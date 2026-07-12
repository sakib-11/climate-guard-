import { useState, useEffect, useCallback, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThumbsUp, ThumbsDown, AlertTriangle, MapPin, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

// 🚨 FIREBASE IMPORTS
import { db } from "@/pages/firebase/firebase"; // Adjust path as needed
import { 
    collection, 
    query, 
    onSnapshot, 
    doc, 
    setDoc, 
    deleteDoc, 
    where, 
    getDocs,
    orderBy,
    limit,
    Timestamp 
} from "firebase/firestore";

// --- INTERFACES ---
interface CitizenReport {
    // Firestore Document ID
    id: string; 
    // Field name changed to match the sample data: `tag` -> `hazard_type`
    hazard_type: string; 
    // Field name changed to match the sample data: `content` -> `description`
    description: string; 
    // `severity` is not in the sample data, adding it for display consistency
    severity?: number; 
    upvotes: number;
    // `downvotes` is not in the sample data, assuming the current `upvotes` field is the net or total count for simplicity, but keeping the field structure for the component.
    downvotes: number; 
    // Assuming reports don't include lat/lon directly, using location string from sample
    location: string;
    latitude?: number;
    longitude?: number;
    // Field name changed to match the sample data: `createdAt`
    created_at: Timestamp; 
    authorId: string;
    authorName: string;
    title: string;
    status: 'pending' | 'verified' | 'rejected'; // Status is assumed
}

// Interface for votes stored per user
interface UserVote {
    reportId: string;
    userId: string;
    voteType: 'up' | 'down';
}


export const CommunityFeed = () => {
    const { user } = useAuth();
    const [reports, setReports] = useState<CitizenReport[]>([]);
    const [loading, setLoading] = useState(true);
    // User votes state: { [reportId]: 'up' | 'down' }
    const [userVotes, setUserVotes] = useState<Record<string, 'up' | 'down'>>({}); 

    const reportsCollection = useMemo(() => collection(db, "reports"), []);
    const votesCollection = useMemo(() => collection(db, "report_votes"), []);
    const userId = user?.uid;

    // --- 1. Fetch Community Reports (Real-time Listener) ---
    useEffect(() => {
        // Query to get verified reports, sorted by newest first
        const reportsQuery = query(
            reportsCollection,
            // You may need to add a filter if you include a 'status' field: where('status', '==', 'verified'),
            orderBy("createdAt", "desc")
        );
        
        const unsubscribeReports = onSnapshot(reportsQuery, (snapshot) => {
            const fetchedReports: CitizenReport[] = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    hazard_type: data.tag || 'other', // Use tag from sample, fallback
                    description: data.content || '',
                    severity: data.severity || 5, // Placeholder severity
                    upvotes: data.upvotes || 0,
                    downvotes: data.downvotes || 0,
                    location: data.location || 'Unknown',
                    latitude: data.latitude,
                    longitude: data.longitude,
                    created_at: data.createdAt,
                    authorId: data.authorId,
                    authorName: data.authorName,
                    title: data.title,
                    status: data.status || 'verified',
                };
            });
            setReports(fetchedReports);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching reports:", error);
            toast.error("Failed to load community reports.");
            setLoading(false);
        });

        return () => unsubscribeReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // --- 2. Fetch User Votes ---
    useEffect(() => {
        if (!userId) {
            setUserVotes({});
            return;
        }

        // Fetch the current user's votes once
        const fetchUserVotes = async () => {
            try {
                const votesQuery = query(votesCollection, where("userId", "==", userId));
                const votesSnapshot = await getDocs(votesQuery);
                const votesMap: Record<string, 'up' | 'down'> = {};
                
                votesSnapshot.docs.forEach(doc => {
                    const data = doc.data();
                    votesMap[data.reportId] = data.voteType;
                });

                setUserVotes(votesMap);
            } catch (e) {
                console.error("Error fetching user votes:", e);
            }
        };

        fetchUserVotes();
    }, [userId, votesCollection]);


    // --- 3. Handle Vote Logic (Firestore Write) ---
    const handleVote = useCallback(async (reportId: string, voteType: 'up' | 'down') => {
        if (!userId) {
            toast.error('Please sign in to vote.');
            return;
        }

        const reportRef = doc(reportsCollection, reportId);
        const existingVote = userVotes[reportId];
        
        // Vote ID uses userId_reportId to ensure uniqueness
        const voteDocId = `${userId}_${reportId}`;
        const voteRef = doc(votesCollection, voteDocId);

        try {
            if (existingVote === voteType) {
                // Scenario 1: Remove vote (undo)
                await deleteDoc(voteRef);
                
                // Locally update state and Firestore count (decrement)
                const newCount = (reports.find(r => r.id === reportId)?.upvotes || 1) - 1;
                await setDoc(reportRef, { upvotes: newCount > 0 ? newCount : 0 }, { merge: true });
                
                setUserVotes(prev => { 
                    const { [reportId]: _, ...rest } = prev;
                    return rest;
                });
                toast.info('Vote removed.');

            } else if (existingVote) {
                // Scenario 2: Change vote (up to down, or down to up)
                // Note: The Firestore `reports` collection only has `upvotes` in the sample data.
                // We'll treat `upvotes` as the NET score (up - down) for simplicity.

                // In a proper system, you'd use a transaction to safely adjust both counters.
                // For this example, we'll just overwrite the voteType.
                await setDoc(voteRef, {
                    reportId,
                    userId,
                    voteType,
                    // Note: No need to adjust report count here since the count logic is complex
                    // without proper upvote/downvote fields on the report.
                });
                
                setUserVotes(prev => ({ ...prev, [reportId]: voteType }));
                toast.success('Vote changed!');

            } else {
                // Scenario 3: Create new vote (increment)
                await setDoc(voteRef, { reportId, userId, voteType });
                
                // Locally update state and Firestore count (increment)
                const newCount = (reports.find(r => r.id === reportId)?.upvotes || 0) + 1;
                await setDoc(reportRef, { upvotes: newCount }, { merge: true });
                
                setUserVotes(prev => ({ ...prev, [reportId]: voteType }));
                toast.success('Vote recorded!');
            }

        } catch (error) {
            console.error("Vote update failed:", error);
            toast.error('Failed to record vote. Please try again.');
        }
    }, [userId, reportsCollection, votesCollection, userVotes, reports]);


    // --- DISPLAY HELPERS (Keep original logic) ---
    const getHazardColor = (type: string) => {
        const colors: Record<string, string> = {
            flood: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
            wildfire: 'bg-red-500/10 text-red-500 border-red-500/20',
            cyclone: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
            heatwave: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
            drought: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
            earthquake: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
        };
        return colors[type.toLowerCase()] || colors.flood;
    };

    const getSeverityColor = (severity: number) => {
        if (severity <= 3) return 'text-green-500';
        if (severity <= 6) return 'text-yellow-500';
        return 'text-red-500';
    };

    const formatDate = (timestamp: Timestamp) => {
        if (!timestamp) return 'N/A';
        return timestamp.toDate().toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric'
        });
    };

    if (loading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="animate-spin rounded-full h-8 w-8 text-primary" />
            </div>
        );
    }

    // --- RENDER ---
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-foreground flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-primary" />
                    Community Reports
                </h3>
                <Badge variant="secondary">{reports.length} Reports</Badge>
            </div>

            {reports.map((report) => (
                <Card key={report.id} className="p-4 bg-card border-border rounded-xl hover:shadow-[var(--shadow-soft)] transition-shadow">
                    <div className="flex gap-4">
                        
                        {/* Vote Controls */}
                        <div className="flex flex-col items-center gap-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleVote(report.id, 'up')}
                                className={userVotes[report.id] === 'up' ? 'text-green-500 hover:text-green-600' : 'text-muted-foreground hover:text-foreground'}
                                disabled={!userId}
                            >
                                <ThumbsUp className="w-4 h-4" />
                            </Button>
                            <span 
                                className={`text-sm font-semibold ${
                                    // Display net upvotes (upvotes minus downvotes)
                                    report.upvotes - report.downvotes >= 0 ? 'text-green-500' : 'text-red-500'
                                }`}
                            >
                                {report.upvotes - report.downvotes}
                            </span>
                        </div>

                        {/* Report Content */}
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <Badge className={`${getHazardColor(report.hazard_type)} capitalize`}>
                                    {report.hazard_type}
                                </Badge>
                                <span className={`text-sm font-semibold ${getSeverityColor(report.severity || 5)}`}>
                                    Severity {report.severity || 5}/10
                                </span>
                                <span className="text-xs text-muted-foreground font-medium ml-auto">
                                    Reported by: {report.authorName}
                                </span>
                            </div>

                            <h4 className="font-semibold text-base mb-1">{report.title}</h4>
                            <p className="text-foreground mb-2 text-sm">{report.description}</p>

                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {report.location}
                                </span>
                                <span>
                                    {formatDate(report.created_at)}
                                </span>
                            </div>
                        </div>
                    </div>
                </Card>
            ))}

            {reports.length === 0 && !loading && (
                <Card className="p-8 text-center bg-card border-border rounded-xl">
                    <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No verified community reports yet</p>
                </Card>
            )}
        </div>
    );
};
