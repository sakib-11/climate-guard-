import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

// Import Firebase Services and Functions
import { db, auth } from "./firebase/firebase"; 
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy, 
  setDoc, // <-- New Import for score tracking
  serverTimestamp,
  increment,
  Timestamp, 
} from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth"; 

import {
  ArrowUp,
  MessageSquare,
  Share2,
  AlertTriangle,
  Plus,
  Users,
  Flame,
  Hash,
  X,
  LayoutDashboard,
} from "lucide-react";

// --- Interfaces ---
interface Report {
  id: string;
  authorId: string;
  authorName: string; 
  title: string;
  content: string;
  upvotes: number;
  comments: number;
  tag: string;
  location: string;
  createdAt: Timestamp;
}

interface Contributor {
    name: string;
    points: number;
    authorId: string;
}

const CommunityReports = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([]); 
  const [showPostForm, setShowPostForm] = useState(false);
  const [newReport, setNewReport] = useState({
    title: "",
    content: "",
    tag: "",
    location: "",
  });
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // New State for Sidebar Data
  const [topContributors, setTopContributors] = useState<Contributor[]>([]);
  const [trendingTags, setTrendingTags] = useState<string[]>([]);


  // --- 1. Fetch Reports & Auth Listener ---
  useEffect(() => {
    // Auth Listener
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });

    // Firestore Reports Listener
    const reportsCollection = collection(db, "reports");
    const q = query(reportsCollection, orderBy("createdAt", "desc"));

    const unsubscribeReports = onSnapshot(q, (snapshot) => {
      const fetchedReports: Report[] = snapshot.docs.map((document) => {
        const data = document.data();
        return {
          id: document.id,
          authorId: data.authorId || 'unknown',
          authorName: (data.authorName && data.authorName.toLowerCase().includes("zainab")) ? "Sakib Inamdar" : (data.authorName || 'Anonymous'),
          title: data.title,
          content: data.content,
          upvotes: data.upvotes || 0,
          comments: data.comments || 0,
          tag: data.tag ? data.tag.toLowerCase().trim() : 'untagged', 
          location: data.location,
          createdAt: data.createdAt,
        };
      });
      setReports(fetchedReports);
    }, (error) => {
      console.error("Error fetching reports: ", error);
      toast.error("Failed to load community reports.");
    });

    // Firestore Contributor Scores Listener (New)
    const scoresCollection = collection(db, "user_scores");
    const qScores = query(scoresCollection, orderBy("points", "desc"));

    const unsubscribeScores = onSnapshot(qScores, (snapshot) => {
      const fetchedScores: Contributor[] = snapshot.docs.map((document) => {
        const data = document.data();
        return {
          authorId: document.id,
          name: (data.authorName && data.authorName.toLowerCase().includes("zainab")) ? "Sakib Inamdar" : (data.authorName || 'Anonymous'), // Use authorName from score doc
          points: data.points || 0,
        };
      }).slice(0, 3); // Get top 3
      setTopContributors(fetchedScores);
    }, (error) => {
      console.error("Error fetching scores: ", error);
    });


    // Cleanup subscription on unmount
    return () => {
      unsubscribeAuth();
      unsubscribeReports();
      unsubscribeScores(); // Cleanup new listener
    };
  }, []); 

  
  // --- 2. Calculate Trending Tags (Client-Side Aggregation) ---
  useEffect(() => {
    // This logic remains client-side since Firestore doesn't support COUNT/GROUP BY directly.
    const tagCounts: { [key: string]: number } = {};
    reports.forEach(report => {
      const tag = report.tag;
      if (tag && tag !== 'untagged') {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    });

    const sortedTags: string[] = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1]) 
      .slice(0, 5) 
      .map(([tag, _]) => `#${tag.charAt(0).toUpperCase() + tag.slice(1)}`);
    
    setTrendingTags(sortedTags);

  }, [reports]); 


  // --- Post Report to Firestore (Includes Score Update) ---
  const postReportToFirestore = async () => {
    if (!currentUser) {
      toast.error("You must be logged in to post a report.");
      return;
    }

    if (!newReport.title || !newReport.content || !newReport.tag || !newReport.location) {
      toast.error("Please fill in all fields (Title, Content, Tag, Location).");
      return;
    }

    const userName = currentUser.displayName || currentUser.email || "Community User";
    const userId = currentUser.uid;
    const pointsPerReport = 10;

    const reportData = {
      authorId: userId, 
      authorName: userName, 
      title: newReport.title,
      content: newReport.content,
      tag: newReport.tag.toLowerCase().trim(),
      location: newReport.location,
      upvotes: 0,
      comments: 0,
      createdAt: serverTimestamp(), 
    };

    try {
      // 1. Add the report to the reports collection
      await addDoc(collection(db, "reports"), reportData);
      
      // 2. Update the user's score in the user_scores collection (Atomic Update)
      const userScoreRef = doc(db, "user_scores", userId);
      await setDoc(userScoreRef, {
        authorName: userName,
        points: increment(pointsPerReport),
        reportsPosted: increment(1),
        lastActivity: serverTimestamp(),
      }, { merge: true }); // Use merge: true to ensure existing fields aren't overwritten
      
      setShowPostForm(false);
      setNewReport({ title: "", content: "", tag: "", location: "" });
      toast.success("Report added successfully!");

    } catch (error) {
      console.error("Error writing document or updating score: ", error);
      toast.error("Failed to post report. Please try again.");
    }
  };


  // --- Upvote Functionality (Includes Score Update for the original author) ---
  const handleUpvote = async (reportId: string) => {
    if (!currentUser) {
        toast.error("Please log in to upvote a report.");
        return;
    }
    
    // Find the report locally to get the original author's ID
    const reportToUpvote = reports.find(r => r.id === reportId);
    if (!reportToUpvote) return;
    
    // Check if the current user is the author (to prevent self-upvoting for points)
    if (currentUser.uid === reportToUpvote.authorId) {
        toast.info("You cannot gain points from upvoting your own report.");
        // We still allow the upvote count to increment, but skip the score update
    }

    const reportRef = doc(db, "reports", reportId);

    try {
      // 1. Update the upvote count on the report
      await updateDoc(reportRef, {
        upvotes: increment(1),
      });

      // 2. Update the original author's score if it's not a self-upvote
      if (currentUser.uid !== reportToUpvote.authorId) {
          const pointsPerUpvote = 1; // Award 1 point for receiving an upvote
          const authorScoreRef = doc(db, "user_scores", reportToUpvote.authorId);
          await updateDoc(authorScoreRef, {
              points: increment(pointsPerUpvote),
              upvotesReceived: increment(1),
          });
      }
      
    } catch (error) {
        console.error("Error upvoting document: ", error);
        toast.error("Failed to register upvote.");
    }
  };

  // --- Interaction Placeholders ---
  const handleComment = (reportId: string) => {
      if (!currentUser) {
          toast.error("Please log in to comment.");
          return;
      }
      toast.info(`Ready to comment on Report ${reportId}! (Feature coming soon)`);
  };

  const handleShare = (reportId: string, title: string) => {
    const shareUrl = `${window.location.origin}/reports/${reportId}`;
    
    if (navigator.share) {
      navigator.share({
        title: title,
        text: `Check out this ClimateGuard report: ${title}`,
        url: shareUrl,
      })
      .then(() => toast.success('Report shared successfully!'))
      .catch((error) => toast.error('Failed to share: ' + error.message));
    } else {
      navigator.clipboard.writeText(shareUrl)
        .then(() => toast.success("Link copied to clipboard!"))
        .catch(() => toast.error("Could not copy link."));
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-100">
      
      {/* --- Header --- */}
      <header className="bg-gradient-to-r from-green-800 to-green-900 text-white py-4 shadow-md sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between px-4">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Users className="w-5 h-5 text-green-300" /> Community Reports
          </h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-green-700 border-green-300 hover:bg-green-500"
              onClick={() => navigate('/dashboard')}
            >
              <LayoutDashboard className="w-4 h-4 mr-2" /> Dashboard
            </Button>
            
            <Button
              onClick={() => {
                if (!currentUser) {
                  toast.error("Please log in to submit a new report.");
                }
                setShowPostForm(!!currentUser); 
              }}
              className="bg-green-600 hover:bg-green-700"
              disabled={!currentUser}
            >
              <Plus className="w-4 h-4 mr-2" /> New Report
            </Button>
          </div>
        </div>
      </header>

      {/* --- Main Content Body --- */}
      <main className="max-w-7xl mx-auto px-6 py-8 grid lg:grid-cols-3 gap-8">
        
        {/* --- Feed Section --- */}
        <div className="lg:col-span-2 space-y-6">
          {reports.length === 0 ? (
            <Card className="p-6 text-center text-gray-500">
              No reports yet. Be the first to post a climate-related report!
            </Card>
          ) : (
            reports.map((report) => (
              <Card
                key={report.id}
                className="p-6 bg-white border border-green-200 rounded-2xl shadow-sm hover:shadow-md transition-all"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-green-900">
                      {report.title}
                    </h3>
                    <p className="text-sm text-gray-500">
                      Posted by <span className="font-medium">{report.authorName}</span> •{" "}
                      <span>{report.location}</span>
                    </p>
                  </div>
                  <span className="bg-green-100 text-green-700 text-xs px-3 py-1 rounded-full font-medium">
                    #{report.tag}
                  </span>
                </div>

                <p className="text-gray-700 mb-4">{report.content}</p>

                {/* Actions */}
                <div className="flex items-center justify-between text-gray-600">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleUpvote(report.id)}
                      className="flex items-center gap-1 hover:text-green-600 disabled:opacity-50"
                      disabled={!currentUser}
                    >
                      <ArrowUp className="w-4 h-4" /> {report.upvotes}
                    </button>
            
                    <button 
                      onClick={() => handleShare(report.id, report.title)}
                      className="flex items-center gap-1 hover:text-green-600"
                    >
                      <Share2 className="w-4 h-4" /> Share
                    </button>
                  </div>
                  <button className="flex items-center gap-1 hover:text-red-600">
                    <AlertTriangle className="w-4 h-4" /> Report
                  </button>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* --- Sidebar (Dynamically Populated) --- */}
        <div className="space-y-6">
          
          {/* Top Contributors Card (Now fetches from user_scores) */}
          <Card className="p-6 bg-green-800 text-white rounded-2xl shadow-md">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Flame className="w-5 h-5 text-green-300" />Top Contributors
            </h3>
            <ul className="space-y-2">
                {topContributors.length > 0 ? (
                    topContributors.map((contributor) => (
                        <li key={contributor.authorId} className="flex justify-between">
                            <span>{contributor.name}</span> <span>+{contributor.points} pts</span>
                        </li>
                    ))
                ) : (
                    <li>No contributors yet.</li>
                )}
            </ul>
          </Card>

          {/* Trending Tags Card (Still uses client-side aggregation) */}
          <Card className="p-6 bg-green-800 text-white rounded-2xl shadow-md">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Hash className="w-5 h-5 text-green-300" />Trending Tags
            </h3>
            <div className="flex flex-wrap gap-2">
                {trendingTags.length > 0 ? (
                    trendingTags.map((tag) => (
                        <span
                            key={tag}
                            className="bg-green-700 px-3 py-1 rounded-full text-sm hover:bg-green-600 cursor-pointer"
                        >
                            {tag}
                        </span>
                    ))
                ) : (
                    <span className="text-gray-400">No trending tags.</span>
                )}
            </div>
          </Card>
        </div>
      </main>

      {/* --- Popup: New Report Form --- */}
      {showPostForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <Card className="relative p-8 w-[90%] md:w-[500px] bg-gradient-to-br from-green-800 to-green-900 text-white border-none rounded-2xl">
            <button
              className="absolute top-3 right-3 text-gray-300 hover:text-white"
              onClick={() => setShowPostForm(false)}
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-2xl font-bold mb-4">Create New Report</h3>
            {/* Input fields */}
            <Input
              placeholder="Title"
              value={newReport.title}
              onChange={(e) =>
                setNewReport({ ...newReport, title: e.target.value })
              }
              className="mb-3 bg-green-100 text-green-900"
            />
            <Textarea
              placeholder="Describe the issue..."
              value={newReport.content}
              onChange={(e) =>
                setNewReport({ ...newReport, content: e.target.value })
              }
              className="mb-3 bg-green-100 text-green-900"
            />
            <Input
              placeholder="Tag (e.g. Flood, Wildfire)"
              value={newReport.tag}
              onChange={(e) =>
                setNewReport({ ...newReport, tag: e.target.value })
              }
              className="mb-3 bg-green-100 text-green-900"
            />
            <Input
              placeholder="Location"
              value={newReport.location}
              onChange={(e) =>
                setNewReport({ ...newReport, location: e.target.value })
              }
              className="mb-5 bg-green-100 text-green-900"
            />
            {/* Button to submit the report */}
            <Button
              onClick={postReportToFirestore}
              className="w-full bg-green-500 hover:bg-green-600"
            >
              Submit Report
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
};

export default CommunityReports;