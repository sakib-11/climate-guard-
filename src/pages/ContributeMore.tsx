import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
// NOTE: Ensure the path to your useAuth hook and firebase config file is correct:
import { useAuth } from "@/hooks/useAuth"; 
import { db, storage } from "./firebase/firebase"; 

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";

import {
  Cloud, Droplet, Wind, Thermometer, Leaf, Upload,
  MapPin, LogOut, Award, X, LayoutDashboard, MessageSquare,
} from "lucide-react";

import { 
    collection, 
    addDoc, 
    serverTimestamp, 
    setDoc, 
    doc, 
    onSnapshot,
    increment, 
    query,
    where,
    writeBatch, // <--- CORRECT IMPORT FOR BATCH
    getDocs, 
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";


const ContributeMore = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();

  const [temperature, setTemperature] = useState("");
  const [weather, setWeather] = useState("");
  const [rainfall, setRainfall] = useState(0);
  const [windSpeed, setWindSpeed] = useState("");
  const [airQuality, setAirQuality] = useState("");
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  
  const [userPoints, setUserPoints] = useState(0); 
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [popup, setPopup] = useState<string | null>(null);
  const [unclaimedReportsCount, setUnclaimedReportsCount] = useState(0);

  const POINTS_ON_APPROVAL = 50;

  // --- Auth Redirect ---
  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  // --- Fetch User Points & Unclaimed Count on Load ---
  useEffect(() => {
    if (user) {
      const userId = user.uid;
      const userScoreRef = doc(db, "user_scores", userId);
      
      // Listener for User Points
      const unsubscribePoints = onSnapshot(userScoreRef, (docSnap) => {
        if (docSnap.exists()) {
          setUserPoints(docSnap.data().points || 0);
        } else {
          setUserPoints(0);
        }
      }, (error) => {
        console.error("Error fetching user points:", error);
      });

      // Listener for Approved, Unclaimed Reports
      const q = query(
          collection(db, "localWeather"),
          where("authorId", "==", userId),
          where("pending", "==", false),
          where("claimed", "==", false), // Check if claimed is explicitly false
      );

      const unsubscribeUnclaimed = onSnapshot(q, (snapshot) => {
        setUnclaimedReportsCount(snapshot.size);
      }, (error) => {
        console.error("Error fetching unclaimed reports:", error);
      });


      return () => {
          unsubscribePoints();
          unsubscribeUnclaimed();
      }
    }
  }, [user]);
  
  // --- SUBMIT LOGIC: Saves Data only, PENDING: TRUE ---
  const handleSubmit = async () => {
    if (!user) {
      toast.error("Authentication required to submit data.");
      return;
    }

    if (!temperature || !weather || !airQuality || !windSpeed) {
      toast.error("Please fill in Temperature, Weather Type, Wind Speed, and Air Quality!");
      return;
    }

    setIsSubmitting(true);
    let photoURL = null;

    try {
      // 1. Upload Photo to Firebase Storage (if photo exists)
      if (photo) {
        const storageRef = ref(storage, `localWeatherPhotos/${user.uid}/${Date.now()}_${photo.name}`);
        await uploadBytes(storageRef, photo);
        photoURL = await getDownloadURL(storageRef);
      }

      const userName = user.displayName || user.email || 'Community Contributor';
      
      // 2. Prepare Data for Firestore
      const reportData = {
        authorId: user.uid,
        authorName: userName,
        temperature: parseFloat(temperature),
        weather: weather,
        rainfall: rainfall,
        windSpeed: parseFloat(windSpeed),
        airQuality: airQuality,
        notes: notes,
        photoURL: photoURL,
        location: 'User Location (Placeholder)',
        submittedAt: serverTimestamp(),
        // Initial state: Pending and Unclaimed
        pending: true, 
        claimed: false, 
      };

      // 3. Add Document to 'localWeather' collection
      await addDoc(collection(db, "localWeather"), reportData);
      
      // 4. Success and Cleanup
      toast.success("✅ Report submitted! Waiting for admin approval.");
      
      // Reset form fields
      setTemperature("");
      setWeather("");
      setRainfall(0);
      setWindSpeed("");
      setAirQuality("");
      setNotes("");
      setPhoto(null);
      
    } catch (error) {
      console.error("Submission failed:", error);
      toast.error("❌ Failed to submit data. Please check your connection.");
    } finally {
      setIsSubmitting(false);
    }
  };


  // --- CLAIM POINTS LOGIC (User Action) ---
  const handleClaimPoints = async () => {
    if (!user) {
      toast.error("Authentication required.");
      return;
    }
    if (unclaimedReportsCount === 0) {
        toast.info("No reports are currently approved and pending claim.");
        return;
    }

    const userId = user.uid;
    const userName = user.displayName || user.email || 'Community Contributor';

    try {
        // Find ALL approved reports that haven't been claimed yet
        const q = query(
            collection(db, "localWeather"),
            where("authorId", "==", userId),
            where("pending", "==", false),
            where("claimed", "==", false)
        );
        const snapshot = await getDocs(q);
        const reportsToClaim = snapshot.docs;
        
        if (reportsToClaim.length === 0) {
            toast.info("No new reports to claim points for. Check back later!");
            return;
        }

        const totalPoints = reportsToClaim.length * POINTS_ON_APPROVAL;

        // 1. Atomically Update the User's Score
        const userScoreRef = doc(db, "user_scores", userId);
        await setDoc(userScoreRef, {
            authorName: userName,
            points: increment(totalPoints),
            reportsPosted: increment(reportsToClaim.length),
            lastActivity: serverTimestamp(),
        }, { merge: true });

        // 2. Mark all claimed reports as 'claimed: true' to prevent double claims
        // FIX APPLIED: Use modular syntax writeBatch(db)
        const batch = writeBatch(db); 
        reportsToClaim.forEach(reportDoc => {
            batch.update(reportDoc.ref, { claimed: true });
        });
        await batch.commit();

        toast.success(`🎉 Claim Successful! You earned +${totalPoints} points for ${reportsToClaim.length} approved reports.`);

    } catch (error) {
        console.error("Failed to claim points:", error);
        toast.error("Failed to process point claim.");
    }
  };


  const PopupCard = ({ title, content }: { title: string, content: string }) => (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <Card className="relative p-8 w-[90%] md:w-[400px] bg-gradient-to-br from-green-800 to-green-900 text-white shadow-xl border-none rounded-2xl">
        <button className="absolute top-3 right-3" onClick={() => setPopup(null)}>
          <X className="w-5 h-5 text-gray-200 hover:text-white" />
        </button>
        <h3 className="text-2xl font-bold mb-4">{title}</h3>
        <p className="text-gray-100">{content}</p>
      </Card>
    </div>
  );

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-900 to-green-800">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-300 mx-auto mb-4" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100">
      
      {/* --- Header --- */}
      <header className="bg-gradient-to-r from-green-800 to-green-900 border-b border-green-700 sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Cloud className="w-6 h-6 text-green-300" />
            <h1 className="text-xl font-bold text-white">Contribute Climate Data</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="text-green-700 border-green-300 hover:bg-green-500"
              onClick={() => navigate('/dashboard')}
            >
              <LayoutDashboard className="w-4 h-4 mr-2" /> Dashboard
            </Button>
            <Button variant="outline" size="sm" className="bg-red-700 text-white border-red-400 hover:bg-red-500" onClick={signOut}>
              <LogOut className="w-4 h-4 mr-2" /> Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* --- Body --- */}
      <div className="max-w-5xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* --- Form Section --- */}
        <Card className="lg:col-span-2 p-8 bg-gradient-to-br from-green-800 to-green-900 border-none text-white rounded-2xl shadow-md space-y-6">
          <h2 className="text-2xl font-semibold mb-2 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-green-300" /> Local Weather Report
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm">Temperature (°C)</label>
              <Input
                placeholder="e.g., 28"
                type="number"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                className="bg-green-100 text-green-900"
              />
            </div>

            <div>
              <label className="text-sm">Weather Type</label>
              <Input
                placeholder="e.g., Sunny, Cloudy, Rainy"
                value={weather}
                onChange={(e) => setWeather(e.target.value)}
                className="bg-green-100 text-green-900"
              />
            </div>

            <div>
              <label className="text-sm flex items-center gap-2">
                <Droplet className="w-4 h-4 text-blue-300" /> Rainfall (mm)
              </label>
              <Slider
                defaultValue={[rainfall]}
                max={100}
                step={5}
                onValueChange={(v) => setRainfall(v[0])}
              />
              <p className="text-xs text-gray-300 mt-1">{rainfall} mm</p>
            </div>

            <div>
              <label className="text-sm flex items-center gap-2">
                <Wind className="w-4 h-4 text-cyan-300" /> Wind Speed (km/h)</label>
              <Input
                placeholder="e.g., 15"
                type="number"
                value={windSpeed}
                onChange={(e) => setWindSpeed(e.target.value)}
                className="bg-green-100 text-green-900"
              />
            </div>

            <div>
              <label className="text-sm flex items-center gap-2">
                <Leaf className="w-4 h-4 text-lime-300" /> Air Quality
              </label>
              <Input
                placeholder="e.g., Good, Moderate, Poor"
                value={airQuality}
                onChange={(e) => setAirQuality(e.target.value)}
                className="bg-green-100 text-green-900"
              />
            </div>

            <div>
              <label className="text-sm flex items-center gap-2">
                <Upload className="w-4 h-4 text-green-300" /> Upload Photo (optional)
              </label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setPhoto(e.target.files?.[0] || null)}
                className="bg-green-100 text-green-900"
              />
              {photo && <p className="text-xs mt-1 text-green-200">📸 {photo.name}</p>}
            </div>
          </div>

          <div>
            <label className="text-sm">Additional Notes</label>
            <Textarea
              placeholder="e.g., Noticed strong winds or minor flooding nearby..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-green-100 text-green-900"
            />
          </div>

          <div className="text-center">
            <Button 
              onClick={handleSubmit} 
              className="bg-green-500 hover:bg-green-600 text-black font-semibold px-8 py-6 rounded-xl mt-4"
              disabled={isSubmitting}
            >
              <Upload className="mr-2 h-4 w-4" /> 
              {isSubmitting ? 'Submitting...' : 'Submit Data (Pending Approval)'}
            </Button>
          </div>
        </Card>

        {/* --- Sidebar --- */}
        <div className="space-y-6">
          <Card
            className="p-6 bg-gradient-to-br from-green-700 to-green-800 text-white rounded-2xl hover:scale-[1.02] transition-transform cursor-pointer"
            onClick={() => setPopup("points")}
          >
            <div className="flex items-center gap-3 mb-2">
              <Award className="w-5 h-5 text-green-300" />
              <h3 className="font-semibold">Your Points</h3>
            </div>
            <p className="text-2xl font-bold">{userPoints}</p> 
            <p className="text-sm opacity-80">Reports must be approved to earn points.</p>
          </Card>
          
          {/* New Button for Claiming Points */}
          <Button 
            onClick={handleClaimPoints} 
            className={`w-full font-semibold py-3 rounded-xl shadow-lg relative ${
                unclaimedReportsCount > 0 
                    ? 'bg-yellow-400 hover:bg-yellow-500 text-black' 
                    : 'bg-gray-500 text-gray-300 cursor-not-allowed'
            }`}
            disabled={unclaimedReportsCount === 0}
          >
            <Award className="mr-2 h-4 w-4" /> 
            CLAIM APPROVED POINTS
            {unclaimedReportsCount > 0 && (
                <span className="absolute top-[-10px] right-[-10px] bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                    {unclaimedReportsCount}
                </span>
            )}
          </Button>

          <Card className="p-6 bg-gradient-to-br from-green-800 to-green-900 text-white rounded-2xl shadow-md">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Thermometer className="w-4 h-4 text-orange-300" /> Why Contribute?
            </h3>
            <ul className="list-disc list-inside text-gray-200 text-sm space-y-2">
              <li>Improve regional climate accuracy</li>
              <li>Help early-warning systems detect hazards</li>
              <li>Earn contribution points and badges</li>
              <li>Join a growing climate community 🌍</li>
            </ul>
          </Card>
        </div>
      </div>

      {/* --- Popup --- */}
      {popup === "points" && (
        <PopupCard
          title="Your Points"
          content={`You gain ${POINTS_ON_APPROVAL} points for each approved submission. An administrator must manually change your report's status to approved before you can claim the points using the 'CLAIM APPROVED POINTS' button.`}
        />
      )}
    </div>
  );
};

export default ContributeMore;