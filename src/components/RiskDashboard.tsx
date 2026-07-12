// =================================================================
// 📁 File: components/RiskDashboard.tsx
// =================================================================
import { RiskGauge } from "./RiskGauge";
import { SeverityBar } from "./SeverityBar";
// ✅ CORRECT: Imports the default export and names it 'RiskMap'
import RiskMap from "./RiskMap";
import { KeyFactors } from "./KeyFactors";
import { ForecastCards } from "./ForecastCards";
import { TrendingUp, Loader2 } from "lucide-react";
import { ActionGuidance } from './ActionGuidance';
import { Card } from '@/components/ui/card';

// Assuming GeminiRiskData is imported or defined globally/locally
// Re-defining the structure here to ensure type safety in this file
interface RiskDataStructure {
    location: { city: string; lat: string; lon: string };
    riskAnalysis: {
        title: string;
        riskScore: number;
        riskLevel: string;
        riskTrend: { trend: string; period: string };
        severityBar: { level: number };
        riskGauge: { score: number };
        keyFactors: Array<{ factor: string; status: string }>;
        forecast: Array<{ day: string; date: string; condition: string; probability: string }>;
        recommendations: { title: string; subtitle: string; actions: string[] };
    };
    threatSummary: {
        criticalAlertsCount: number;
        severeAlertsCount: number;
        totalActiveWarnings: number;
        statusColor: string;
    };
    _error?: string;
}

// 🔥 FIX: The Props interface now accepts the data object and isLoading state
interface RiskDashboardProps {
    location: string;
    data: RiskDataStructure; // Accepts the data fetched by the parent
    isLoading: boolean; // Accepts the loading state from the parent
}

export const RiskDashboard = ({ location, data, isLoading }: RiskDashboardProps) => {
    // ⚠️ Remove all internal state (useState, useEffect, useCallback, fetchUrl)
    // The data is now available directly in the 'data' prop.

    // Destructure required data fields from the props
    const { riskAnalysis, threatSummary } = data;
    
    // --- Data Mapping to Components ---
    const riskScore = riskAnalysis.riskGauge.score; // Use riskAnalysis.riskGauge.score as per schema
    const severityLevel = riskAnalysis.severityBar.level;
    const keyFactors = riskAnalysis.keyFactors;
    const forecast = riskAnalysis.forecast.map(f => ({
        ...f,
        risk: riskAnalysis.riskLevel.split(' ')[0] || 'medium', 
    }));


    return (
        <section className="py-20 px-6 bg-background" id="dashboard">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-12 animate-fade-in">
                    <h2 className="text-4xl font-bold text-foreground mb-4">
                        Risk Analysis for {data.location.city || location}
                    </h2>
                    <p className="text-muted-foreground text-lg">
                        {riskAnalysis.title}
                    </p>
                </div>
                
                {/* Use the passed isLoading prop */}
                {isLoading && (
                    <div className="flex justify-center items-center h-20 text-foreground">
                        <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                        <span className="text-lg">Analyzing Climate Data...</span>
                    </div>
                )}
                
                {/* Display backend error if present */}
                {data._error && (
                    <Card className="p-4 mb-8 bg-destructive/20 border-destructive">
                        <p className="font-semibold text-destructive">Error: {data._error}</p>
                    </Card>
                )}


                {/* Risk Score & Severity */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12 animate-fade-in">
                    <div className="bg-card border border-border rounded-2xl p-8 flex items-center justify-center">
                        <RiskGauge score={riskScore} /> 
                    </div>
                    <div className="bg-card border border-border rounded-2xl p-8 flex flex-col justify-center">
                        <SeverityBar level={severityLevel} />
                        <div className="mt-8 pt-8 border-t border-border">
                            <div className="flex items-center gap-3 text-muted-foreground">
                                <TrendingUp className="w-5 h-5" />
                                <span className="text-sm">Risk trend: {riskAnalysis.riskTrend.trend} over {riskAnalysis.riskTrend.period}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Map & Key Factors */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12 animate-fade-in">
                    <RiskMap city={data.location.city || location} />
                    <KeyFactors factors={keyFactors} />
                </div>

                {/* Short-Term Forecast */}
                <div className="mb-12 animate-fade-in">
                    <h3 className="text-2xl font-semibold text-foreground mb-6">
                        Short-Term Forecast (24-72 hours)
                    </h3>
                    <ForecastCards forecast={forecast} />
                </div>
            </div>
        </section>
    );
};
// Removed the export default Index; line from the end of the RiskDashboard file.