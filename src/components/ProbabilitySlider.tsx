import { useState, useEffect, useMemo } from "react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Thermometer, Droplet, Zap, Leaf } from "lucide-react";

// --- INTERFACES ---
interface SensitivityFilter {
    factor: string;
    value: string;
    filterStrength: string;
}

interface ProbabilitySlidersProps {
    onThresholdChange?: (values: Record<string, number>) => void;
    sensitivityData: SensitivityFilter[];
}

interface ProcessedSlider {
    key: string;
    label: string;
    icon: React.ReactNode;
    initialValue: number;
    geminiValue: string;
    geminiStrength: string;
}

const FACTOR_MAP: Record<string, { key: string, icon: React.ReactNode }> = {
    'temperature': { key: 'temperature', icon: <Thermometer className="w-4 h-4 text-orange-300" /> },
    'rainfall': { key: 'rainfall', icon: <Droplet className="w-4 h-4 text-blue-300" /> },
    'pollution': { key: 'pollution', icon: <Zap className="w-4 h-4 text-yellow-300" /> },
    'deforestation': { key: 'deforestation', icon: <Leaf className="w-4 h-4 text-lime-300" /> },
};


export const ProbabilitySliders = ({ onThresholdChange, sensitivityData }: ProbabilitySlidersProps) => {
    
    // State to hold the current user-set thresholds
    const [thresholds, setThresholds] = useState({
        temperature: 40,
        rainfall: 60,
        pollution: 50,
        deforestation: 30,
    });

    // --- Process External Data and Initial State ---
    const processedSliders: ProcessedSlider[] = useMemo(() => {
        const geminiMap = sensitivityData.reduce((acc, filter) => {
            const factorKey = 
                filter.factor.toLowerCase().includes('temperature') || filter.factor.toLowerCase().includes('heat') ? 'temperature' :
                filter.factor.toLowerCase().includes('rainfall') || filter.factor.toLowerCase().includes('moisture') ? 'rainfall' :
                filter.factor.toLowerCase().includes('emission') || filter.factor.toLowerCase().includes('pollution') || filter.factor.toLowerCase().includes('matter') ? 'pollution' :
                filter.factor.toLowerCase().includes('deforestation') || filter.factor.toLowerCase().includes('land use') ? 'deforestation' :
                '';

            if (factorKey) {
                acc[factorKey] = filter;
            }
            return acc;
        }, {} as Record<string, SensitivityFilter>);

        const sliderList: ProcessedSlider[] = [
            { key: 'temperature', label: 'Heat/Temp Sensitivity', icon: FACTOR_MAP.temperature.icon, initialValue: thresholds.temperature },
            { key: 'pollution', label: 'Pollution/Emissions Sensitivity', icon: FACTOR_MAP.pollution.icon, initialValue: thresholds.pollution },
            { key: 'rainfall', label: 'Rainfall/Moisture Sensitivity', icon: FACTOR_MAP.rainfall.icon, initialValue: thresholds.rainfall },
            { key: 'deforestation', label: 'Land Use Change Sensitivity', icon: FACTOR_MAP.deforestation.icon, initialValue: thresholds.deforestation },
        ].map(slider => ({
            ...slider,
            geminiValue: geminiMap[slider.key]?.value || 'N/A',
            geminiStrength: geminiMap[slider.key]?.filterStrength || 'None',
        }));

        return sliderList;

    }, [sensitivityData, thresholds]);


    // --- Helper Functions ---
    const getThresholdColor = (val: number) => {
        if (val < 30) return "text-green-500";
        if (val < 70) return "text-yellow-400";
        return "text-red-500";
    };

    /** * 🚨 FIX: This function is updated to calculate and dispatch
     * the combined threshold whenever *any* slider is changed.
     */
    const handleChange = (key: string, value: number[]) => {
        const updated = { ...thresholds, [key]: value[0] };
        setThresholds(updated);

        // Calculate the average of all thresholds
        const keys = Object.keys(updated);
        const sum = keys.reduce((total, currentKey) => total + updated[currentKey as keyof typeof thresholds], 0);
        const combinedThreshold = Math.round(sum / keys.length);

        // Pass the calculated combined threshold back to the parent
        onThresholdChange?.({
            ...updated, // Pass all individual values
            coreThreshold: combinedThreshold // Pass the key the parent is expecting
        });
    };

    // --- Render ---
    return (
        <Card className="flex flex-col justify-between h-auto bg-gradient-to-br from-green-800 to-green-900 border-none text-white rounded-2xl shadow-md p-6">
            <div>
                <h3 className="text-xl font-semibold text-white mb-2">
                    Environmental Sensitivity Filters
                </h3>

                {processedSliders.map(slider => (
                    <div key={slider.key} className="mb-6 border-b border-green-700/50 pb-4 last:border-b-0 last:pb-0">
                        <div className="flex justify-between items-center mb-2">
                            <Label className="text-green-100 flex items-center gap-2">
                                {slider.icon} {slider.label}
                            </Label>
                            <span className={`font-bold ${getThresholdColor(thresholds[slider.key as keyof typeof thresholds])}`}>
                                {thresholds[slider.key as keyof typeof thresholds]}%
                            </span>
                        </div>
                        
                        <Slider
                            value={[thresholds[slider.key as keyof typeof thresholds]]}
                            onValueChange={(val) => handleChange(slider.key, val)}
                            max={100}
                            step={5}
                            className={`
                                [&>[role=slider]]:bg-green-500 
                                [&>[role=slider]]:hover:bg-green-400 
                                [&>div:first-child]:bg-green-600
                            `}
                        />
                    
                    </div>
                ))}
            </div>

            <div className="mt-6 border-t border-green-700 pt-4 text-sm text-green-100 flex justify-between">
                <span>Total Factor Filters:</span>
                <span className="font-bold text-green-400">
                    {processedSliders.length}
                </span>
            </div>
        </Card>
    );
};

export default ProbabilitySliders;