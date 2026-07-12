import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { db } from "./firebase/firebase"; 
import { limit, collection, doc, setDoc, onSnapshot, getDocs, query, orderBy, updateDoc, getDoc } from "firebase/firestore";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { InteractiveMap } from "@/components/InteractiveMap";
import { ProbabilitySliders } from "@/components/ProbabilitySlider";
import { ScenarioSimulator } from "@/components/ScenarioSimulator";

import {
    MapPin, Plus, Trash2, LogOut, Bell,
    TrendingUp, Users, Award, X, PlusCircle, Trophy,
} from "lucide-react";
import { toast } from "sonner";

// --- INTERFACES ---
interface SavedLocation {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    is_primary: boolean;
}

interface ActiveHazards {
    flood: boolean; wildfire: boolean; cyclone: boolean;
    heatwave: boolean; drought: boolean; earthquake: boolean;
}

interface ConsolidateMetrics {
    totalCommunityReports: number;
    totalUserPoints: number;
    totalAlerts: number;
    highestAlertSeverity: string;
}

interface ThreatSummary {
    totalActiveWarnings: number;
    statusColor: string;
}

const DEFAULT_ACTIVE_HAZARDS: ActiveHazards = {
    flood: true,
    wildfire: true,
    cyclone: true,
    heatwave: false,
    drought: false,
    earthquake: false,
};

// --- DUMMY LOCATIONS (Used only as initial fallback structure) ---
const INITIAL_DUMMY_LOCATIONS: SavedLocation[] = [
    { id: "loc1", name: "Coastal City, CA", latitude: 34.05, longitude: -118.25, is_primary: true },
];

const DashboardLoadingSkeleton = () => (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100">
        <header className="bg-gradient-to-r from-green-800 to-green-900 border-b border-green-700 sticky top-0 z-50 shadow-md">
            <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                <Skeleton className="h-8 w-56 bg-white/20" />
                <div className="flex items-center gap-3">
                    <Skeleton className="h-9 w-28 bg-white/20" />
                    <Skeleton className="h-9 w-28 bg-white/20" />
                </div>
            </div>
        </header>

        <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-6">
                <Card className="p-6 rounded-2xl space-y-4">
                    <Skeleton className="h-6 w-40" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </Card>
                <Card className="p-6 rounded-2xl space-y-4">
                    <Skeleton className="h-6 w-52" />
                    <Skeleton className="h-24 w-full" />
                </Card>
            </div>

            <div className="lg:col-span-2 space-y-6">
                <Skeleton className="h-96 w-full rounded-2xl" />
                <Skeleton className="h-[28rem] w-full rounded-2xl" />
            </div>
        </div>
    </div>
);

const Dashboard = () => {
    const { user, loading: authLoading, signOut } = useAuth();
    const navigate = useNavigate();

    const [savedLocations, setSavedLocations] = useState<SavedLocation[]>(INITIAL_DUMMY_LOCATIONS);
    const [selectedLocation, setSelectedLocation] = useState<SavedLocation | null>(INITIAL_DUMMY_LOCATIONS[0]);
    const [newLocationName, setNewLocationName] = useState("");
    const [loadingData, setLoadingData] = useState(true);
    const [probabilityThreshold, setProbabilityThreshold] = useState(50); 
    const [activeHazards, setActiveHazards] = useState<ActiveHazards>(DEFAULT_ACTIVE_HAZARDS);
    const [popup, setPopup] = useState<string | null>(null); 
    const [metrics, setMetrics] = useState<ConsolidateMetrics>({
        totalCommunityReports: 0, totalUserPoints: 0, totalAlerts: 0, highestAlertSeverity: 'green'
    });
    const [geminiSensitivityData, setGeminiSensitivityData] = useState([]); 

    const profilesCollection = useMemo(() => collection(db, "profiles"), []);
    const userScoresCollection = useMemo(() => collection(db, "user_scores"), []);
    const reportsCollection = useMemo(() => collection(db, "reports"), []);
    const geminiLogsCollection = useMemo(() => collection(db, "gemini_logs"), []);

    // --- LOGIC 1: ISO Derivation (Connects City to Prediction Data) ---
    const getSelectedISO = useMemo(() => {
        if (!selectedLocation) return "AFG"; 

        const name = selectedLocation.name.toUpperCase();
        
        // --- Custom Mapping Logic for well-known countries ---
        if (name.includes("INDIA") || name.includes("DELHI") || name.includes("MUMBAI")) return "IND";
        if (name.includes("AMERICA") || name.includes("USA") || name.includes("CA") || name.includes("NY")) return "USA";
        if (name.includes("CHINA") || name.includes("BEIJING")) return "CHN";
        if (name.includes("JAPAN") || name.includes("TOKYO")) return "JPN";
        if (name.includes("PAKISTAN") || name.includes("KARACHI") || name.includes("LAHORE")) return "PAK";
        if (name.includes("GERMANY") || name.includes("DEU")) return "DEU";
        if (name.includes("CANADA") || name.includes("CAN")) return "CAN";
        if (name.includes("BRAZIL")) return "BRA";
        
        // Fallback to Afghanistan (AFG) as it is guaranteed to be in the simulator data.
        return "AFG"; 
    }, [selectedLocation]);


    // --- 3. Persistence Handler ---
    const updateProfileInFirestore = useCallback((updates: Partial<{ locations: SavedLocation[], selectedLocationId: string | undefined, hazards: ActiveHazards, threshold: number }>) => {
        if (user) {
            updateDoc(doc(profilesCollection, user.uid), updates)
                .catch(e => toast.error("Failed to save profile changes."));
        }
    }, [profilesCollection, user]);

    // --- 1. Fetch/Sync User Profile Data from Firestore (/profiles/{userId}) ---
    useEffect(() => {
        if (!user) {
            if (!authLoading) navigate('/auth');
            return;
        }

        const profileRef = doc(profilesCollection, user.uid);
        const unsubscribe = onSnapshot(profileRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const loadedLocations = data.locations || INITIAL_DUMMY_LOCATIONS;

                setSavedLocations(loadedLocations);
                setActiveHazards(data.hazards || DEFAULT_ACTIVE_HAZARDS);
                setProbabilityThreshold(data.threshold || 50);

                if (data.selectedLocationId) {
                    const foundLoc = loadedLocations.find((l: SavedLocation) => l.id === data.selectedLocationId);
                    setSelectedLocation(foundLoc || (loadedLocations.length > 0 ? loadedLocations[0] : null));
                } else if (loadedLocations.length > 0) {
                    setSelectedLocation(loadedLocations[0]);
                } else {
                    setSelectedLocation(null);
                }
            } else {
                const initialData = {
                    locations: INITIAL_DUMMY_LOCATIONS,
                    hazards: DEFAULT_ACTIVE_HAZARDS,
                    threshold: 50,
                    selectedLocationId: INITIAL_DUMMY_LOCATIONS[0].id,
                };
                setDoc(profileRef, initialData, { merge: true });
                setSavedLocations(INITIAL_DUMMY_LOCATIONS);
                setSelectedLocation(INITIAL_DUMMY_LOCATIONS[0]);
            }
            setLoadingData(false);
        }, (error) => {
            console.error("Error syncing profile:", error);
            setLoadingData(false);
        });

        return () => unsubscribe();
    }, [user, authLoading, navigate, profilesCollection]);

    // --- 2. Fetch Dashboard Metrics & GEMINI Risk Data ---
    useEffect(() => {
        if (!user) return;

        const fetchAllData = async () => {
            const newMetrics: ConsolidateMetrics = {
                totalCommunityReports: 0,
                totalUserPoints: 0,
                totalAlerts: 0,
                highestAlertSeverity: 'green',
            };

            // 1. Total Community Reports & User Points (Metrics)
            try {
                const reportsSnapshot = await getDocs(reportsCollection);
                newMetrics.totalCommunityReports = reportsSnapshot.size;
                
                const userScoreDoc = await getDoc(doc(userScoresCollection, user.uid));
                newMetrics.totalUserPoints = userScoreDoc.exists() ? userScoreDoc.data().points || 0 : 0;
            } catch (e) { console.error("Error fetching core metrics:", e); }

            // 2. Total Active Alerts & Gemini Sensitivity Data
            try {
                const logsSnapshot = await getDocs(query(geminiLogsCollection, orderBy("timestamp", "desc"), limit(1)));
                
                if (!logsSnapshot.empty) {
                    const log = logsSnapshot.docs[0].data();
                    const responseData = log.response_data;
                    const summary = responseData?.threatSummary as ThreatSummary;
                    const riskAnalysis = responseData?.riskAnalysis;

                    if (summary) {
                        newMetrics.totalAlerts = summary.totalActiveWarnings || 0;
                        newMetrics.highestAlertSeverity = summary.statusColor || 'green';
                    }

                    if (riskAnalysis && riskAnalysis.sensitivityFilters) {
                        setGeminiSensitivityData(riskAnalysis.sensitivityFilters);
                    }
                }
            } catch (e) { console.error("Error fetching alerts/Gemini data:", e); }

            setMetrics(newMetrics);
        };

        fetchAllData();
        const intervalId = setInterval(fetchAllData, 60000); 
        return () => clearInterval(intervalId);

    }, [geminiLogsCollection, reportsCollection, user, userScoresCollection]);


    // --- Location Handlers ---
    const handleLocationSelect = (loc: SavedLocation) => {
        setSelectedLocation(loc);
        updateProfileInFirestore({ locations: savedLocations, selectedLocationId: loc.id });
    };

    const addLocation = () => {
        if (!newLocationName.trim()) return toast.error('Enter a location name');

        const newLoc: SavedLocation = {
            id: `loc${Date.now()}`,
            name: newLocationName.trim(),
            latitude: 30 + Math.random() * 10, 
            longitude: -100 + Math.random() * 20, 
            is_primary: savedLocations.length === 0,
        };
        const updated = [newLoc, ...savedLocations];
        setSavedLocations(updated);
        setSelectedLocation(newLoc);
        setNewLocationName("");
        toast.success(`Added ${newLoc.name}`);
        updateProfileInFirestore({ locations: updated, selectedLocationId: newLoc.id });
    };

    const removeLocation = (id: string) => {
        const updated = savedLocations.filter(l => l.id !== id);
        setSavedLocations(updated);
        
        let newSelectedId: string | undefined = undefined;
        if (selectedLocation?.id === id) {
            const nextSelected = updated[0] || null;
            setSelectedLocation(nextSelected);
            newSelectedId = nextSelected?.id;
        } else {
            newSelectedId = selectedLocation?.id;
        }

        toast.success("Location removed");
        updateProfileInFirestore({ locations: updated, selectedLocationId: newSelectedId });
    };
    
    // --- Threshold Persistence Handler ---
    // Inside Dashboard.tsx
const handleThresholdsChange = (values: Record<string, number>) => {
    // 🛑 WAS: const coreThreshold = values.temperature;
    // ✅ NOW: Use the new calculated average threshold
    const coreThreshold = values.coreThreshold; 
    
    setProbabilityThreshold(coreThreshold); 
    updateProfileInFirestore({ threshold: coreThreshold });
};

    // --- Placeholder for other scenario functions ---
    const handleScenarioChange = (date: string, season: string) => {
        toast.info(`Simulating ${season} (${date})`);
    };
    
    // --- Loading Screen ---
    if (authLoading || loadingData) {
        return <DashboardLoadingSkeleton />;
    }

    // --- Popup modal ---
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

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100">
            {/* Header */}
            <header className="bg-gradient-to-r from-green-800 to-green-900 border-b border-green-700 sticky top-0 z-50 shadow-md">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <MapPin className="w-6 h-6 text-green-300" />
                        <h1 className="text-xl font-bold text-white">Climate Dashboard</h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button variant="outline" size="sm" className="text-green-700 border-green-300 hover:bg-green-500" onClick={() => navigate('/reports')}>
                            <Users className="w-4 h-4 mr-2" /> Community
                        </Button>
                        <Button variant="outline" size="sm" className="text-green-700 border-green-300 hover:bg-green-500" onClick={() => navigate('/contribute')}>
                            <PlusCircle className="w-4 h-4 mr-2" /> Contribute
                        </Button>
                        <Button variant="outline" size="sm" className="text-green-700 border-green-300 hover:bg-green-500" onClick={() => navigate('/points')}>
                            <Trophy className="w-4 h-4 mr-2" /> Points
                        </Button>
                        <Button variant="outline" size="sm" className="text-green-700 border-green-300 hover:bg-green-500" onClick={() => navigate('/alerts')}>
                            <Bell className="w-4 h-4 mr-2" /> Alerts
                        </Button>
                        <Button variant="outline" size="sm" className="text-green-700 border-green-300 hover:bg-green-500" onClick={() => navigate('/')}>
                            <TrendingUp className="w-4 h-4 mr-2" /> Predictions
                        </Button>
                        <Button variant="outline" size="sm" className="bg-red-700 text-white border-red-400 hover:bg-red-500" onClick={signOut}>
                            <LogOut className="w-4 h-4 mr-2" /> Sign Out
                        </Button>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-6 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Sidebar */}
                    <div className="lg:col-span-1 space-y-6">
                        <Card className="p-6 bg-gradient-to-br from-green-800 to-green-900 border-none text-white rounded-2xl shadow-md">
                            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <MapPin className="w-5 h-5 text-green-300" /> Saved Locations
                            </h2>

                            <div className="flex gap-2 mb-4">
                                <Input
                                    placeholder="Add location..."
                                    value={newLocationName}
                                    onChange={(e) => setNewLocationName(e.target.value)}
                                    onKeyPress={(e) => e.key === "Enter" && addLocation()}
                                    className="bg-green-100 text-green-900"
                                />
                                <Button onClick={addLocation} size="icon" className="bg-green-600 hover:bg-green-700 text-white">
                                    <Plus className="w-4 h-4" />
                                </Button>
                            </div>

                            <div className="space-y-2">
                                {savedLocations.map((loc) => (
                                    <div
                                        key={loc.id}
                                        className={`p-3 rounded-lg cursor-pointer transition-colors ${
                                            selectedLocation?.id === loc.id
                                                ? "bg-green-700 text-white"
                                                : "bg-green-100 text-green-800 hover:bg-green-200"
                                        }`}
                                        onClick={() => handleLocationSelect(loc)}
                                    >
                                        <div className="flex justify-between items-center">
                                            <span>{loc.name}</span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeLocation(loc.id);
                                                }}
                                            >
                                                <Trash2 className="w-4 h-4 text-red-400" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>

                        {/* Probability Sliders / Environmental Sensitivity Filters */}
                        <ProbabilitySliders
                            sensitivityData={geminiSensitivityData}
                            onThresholdChange={handleThresholdsChange}
                        />

                    </div>

                    {/* Main Section */}
                    <div className="lg:col-span-2 space-y-6">
                        {selectedLocation ? (
                            <>
                                {/* Interactive Map */}
                                <InteractiveMap 
                                    location={selectedLocation.name} 
                                    hazards={activeHazards} 
                                />
                                <ScenarioSimulator 
                                    onScenarioChange={handleScenarioChange} 
                                    // Pass the dynamically mapped ISO code
                                    defaultISO={getSelectedISO}
                                />

                                {/* Real-time Metric Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    
                                    
                                </div>
                            </>
                        ) : (
                            <Card className="p-12 text-center bg-green-50 rounded-2xl border-2 border-dashed border-green-300">
                                <MapPin className="w-16 h-16 text-green-700 mx-auto mb-4" />
                                <h3 className="text-xl font-semibold text-green-800 mb-2">
                                    No Location Selected
                                </h3>
                                <p className="text-green-700 mb-6">
                                    Add a location to start tracking climate risks
                                </p>
                                <Button onClick={() => document.querySelector('input')?.focus()} className="bg-green-700 hover:bg-green-800 text-white">
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add Your First Location
                                </Button>
                            </Card>
                        )}
                    </div>
                </div>
            </div>

        </div>
    );
};

export default Dashboard;
