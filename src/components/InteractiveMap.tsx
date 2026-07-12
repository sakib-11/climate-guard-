import { useState, useEffect } from "react";
import { MapPin, Layers, ZoomIn, ZoomOut, AlertTriangle, Cloud, Zap, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

// --- NEW INTERFACES (Matching data passed from Dashboard.tsx) ---
interface MapVisualization {
    title: string;
    description: string;
    status: string; // e.g., Critical, High, Moderate
}

interface KeyFactor {
    factor: string; // e.g., Air Quality Index (AQI)
    status: string; // e.g., Critical, Elevated
}

interface InteractiveMapProps {
    location: string;
    hazards: {
        flood?: boolean;
        wildfire?: boolean;
        cyclone?: boolean;
        heatwave?: boolean;
        drought?: boolean;
        earthquake?: boolean;
    };
    // NEW PROPS: Data passed from the Gemini logs (via Dashboard)
    mapVisualization?: MapVisualization | null;
    keyFactors?: KeyFactor[] | null;
}

const hazardColors = {
    flood: '#3B82F6',
    wildfire: '#EF4444',
    cyclone: '#8B5CF6',
    heatwave: '#F59E0B',
    drought: '#D97706',
    earthquake: '#6B7280',
};

// Helper function to get style based on map status
const getRiskBannerStyle = (status: string) => {
    switch (status) {
        case 'Critical':
        case 'Severe':
            return { bg: 'bg-red-700', icon: AlertTriangle, text: 'text-red-100', color: '#dc2626' };
        case 'High':
            return { bg: 'bg-orange-600', icon: Zap, text: 'text-orange-100', color: '#f97316' };
        case 'Moderate':
            return { bg: 'bg-yellow-500', icon: Cloud, text: 'text-yellow-900', color: '#facc15' };
        default:
            return { bg: 'bg-green-600', icon: CheckCircle, text: 'text-green-100', color: '#16a34a' };
    }
};


export const InteractiveMap = ({ location, hazards, mapVisualization, keyFactors }: InteractiveMapProps) => {
    const [zoom, setZoom] = useState(1);
    const [activeLayersState, setActiveLayersState] = useState(hazards);
    const [showLayerControl, setShowLayerControl] = useState(false);
    
    // Set initial layers state from props once
    useEffect(() => {
        setActiveLayersState(hazards);
    }, [hazards]);

    const toggleLayer = (hazard: keyof typeof hazardColors) => {
        setActiveLayersState(prev => ({
            ...prev,
            [hazard]: !prev[hazard]
        }));
    };

    const handleZoomIn = () => setZoom(Math.min(zoom + 0.2, 2));
    const handleZoomOut = () => setZoom(Math.max(zoom - 0.2, 0.5));

    const riskStyle = mapVisualization ? getRiskBannerStyle(mapVisualization.status) : getRiskBannerStyle('Normal');
    const IconComponent = riskStyle.icon;

    // --- Dynamic Hazard Grid Visualization ---
    // The visual density of the risk map is now tied to the Gemini status
    const riskLevel = mapVisualization?.status === 'Critical' ? 0.9 : mapVisualization?.status === 'High' ? 0.75 : 0.4;
    const activeLayers = Object.entries(activeLayersState).filter(([_, active]) => active).map(([hazard]) => hazard);

    return (
        <div className="relative bg-muted rounded-2xl overflow-hidden border border-border">
            
            {/* Dynamic Risk Indicator Banner (New) */}
            <div className={`absolute top-0 left-0 right-0 p-3 ${riskStyle.bg} text-white z-20 flex items-center gap-3 shadow-lg`}>
                <IconComponent className="w-5 h-5" />
                <div>
                    <h3 className="font-bold text-sm leading-none">{mapVisualization?.title || "Regional Climate Map"}</h3>
                    
                </div>
            </div>

            {/* Map Controls */}
            <div className="absolute top-16 right-4 z-30 flex flex-col gap-2"> {/* Adjusted top position */}
                <Button
                    size="icon"
                    variant="secondary"
                    onClick={() => setShowLayerControl(!showLayerControl)}
                    className="bg-card hover:bg-card/90 shadow-[var(--shadow-soft)]"
                >
                    <Layers className="w-4 h-4" />
                </Button>
                <Button
                    size="icon"
                    variant="secondary"
                    onClick={handleZoomIn}
                    className="bg-card hover:bg-card/90 shadow-[var(--shadow-soft)]"
                >
                    <ZoomIn className="w-4 h-4" />
                </Button>
                <Button
                    size="icon"
                    variant="secondary"
                    onClick={handleZoomOut}
                    className="bg-card hover:bg-card/90 shadow-[var(--shadow-soft)]"
                >
                    <ZoomOut className="w-4 h-4" />
                </Button>
            </div>

            {/* Layer Control Panel */}
            {showLayerControl && (
                <div className="absolute top-16 left-4 z-30 bg-card p-4 rounded-xl shadow-[var(--shadow-soft)] border border-border animate-fade-in">
                    <h3 className="font-semibold text-foreground mb-3 text-sm">Hazard Layers</h3>
                    <div className="space-y-2">
                        {Object.entries(hazardColors).map(([hazard, color]) => (
                            <div key={hazard} className="flex items-center gap-2">
                                <Switch
                                    checked={activeLayersState[hazard as keyof typeof hazardColors]}
                                    onCheckedChange={() => toggleLayer(hazard as keyof typeof hazardColors)}
                                    id={`layer-${hazard}`}
                                />
                                <Label htmlFor={`layer-${hazard}`} className="flex items-center gap-2 text-sm cursor-pointer">
                                    <div 
                                        className="w-3 h-3 rounded-full" 
                                        style={{ backgroundColor: color }}
                                    />
                                    <span className="capitalize">{hazard}</span>
                                </Label>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Map Visualization Container */}
            <div className="relative h-96 pt-12" style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}>
                
                {/* Dynamic Risk Grid Visualization (Tied to Gemini Status) */}
                <div className="absolute inset-0 pt-12 opacity-80" style={{ transform: `scale(${1 / zoom})`, transformOrigin: 'center' }}>
                    <div className="grid grid-cols-12 grid-rows-12 h-full">
                        {Array.from({ length: 144 }).map((_, i) => {
                            // Only apply color if at least one layer is active
                            const shouldShowRisk = activeLayers.length > 0 && Math.random() < riskLevel;
                            const randomHazard = activeLayers[Math.floor(Math.random() * activeLayers.length)];
                            
                            return (
                                <div
                                    key={i}
                                    className="transition-colors duration-500"
                                    style={{
                                        backgroundColor: shouldShowRisk && randomHazard 
                                            ? `${hazardColors[randomHazard as keyof typeof hazardColors]}33` // 33 is ~20% opacity
                                            : 'transparent',
                                        // Add a subtle border effect for map texture
                                        border: '1px solid rgba(0,0,0,0.05)', 
                                    }}
                                />
                            );
                        })}
                    </div>
                </div>
                
                {/* Location marker */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40">
                    <div className="relative">
                        <div className="absolute inset-0 bg-primary rounded-full animate-ping opacity-75" />
                        <div className="relative bg-primary text-primary-foreground p-4 rounded-full shadow-lg">
                            <MapPin className="w-8 h-8" />
                        </div>
                    </div>
                </div>

                {/* Location label */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-card px-4 py-2 rounded-lg shadow-lg border border-border z-40">
                    <p className="text-sm font-semibold text-foreground">{location}</p>
                    <p className="text-xs text-muted-foreground">
                        {Object.values(activeLayersState).filter(Boolean).length} hazard layers active
                    </p>
                </div>
            </div>
        </div>
    );
};