import { useState, useEffect, useMemo } from "react";
import { Calendar, Clock, RefreshCw, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

// --- EMBEDDED PREDICTION DATA ---
interface Prediction {
    ISO: string;
    Date: string;
    RF_Prediction_Probability: number;
    XGB_Prediction_Probability: number;
}

const SIMULATOR_DATA = {
    "countries": ["AFG", "AGO", "AIA", "ALB", "ANT", "ARE", "ARG", "ARM", "ASM", "ATG", "AUS", "AUT", "AZE", "AZO", "BDI", "BEL", "BEN", "BFA", "BGD", "BGR", "BHR", "BHS", "BIH", "BLM", "BLR", "BLZ", "BMU", "BOL", "BRA", "BRB", "BRN", "BTN", "BWA", "CAF", "CAN", "CHE", "CHL", "CHN", "CIV", "CMR", "COD", "COG", "COK", "COL", "COM", "CPV", "CRI", "CSK", "CUB", "CYM", "CYP", "CZE", "DDR", "DEU", "DFR", "DJI", "DMA", "DNK", "DOM", "DZA", "ECU", "EGY", "ERI", "ESP", "EST", "ETH", "FIN", "FJI", "FRA", "FSM", "GAB", "GBR", "GEO", "GHA", "GIN", "GLP", "GMB", "GNB", "GNQ", "GRC", "GRD", "GTM", "GUF", "GUM", "GUY", "HKG", "HND", "HRV", "HTI", "HUN", "IDN", "IND", "IRL", "IRN", "IRQ", "ISL", "ISR", "ITA", "JAM", "JOR", "JPN", "KAZ", "KEN", "KGZ", "KHM", "KIR", "KNA", "KOR", "KWT", "LAO", "LBN", "LBR", "LBY", "LCA", "LIE", "LKA", "LSO", "LTU", "LUX", "LVA", "MAC", "MAF", "MAR", "MDA", "MDG", "MDV", "MEX", "MHL", "MKD", "MLI", "MLT", "MMR", "MNE", "MNG", "MNP", "MOZ", "MRT", "MSR", "MTQ", "MUS", "MWI", "MYS", "MYT", "NAM", "NCL", "NER", "NGA", "NIC", "NIU", "NLD", "NOR", "NPL", "NZL", "OMN", "PAK", "PAN", "PER", "PHL", "PLW", "PNG", "POL", "PRI", "PRK", "PRT", "PRY", "PSE", "PYF", "QAT", "REU", "ROU", "RUS", "RWA", "SAU", "SCG", "SDN", "SEN", "SGP", "SHN", "SLB", "SLE", "SLV", "SOM", "SPI", "SRB", "SSD", "STP", "SUN", "SUR", "SVK", "SVN", "SWE", "SWZ", "SXM", "SYC", "SYR", "TCA", "TCD", "TGO", "THA", "TJK", "TKL", "TKM", "TLS", "TON", "TTO", "TUN", "TUR", "TUV", "TWN", "TZA", "UGA", "UKR", "URY", "USA", "UZB", "VCT", "VEN", "VGB", "VIR", "VNM", "VUT", "WLF", "WSM", "YEM", "YMD", "YMN", "YUG", "ZAF", "ZMB", "ZWE"],
    "predictions": [
		{ "ISO": "AFG", "Date": "2025-10-01", "RF_Prediction_Probability": 0.25050167, "XGB_Prediction_Probability": 0.26912007 },
		{ "ISO": "AGO", "Date": "2025-10-01", "RF_Prediction_Probability": 0.20150816, "XGB_Prediction_Probability": 0.20016573 },
		{ "ISO": "AIA", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "ALB", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "ANT", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "ARE", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "ARG", "Date": "2025-10-01", "RF_Prediction_Probability": 0.27257534, "XGB_Prediction_Probability": 0.27833260 },
		{ "ISO": "ARM", "Date": "2025-10-01", "RF_Prediction_Probability": 0.20150816, "XGB_Prediction_Probability": 0.20016573 },
		{ "ISO": "ASM", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "ATG", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "AUS", "Date": "2025-10-01", "RF_Prediction_Probability": 0.21685185, "XGB_Prediction_Probability": 0.22779125 },
		{ "ISO": "AUT", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "AZE", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "AZO", "Date": "2025-10-01", "RF_Prediction_Probability": 0.21665777, "XGB_Prediction_Probability": 0.21884547 },
		{ "ISO": "BDI", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "BEL", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "BEN", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "BFA", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "BGD", "Date": "2025-10-01", "RF_Prediction_Probability": 1.00000000, "XGB_Prediction_Probability": 0.99984310 },
		{ "ISO": "BGR", "Date": "2025-10-01", "RF_Prediction_Probability": 1.00000000, "XGB_Prediction_Probability": 0.99999774 },
		{ "ISO": "BHR", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "BHS", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "BIH", "Date": "2025-10-01", "RF_Prediction_Probability": 0.21685185, "XGB_Prediction_Probability": 0.22779125 },
		{ "ISO": "BLM", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "BLR", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "BLZ", "Date": "2025-10-01", "RF_Prediction_Probability": 0.20150816, "XGB_Prediction_Probability": 0.20016573 },
		{ "ISO": "BMU", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "BOL", "Date": "2025-10-01", "RF_Prediction_Probability": 0.32564017, "XGB_Prediction_Probability": 0.35064462 },
		{ "ISO": "BRA", "Date": "2025-10-01", "RF_Prediction_Probability": 0.35010101, "XGB_Prediction_Probability": 0.51978360 },
		{ "ISO": "BRB", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "BRN", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "BTN", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "BWA", "Date": "2025-10-01", "RF_Prediction_Probability": 0.21685185, "XGB_Prediction_Probability": 0.22779125 },
		{ "ISO": "CAF", "Date": "2025-10-01", "RF_Prediction_Probability": 0.21665777, "XGB_Prediction_Probability": 0.21884547 },
		{ "ISO": "CAN", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "CHE", "Date": "2025-10-01", "RF_Prediction_Probability": 0.20150816, "XGB_Prediction_Probability": 0.20016573 },
		{ "ISO": "CHL", "Date": "2025-10-01", "RF_Prediction_Probability": 0.21685185, "XGB_Prediction_Probability": 0.22779125 },
		{ "ISO": "CHN", "Date": "2025-10-01", "RF_Prediction_Probability": 0.77499932, "XGB_Prediction_Probability": 0.98451310 },
		{ "ISO": "CIV", "Date": "2025-10-01", "RF_Prediction_Probability": 0.20150816, "XGB_Prediction_Probability": 0.20016573 },
		{ "ISO": "CMR", "Date": "2025-10-01", "RF_Prediction_Probability": 0.20150816, "XGB_Prediction_Probability": 0.20016573 },
		{ "ISO": "COD", "Date": "2025-10-01", "RF_Prediction_Probability": 0.35010101, "XGB_Prediction_Probability": 0.51978360 },
		{ "ISO": "COG", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "COK", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "COL", "Date": "2025-10-01", "RF_Prediction_Probability": 0.47750894, "XGB_Prediction_Probability": 0.54192930 },
		{ "ISO": "COM", "Date": "2025-10-01", "RF_Prediction_Probability": 0.20150816, "XGB_Prediction_Probability": 0.20016573 },
		{ "ISO": "CPV", "Date": "2025-10-01", "RF_Prediction_Probability": 0.21665777, "XGB_Prediction_Probability": 0.21884547 },
		{ "ISO": "CRI", "Date": "2025-10-01", "RF_Prediction_Probability": 0.27257534, "XGB_Prediction_Probability": 0.27833260 },
		{ "ISO": "CSK", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "CUB", "Date": "2025-10-01", "RF_Prediction_Probability": 0.27257534, "XGB_Prediction_Probability": 0.27833260 },
		{ "ISO": "CYM", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "CYP", "Date": "2025-10-01", "RF_Prediction_Probability": 0.21665777, "XGB_Prediction_Probability": 0.21884547 },
		{ "ISO": "CZE", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "DDR", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "DEU", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "DFR", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "DJI", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "DMA", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "DNK", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "DOM", "Date": "2025-10-01", "RF_Prediction_Probability": 0.21685185, "XGB_Prediction_Probability": 0.22779125 },
		{ "ISO": "DZA", "Date": "2025-10-01", "RF_Prediction_Probability": 0.20150816, "XGB_Prediction_Probability": 0.20016573 },
		{ "ISO": "ECU", "Date": "2025-10-01", "RF_Prediction_Probability": 0.27257534, "XGB_Prediction_Probability": 0.27833260 },
		{ "ISO": "EGY", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "ERI", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "ESP", "Date": "2025-10-01", "RF_Prediction_Probability": 1.00000000, "XGB_Prediction_Probability": 0.99993560 },
		{ "ISO": "EST", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "ETH", "Date": "2025-10-01", "RF_Prediction_Probability": 1.00000000, "XGB_Prediction_Probability": 0.99999560 },
		{ "ISO": "FIN", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "FJI", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "FRA", "Date": "2025-10-01", "RF_Prediction_Probability": 0.32564017, "XGB_Prediction_Probability": 0.35064462 },
		{ "ISO": "FSM", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "GAB", "Date": "2025-10-01", "RF_Prediction_Probability": 0.20150816, "XGB_Prediction_Probability": 0.20016573 },
		{ "ISO": "GBR", "Date": "2025-10-01", "RF_Prediction_Probability": 0.20150816, "XGB_Prediction_Probability": 0.20016573 },
		{ "ISO": "GEO", "Date": "2025-10-01", "RF_Prediction_Probability": 0.20150816, "XGB_Prediction_Probability": 0.20016573 },
		{ "ISO": "GHA", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "GIN", "Date": "2025-10-01", "RF_Prediction_Probability": 0.21665777, "XGB_Prediction_Probability": 0.21884547 },
		{ "ISO": "GLP", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "GMB", "Date": "2025-10-01", "RF_Prediction_Probability": 0.21665777, "XGB_Prediction_Probability": 0.21884547 },
		{ "ISO": "GNB", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "GNQ", "Date": "2025-10-01", "RF_Prediction_Probability": 0.21665777, "XGB_Prediction_Probability": 0.21884547 },
		{ "ISO": "GRC", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "GRD", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "GTM", "Date": "2025-10-01", "RF_Prediction_Probability": 0.35866190, "XGB_Prediction_Probability": 0.35097998 },
		{ "ISO": "GUF", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "GUM", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "GUY", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "HKG", "Date": "2025-10-01", "RF_Prediction_Probability": 0.23265527, "XGB_Prediction_Probability": 0.32669112 },
		{ "ISO": "HND", "Date": "2025-10-01", "RF_Prediction_Probability": 1.00000000, "XGB_Prediction_Probability": 0.99999560 },
		{ "ISO": "HRV", "Date": "2025-10-01", "RF_Prediction_Probability": 0.20150816, "XGB_Prediction_Probability": 0.20016573 },
		{ "ISO": "HTI", "Date": "2025-10-01", "RF_Prediction_Probability": 0.32425163, "XGB_Prediction_Probability": 0.16279040 },
		{ "ISO": "HUN", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "IDN", "Date": "2025-10-01", "RF_Prediction_Probability": 0.52526150, "XGB_Prediction_Probability": 0.12253908 },
		{ "ISO": "IND", "Date": "2025-10-01", "RF_Prediction_Probability": 1.00000000, "XGB_Prediction_Probability": 0.99994110 },
		{ "ISO": "IRL", "Date": "2025-10-01", "RF_Prediction_Probability": 0.20150816, "XGB_Prediction_Probability": 0.20016573 },
		{ "ISO": "IRN", "Date": "2025-10-01", "RF_Prediction_Probability": 0.20150816, "XGB_Prediction_Probability": 0.20016573 },
		{ "ISO": "IRQ", "Date": "2025-10-01", "RF_Prediction_Probability": 0.21685185, "XGB_Prediction_Probability": 0.22779125 },
		{ "ISO": "ISL", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "ISR", "Date": "2025-10-01", "RF_Prediction_Probability": 0.20150816, "XGB_Prediction_Probability": 0.20016573 },
		{ "ISO": "ITA", "Date": "2025-10-01", "RF_Prediction_Probability": 0.21685185, "XGB_Prediction_Probability": 0.22779125 },
		{ "ISO": "JAM", "Date": "2025-10-01", "RF_Prediction_Probability": 0.20150816, "XGB_Prediction_Probability": 0.20016573 },
		{ "ISO": "JOR", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "JPN", "Date": "2025-10-01", "RF_Prediction_Probability": 0.19591968, "XGB_Prediction_Probability": 0.02388084 },
		{ "ISO": "KAZ", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "KEN", "Date": "2025-10-01", "RF_Prediction_Probability": 0.21685185, "XGB_Prediction_Probability": 0.22779125 },
		{ "ISO": "KGZ", "Date": "2025-10-01", "RF_Prediction_Probability": 0.20150816, "XGB_Prediction_Probability": 0.20016573 },
		{ "ISO": "KHM", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "KIR", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "KNA", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "KOR", "Date": "2025-10-01", "RF_Prediction_Probability": 0.28671309, "XGB_Prediction_Probability": 0.30003732 },
		{ "ISO": "KWT", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "LAO", "Date": "2025-10-01", "RF_Prediction_Probability": 0.14583953, "XGB_Prediction_Probability": 0.13981147 },
		{ "ISO": "LBN", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "LBR", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "LBY", "Date": "2025-10-01", "RF_Prediction_Probability": 0.20150816, "XGB_Prediction_Probability": 0.20016573 },
		{ "ISO": "LCA", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "LIE", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "LKA", "Date": "2025-10-01", "RF_Prediction_Probability": 0.21685185, "XGB_Prediction_Probability": 0.22779125 },
		{ "ISO": "LSO", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "LTU", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "LUX", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "LVA", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "MAC", "Date": "2025-10-01", "RF_Prediction_Probability": 0.21665777, "XGB_Prediction_Probability": 0.21884547 },
		{ "ISO": "MAF", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "MAR", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "MDA", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "MDG", "Date": "2025-10-01", "RF_Prediction_Probability": 0.47750894, "XGB_Prediction_Probability": 0.54192930 },
		{ "ISO": "MDV", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "MEX", "Date": "2025-10-01", "RF_Prediction_Probability": 1.00000000, "XGB_Prediction_Probability": 0.99999450 },
		{ "ISO": "MHL", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "MKD", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "MLI", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "MLT", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "MMR", "Date": "2025-10-01", "RF_Prediction_Probability": 0.19591968, "XGB_Prediction_Probability": 0.02388084 },
		{ "ISO": "MNE", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "MNG", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "MNP", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "MOZ", "Date": "2025-10-01", "RF_Prediction_Probability": 0.27430621, "XGB_Prediction_Probability": 0.24749796 },
		{ "ISO": "MRT", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "MSR", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "MTQ", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "MUS", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "MWI", "Date": "2025-10-01", "RF_Prediction_Probability": 0.27430621, "XGB_Prediction_Probability": 0.24749796 },
		{ "ISO": "MYS", "Date": "2025-10-01", "RF_Prediction_Probability": 0.32564017, "XGB_Prediction_Probability": 0.35064462 },
		{ "ISO": "MYT", "Date": "2025-10-01", "RF_Prediction_Probability": 0.20150816, "XGB_Prediction_Probability": 0.20016573 },
		{ "ISO": "NAM", "Date": "2025-10-01", "RF_Prediction_Probability": 0.20150816, "XGB_Prediction_Probability": 0.20016573 },
		{ "ISO": "NCL", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "NER", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "NGA", "Date": "2025-10-01", "RF_Prediction_Probability": 0.28671309, "XGB_Prediction_Probability": 0.30003732 },
		{ "ISO": "NIC", "Date": "2025-10-01", "RF_Prediction_Probability": 0.20150816, "XGB_Prediction_Probability": 0.20016573 },
		{ "ISO": "NIU", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "NLD", "Date": "2025-10-01", "RF_Prediction_Probability": 0.20150816, "XGB_Prediction_Probability": 0.20016573 },
		{ "ISO": "NOR", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "NPL", "Date": "2025-10-01", "RF_Prediction_Probability": 1.00000000, "XGB_Prediction_Probability": 0.99999450 },
		{ "ISO": "NZL", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "OMN", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "PAK", "Date": "2025-10-01", "RF_Prediction_Probability": 0.27257534, "XGB_Prediction_Probability": 0.27833260 },
		{ "ISO": "PAN", "Date": "2025-10-01", "RF_Prediction_Probability": 0.20150816, "XGB_Prediction_Probability": 0.20016573 },
		{ "ISO": "PER", "Date": "2025-10-01", "RF_Prediction_Probability": 0.27430621, "XGB_Prediction_Probability": 0.24749796 },
		{ "ISO": "PHL", "Date": "2025-10-01", "RF_Prediction_Probability": 1.00000000, "XGB_Prediction_Probability": 0.99993503 },
		{ "ISO": "PLW", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "PNG", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "POL", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "PRI", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "PRK", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "PRT", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "PRY", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "PSE", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "PYF", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "QAT", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "REU", "Date": "2025-10-01", "RF_Prediction_Probability": 0.20150816, "XGB_Prediction_Probability": 0.20016573 },
		{ "ISO": "ROU", "Date": "2025-10-01", "RF_Prediction_Probability": 0.21665777, "XGB_Prediction_Probability": 0.21884547 },
		{ "ISO": "RUS", "Date": "2025-10-01", "RF_Prediction_Probability": 0.21665777, "XGB_Prediction_Probability": 0.21884547 },
		{ "ISO": "RWA", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "SAU", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "SCG", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "SDN", "Date": "2025-10-01", "RF_Prediction_Probability": 0.21665777, "XGB_Prediction_Probability": 0.21884547 },
		{ "ISO": "SEN", "Date": "2025-10-01", "RF_Prediction_Probability": 0.20150816, "XGB_Prediction_Probability": 0.20016573 },
		{ "ISO": "SGP", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "SHN", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "SLB", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "SLE", "Date": "2025-10-01", "RF_Prediction_Probability": 0.20150816, "XGB_Prediction_Probability": 0.20016573 },
		{ "ISO": "SLV", "Date": "2025-10-01", "RF_Prediction_Probability": 0.20150816, "XGB_Prediction_Probability": 0.20016573 },
		{ "ISO": "SOM", "Date": "2025-10-01", "RF_Prediction_Probability": 0.27430621, "XGB_Prediction_Probability": 0.24749796 },
		{ "ISO": "SPI", "Date": "2025-10-01", "RF_Prediction_Probability": 0.20150816, "XGB_Prediction_Probability": 0.20016573 },
		{ "ISO": "SRB", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "SSD", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "STP", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "SUN", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "SUR", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "SVK", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "SVN", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "SWE", "Date": "2025-10-01", "RF_Prediction_Probability": 0.21665777, "XGB_Prediction_Probability": 0.21884547 },
		{ "ISO": "SWZ", "Date": "2025-10-01", "RF_Prediction_Probability": 0.20150816, "XGB_Prediction_Probability": 0.20016573 },
		{ "ISO": "SXM", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "SYC", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "SYR", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "TCA", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "TCD", "Date": "2025-10-01", "RF_Prediction_Probability": 0.21665777, "XGB_Prediction_Probability": 0.21884547 },
		{ "ISO": "TGO", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "THA", "Date": "2025-10-01", "RF_Prediction_Probability": 0.14583953, "XGB_Prediction_Probability": 0.13981147 },
		{ "ISO": "TJK", "Date": "2025-10-01", "RF_Prediction_Probability": 0.20150816, "XGB_Prediction_Probability": 0.20016573 },
		{ "ISO": "TKL", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "TKM", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "TLS", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "TON", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "TTO", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "TUN", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "TUR", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "TUV", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "TWN", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "TZA", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "UGA", "Date": "2025-10-01", "RF_Prediction_Probability": 0.21665777, "XGB_Prediction_Probability": 0.21884547 },
		{ "ISO": "UKR", "Date": "2025-10-01", "RF_Prediction_Probability": 0.20150816, "XGB_Prediction_Probability": 0.20016573 },
		{ "ISO": "URY", "Date": "2025-10-01", "RF_Prediction_Probability": 0.27430621, "XGB_Prediction_Probability": 0.24749796 },
		{ "ISO": "USA", "Date": "2025-10-01", "RF_Prediction_Probability": 0.32564017, "XGB_Prediction_Probability": 0.35064462 },
		{ "ISO": "UZB", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "VCT", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "VEN", "Date": "2025-10-01", "RF_Prediction_Probability": 0.27257534, "XGB_Prediction_Probability": 0.27833260 },
		{ "ISO": "VGB", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "VIR", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "VNM", "Date": "2025-10-01", "RF_Prediction_Probability": 0.20150816, "XGB_Prediction_Probability": 0.20016573 },
		{ "ISO": "VUT", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "WLF", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "WSM", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "YEM", "Date": "2025-10-01", "RF_Prediction_Probability": 0.20150816, "XGB_Prediction_Probability": 0.20016573 },
		{ "ISO": "YMD", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "YMN", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "YUG", "Date": "2025-10-01", "RF_Prediction_Probability": 0.04389996, "XGB_Prediction_Probability": 0.04388626 },
		{ "ISO": "ZAF", "Date": "2025-10-01", "RF_Prediction_Probability": 0.21685185, "XGB_Prediction_Probability": 0.22779125 },
		{ "ISO": "ZMB", "Date": "2025-10-01", "RF_Prediction_Probability": 0.21665777, "XGB_Prediction_Probability": 0.21884547 },
		{ "ISO": "ZWE", "Date": "2025-10-01", "RF_Prediction_Probability": 0.21685185, "XGB_Prediction_Probability": 0.22779125 }
	] as Prediction[],
};

// --- INTERFACES ---
interface ScenarioSimulatorProps {
    onScenarioChange: (date: string, season: string) => void;
    defaultISO: string; // Prop passed from Dashboard.tsx
}

interface SimulationResult {
    probability: number;
    date: string;
    status: string;
}

// --- NEW FORMULA COMPONENTS (UNCHANGED) ---

/**
 * Applies a significant, non-linear adjustment based on the typical risk profile of a season.
 */
const getSeasonalBaseOffset = (season: string): number => {
    switch (season) {
        case 'monsoon':
            return 0.30; 
        case 'summer':
            return 0.20; 
        case 'spring':
        case 'fall':
            return 0.10; 
        case 'winter':
            return -0.10; 
        case 'current':
        default:
            return 0.0;
    }
};

/**
 * Calculates a multiplier based on the time horizon.
 */
const getTimeHorizonMultiplier = (dateKey: string): number => {
    switch (dateKey) {
        case 'month': return 1.05; 
        case '3months': return 1.15; 
        case '6months': return 1.30; 
        case 'year': return 1.50; 
        case 'current':
        default: return 1.0;
    }
};


export const ScenarioSimulator = ({ onScenarioChange, defaultISO }: ScenarioSimulatorProps) => {
    // 🚨 FIX: Use defaultISO to initialize, but allow user to change
    const [selectedISO, setSelectedISO] = useState(defaultISO); 
    const [selectedDate, setSelectedDate] = useState('current');
    const [selectedSeason, setSelectedSeason] = useState('current');
    const [simulating, setSimulating] = useState(false);
    const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);

    // 1. Reset ISO only if the defaultISO from the dashboard changes AND the component hasn't yet initialized with it
    useEffect(() => {
        setSelectedISO(defaultISO);
        setSimulationResult(null);
    }, [defaultISO]); // Keep dependency on defaultISO to track changes from parent (Dashboard)

    // Memoize the prediction data relevant to the currently selected ISO
    const isoPredictions = useMemo(() => {
        return SIMULATOR_DATA.predictions
            .filter(p => p.ISO === selectedISO)
            .sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime());
    }, [selectedISO]);

    const getDateDisplay = (key: string) => {
        switch (key) {
            case 'current': return 'Today (Latest Data)';
            case 'month': return '1 Month Ahead';
            case '3months': return '3 Months Ahead';
            case '6months': return '6 Months Ahead';
            case 'year': return '1 Year Ahead';
            default: return 'Current';
        }
    };

    const getStatus = (probability: number) => {
        if (probability >= 0.75) return { text: 'Severe Risk', color: 'text-red-500' };
        if (probability >= 0.50) return { text: 'High Risk', color: 'text-orange-500' };
        if (probability >= 0.30) return { text: 'Moderate Risk', color: 'text-yellow-500' };
        return { text: 'Low Risk', color: 'text-green-500' };
    };

    const runSimulation = () => {
        if (isoPredictions.length === 0) {
            toast.error(`No prediction data available for ${selectedISO}.`);
            return;
        }

        setSimulating(true);
        setSimulationResult(null);
        
        const latestPrediction = isoPredictions[0];
        
        // Step 1: Calculate Base Probability (Average of ML Models)
        const avgProb = (latestPrediction.RF_Prediction_Probability + latestPrediction.XGB_Prediction_Probability) / 2;
        
        let probability = avgProb;

        // Step 2: Apply Scenario Logic
        if (selectedDate !== 'current' || selectedSeason !== 'current') {
            const seasonalOffset = getSeasonalBaseOffset(selectedSeason);
            const timeMultiplier = getTimeHorizonMultiplier(selectedDate);
            
            // Formula: Base Prob + (Seasonal Offset * Time Multiplier)
            probability += (seasonalOffset * timeMultiplier); 
        }

        // Step 3: Clamp the final probability between 0 and 1
        probability = Math.min(1.0, Math.max(0.0, probability));

        // Round to two decimal places
        probability = Math.round(probability * 100) / 100;
        
        const result: SimulationResult = {
            probability: probability,
            date: latestPrediction.Date,
            status: getStatus(probability).text
        };
        
        onScenarioChange(selectedDate, selectedSeason);

        setTimeout(() => {
            setSimulating(false);
            setSimulationResult(result);
        }, 1500);
    };

    return (
        <Card className="bg-card border-border p-6 rounded-2xl shadow-lg">
            <div className="flex items-center gap-3 mb-4">
                <Clock className="w-6 h-6 text-green-700" />
                <h3 className="text-xl font-semibold text-foreground text-green-900">
                    Time-Based Disaster Simulator
                </h3>
            </div>

            <p className="text-muted-foreground text-sm mb-6 text-gray-700">
                Simulate disaster and wild fire risks using ML models for {selectedISO} based on selected patterns.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                
                {/* Current Location / Country Selector (User can change) */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Selected Country (ISO)</label>
                    <Select value={selectedISO} onValueChange={setSelectedISO} disabled={simulating}>
                        <SelectTrigger className="bg-background">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {SIMULATOR_DATA.countries.map(iso => (
                                <SelectItem key={iso} value={iso}>{iso}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                
                {/* Date Selector */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Select Date</label>
                    <Select value={selectedDate} onValueChange={setSelectedDate} disabled={simulating}>
                        <SelectTrigger className="bg-background">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="current">Current (Latest Data)</SelectItem>
                            <SelectItem value="month">1 Month Ahead</SelectItem>
                            <SelectItem value="3months">3 Months Ahead</SelectItem>
                            <SelectItem value="6months">6 Months Ahead</SelectItem>
                            <SelectItem value="year">1 Year Ahead</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Season Selector */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Season Pattern</label>
                    <Select value={selectedSeason} onValueChange={setSelectedSeason} disabled={simulating}>
                        <SelectTrigger className="bg-background">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="current">Current Season</SelectItem>
                            <SelectItem value="spring">Spring Pattern</SelectItem>
                            <SelectItem value="summer">Summer Pattern</SelectItem>
                            <SelectItem value="fall">Fall Pattern</SelectItem>
                            <SelectItem value="winter">Winter Pattern</SelectItem>
                            <SelectItem value="monsoon">Monsoon Pattern</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <Button
                onClick={runSimulation}
                disabled={simulating || isoPredictions.length === 0}
                className="w-full bg-green-700 hover:bg-green-800 text-white"
            >
                {simulating ? (
                    <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Simulating...
                    </>
                ) : (
                    <>
                        <Calendar className="w-4 h-4 mr-2" />
                        Run Simulation
                    </>
                )}
            </Button>

            {/* Simulation Result Display */}
            {simulationResult && (
                <div className="mt-4 p-4 bg-green-50 border border-green-300 rounded-xl animate-fade-in flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <TrendingUp className={`w-5 h-5 ${getStatus(simulationResult.probability).color}`} />
                        <p className="text-sm text-green-900 font-semibold">
                            {getDateDisplay(selectedDate)} Prediction for {selectedISO}:
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-lg font-bold text-green-900">
                            {Math.round(simulationResult.probability * 100)}%
                        </p>
                        <p className={`text-xs font-medium ${getStatus(simulationResult.probability).color}`}>
                            {simulationResult.status}
                        </p>
                    </div>
                </div>
            )}
        </Card>
    );
};
