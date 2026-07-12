// src/components/ForecastCards.tsx

import { Cloud, CloudRain, Sun, Wind } from "lucide-react";
import { Card } from "@/components/ui/card";

// ⚠️ UPDATED: The structure now matches the backend/Gemini output keys more closely, 
// and assumes 'probability' might come as a string (e.g., "15%") from the AI.
interface ForecastDay {
  day: string;
  date: string;
  // NOTE: This field is not explicitly in your desired Gemini output, 
  // but is crucial for gradient/color logic. We'll derive it from riskScore/riskLevel.
  risk: string; 
  condition: string;
  probability: string; // Keep as string to match Gemini output example ("15%")
}

interface ForecastCardsProps {
  forecast?: ForecastDay[];
  riskLevel?: string; // Passed down from parent component for general risk context
}

// Utility function to convert the string probability (e.g., "60%") to a number (60)
const parseProbability = (prob: string): number => {
    const num = parseFloat(prob.replace('%', ''));
    return isNaN(num) ? 0 : Math.min(100, num);
};

// Utility function to map the risk level used for color coding
const mapRiskLevel = (risk: string): "low" | "medium" | "high" | "default" => {
    const lowerRisk = risk.toLowerCase();
    if (lowerRisk.includes('low') || lowerRisk.includes('minimal')) return "low";
    if (lowerRisk.includes('moderate') || lowerRisk.includes('medium')) return "medium";
    if (lowerRisk.includes('severe') || lowerRisk.includes('high') || lowerRisk.includes('critical')) return "high";
    return "default";
};


export const ForecastCards = ({ forecast: customForecast }: ForecastCardsProps) => {
  const defaultForecasts: ForecastDay[] = [
    // Default data structure now uses the string probability format
    { day: "Today", date: "Oct 29", risk: "low", condition: "Clear", probability: "15%" },
    { day: "Tomorrow", date: "Oct 30", risk: "medium", condition: "Cloudy", probability: "45%" },
    { day: "Day 3", date: "Oct 31", risk: "high", condition: "Rain", probability: "80%" },
  ];

  // Use dynamic data if provided, otherwise use defaults
  const forecasts = customForecast || defaultForecasts;

  // --- Styling Logic (remains mostly the same, adapted to use helper functions) ---

  const getIcon = (condition: string) => {
    // ... (same implementation as before) ...
    switch (condition) {
      case "Clear":
        return <Sun className="w-8 h-8 text-emerald-200" />;
      case "Cloudy":
        return <Cloud className="w-8 h-8 text-emerald-200" />;
      case "Rain":
        return <CloudRain className="w-8 h-8 text-emerald-200" />;
      default:
        return <Wind className="w-8 h-8 text-emerald-200" />;
    }
  };

  const getGradient = (risk: string) => {
    const mappedRisk = mapRiskLevel(risk);
    switch (mappedRisk) {
      case "low":
        return "bg-gradient-to-br from-emerald-950 to-emerald-800";
      case "medium":
        return "bg-gradient-to-br from-lime-950 to-emerald-800";
      case "high":
        return "bg-gradient-to-br from-rose-950 to-emerald-900";
      default:
        return "bg-gradient-to-br from-zinc-800 to-emerald-900";
    }
  };

  const getBarColor = (risk: string) => {
    const mappedRisk = mapRiskLevel(risk);
    switch (mappedRisk) {
      case "low":
        return "bg-emerald-500";
      case "medium":
        return "bg-lime-500";
      case "high":
        return "bg-rose-500";
      default:
        return "bg-neutral-500";
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {forecasts.map((forecast, index) => {
        // Calculate the risk level string and probability number for display/style
        const riskStyle = forecast.risk; 
        const probabilityValue = parseProbability(forecast.probability);
        
        return (
          <Card
            key={index}
            className={`${getGradient(
              riskStyle
            )} p-6 rounded-2xl shadow-md hover:shadow-lg hover:scale-[1.02] transition-all duration-300 bg-gradient-to-br from-emerald-950 to-emerald-800 border border-emerald-900 text-emerald-100`}
          >
            <div className="flex flex-col items-center text-center space-y-2">
              <h4 className="text-xl font-semibold text-emerald-100">{forecast.day}</h4>
              <p className="text-sm text-emerald-300/80">{forecast.date}</p>

              <div className="mt-2">{getIcon(forecast.condition)}</div>

              <p className="text-lg font-medium text-emerald-100">{forecast.condition}</p>

              <div className="w-full bg-emerald-950/40 rounded-full h-2 mt-2">
                <div
                  // ⚠️ DYNAMIC STYLE: Using calculated percentage width
                  className={`h-full rounded-full ${getBarColor(riskStyle)}`}
                  style={{ width: `${probabilityValue}%` }}
                />
              </div>

              <p className="text-sm text-emerald-300/80">
                {/* ⚠️ DYNAMIC DISPLAY: Use the original string for display */}
                {forecast.probability} probability
              </p>
            </div>
          </Card>
        );
      })}
    </div>
  );
};