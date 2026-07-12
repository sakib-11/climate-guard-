import { useQuery } from "@tanstack/react-query";

export interface AiCityRiskData {
  location: { city: string; lat: string; lon: string };
  riskAnalysis: any;
  threatSummary: any;
  _error?: string;
}

export interface AiCityRiskRequest {
  city: string;
  lat?: string;
  lon?: string;
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5010").replace(/\/$/, "");

export const getAiCityRiskQueryKey = (request: AiCityRiskRequest) =>
  [
    "ai-city-risk",
    request.city.trim().toLowerCase(),
    request.lat ?? "",
    request.lon ?? "",
  ] as const;

export const fetchAiCityRiskData = async ({
  city,
  lat,
  lon,
}: AiCityRiskRequest): Promise<AiCityRiskData> => {
  const apiUrl = `${API_BASE_URL}/api/ai/city/${encodeURIComponent(city)}`;
  const params = new URLSearchParams();

  if (lat) {
    params.append("lat", lat);
  }
  if (lon) {
    params.append("lon", lon);
  }

  const url = params.toString() ? `${apiUrl}?${params.toString()}` : apiUrl;
  const response = await fetch(url);

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody._error || `Server error: ${response.status} ${response.statusText}`);
  }

  return response.json();
};

export const useAiCityRiskData = (
  request: AiCityRiskRequest,
  options: { enabled?: boolean } = {},
) =>
  useQuery({
    queryKey: getAiCityRiskQueryKey(request),
    queryFn: () => fetchAiCityRiskData(request),
    enabled: options.enabled ?? true,
    staleTime: 5 * 60 * 1000,
  });
