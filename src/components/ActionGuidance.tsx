// src/components/ActionGuidance.tsx

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Download, Bell, Shield, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

// 🚨 FIREBASE IMPORTS
import { db } from "@/pages/firebase/firebase"; // Adjust path as needed
import { doc, updateDoc, onSnapshot, collection } from "firebase/firestore";

// --- INTERFACES ---

// Configuration for each alert channel
interface AlertChannels {
  sms: boolean;
  email: boolean;
  whatsapp: boolean;
}

interface RecommendationData {
  title: string;
  subtitle: string;
  actions: string[];
}

interface ThreatSummaryData {
  criticalAlertsCount: number;
  totalActiveWarnings: number;
  statusColor: string;
}

interface ActionGuidanceProps {
  recommendations: RecommendationData;
  threatSummary: ThreatSummaryData;
  isLoading: boolean;
}

// --- CONSTANTS & DEFAULTS ---

// Default state for alert preferences
const defaultAlerts: AlertChannels = {
  sms: false,
  email: false,
  whatsapp: false,
};

const defaultRecommendations: RecommendationData = {
  title: "Analysis Pending",
  subtitle: "Fetching personalized guidance...",
  actions: ["Load risk data to receive personalized actions."],
};

const defaultThreatSummary: ThreatSummaryData = {
  criticalAlertsCount: 0,
  totalActiveWarnings: 0,
  statusColor: "gray",
};

// Define the alert options structure for mapping in the UI
const ALERT_OPTIONS = [
  { key: "sms", label: "SMS Alerts", sub: "Receive text notifications" },
  { key: "email", label: "Email Updates", sub: "Daily risk summaries" },
  { key: "whatsapp", label: "WhatsApp Alerts", sub: "Instant messaging updates" },
];

export const ActionGuidance = ({
  recommendations = defaultRecommendations,
  threatSummary = defaultThreatSummary,
  isLoading,
}: ActionGuidanceProps) => {
  const { user } = useAuth();
  const [alertPreferences, setAlertPreferences] = useState<AlertChannels>(defaultAlerts);
  const [isSyncing, setIsSyncing] = useState(true);

  const profilesCollection = collection(db, "profiles");
  const userId = user?.uid;

  // --- 1. Firestore Sync: Read Alert Preferences ---
  useEffect(() => {
    if (!userId) {
      setIsSyncing(false);
      return;
    }

    const profileRef = doc(profilesCollection, userId);
    
    // Listen for real-time updates to the user's profile
    const unsubscribe = onSnapshot(profileRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Load the 'alerts' map, merging with defaults to ensure all keys exist
        const loadedAlerts = { ...defaultAlerts, ...data.alerts };
        setAlertPreferences(loadedAlerts);
      }
      setIsSyncing(false);
    }, (error) => {
      console.error("Error reading alert preferences:", error);
      toast.error("Failed to sync alert settings.");
      setIsSyncing(false);
    });

    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);


  // --- 2. Firestore Write: Handle Alert Toggle ---
  const handleToggleAlerts = useCallback(async (key: keyof AlertChannels, enabled: boolean) => {
    if (!userId) {
      toast.error("Please sign in to manage alerts.");
      return;
    }
    
    setIsSyncing(true);
    const profileRef = doc(profilesCollection, userId);
    
    // Update the local state immediately for responsiveness
    setAlertPreferences(prev => ({ ...prev, [key]: enabled }));

    try {
      // Construct the update object for Firestore: { alerts: { sms: true/false } }
      await updateDoc(profileRef, {
        alerts: {
          ...alertPreferences, // Use current state to preserve other settings
          [key]: enabled,
        },
      });
      
      toast.success(enabled 
        ? `${key.toUpperCase()} alerts enabled!` 
        : `${key.toUpperCase()} alerts disabled.`
      );
    } catch (error) {
      console.error("Error updating alerts:", error);
      // Revert local state on failure
      setAlertPreferences(prev => ({ ...prev, [key]: !enabled }));
      toast.error("Failed to save alert preference. Please check connection.");
    } finally {
        setIsSyncing(false);
    }
  }, [userId, alertPreferences, profilesCollection]);


  const handleDownloadReport = () => {
    toast.success("Preparedness report download started");
  };

  // Determine the color class based on the threat summary status
  const getColorClass = (color: string) => {
    if (color === 'red') return 'from-red-950 to-red-800 border-red-900';
    if (color === 'orange') return 'from-amber-950 to-amber-800 border-amber-900';
    return 'from-emerald-950 to-emerald-800 border-emerald-900';
  };

  const threatCardClasses = getColorClass(threatSummary.statusColor);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      
      {/* --- Preparedness Card (Dynamically populated) --- */}
      <Card className="bg-gradient-to-br from-emerald-950 to-emerald-800 border border-emerald-900 shadow-lg p-6 rounded-2xl transition-all duration-300">
        <div className="flex items-start gap-4 mb-4">
          <Shield className="w-8 h-8 text-emerald-300 flex-shrink-0" />
          <div>
            <h3 className="text-xl font-semibold text-emerald-100 mb-2">
              {recommendations.title} 
              {isLoading && <Loader2 className="w-4 h-4 ml-2 inline-block animate-spin" />}
            </h3>
            <p className="text-emerald-300/80 text-sm mb-4">
              {recommendations.subtitle}
            </p>
          </div>
        </div>

        {/* DYNAMIC DATA: Map through recommendations.actions */}
        <ul className="space-y-3 mb-6">
          {recommendations.actions.map((tip, index) => (
            <li key={index} className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-emerald-400 mt-1 flex-shrink-0" />
              <span className="text-sm text-emerald-100">{tip}</span>
            </li>
          ))}
        </ul>
  
      </Card>

      {/* --- Alerts & Notifications Card (Uses Threat Summary Data) --- */}
      <Card className={`bg-gradient-to-br ${threatCardClasses} shadow-lg p-6 rounded-2xl transition-all duration-300`}>
        <div className="flex items-start gap-4 mb-6">
          <Bell className="w-8 h-8 text-emerald-300 flex-shrink-0" />
          <div>
            <h3 className="text-xl font-semibold text-emerald-100 mb-2">
              Stay Informed
            </h3>
            
          </div>
        </div>

        {/* 🚨 DYNAMIC ALERT OPTIONS BLOCK */}
        <div className="space-y-4">
          {ALERT_OPTIONS.map((option) => (
            <div
              key={option.key}
              className="flex items-center justify-between p-4 bg-emerald-900/50 border border-emerald-700 rounded-xl shadow-sm hover:shadow-md transition-all"
            >
              <div className="flex-1">
                <p className="font-medium text-emerald-100">{option.label}</p>
                <p className="text-sm text-emerald-300/80">{option.sub}</p>
              </div>
              <Switch
                checked={alertPreferences[option.key as keyof AlertChannels]}
                onCheckedChange={(enabled) => handleToggleAlerts(option.key as keyof AlertChannels, enabled)}
                disabled={!userId || isSyncing} // Disable if not logged in or currently writing
                className="data-[state=checked]:bg-emerald-600"
              />
            </div>
          ))}
          {isSyncing && (
             <p className="text-center text-xs text-emerald-300/80 flex items-center justify-center pt-2">
                <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Syncing preferences...
             </p>
          )}
        </div>
      </Card>
    </div>
  );
};