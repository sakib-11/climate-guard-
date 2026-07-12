import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LayoutDashboard, LogOut } from "lucide-react";
import { toast } from "sonner";

import { Hero } from "@/components/Hero";
import { RiskDashboard } from "@/components/RiskDashboard";
import { ActionGuidance } from "@/components/ActionGuidance";
import { CommunityFeed } from "@/components/CommunityFeed";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { type AiCityRiskData, useAiCityRiskData } from "@/hooks/useAiCityRiskData";

interface SearchRequest {
  city: string;
  lat: string;
  lon: string;
}

const geocodeLocation = (city: string): SearchRequest | null => {
  const cityMap: Record<string, { lat: string; lon: string }> = {
    london: { lat: "51.5074", lon: "0.1278" },
    tokyo: { lat: "35.6895", lon: "139.6917" },
    miami: { lat: "25.7617", lon: "-80.1918" },
    mumbai: { lat: "19.0760", lon: "72.8777" },
  };

  const normalizedCity = city.toLowerCase().trim();
  const coords = cityMap[normalizedCity];

  if (coords) {
    return { city, ...coords };
  }

  return { city, lat: "40.7128", lon: "-74.0060" };
};

const AnalysisSkeleton = () => (
  <div id="dashboard">
    <section className="py-20 px-6 bg-background">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="space-y-3 text-center">
          <Skeleton className="mx-auto h-10 w-80 max-w-full" />
          <Skeleton className="mx-auto h-5 w-[32rem] max-w-full" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="rounded-2xl border border-border p-8 space-y-4">
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
          <div className="rounded-2xl border border-border p-8 space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Skeleton className="h-[26rem] w-full rounded-2xl" />
          <Skeleton className="h-[26rem] w-full rounded-2xl" />
        </div>

        <div className="space-y-4">
          <Skeleton className="h-8 w-72" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </section>
  </div>
);

const Index = () => {
  const [searchLocation, setSearchLocation] = useState<string | null>(null);
  const [searchRequest, setSearchRequest] = useState<SearchRequest | null>(null);
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const lastToastKey = useRef<string | null>(null);

  const riskQuery = useAiCityRiskData(
    searchRequest ?? { city: "", lat: "", lon: "" },
    { enabled: Boolean(searchRequest) },
  );

  const riskData: AiCityRiskData | null = riskQuery.data ?? null;
  const isAnalyzing = Boolean(searchRequest) && (riskQuery.isPending || riskQuery.isFetching);

  const handleSearch = (city: string) => {
    if (!city.trim()) {
      toast.error("Please enter a location to search.");
      return;
    }

    const geo = geocodeLocation(city);
    if (!geo) {
      toast.error("Could not determine coordinates for the location.");
      return;
    }

    setSearchLocation(geo.city);
    setSearchRequest(geo);
  };

  useEffect(() => {
    if (!searchRequest) {
      return;
    }

    const toastKey = `${searchRequest.city}:${riskQuery.status}:${riskQuery.dataUpdatedAt}:${riskQuery.errorUpdatedAt}`;
    if (lastToastKey.current === toastKey) {
      return;
    }

    if (riskQuery.isSuccess && riskQuery.data) {
      lastToastKey.current = toastKey;

      if (riskQuery.data._error) {
        toast.error(`AI analysis fallback notice: ${riskQuery.data._error}`);
      } else {
        toast.success(`Risk analysis ready for ${searchRequest.city}.`);
      }
    }

    if (riskQuery.isError) {
      lastToastKey.current = toastKey;
      const message =
        riskQuery.error instanceof Error
          ? riskQuery.error.message
          : "Unknown connection error.";
      toast.error(`Error during analysis: ${message}`);
    }
  }, [
    riskQuery.data,
    riskQuery.dataUpdatedAt,
    riskQuery.error,
    riskQuery.errorUpdatedAt,
    riskQuery.isError,
    riskQuery.isSuccess,
    riskQuery.status,
    searchRequest,
  ]);

  useEffect(() => {
    if (!searchRequest || isAnalyzing) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      document.getElementById("dashboard")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);

    return () => window.clearTimeout(timeoutId);
  }, [isAnalyzing, searchRequest]);

  const recommendations = riskData?.riskAnalysis?.recommendations || {};
  const threatSummary = riskData?.threatSummary || {};

  return (
    <div className="min-h-screen relative">
      <div className="fixed top-4 right-4 flex items-center gap-3 z-50">
        <Button
          variant="outline"
          size="sm"
          className="text-green-700 border-green-300 bg-white/70 backdrop-blur-sm hover:bg-green-500 transition-all shadow-md"
          onClick={() => navigate("/dashboard")}
        >
          <LayoutDashboard className="w-4 h-4 mr-2" /> Dashboard
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="text-white border-red-400 bg-red-700 hover:bg-red-500 transition-all shadow-md"
          onClick={signOut}
        >
          <LogOut className="w-4 h-4 mr-2" /> Sign Out
        </Button>
      </div>

      <Hero onSearch={handleSearch} />

      {searchLocation && isAnalyzing && <AnalysisSkeleton />}

      {searchLocation && riskData && (
        <div id="dashboard">
          <RiskDashboard
            location={searchLocation}
            data={riskData}
            isLoading={riskQuery.isFetching}
          />

          <section className="py-20 px-6 bg-muted/30">
            <div className="max-w-7xl mx-auto">
              <h2 className="text-3xl font-bold text-foreground mb-8 text-center">
                Preparedness & Action Guidance
              </h2>
              <ActionGuidance
                recommendations={recommendations}
                threatSummary={threatSummary}
                isLoading={riskQuery.isFetching}
              />
            </div>
          </section>

          <section className="py-20 px-6 bg-background">
            <div className="max-w-4xl mx-auto">
              <CommunityFeed />
            </div>
          </section>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default Index;
