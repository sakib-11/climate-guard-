// src/components/KeyFactors.tsx

import { AlertTriangle, Droplets, Wind, Thermometer, LucideIcon, Cloud } from "lucide-react";
import { Card } from "@/components/ui/card";

// Interface for the raw data coming from the Gemini API payload
interface GeminiFactor {
    factor: string;
    status: string; 
}

interface KeyFactorsProps {
    factors?: GeminiFactor[]; // Accept the raw data structure from the API
}

// --- COLOR & SEVERITY MAPPING LOGIC (Unified with RiskMap) ---

// Map factor names to their Lucide Icons
const FactorIconMap: Record<string, LucideIcon> = {
    "Precipitation Levels": Droplets,
    "Wind Patterns": Wind,
    "Temperature Anomaly": Thermometer,
    "Historical Events": AlertTriangle,
    "Air Quality Index (AQI)": Cloud, // Example addition
    "Soil Moisture Deficit": Droplets, // Example addition
};

// Map the raw status string to a standardized severity level
const normalizeStatus = (raw?: string) => {
    if (!raw) return "low";
    const s = raw.toString().toLowerCase().trim();
    if (s.includes("crit") || s.includes("severe") || s.includes("danger")) return "critical";
    if (s.includes("high") || s.includes("elevat") || s.includes("warning")) return "high";
    if (s.includes("moderate") || s.includes("mod")) return "moderate";
    if (s.includes("low") || s.includes("safe") || s.includes("green")) return "low";
    return "low"; // Default to low
};

// Get the corresponding Tailwind text color class for a standardized severity level
const getStatusColorClass = (severity: string) => {
    switch (severity) {
        case "critical":
            return "text-red-600"; // Use a specific red shade
        case "high":
            return "text-orange-500"; // Use an orange shade
        case "moderate":
            return "text-yellow-500"; // Use a yellow shade
        case "low":
            return "text-green-600"; // Use a specific green shade
        default:
            return "text-muted-foreground";
    }
};

// Interface for the richly formatted data the component uses internally
interface FormattedFactor {
    icon: LucideIcon;
    label: string;
    value: string; // The displayed value/status
    color: string; // Tailwind color class
}

// --- COMPONENT ---

export const KeyFactors = ({ factors: customFactors }: KeyFactorsProps) => {
    
    // Default factors for display if API data is missing or loading
    const defaultFactors: FormattedFactor[] = [
        { icon: Droplets, label: "Precipitation Levels", value: "Normal", color: "text-green-600" },
        { icon: Wind, label: "Wind Patterns", value: "Low", color: "text-green-600" },
        { icon: Thermometer, label: "Temperature Anomaly", value: "Moderate", color: "text-yellow-500" },
        { icon: AlertTriangle, label: "Historical Data", value: "High", color: "text-orange-500" },
    ];

    // MAPPING LOGIC: Transform the simple API data (factor, status) into the rich UI data
    const factors: FormattedFactor[] = customFactors?.map((f) => {
        const factorName = f.factor;
        const Icon = FactorIconMap[factorName] || AlertTriangle;
        
        // 1. Normalize the raw status string from the API
        const severity = normalizeStatus(f.status);
        
        // 2. Get the consistent color class
        const color = getStatusColorClass(severity);

        return {
            icon: Icon,
            label: factorName,
            value: f.status, 
            color: color,
        };
    }) || defaultFactors;

    return (
        <div className="bg-card rounded-2xl p-6 border border-border">
            <h3 className="text-xl font-semibold text-foreground mb-4">Key Reasoning Factors</h3>
            <div className="space-y-3">
                {factors.map((factor, index) => {
                    const Icon = factor.icon;
                    return (
                        <div key={index} className="flex items-center gap-4 p-3 bg-muted/50 rounded-xl">
                            <Icon className={`w-5 h-5 ${factor.color}`} />
                            <div className="flex-1">
                                <p className="text-sm font-medium text-foreground">{factor.label}</p>
                            </div>
                            <span className={`text-sm font-semibold ${factor.color} min-w-[100px] text-right`}>
                                {/* Displaying the original status value */}
                                {factor.value} 
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};