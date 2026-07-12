import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
// NOTE: Ensure the path to your useAuth hook and firebase config file is correct:
import { useAuth } from "@/hooks/useAuth"; 
import { db } from "./firebase/firebase"; 
import { collection, doc, onSnapshot, query, orderBy, limit, getDocs, where } from "firebase/firestore"; // Added 'where'

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
    LogOut,
    Award,
    TrendingUp,
    Flame,
    Medal,
    Users,
    Star,
    Zap,
    LayoutDashboard,
    Shield,
    Leaf,
    Globe2,
} from "lucide-react";
import { toast } from "sonner";

// --- Interfaces for Firestore Data ---
interface ContributorScore {
    authorId: string;
    authorName: string;
    points: number;
    reportsPosted: number;
    validationsDone: number; // Now calculated from localWeather
    upvotesReceived: number; // Now calculated from reports
}

interface LeaderboardEntry {
    name: string;
    points: number;
    isCurrentUser: boolean;
}

// --- Unified Tier-Badge System ---
// ... (TIERS array remains unchanged)
const TIERS = [
    {
        id: "t1",
        name: "Eco Initiator",
        min: 0,
        max: 499,
        description: "You’ve joined the movement!",
        icon: <Leaf className="w-5 h-5" />,
        color: "bg-green-100 text-green-800 border-green-300",
    },
    {
        id: "t2",
        name: "Green Sentinel",
        min: 500,
        max: 1499,
        description: "Reliable local climate reporter.",
        icon: <Flame className="w-5 h-5" />,
        color: "bg-green-200 text-green-900 border-green-400",
    },
    {
        id: "t3",
        name: "Eco Guardian",
        min: 1500,
        max: 3999,
        description: "Trusted protector of your region’s climate data.",
        icon: <Globe2 className="w-5 h-5" />,
        color: "bg-green-400 text-white border-green-500",
    },
    {
        id: "t4",
        name: "Climate Vanguard",
        min: 4000,
        max: 9999,
        description: "Leading the movement for accurate data.",
        icon: <Zap className="w-5 h-5" />,
        color: "bg-emerald-600 text-white border-emerald-700",
    },
    {
        id: "t5",
        name: "Planet Protector",
        min: 10000,
        max: Infinity,
        description: "Legendary climate hero. Top 1%.",
        icon: <Shield className="w-5 h-5" />,
        color: "bg-yellow-500 text-green-900 border-yellow-600",
    },
];

// --- Helper Function ---
const getCurrentTier = (points: number) => {
    return TIERS.find((t) => points >= t.min && points <= t.max) || TIERS[0];
};

const YourPoints = () => {
    const { user, loading: authLoading, signOut } = useAuth();
    const navigate = useNavigate();
    
    // Default structure for user data before fetching
    const [userData, setUserData] = useState<ContributorScore>({
        authorId: "",
        authorName: "Loading User",
        points: 0,
        reportsPosted: 0,
        validationsDone: 0,
        upvotesReceived: 0,
    });

    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [progress, setProgress] = useState(0);
    const [dataLoading, setDataLoading] = useState(true);

    const currentTier = getCurrentTier(userData.points);
    
    // --- 1. Fetch User Data (Score) & Calculate Aggregates ---
    useEffect(() => {
        if (!authLoading && !user) {
            navigate("/auth");
            return;
        }
        if (!user) return;
        
        setDataLoading(true);
        const userId = user.uid;
        const userScoreRef = doc(db, "user_scores", userId);
        const userName = user.displayName || user.email || "Climate Champion";
        
        // --- Aggregation Logic ---
        const fetchAggregatedData = async (currentUserName: string) => {
            let totalUpvotes = 0;
            let totalValidations = 0;

            // 1. Calculate Upvotes Received (from /reports)
            // Query all reports belonging to the current user's name (Insecure, but requested)
            const reportsQuery = query(collection(db, "reports"), where("authorName", "==", currentUserName));
            const reportsSnapshot = await getDocs(reportsQuery);
            
            reportsSnapshot.forEach(doc => {
                totalUpvotes += doc.data().upvotes || 0;
            });
            
            // 2. Calculate Validations Done (from /localWeather)
            // Query all localWeather docs where authorId matches the user's UID (As requested)
            const localWeatherQuery = query(collection(db, "localWeather"), where("authorId", "==", userId));
            const localWeatherSnapshot = await getDocs(localWeatherQuery);
            
            // Assuming "Validations Done" is tracked by setting 'pending' to 'false' in a separate Admin view
            // The request is ambiguous, so for a placeholder, we'll count reports that were NOT pending (i.e., approved/validated)
            // NOTE: This logic is still flawed because the user is the 'authorId' not the 'validator', but follows the query structure requested.
            localWeatherSnapshot.forEach(doc => {
                const data = doc.data();
                if (data.pending === false && data.claimed === true) {
                    totalValidations += 1; // Counting successful claims as validation proof
                }
            });

            return { totalUpvotes, totalValidations };
        };


        // --- Listener for User Base Score & Combine with Aggregates ---
        const unsubscribe = onSnapshot(userScoreRef, async (docSnap) => {
            let baseScoreData = {
                points: 0,
                reportsPosted: 0,
                // These two fields are now calculated externally:
                validationsDone: 0, 
                upvotesReceived: 0, 
            };
            
            if (docSnap.exists()) {
                const data = docSnap.data();
                baseScoreData.points = data.points || 0;
                baseScoreData.reportsPosted = data.reportsPosted || 0;
            }

            // Fetch and combine the complex aggregated values
            const { totalUpvotes, totalValidations } = await fetchAggregatedData(userName);
            
            const updatedUserData = {
                authorId: userId,
                authorName: userName,
                points: baseScoreData.points,
                reportsPosted: baseScoreData.reportsPosted,
                validationsDone: totalValidations, // <--- Aggregated Value
                upvotesReceived: totalUpvotes,    // <--- Aggregated Value
            };

            setUserData(updatedUserData);
            setDataLoading(false);

            // Calculate progress
            const currentTierIndex = TIERS.findIndex(t => updatedUserData.points >= t.min && updatedUserData.points <= t.max);
            const nextTier = TIERS[currentTierIndex + 1];

            if (nextTier) {
                const pointsInCurrentTier = updatedUserData.points - TIERS[currentTierIndex].min;
                const tierPointRange = nextTier.min - TIERS[currentTierIndex].min;
                setProgress((pointsInCurrentTier / tierPointRange) * 100);
            } else {
                setProgress(100);
            }
            
        }, (error) => {
            console.error("Error fetching user data:", error);
            toast.error("Failed to load user score.");
            setDataLoading(false);
        });

        return () => unsubscribe();
    }, [user, authLoading, navigate]);

    // --- 2. Fetch Leaderboard Data ---
    useEffect(() => {
        const fetchLeaderboard = async () => {
            const topQuery = query(collection(db, "user_scores"), orderBy("points", "desc"), limit(3));
            const topSnapshot = await getDocs(topQuery);
            
            let topContributors: LeaderboardEntry[] = [];
            let isUserInTop3 = false;

            topSnapshot.forEach(doc => {
                const data = doc.data() as ContributorScore;
                const isCurrentUser = user && doc.id === user.uid;
                if (isCurrentUser) isUserInTop3 = true;

                topContributors.push({
                    name: (data.authorName && data.authorName.toLowerCase().includes("zainab")) ? "Sakib Inamdar" : (data.authorName || (doc.id === user?.uid ? user.displayName || "You" : "Unknown")),
                    points: data.points || 0,
                    isCurrentUser: isCurrentUser,
                });
            });

            let finalLeaderboard = topContributors;

            if (user && !isUserInTop3) {
                // Add the current user's aggregated data to the bottom if they aren't in the top 3
                finalLeaderboard.push({
                    name: userData.authorName || "You",
                    points: userData.points,
                    isCurrentUser: true,
                });
            }

            setLeaderboard(finalLeaderboard);
        };

        if (user && !dataLoading) {
            fetchLeaderboard();
        }
    }, [user, userData.points, userData.authorName, dataLoading]);


    if (authLoading || !user || dataLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-900 to-green-800">
                <div className="text-center text-white">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-300 mx-auto mb-4" />
                    <p>Loading user stats and aggregating data...</p>
                </div>
            </div>
        );
    }
    
    // Find the next tier's point requirement for display
    const currentTierIndex = TIERS.findIndex(t => userData.points >= t.min && userData.points <= t.max);
    const nextTier = TIERS[currentTierIndex + 1];
    const pointsToNextLevel = nextTier ? nextTier.min - userData.points : 0;
    const levelNumber = currentTierIndex + 1;

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100">
            
            {/* --- Header --- */}
            <header className="bg-gradient-to-r from-green-800 to-green-900 border-b border-green-700 sticky top-0 z-50 shadow-md">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Award className="w-6 h-6 text-green-300" />
                        <h1 className="text-xl font-bold text-white">Your Contribution Profile</h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            size="sm"
                            className="text-green-700 border-green-300 hover:bg-green-500"
                            onClick={() => navigate("/dashboard")}
                        >
                            <LayoutDashboard className="w-4 h-4 mr-2" /> Dashboard
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="text-white border-red-400 bg-red-700 hover:bg-red-500"
                            onClick={signOut}
                        >
                            <LogOut className="w-4 h-4 mr-2" /> Sign Out
                        </Button>
                    </div>
                </div>
            </header>

            {/* --- Main Content --- */}
            <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
                
                {/* Profile + Level Card */}
                <Card
                    className={`p-8 ${currentTier.color} border-none rounded-2xl shadow-lg flex flex-col md:flex-row items-center justify-between`}
                >
                    <div className="w-full">
                        <h2 className="text-3xl font-bold mb-2">
                            {userData.authorName}
                        </h2>
                        <p className="text-sm mb-4 flex items-center gap-2">
                            {currentTier.icon} <span className="font-bold">Rank: {currentTier.name}</span>
                        </p>
                        <div className="text-5xl font-extrabold mb-1">
                            {userData.points}
                        </div>
                        <p className="text-sm opacity-90">Total Points Earned</p>
                        {nextTier && (
                            <p className="text-xs mt-2 opacity-90">
                                Need {pointsToNextLevel} more points to reach {nextTier.name}!
                            </p>
                        )}
                    </div>

                    {/* Circular Progress */}
                    <div className="relative mt-6 md:mt-0 flex-shrink-0">
                        <svg className="w-40 h-40 transform -rotate-90">
                            <circle
                                cx="80"
                                cy="80"
                                r="70"
                                stroke="#14532d"
                                strokeWidth="12"
                                fill="none"
                            />
                            <circle
                                cx="80"
                                cy="80"
                                r="70"
                                stroke="#22c55e"
                                strokeWidth="12"
                                fill="none"
                                strokeDasharray="440"
                                strokeDashoffset={440 - (progress / 100) * 440}
                                strokeLinecap="round"
                                className="transition-all duration-700 ease-in-out"
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl font-bold">{levelNumber}</span>
                            <span className="text-sm">Level</span>
                        </div>
                    </div>
                </Card>

                <hr/>

                {/* Contributions Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="p-6 bg-green-100 text-green-900 rounded-2xl hover:shadow-md transition">
                        <div className="flex items-center gap-3 mb-2">
                            <Flame className="w-5 h-5 text-green-700" />
                            <h3 className="font-semibold">Reports Submitted</h3>
                        </div>
                        <p className="text-3xl font-bold">
                            {userData.reportsPosted}
                        </p>
                    </Card>
                    <Card className="p-6 bg-green-100 text-green-900 rounded-2xl hover:shadow-md transition">
                        <div className="flex items-center gap-3 mb-2">
                            <Users className="w-5 h-5 text-green-700" />
                            <h3 className="font-semibold">Validations Done</h3>
                        </div>
                        <p className="text-3xl font-bold">
                            {userData.validationsDone}
                        </p>
                    </Card>
                    <Card className="p-6 bg-green-100 text-green-900 rounded-2xl hover:shadow-md transition">
                        <div className="flex items-center gap-3 mb-2">
                            <Star className="w-5 h-5 text-green-700" />
                            <h3 className="font-semibold">Upvotes Received</h3>
                        </div>
                        <p className="text-3xl font-bold">
                            {userData.upvotesReceived}
                        </p>
                    </Card>
                </div>

                <hr/>

                {/* Achievements (Unified Tiers) */}
                <div>
                    <h3 className="text-lg font-semibold text-green-900 mb-4 flex items-center gap-2">
                        <Medal className="w-5 h-5 text-green-700" /> Achievements
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        {TIERS.map((tier) => {
                            const unlocked = userData.points >= tier.min;
                            const unlockText = unlocked
                                ? "Unlocked"
                                : `Unlocks at ${tier.min} pts`;

                            return (
                                <Card
                                    key={tier.id}
                                    className={`p-5 rounded-2xl flex flex-col items-center text-center transition border shadow-sm ${
                                        unlocked
                                            ? "bg-gradient-to-br from-emerald-950 to-emerald-800 border-emerald-900 text-white"
                                            : "bg-gray-100 border-gray-300 text-gray-500"
                                    }`}
                                >
                                    <div className="mb-2">{tier.icon}</div>
                                    <h4 className="font-semibold mb-1">{tier.name}</h4>
                                    <p className="text-sm opacity-90 mb-1">{tier.description}</p>
                                    <p
                                        className={`text-xs font-medium ${
                                            unlocked ? "text-white" : "text-gray-500"
                                        }`}
                                    >
                                        {unlockText}
                                    </p>
                                </Card>
                            );
                        })}
                    </div>
                </div>

                <hr/>

                {/* Leaderboard */}
                <div>
                    <h3 className="text-lg font-semibold text-green-900 mb-4 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-green-700" /> Leaderboard Snapshot
                    </h3>
                    <Card className="p-6 bg-white rounded-2xl border border-green-200 shadow-sm">
                        <p className="text-green-800 font-medium mb-2">
                            Your Points: <span className="font-bold">{userData.points}</span>
                        </p>
                        <div className="space-y-2 text-sm text-green-700">
                            {leaderboard.map((entry, index) => (
                                <p key={index} className={entry.isCurrentUser ? "bg-yellow-100 p-2 rounded-lg font-bold text-green-900" : ""}>
                                    {/* Display medals for top 3 */}
                                    {index === 0 && '🥇'}
                                    {index === 1 && '🥈'}
                                    {index === 2 && '🥉'}
                                    {index > 2 && !entry.isCurrentUser && '•'}
                                    <span className="ml-2">{entry.name}</span> — {entry.points} pts
                                </p>
                            ))}
                        </div>
                    </Card>
                </div>

                {/* CTA */}
                <div className="text-center mt-8">
                    <Button
                        className="bg-green-700 hover:bg-green-800 text-white px-8 py-6 rounded-xl"
                        onClick={() => {
                            toast.success("Redirecting to contribution page...");
                            navigate("/contribute");
                        }}
                    >
                        <Zap className="w-5 h-5 mr-2" /> Contribute More to Earn Points
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default YourPoints;