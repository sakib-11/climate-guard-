// C:\Users\DELL\Desktop\ClimateGuard\src\pages\Alerts.tsx
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
// NOTE: Ensure the path to your firebase config file is correct:
import { db } from "./firebase/firebase"; 
import { collection, query, orderBy, getDocs } from "firebase/firestore"; 

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    MapPin,
    Filter,
    AlertTriangle,
    XCircle,
    Clock,
    Zap,
    LogOut,
    LayoutDashboard,
    CheckCircle,
    X,
    List, // New icon for truncated list indicator
} from "lucide-react";
import { toast } from "sonner";

// --- CONFIGURATION ---
const INITIAL_CARD_LIMIT = 5; // The limit when no filters are applied

// ---------------- FIREBASE DATA INTERFACES (Matching Gemini Output) ----------------
interface GeminiAlert {
    title: string;
    description: string;
    location: string;
    severity: string;
    time: string;
}

interface Recommendations {
    title: string;
    subtitle: string;
    actions: string[];
}

interface ConsolidatedThreatSummary {
    criticalAlertsCount: number;
    severeAlertsCount: number;
    totalActiveWarnings: number;
    statusColor: string;
}

// ---------------- STYLES ----------------
const getSeverityStyle = (severity: string) => {
    switch (severity) {
        case "Critical":
        case "Severe":
        case "High":
            return "bg-red-700 text-white shadow-md shadow-red-900/30";
        case "Moderate":
            return "bg-orange-500 text-white shadow-md shadow-orange-900/30";
        case "Minor":
            return "bg-yellow-400 text-black";
        default:
            return "bg-green-200 text-green-900";
    }
};

const getStatusColorHex = (colorName: string) => {
    switch (colorName?.toLowerCase()) {
        case "red": return "#f87171";
        case "orange": return "#fb923c";
        case "yellow": return "#facc15";
        default: return "#86efac";
    }
};

// ---------------- POPUP COMPONENT ----------------
interface GuidancePopupProps {
    recommendations: Recommendations;
    onClose: () => void;
}

const GuidancePopup: React.FC<GuidancePopupProps> = ({ recommendations, onClose }) => (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]">
        <Card className="relative p-8 w-[95%] max-w-lg bg-white rounded-2xl shadow-2xl border border-green-200">
            <button className="absolute top-3 right-3 text-gray-500 hover:text-red-600" onClick={onClose}>
                <X className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-3 mb-4 text-green-800">
                <CheckCircle className="w-6 h-6 text-green-600" />
                <h3 className="text-xl font-bold">{recommendations.title}</h3>
            </div>
            
            <p className="text-sm text-gray-600 mb-4 border-b pb-3">{recommendations.subtitle}</p>

            <ul className="space-y-3">
                {recommendations.actions.map((action, index) => (
                    <li key={index} className="flex items-start gap-3 text-sm text-green-900">
                        <Zap className="w-4 h-4 mt-1 text-green-500 flex-shrink-0" />
                        <span>{action}</span>
                    </li>
                ))}
            </ul>
        </Card>
    </div>
);

const AlertsLoadingSkeleton: React.FC = () => (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 text-green-900">
        <header className="bg-gradient-to-r from-green-800 to-green-900 text-white py-4 shadow-md sticky top-0 z-50">
            <div className="max-w-7xl mx-auto flex items-center justify-between px-6">
                <Skeleton className="h-8 w-64 bg-white/20" />
                <Skeleton className="h-9 w-32 bg-white/20" />
            </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1 space-y-6">
                <Card className="p-6 rounded-2xl space-y-4">
                    <Skeleton className="h-6 w-40" />
                    <Skeleton className="h-12 w-20" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-10 w-full" />
                </Card>

                <Card className="p-6 rounded-2xl space-y-4">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </Card>
            </div>

            <div className="lg:col-span-3 space-y-5">
                {Array.from({ length: 4 }).map((_, index) => (
                    <Card key={index} className="p-6 rounded-2xl space-y-4">
                        <Skeleton className="h-6 w-64" />
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-5/6" />
                    </Card>
                ))}
            </div>
        </main>
    </div>
);


// ---------------- MAIN COMPONENT ----------------
const Alerts: React.FC = () => {
    const { signOut } = useAuth();
    const navigate = useNavigate();
    
    const [alertsData, setAlertsData] = useState<GeminiAlert[]>([]);
    const [threatSummary, setThreatSummary] = useState<ConsolidatedThreatSummary | null>(null);
    const [recommendations, setRecommendations] = useState<Recommendations | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showGuidance, setShowGuidance] = useState(false); 

    const [selectedLocation, setSelectedLocation] = useState<string>("all");
    const [filterSeverity, setFilterSeverity] = useState<string>("all");

    // --- FETCH AND AGGREGATE DATA FROM ALL LOGS ---
    useEffect(() => {
        const fetchGeminiData = async () => {
            setIsLoading(true);
            try {
                // Query ALL documents in the gemini_logs collection
                const logsCollection = collection(db, "gemini_logs");
                const logsQuery = query(logsCollection, orderBy("timestamp", "desc"));
                
                const snapshot = await getDocs(logsQuery);
                
                let allAlerts: GeminiAlert[] = [];
                let totalCritical = 0;
                let totalSevere = 0;
                let highestSeverityColor = 'green';
                const severityOrder: Record<string, number> = { Critical: 4, Severe: 3, High: 3, Moderate: 2, Minor: 1, green: 0 };
                let firstRecommendations: Recommendations | null = null; 

                snapshot.forEach(doc => {
                    const log = doc.data();
                    const responseData = log.response_data;

                    if (responseData && responseData.riskAnalysis && responseData.threatSummary) {
                        const newAlerts = responseData.riskAnalysis.activeAlerts as GeminiAlert[];
                        const summary = responseData.threatSummary;
                        const recs = responseData.riskAnalysis.recommendations as Recommendations;

                        // 1. Consolidate Alerts
                        allAlerts = allAlerts.concat(newAlerts || []);

                        // 2. Consolidate Threat Counts
                        totalCritical += summary.criticalAlertsCount || 0;
                        totalSevere += summary.severeAlertsCount || 0;
                        
                        // 3. Capture Recommendations from the first log entry (assuming they are consistent)
                        if (!firstRecommendations) {
                            firstRecommendations = recs;
                        }
                        
                        // 4. Determine Highest Overall Severity Color
                        if (severityOrder[summary.statusColor] > severityOrder[highestSeverityColor]) {
                            highestSeverityColor = summary.statusColor;
                        }
                    }
                });
                
                setAlertsData(allAlerts);
                setRecommendations(firstRecommendations); // Set the recommendations data
                setThreatSummary({
                    criticalAlertsCount: totalCritical,
                    severeAlertsCount: totalSevere,
                    totalActiveWarnings: allAlerts.length,
                    statusColor: highestSeverityColor,
                });

                if (allAlerts.length === 0) {
                    toast.info("No active alerts found across all logs.");
                }

            } catch (error) {
                console.error("Error fetching Gemini data:", error);
                toast.error("Failed to load real-time alert data.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchGeminiData();
    }, []); 


    // --- MEMOIZED DATA FOR FILTERS AND LIMITING ---
    const uniqueLocations = useMemo(() => {
        const names = new Set(alertsData.map((a) => a.location));
        return Array.from(names).map((name) => ({
            id: name,
            name: name,
        }));
    }, [alertsData]);

    const filteredAlerts = useMemo(() => {
        let list = alertsData;
        const filtersActive = selectedLocation !== "all" || filterSeverity !== "all";

        // 1. Apply Filters
        if (selectedLocation !== "all") {
            list = list.filter((a) => a.location === selectedLocation);
        }
        
        if (filterSeverity !== "all") {
            list = list.filter((a) => a.severity === filterSeverity);
        }

        // 2. Sort by severity (highest first)
        const severityOrder: Record<string, number> = {
            Critical: 4,
            Severe: 3,
            High: 3, 
            Moderate: 2,
            Minor: 1,
            Unknown: 0
        };

        const sortedList = [...list].sort(
            (a, b) => severityOrder[b.severity] - severityOrder[a.severity]
        );
        
        // 3. Apply Conditional Limit
        if (filtersActive) {
            return sortedList; // Show all matching results
        } else {
            // No filters active, show only the first 5
            return sortedList.slice(0, INITIAL_CARD_LIMIT);
        }

    }, [alertsData, selectedLocation, filterSeverity]);

    // Check if the original list (before slicing) was longer than the limit
    const listWasTruncated = useMemo(() => {
        if (selectedLocation !== "all" || filterSeverity !== "all") {
            return false; // Never show the indicator if filters are active
        }
        
        // Calculate the full sorted list without slicing
        const fullSortedList = [...alertsData].sort(
            (a, b) => {
                const severityOrder: Record<string, number> = { Critical: 4, Severe: 3, High: 3, Moderate: 2, Minor: 1, Unknown: 0 };
                return severityOrder[b.severity] - severityOrder[a.severity];
            }
        );

        return fullSortedList.length > INITIAL_CARD_LIMIT;
    }, [alertsData, selectedLocation, filterSeverity]);


    // --- RENDER BLOCK ---
    const totalWarnings = threatSummary?.totalActiveWarnings || 0;

    if (isLoading) {
        return <AlertsLoadingSkeleton />;
    }
    
    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 text-green-900">
            
            {/* --- HEADER --- */}
            <header className="bg-gradient-to-r from-green-800 to-green-900 text-white py-4 shadow-md sticky top-0 z-50">
                <div className="max-w-7xl mx-auto flex items-center justify-between px-6">
                    <div className="flex items-center gap-2">
                        <Zap className="w-6 h-6 text-green-300" />
                        <h1 className="text-xl font-bold">Active Alerts ({totalWarnings})</h1>
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
                        <Button variant="outline" size="sm" className="text-white border-red-400 bg-red-700 hover:bg-red-500" onClick={signOut}>
                            <LogOut className="w-4 h-4 mr-2" /> Sign Out
                        </Button>
                    </div>
                </div>
            </header>

            {/* --- MAIN CONTENT --- */}
            <main className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-4 gap-6">
                
                {/* SIDEBAR */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Threat Summary */}
                    <Card className="p-6 bg-gradient-to-br from-green-800 to-green-900 text-white rounded-2xl shadow-md border-none">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-red-400" />
                            Threat Summary
                        </h2>

                        <p
                            className="text-5xl font-extrabold mb-2"
                            style={{
                                color: getStatusColorHex(threatSummary?.statusColor || 'green'),
                            }}
                        >
                            {totalWarnings}
                        </p>
                        <p className="text-sm text-green-200 mb-4">Total Active Warnings</p>

                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span>Critical Alerts:</span>
                                <span className="font-bold text-red-400">{threatSummary?.criticalAlertsCount || 0}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Severe/High Alerts:</span>
                                <span className="font-bold text-orange-400">{threatSummary?.severeAlertsCount || 0}</span>
                            </div>
                        </div>

                        <Button
                            className="w-full mt-5 bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => navigate("/dashboard")}
                        >
                            View Dashboard Map
                        </Button>
                    </Card>

                    {/* Filters */}
                    <Card className="p-6 bg-gradient-to-br from-green-800 to-green-900 text-white rounded-2xl shadow-md border-none">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Filter className="w-5 h-5 text-green-300" />
                            Filter Alerts
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                                    <SelectTrigger className="bg-green-100 text-green-800 border-green-300">
                                        <SelectValue placeholder="All Locations" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-green-100 border-green-300 text-green-800">
                                        <SelectItem value="all">All Locations</SelectItem>
                                        {uniqueLocations.map((loc) => (
                                            <SelectItem key={loc.id} value={loc.id}>
                                                {loc.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                                    <SelectTrigger className="bg-green-100 text-green-800 border-green-300">
                                        <SelectValue placeholder="All Severities" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-green-100 border-green-300 text-green-800">
                                        <SelectItem value="all">All Severities</SelectItem>
                                        <SelectItem value="Critical">Critical</SelectItem>
                                        <SelectItem value="Severe">Severe</SelectItem>
                                        <SelectItem value="High">High</SelectItem>
                                        <SelectItem value="Moderate">Moderate</SelectItem>
                                        <SelectItem value="Minor">Minor</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* ALERT LIST */}
                <div className="lg:col-span-3 space-y-5">
                    
                    {/* Truncated List Indicator */}
                    {listWasTruncated && (
                        <Card className="p-3 bg-yellow-100 text-yellow-800 border-yellow-400 rounded-lg flex items-center gap-2">
                            <List className="w-5 h-5 flex-shrink-0" />
                            <p className="text-sm font-medium">
                                Showing the top {INITIAL_CARD_LIMIT} alerts. Use the filters to view all ({totalWarnings}).
                            </p>
                        </Card>
                    )}

                    {filteredAlerts.length > 0 ? (
                        filteredAlerts.map((alert, index) => (
                            <Card
                                key={index} 
                                className="p-6 bg-gradient-to-br from-green-700 to-green-800 text-white rounded-2xl shadow-md hover:scale-[1.01] transition-transform"
                            >
                                <div className="flex justify-between items-start">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <span
                                                className={`px-3 py-1 text-xs font-bold rounded-full ${getSeverityStyle(
                                                    alert.severity
                                                )}`}
                                            >
                                                {alert.severity.toUpperCase()}
                                            </span>
                                            <span className="text-lg font-semibold text-green-100">
                                                {alert.title}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-4 text-sm text-green-200/80">
                                            <span className="flex items-center gap-1">
                                                <MapPin className="w-4 h-4" /> {alert.location}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-4 h-4" />
                                                {alert.time}
                                            </span>
                                        </div>

                                        <p className="text-green-100/90 text-sm">{alert.description}</p>
                                    </div>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-black border-green-400 hover:bg-green-700"
                                        onClick={() => setShowGuidance(true)} 
                                        disabled={!recommendations}
                                    >
                                        View Guidance
                                    </Button>
                                </div>
                            </Card>
                        ))
                    ) : (
                        <Card className="p-12 text-center bg-green-50 rounded-2xl border-2 border-dashed border-green-300">
                            <XCircle className="w-12 h-12 text-green-700 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold text-green-800 mb-2">
                                No Alerts Match Filter
                            </h3>
                            <p className="text-green-700">
                                Adjust your filters or wait for new alerts to be issued.
                            </p>
                        </Card>
                    )}
                </div>
            </main>
            
            {/* --- GUIDANCE POPUP --- */}
            {showGuidance && recommendations && (
                <GuidancePopup 
                    recommendations={recommendations}
                    onClose={() => setShowGuidance(false)}
                />
            )}
        </div>
    );
};

export default Alerts;
