import React, { useMemo, useState } from "react";
import {
  MapPin,
  Layers,
  ZoomIn,
  ZoomOut,
  AlertTriangle,
  Cloud,
  Zap,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAiCityRiskData } from "@/hooks/useAiCityRiskData";

/* -------------------------
   Types & Helpers
   ------------------------- */

type RawAnyMap = { [k: string]: any };

interface MapVisualization {
  title?: string;
  description?: string;
  status?: string;
}

interface RiskAnalysis {
  mapVisualization?: MapVisualization;
  riskScore?: number | string;
  riskLevel?: string;
  riskTrend?: any;
  [k: string]: any;
}

interface ThreatSummary {
  totalActiveWarnings?: number;
  statusColor?: string;
  criticalAlertsCount?: number;
  severeAlertsCount?: number;
  [k: string]: any;
}

interface RiskData {
  location?: { city?: string; lat?: string; lon?: string } | RawAnyMap;
  riskAnalysis?: RiskAnalysis | RawAnyMap;
  threatSummary?: ThreatSummary | RawAnyMap;
  _error?: string | null;
  [k: string]: any;
}

interface RiskMapProps {
  city: string;
  lat?: string;
  lon?: string;
}

/** pickFirst: return first non-null/undefined value */
const pickFirst = <T,>(...vals: (T | undefined | null)[]): T | undefined => {
  for (const v of vals) {
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
};

const toNumberSafe = (v: any, fallback = 0) => {
  if (v == null) return fallback;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
};

const normalizeSeverity = (raw?: string) => {
  if (!raw) return "normal";
  const s = raw.toString().toLowerCase().trim();
  if (s.includes("crit") || s.includes("severe") || s.includes("danger")) return "critical";
  if (s.includes("high") || s.includes("elevat") || s.includes("warning")) return "high";
  if (s.includes("moderate") || s.includes("mod")) return "moderate";
  if (s.includes("low") || s.includes("safe") || s.includes("green")) return "low";
  if (s.includes("elevated") || s.includes("elev")) return "high";
  if (s.includes("red")) return "critical";
  if (s.includes("orange")) return "high";
  if (s.includes("yellow")) return "moderate";
  if (s.includes("green")) return "low";
  return "normal";
};

const severityStyle = (sev: string) => {
  switch (sev) {
    case "critical":
      return { bg: "bg-red-700", icon: AlertTriangle, text: "text-red-100", colorHex: "#dc2626" };
    case "high":
      return { bg: "bg-orange-600", icon: Zap, text: "text-orange-100", colorHex: "#f97316" };
    case "moderate":
      return { bg: "bg-yellow-500", icon: Cloud, text: "text-yellow-900", colorHex: "#f59e0b" };
    case "low":
      return { bg: "bg-green-600", icon: CheckCircle, text: "text-green-100", colorHex: "#16a34a" };
    default:
      return { bg: "bg-slate-700", icon: CheckCircle, text: "text-white", colorHex: "#64748b" };
  }
};

const hazardColors: Record<string, string> = {
  flood: "#3B82F6",
  wildfire: "#EF4444",
  cyclone: "#8B5CF6",
  heatwave: "#F59E0B",
  drought: "#D97706",
  earthquake: "#6B7280",
};

const seededRng = (seed: number) => {
  let t = Math.floor(seed) + 0x6d2b79f5;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967295;
  };
};

/* -------------------------
   Component
   ------------------------- */

export default function RiskMap({ city, lat, lon }: RiskMapProps) {
  const [zoom, setZoom] = useState<number>(1);
  const [activeLayersState, setActiveLayersState] = useState<Record<string, boolean>>({
    flood: true,
    wildfire: true,
    cyclone: true,
    heatwave: false,
    drought: false,
    earthquake: false,
  });
  const [showLayerControl, setShowLayerControl] = useState(false);
  const riskQuery = useAiCityRiskData(
    { city, lat, lon },
    { enabled: Boolean(city) },
  );
  const raw = (riskQuery.data as RiskData | undefined) ?? null;
  const isLoading = riskQuery.isPending || riskQuery.isFetching;
  const errorMessage = riskQuery.error instanceof Error ? riskQuery.error.message : null;

  const parsed = useMemo(() => {
    const data: RiskData = raw || ({} as RiskData);

    // ensure locAny is a RawAnyMap for flexible access
    const locAny = (data.location || {}) as RawAnyMap;

    const cityFromData =
      pickFirst(
        locAny.city,
        locAny.name,
        (data as any).city,
        (data as any)?.location?.city
      ) || city;

    const latFromData =
      pickFirst(
        locAny.lat,
        locAny["latitude"],
        (data as any)?.lat,
        (data as any)?.location?.lat
      ) || lat || "";

    const lonFromData =
      pickFirst(
        locAny.lon,
        locAny["longitude"],
        (data as any)?.lon,
        (data as any)?.location?.lon
      ) || lon || "";

    const raAny: RawAnyMap = pickFirst(
      (data as any).riskAnalysis,
      (data as any).risk_analysis,
      (data as any).analysis,
      {}
    ) as RawAnyMap;

    const mapVisAny: RawAnyMap = pickFirst(
      raAny?.mapVisualization,
      raAny?.map_visualization,
      raAny?.visualization,
      {}
    ) as RawAnyMap;

    const tsAny: RawAnyMap = pickFirst(
      (data as any).threatSummary,
      (data as any).threat_summary,
      (data as any).summary,
      {}
    ) as RawAnyMap;

    const rawScore = pickFirst(raAny?.riskScore, raAny?.risk_score, raAny?.score, raAny?.risk);
    const riskScore = Math.max(0, Math.min(100, toNumberSafe(rawScore, 0)));

    const rawLevel = pickFirst(raAny?.riskLevel, raAny?.risk_level, raAny?.level, tsAny?.status || "");
    const riskLevel = (rawLevel && String(rawLevel)) || "";

    const mapVisualization = {
      title: String(pickFirst(mapVisAny?.title, mapVisAny?.name, raAny?.title, "Regional Climate Map") || ""),
      description: String(pickFirst(mapVisAny?.description, mapVisAny?.desc, raAny?.description, "") || ""),
      status: String(pickFirst(mapVisAny?.status, mapVisAny?.state, raAny?.status, "") || ""),
    };

    const threatSummary: ThreatSummary = {
      totalActiveWarnings: toNumberSafe(pickFirst(tsAny?.totalActiveWarnings, tsAny?.total_active_warnings, tsAny?.activeWarnings), 0),
      statusColor: String(pickFirst(tsAny?.statusColor, tsAny?.status_color, tsAny?.color, "") || ""),
      criticalAlertsCount: toNumberSafe(pickFirst(tsAny?.criticalAlertsCount, tsAny?.critical_alerts_count), 0),
      severeAlertsCount: toNumberSafe(pickFirst(tsAny?.severeAlertsCount, tsAny?.severe_alerts_count), 0),
    };

    const keyFactors =
      pickFirst(raAny?.keyFactors, raAny?.key_factors, (data as any)?.keyFactors, (data as any)?.key_factors) || [];

    const sensitivityFilters = pickFirst(raAny?.sensitivityFilters, raAny?.sensitivity_filters, (data as any)?.sensitivityFilters, []) || [];

    const activeAlerts =
      pickFirst(raAny?.activeAlerts, raAny?.active_alerts, (data as any)?.activeAlerts, (data as any)?.active_alerts) || [];

    let resolvedSeverity = String(pickFirst(threatSummary.statusColor, mapVisualization.status, riskLevel) || "");
    if (!resolvedSeverity) {
      if (riskScore >= 85) resolvedSeverity = "critical";
      else if (riskScore >= 65) resolvedSeverity = "high";
      else if (riskScore >= 40) resolvedSeverity = "moderate";
      else resolvedSeverity = "low";
    }

    return {
      city: String(cityFromData || city),
      lat: String(latFromData || ""),
      lon: String(lonFromData || ""),
      mapVisualization,
      riskScore,
      riskLevel: String(riskLevel || (riskScore > 75 ? "High" : riskScore > 40 ? "Moderate" : "Low")),
      keyFactors,
      sensitivityFilters,
      activeAlerts,
      threatSummary,
      resolvedSeverity: normalizeSeverity(resolvedSeverity),
      raw: data,
    };
  }, [raw, city, lat, lon]);

  const riskStyle = severityStyle(parsed.resolvedSeverity);
  const IconComponent = riskStyle.icon;

  const visualIntensity = useMemo(() => {
    const v = Math.max(0, Math.min(100, parsed.riskScore));
    return Math.pow(v / 100, 1.1);
  }, [parsed.riskScore]);

  const rng = useMemo(() => seededRng(Math.round(parsed.riskScore || 0) || 42), [parsed.riskScore]);

  const activeLayers = Object.keys(activeLayersState).filter((k) => !!activeLayersState[k]);

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.2, 2));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.2, 0.5));
  const toggleLayer = (hazard: string) =>
    setActiveLayersState((prev) => ({ ...prev, [hazard]: !prev[hazard] }));

  const hotProbability = Math.max(0.05, visualIntensity * (activeLayers.length > 0 ? 1 : 0.4));

  return (
    <div className="relative bg-muted rounded-2xl overflow-hidden border border-border h-[26rem]">
      {/* Banner */}
      <div className={`absolute top-0 left-0 right-0 p-3 ${riskStyle.bg} text-white z-20 flex items-center gap-3 shadow-lg`}>
        <IconComponent className="w-5 h-5" />
        <div>
          <h3 className="font-bold text-sm leading-none">
            {isLoading ? "Loading AI risk analysis..." : parsed.mapVisualization.title || "Regional Climate Map"}
          </h3>
          {errorMessage && !isLoading && (
            <p className="mt-1 text-xs text-white/90">
              {errorMessage}
            </p>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="absolute top-16 right-4 z-30 flex flex-col gap-2">
        <Button size="icon" variant="secondary" onClick={() => setShowLayerControl((s) => !s)} className="bg-card hover:bg-card/90">
          <Layers className="w-4 h-4" />
        </Button>
        <Button size="icon" variant="secondary" onClick={handleZoomIn} className="bg-card hover:bg-card/90">
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button size="icon" variant="secondary" onClick={handleZoomOut} className="bg-card hover:bg-card/90">
          <ZoomOut className="w-4 h-4" />
        </Button>
      </div>

      {/* Layer Control */}
      {showLayerControl && (
        <div className="absolute top-16 left-4 z-30 bg-card p-4 rounded-xl shadow-md border border-border animate-fade-in">
          <h3 className="font-semibold text-foreground mb-3 text-sm">Hazard Layers</h3>
          <div className="space-y-2">
            {Object.keys(hazardColors).map((hazard) => (
              <div key={hazard} className="flex items-center gap-2">
                <Switch checked={!!activeLayersState[hazard]} onCheckedChange={() => toggleLayer(hazard)} id={`layer-${hazard}`} />
                <Label htmlFor={`layer-${hazard}`} className="flex items-center gap-2 text-sm cursor-pointer">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: hazardColors[hazard] }} />
                  <span className="capitalize">{hazard}</span>
                </Label>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Map Visualization */}
      <div className="relative h-full pt-12" style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}>
        <div className="absolute inset-0 pt-12 opacity-100" style={{ transform: `scale(${1 / zoom})`, transformOrigin: "center" }}>
          <div className="grid grid-cols-12 grid-rows-12 h-full">
            {Array.from({ length: 144 }).map((_, i) => {
              const r = rng();
              const layerIndex = activeLayers.length ? Math.floor(r * activeLayers.length) : 0;
              const chosenHazard = activeLayers.length ? activeLayers[layerIndex % activeLayers.length] : null;
              const chance = rng();
              const shouldShow = chance < hotProbability;

              const bg = shouldShow && chosenHazard ? `${hazardColors[chosenHazard as keyof typeof hazardColors]}33` : "transparent";
              const boxShadow = shouldShow ? "0 4px 8px rgba(0,0,0,0.12)" : "inset 0 1px 0 rgba(255,255,255,0.02)";

              return (
                <div
                  key={i}
                  className="transition-colors duration-700"
                  style={{
                    background: bg,
                    border: "1px solid rgba(0,0,0,0.05)",
                    boxShadow,
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Marker */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40">
          <div className="relative">
            <div className="absolute inset-0 rounded-full animate-ping" style={{ background: `${riskStyle.colorHex}`, opacity: 0.12 }} />
            <div className="relative bg-primary text-primary-foreground p-4 rounded-full shadow-lg">
              <MapPin className="w-8 h-8" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
