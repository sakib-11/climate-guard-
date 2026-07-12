from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import pandas as pd
import io
import os
from dotenv import load_dotenv
from datetime import datetime
from datetime import timedelta
import json
import numpy as np
import ee
import traceback
import hashlib
from typing import Dict, List

# --- Google Earth Engine Authentication ---
SERVICE_ACCOUNT = "climateguard-service@climateguard-3c7c7.iam.gserviceaccount.com"
KEY_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "credentials", "gee_service_key.json")

try:
    if os.path.exists(KEY_FILE):
        credentials = ee.ServiceAccountCredentials(SERVICE_ACCOUNT, KEY_FILE)
        ee.Initialize(credentials, project='climateguard-3c7c7')
        print("[SUCCESS] Earth Engine initialized successfully!")
        GEE_INITIALIZED = True
    else:
        # print(f"[WARNING] GEE key file not found at {KEY_FILE}. Earth Engine features will be disabled.")
        GEE_INITIALIZED = False
except Exception as e:
    print(f"[ERROR] Failed to initialize Earth Engine: {e}")
    GEE_INITIALIZED = False


# --- Load environment variables ---
load_dotenv()

app = Flask(__name__)
CORS(app)

# --- External APIs (Unchanged) ---
OPEN_METEO_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
OPEN_METEO_VARS = [
    "temperature_2m_max",
    "temperature_2m_min",
    "precipitation_sum",
    "relative_humidity_2m_max",
    "relative_humidity_2m_min",
    "wind_speed_10m_max",
]

VC_API_KEY = os.getenv("VC_API_KEY")
VC_TIMELINE_URL = "https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/"

# --- GEE NDVI constants (Unchanged) ---
MODIS_COLLECTION = 'MODIS/061/MOD13Q1' 
S2_COLLECTION = 'COPERNICUS/S2_SR' 
MODIS_SCALE = 250
S2_SCALE = 10

ALERT_SEVERITY_ORDER = {
    "minor": 0,
    "moderate": 1,
    "severe": 2,
    "critical": 3,
}

CITY_ALERT_RULES = [
    {
        "hazard": "flood",
        "severity": "severe",
        "keywords": ("mumbai", "chennai", "kolkata", "miami", "jakarta", "coastal"),
        "title": "Urban Flood Watch",
        "description": "Heavy rainfall and drainage stress can trigger fast localized flooding in low-lying zones.",
        "recommendedAction": "Move vehicles and valuables away from flood-prone streets and keep emergency power banks charged.",
    },
    {
        "hazard": "heatwave",
        "severity": "critical",
        "keywords": ("delhi", "phoenix", "dubai", "karachi", "heat"),
        "title": "Extreme Heat Advisory",
        "description": "Dangerous daytime heat stress is likely during peak afternoon hours.",
        "recommendedAction": "Limit outdoor activity after noon, hydrate aggressively, and check on vulnerable neighbors.",
    },
    {
        "hazard": "wildfire",
        "severity": "severe",
        "keywords": ("california", "los angeles", "san francisco", "sacramento", "wildfire"),
        "title": "Wildfire Smoke Alert",
        "description": "Dry vegetation and gusty wind conditions can increase ignition spread and smoke exposure risk.",
        "recommendedAction": "Keep windows sealed, stage N95 masks, and prepare for short-notice evacuation updates.",
    },
    {
        "hazard": "cyclone",
        "severity": "severe",
        "keywords": ("miami", "houston", "tampa", "odisha", "cyclone", "hurricane"),
        "title": "Coastal Storm Surge Advisory",
        "description": "Coastal wind and surge conditions can disrupt travel and inundate vulnerable shoreline roads.",
        "recommendedAction": "Review evacuation zones and avoid parking vehicles in coastal or basement areas.",
    },
    {
        "hazard": "earthquake",
        "severity": "moderate",
        "keywords": ("tokyo", "japan", "jakarta", "istanbul", "earthquake"),
        "title": "Seismic Preparedness Notice",
        "description": "Regional seismic exposure warrants keeping household emergency supplies ready.",
        "recommendedAction": "Secure heavy furniture, confirm family meet-up points, and keep grab-bags accessible.",
    },
]

DEFAULT_ALERT_RULES = [
    {
        "hazard": "flood",
        "severity": "moderate",
        "title": "Heavy Rain Advisory",
        "description": "Short bursts of intense rainfall may create temporary flooding and traffic disruption.",
        "recommendedAction": "Avoid waterlogged roads, check local drainage conditions, and keep flashlights ready.",
    },
    {
        "hazard": "heatwave",
        "severity": "moderate",
        "title": "Heat Stress Advisory",
        "description": "Elevated temperatures may increase dehydration and power demand during daylight hours.",
        "recommendedAction": "Shift outdoor work earlier in the day and stock extra drinking water.",
    },
    {
        "hazard": "wildfire",
        "severity": "moderate",
        "title": "Air Quality Watch",
        "description": "Dry conditions can worsen smoke sensitivity and reduce outdoor air quality.",
        "recommendedAction": "Reduce prolonged outdoor exertion and keep indoor air circulation filtered where possible.",
    },
    {
        "hazard": "cyclone",
        "severity": "moderate",
        "title": "Wind and Storm Advisory",
        "description": "Strong wind bands can affect travel safety and cause isolated infrastructure disruption.",
        "recommendedAction": "Secure loose outdoor items and avoid unnecessary travel during peak wind periods.",
    },
]

OPEN_METEO_ALERT_CODE_MAP = {
    65: {
        "hazard": "flood",
        "severity": "severe",
        "title": "Heavy Rain Alert",
        "description": "Heavy rain is forecast and may trigger localized flooding, ponding, or transport disruption.",
    },
    67: {
        "hazard": "flood",
        "severity": "severe",
        "title": "Freezing Rain Alert",
        "description": "Heavy freezing rain is forecast and may create dangerous travel conditions and utility stress.",
    },
    75: {
        "hazard": "snow",
        "severity": "severe",
        "title": "Snowstorm Alert",
        "description": "Heavy snowfall is forecast and may rapidly affect road visibility and mobility.",
    },
    82: {
        "hazard": "flood",
        "severity": "severe",
        "title": "Violent Rain Shower Alert",
        "description": "Violent rain showers are forecast and may lead to flash flooding in exposed areas.",
    },
    86: {
        "hazard": "snow",
        "severity": "severe",
        "title": "Heavy Snow Shower Alert",
        "description": "Heavy snow showers are forecast and may create sudden visibility drops and slippery conditions.",
    },
    95: {
        "hazard": "thunderstorm",
        "severity": "critical",
        "title": "Thunderstorm Alert",
        "description": "Thunderstorms are forecast and may bring lightning, gusty winds, and short-notice disruption.",
    },
    96: {
        "hazard": "thunderstorm",
        "severity": "critical",
        "title": "Hailstorm Alert",
        "description": "Thunderstorms with hail are forecast and may threaten travel, crops, and exposed property.",
    },
    99: {
        "hazard": "thunderstorm",
        "severity": "critical",
        "title": "Severe Hailstorm Alert",
        "description": "Severe hail-bearing thunderstorms are forecast and may cause acute outdoor safety risks.",
    },
}


def _slugify_text(value: str) -> str:
    return "".join(ch.lower() if ch.isalnum() else "-" for ch in (value or "")).strip("-") or "location"


def _stable_index(seed_text: str, modulo: int) -> int:
    digest = hashlib.sha256((seed_text or "location").encode("utf-8")).hexdigest()
    return int(digest[:8], 16) % max(modulo, 1)


def _severity_rank(value: str) -> int:
    return ALERT_SEVERITY_ORDER.get(str(value or "").lower(), -1)


def _select_alert_blueprints(city: str, lat: str = None) -> List[Dict[str, str]]:
    normalized_city = (city or "").strip().lower()
    selected: List[Dict[str, str]] = []
    used_hazards = set()

    for rule in CITY_ALERT_RULES:
        if any(keyword in normalized_city for keyword in rule["keywords"]):
            selected.append(rule)
            used_hazards.add(rule["hazard"])

    if not selected:
        try:
            latitude = abs(float(lat)) if lat is not None else None
        except (TypeError, ValueError):
            latitude = None

        if latitude is not None and latitude <= 23.5:
            tropical_alerts = [
                rule for rule in DEFAULT_ALERT_RULES
                if rule["hazard"] in {"heatwave", "flood"}
            ]
            selected.extend(tropical_alerts)
            used_hazards.update(rule["hazard"] for rule in tropical_alerts)
        elif latitude is not None and latitude >= 35:
            temperate_alerts = [
                rule for rule in DEFAULT_ALERT_RULES
                if rule["hazard"] in {"wildfire", "cyclone"}
            ]
            selected.extend(temperate_alerts)
            used_hazards.update(rule["hazard"] for rule in temperate_alerts)

    if len(selected) < 2:
        fallback_pool = [rule for rule in DEFAULT_ALERT_RULES if rule["hazard"] not in used_hazards]
        while fallback_pool and len(selected) < 2:
            fallback_index = _stable_index(f"{normalized_city}-{len(selected)}", len(fallback_pool))
            selected.append(fallback_pool.pop(fallback_index))

    return selected[:3]


def _build_alert_records(city: str, lat: str = None) -> List[Dict[str, str]]:
    location_name = city or "Selected location"
    now = datetime.utcnow()
    alert_records: List[Dict[str, str]] = []

    for idx, blueprint in enumerate(_select_alert_blueprints(location_name, lat)):
        issued_at = now - timedelta(hours=(idx * 2) + 1)
        expires_at = now + timedelta(hours=(idx * 6) + 12)
        alert_records.append({
            "id": f"{_slugify_text(location_name)}-{blueprint['hazard']}-{idx + 1}",
            "hazard": blueprint["hazard"],
            "severity": blueprint["severity"],
            "title": blueprint["title"],
            "location": location_name,
            "issuedAt": issued_at.replace(microsecond=0).isoformat() + "Z",
            "expiresAt": expires_at.replace(microsecond=0).isoformat() + "Z",
            "description": blueprint["description"],
            "recommendedAction": blueprint["recommendedAction"],
            "source": "ClimateGuard synthesized alert service",
        })

    alert_records.sort(key=lambda alert: _severity_rank(alert.get("severity")), reverse=True)
    return alert_records


def _build_preparedness_payload(city: str, alerts: List[Dict[str, str]], severity_override: str = None) -> Dict[str, object]:
    location_name = city or "Selected location"
    highest_severity = severity_override or (
        alerts[0]["severity"] if alerts else "moderate"
    )
    highest_severity = str(highest_severity).lower()
    unique_hazards = list(dict.fromkeys(alert.get("hazard", "weather") for alert in alerts))

    actions: List[str] = []
    for alert in alerts:
        recommended_action = alert.get("recommendedAction")
        if recommended_action and recommended_action not in actions:
            actions.append(recommended_action)

    baseline_actions = [
        "Keep a 72-hour emergency kit ready with medicines, torchlights, drinking water, and ID copies.",
        "Confirm local emergency contacts and share a household check-in plan before risk conditions escalate.",
    ]
    if highest_severity in {"severe", "critical"}:
        baseline_actions.append("Charge phones, backup batteries, and power banks early in case outages begin.")
    if "flood" in unique_hazards or "cyclone" in unique_hazards:
        baseline_actions.append("Identify the fastest route to higher ground or an indoor shelter before travel becomes unsafe.")

    for action in baseline_actions:
        if action not in actions:
            actions.append(action)

    subtitle = (
        f"{len(alerts)} active risk signal(s) tracked for {location_name}. "
        f"Primary focus: {', '.join(unique_hazards) if unique_hazards else 'general weather readiness'}."
    )

    return {
        "title": f"{highest_severity.capitalize()} preparedness plan",
        "subtitle": subtitle,
        "actions": actions[:6],
        "highestSeverity": highest_severity,
        "hazards": unique_hazards,
        "alertsConsidered": len(alerts),
    }


def _alert_action_for_hazard(hazard: str) -> str:
    hazard_key = str(hazard or "").lower()
    if hazard_key == "flood":
        return "Avoid flood-prone roads, move essentials above ground level, and keep battery backups charged."
    if hazard_key == "snow":
        return "Limit non-essential travel, keep warm supplies ready, and prepare for icy surfaces."
    if hazard_key == "thunderstorm":
        return "Stay indoors during lightning risk, unplug sensitive electronics, and track local warnings closely."
    return "Review local emergency guidance and prepare a small go-kit in case conditions worsen."


def _build_openmeteo_alert_record(
    city: str,
    alert_date: str,
    weather_code: int,
    precipitation_sum: float | None,
    wind_speed_max: float | None,
) -> Dict[str, str] | None:
    blueprint = OPEN_METEO_ALERT_CODE_MAP.get(weather_code)
    if blueprint is None:
        return None

    detail_parts = [blueprint["description"]]
    if precipitation_sum is not None:
        detail_parts.append(f"Forecast precipitation: {round(float(precipitation_sum), 1)} mm.")
    if wind_speed_max is not None:
        detail_parts.append(f"Maximum wind speed: {round(float(wind_speed_max), 1)} km/h.")

    return {
        "id": f"{_slugify_text(city)}-{blueprint['hazard']}-{alert_date}",
        "hazard": blueprint["hazard"],
        "severity": blueprint["severity"],
        "title": blueprint["title"],
        "location": city,
        "issuedAt": f"{alert_date}T00:00:00Z",
        "expiresAt": f"{alert_date}T23:59:59Z",
        "description": " ".join(detail_parts),
        "recommendedAction": _alert_action_for_hazard(blueprint["hazard"]),
        "source": "Open-Meteo forecast API",
        "wmoCode": weather_code,
    }


def _fetch_openmeteo_alert_records(city: str, lat: str, lon: str) -> List[Dict[str, str]]:
    params = {
        "latitude": lat,
        "longitude": lon,
        "daily": [
            "weather_code",
            "precipitation_sum",
            "wind_speed_10m_max",
        ],
        "forecast_days": 7,
        "timezone": "auto",
    }

    response = requests.get(OPEN_METEO_FORECAST_URL, params=params, timeout=8)
    response.raise_for_status()
    payload = response.json()
    daily = payload.get("daily")
    if not isinstance(daily, dict):
        return []

    dates = daily.get("time") or []
    weather_codes = daily.get("weather_code") or []
    precipitation_sums = daily.get("precipitation_sum") or []
    wind_speeds = daily.get("wind_speed_10m_max") or []

    alerts: List[Dict[str, str]] = []
    for idx, alert_date in enumerate(dates):
        weather_code = weather_codes[idx] if idx < len(weather_codes) else None
        if weather_code is None:
            continue

        record = _build_openmeteo_alert_record(
            city=city,
            alert_date=alert_date,
            weather_code=int(weather_code),
            precipitation_sum=precipitation_sums[idx] if idx < len(precipitation_sums) else None,
            wind_speed_max=wind_speeds[idx] if idx < len(wind_speeds) else None,
        )
        if record:
            alerts.append(record)

    alerts.sort(key=lambda alert: (_severity_rank(alert.get("severity")), alert.get("issuedAt", "")), reverse=True)
    return alerts


def _get_features_from_collection(collection, point, scale, max_images=15, scale_factor=1.0):
    """
    Uses a single getRegion() call for speed, robust date parsing.
    """
    try:
        size = int(collection.size().getInfo())
    except Exception:
        return []

    if size == 0:
        return []

    # Limit the collection size server-side, descending order (most recent first)
    limit = min(size, max_images)
    limited_collection = collection.limit(limit, 'system:time_start', False)

    # Use getRegion for a single, fast client/server transaction
    region_data = limited_collection.getRegion(point, scale).getInfo()
    
    if not region_data or len(region_data) <= 1: 
        return []

    header = region_data[0]
    data_rows = region_data[1:]

    # 1. Find the NDVI column index 
    try:
        ndvi_idx = header.index('NDVI')
    except ValueError:
        non_standard_cols = ['id', 'time', 'lon', 'lat', 'system:index', 'system:time_start']
        ndvi_idx = -1
        for i, col_name in enumerate(header):
             if col_name not in non_standard_cols and col_name is not None:
                 ndvi_idx = i
                 break
        if ndvi_idx == -1: return [] 

    # 2. Find the Date column index 
    date_idx = -1
    for name in ['system:time_start', 'time']:
        try:
            date_idx = header.index(name)
            break
        except ValueError:
            continue
    if date_idx == -1: date_idx = 1 

    results = []
    for row in data_rows:
        try:
            timestamp_ms = row[date_idx]
            ndvi_val = row[ndvi_idx]
            
            # Skip if value or timestamp is missing/invalid
            if ndvi_val is None or not isinstance(timestamp_ms, (int, float)):
                continue

            # Convert timestamp to YYYY-MM-dd format
            date = datetime.fromtimestamp(timestamp_ms / 1000).strftime('%Y-%m-%d')
            
            # Apply scaling factor
            ndvi_scaled = float(ndvi_val) * scale_factor
            
            results.append({
                'date': date,
                'ndvi': round(ndvi_scaled, 4),
                'vegetation_health': classify_ndvi(ndvi_scaled)
            })

        except Exception:
            continue

    # Sort by date ascending before returning
    return sorted(results, key=lambda x: x['date'])


def classify_ndvi(value):
    """Return vegetation health category for given NDVI value."""
    if value is None:
        return "No data"
    elif value < 0.1:
        return "Bare / No vegetation"
    elif value < 0.3:
        return "Stressed"
    elif value < 0.5:
        return "Moderate"
    elif value < 0.7:
        return "Healthy"
    else:
        return "Very healthy"

def extract_ndvi_data(lat, lon, start_date, end_date, max_images=15, cloud_thresh=30):
    """
    Smart NDVI extractor, priority-based, with corrected, highly robust NDVI calculation logic.
    """
    if not GEE_INITIALIZED:
        raise Exception("Google Earth Engine is not initialized.")

    lat, lon = float(lat), float(lon)
    point = ee.Geometry.Point([lon, lat])

    # Default scale factors 
    S2_SCALE_FACTOR = 0.0001
    L8_SCALE_FACTOR = 0.0000275
    MODIS_SCALE_FACTOR = 0.0001
    
    # ----------------------------------
    # --- GEE Mapping Functions ---
    # The functions MUST return ONLY the calculated NDVI band to avoid the GEE error.
    # ----------------------------------
    def scale_and_ndvi_landsat(img):
        # Scale SR bands: (Band * 0.0000275) + -0.2 (reflectance)
        scaled = img.addBands(img.select('SR_B5').multiply(L8_SCALE_FACTOR).add(-0.2).rename('NIR')) \
            .addBands(img.select('SR_B4').multiply(L8_SCALE_FACTOR).add(-0.2).rename('RED'))
        
        # QA mask (Bit 5 = Cloud Shadow)
        qa_mask = img.select('QA_PIXEL').bitwiseAnd(32).eq(0)

        # Calculate NDVI using the scaled bands
        ndvi = scaled.normalizedDifference(['NIR', 'RED']).rename('NDVI')

        # *** CRITICAL FIX: Return ONLY the NDVI band, masked ***
        return ndvi.updateMask(qa_mask).copyProperties(img, img.propertyNames())

    def scale_and_ndvi_sentinel(img):
        # Apply scale factor 0.0001 (divide by 10000) for SR
        nir = img.select('B8').multiply(S2_SCALE_FACTOR)
        red = img.select('B4').multiply(S2_SCALE_FACTOR)

        # Calculate NDVI using the scaled bands
        ndvi = nir.normalizedDifference(red).rename("NDVI")

        # *** CRITICAL FIX: Return ONLY the NDVI band ***
        return ndvi.copyProperties(img, img.propertyNames())

    # --- UPDATED SOURCE CONFIGURATION ---
    # Using relaxed thresholds to increase success rate for high-res data.
    S2_CLOUD_THRESH = 50 
    L8_CLOUD_THRESH = 60 
    
    sources = [
        {
            "name": "Sentinel-2",
            "collection": "COPERNICUS/S2_SR_HARMONIZED",
            "bands": ["B8", "B4"],
            "scale": 10,
            "cloud_filter": ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", S2_CLOUD_THRESH),
            "map_function": scale_and_ndvi_sentinel, 
            "scale_factor": 1.0 
        },
        {
            "name": "Landsat-8/9",
            "collection": "LANDSAT/LC08/C02/T1_L2",
            "bands": ["SR_B5", "SR_B4"],
            "scale": 30,
            "cloud_filter": ee.Filter.lt("CLOUD_COVER", L8_CLOUD_THRESH),
            "map_function": scale_and_ndvi_landsat, 
            "scale_factor": 1.0 
        },
        {
            "name": "MODIS",
            "collection": "MODIS/061/MOD13Q1",
            "bands": ["NDVI"],
            "scale": 250,
            "cloud_filter": None,
            "map_function": None,
            "scale_factor": MODIS_SCALE_FACTOR
        }
    ]
    # ----------------------------------

    for src in sources:
        try:
            col = ee.ImageCollection(src["collection"]) \
                .filterDate(start_date, end_date) \
                .filterBounds(point)

            if src["cloud_filter"]:
                col = col.filter(src["cloud_filter"])

            if src["map_function"]:
                # The map function returns ONLY the NDVI band, so no further selection is needed.
                col = col.map(src["map_function"]) 
            else:
                # MODIS: just select the 'NDVI' band
                col = col.select(src["bands"])

            # Check collection size before expensive operation
            size = int(col.size().getInfo())
            print(f"🔍 {src['name']} images found: {size}")

            if size == 0:
                continue 

            # Use the new, faster getRegion-based function
            data = _get_features_from_collection(col, point, src["scale"], max_images=max_images, scale_factor=src["scale_factor"])
            
            if data:
                print(f"✅ Using {src['name']} NDVI with {len(data)} valid points")
                return {"collection": src["name"], "data": data}

        except Exception as e:
            print(f"⚠️ {src['name']} failed: {e}")
            print(traceback.format_exc())
            continue

    # Nothing worked
    print("❌ No NDVI data found in any collection.")
    return {"collection": None, "data": []}


# --- 1. Open-Meteo API (Unchanged) ---
@app.route('/api/climate/openmeteo', methods=['GET'])
def get_openmeteo_data():
    try:
        latitude = request.args.get('lat')
        longitude = request.args.get('lon')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')

        if not all([latitude, longitude, start_date, end_date]):
            return jsonify({"error": "Missing required parameters: lat, lon, start_date, end_date"}), 400

        params = {
            "latitude": latitude,
            "longitude": longitude,
            "start_date": start_date,
            "end_date": end_date,
            "daily": OPEN_METEO_VARS,
            "timezone": "auto",
            "precipitation_unit": "mm",
        }

        response = requests.get(OPEN_METEO_ARCHIVE_URL, params=params)
        response.raise_for_status()
        data = response.json()

        if 'daily' not in data:
            return jsonify({"error": "No 'daily' data found"}), 404

        df = pd.DataFrame(data['daily'])
        df.rename(columns={
            'time': 'date',
            'temperature_2m_max': 'temp_max_c',
            'temperature_2m_min': 'temp_min_c',
            'precipitation_sum': 'rainfall_mm',
            'relative_humidity_2m_max': 'humidity_max_pct',
            'relative_humidity_2m_min': 'humidity_min_pct',
            'wind_speed_10m_max': 'wind_max_kph',
        }, inplace=True)
        df['latitude'] = float(latitude)
        df['longitude'] = float(longitude)

        return jsonify(df.to_dict('records'))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --- 2. Visual Crossing API (Unchanged) ---
@app.route('/api/climate/visualcrossing', methods=['GET'])
def get_visualcrossing_data():
    if not VC_API_KEY:
        return jsonify({"error": "VC_API_KEY missing in .env"}), 500

    try:
        latitude = request.args.get('lat')
        longitude = request.args.get('lon')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')

        if not all([latitude, longitude, start_date, end_date]):
            return jsonify({"error": "Missing parameters"}), 400

        location_path = f"{latitude},{longitude}/{start_date}/{end_date}"
        params = {
            "key": VC_API_KEY,
            "unitGroup": "metric",
            "contentType": "csv",
            "include": "days",
            "elements": "datetime,tempmax,tempmin,precip,humidity,windspeed,windgust,solarradiation,sealevelpressure"
        }

        response = requests.get(VC_TIMELINE_URL + location_path, params=params)
        response.raise_for_status()

        df = pd.read_csv(io.StringIO(response.text))
        df.rename(columns={
            'datetime': 'date',
            'tempmax': 'temp_max_c',
            'tempmin': 'temp_min_c',
            'precip': 'rainfall_mm',
            'humidity': 'humidity_mean_pct',
            'windspeed': 'wind_mean_kph',
            'windgust': 'wind_gust_kph',
            'solarradiation': 'solar_radiation_wm2',
            'sealevelpressure': 'pressure_hpa'
        }, inplace=True)

        df['latitude'] = float(latitude)
        df['longitude'] = float(longitude)
        return jsonify(df.to_dict('records'))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --- 3. NDVI from GEE (Limited to 15 entries) ---
@app.route('/api/climate/ndvi', methods=['GET'])
def get_ndvi_data():
    if not GEE_INITIALIZED:
        return jsonify({"error": "GEE not initialized"}), 500
    try:
        latitude = request.args.get('lat')
        longitude = request.args.get('lon')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        # Hard limit max_images to 15 entries for speed
        max_images = 15
        # The cloud_thresh parameter is ignored here, as it's defined inside extract_ndvi_data
        cloud_thresh = int(request.args.get('cloud_thresh', 30)) 

        if not all([latitude, longitude, start_date, end_date]):
            return jsonify({"error": "Missing parameters"}), 400

        result = extract_ndvi_data(latitude, longitude, start_date, end_date, max_images=max_images, cloud_thresh=cloud_thresh)

        if not result['data']:
            return jsonify({"error": "No NDVI data found", "collection_tried": result['collection']}), 404

        return jsonify({
            "collection": result['collection'],
            "count": len(result['data']),
            "data": result['data']
            })


    except Exception as e:
        tb = traceback.format_exc()
        return jsonify({"error": str(e), "trace": tb}), 500


# --- 4. Unified Endpoint (weather + NDVI) (Unchanged) ---
@app.route('/api/climate/unified', methods=['GET'])
def get_unified_data():
    try:
        weather_resp = get_openmeteo_data()
        ndvi_resp = get_ndvi_data()

        # parse weather response
        if isinstance(weather_resp, tuple):
            weather_data = json.loads(weather_resp[0].data)
        else:
            weather_data = json.loads(weather_resp.data)

        # parse ndvi response
        if isinstance(ndvi_resp, tuple):
            ndvi_parsed = json.loads(ndvi_resp[0].data)
        else:
            ndvi_parsed = json.loads(ndvi_resp.data)

        if isinstance(weather_data, dict) and "error" in weather_data:
            return jsonify(weather_data), 400

        # If NDVI endpoint returned error/didn't find data, ndvi_parsed may be an error dict
        ndvi_data = ndvi_parsed.get('data') if isinstance(ndvi_parsed, dict) else None

        weather_df = pd.DataFrame(weather_data)
        if ndvi_data and isinstance(ndvi_data, list) and len(ndvi_data) > 0:
            ndvi_df = pd.DataFrame(ndvi_data)
            ndvi_df['date'] = pd.to_datetime(ndvi_df['date'])
            weather_df['date'] = pd.to_datetime(weather_df['date'])

            unified_df = pd.merge_asof(
                weather_df.sort_values('date'),
                ndvi_df[['date', 'ndvi']].sort_values('date'),
                on='date',
                direction='nearest',
                tolerance=pd.Timedelta(days=8)
            )
        else:
            unified_df = weather_df.copy()
            unified_df['ndvi'] = None

        return jsonify(unified_df.to_dict('records'))
    except Exception as e:
        tb = traceback.format_exc()
        return jsonify({"error": str(e), "trace": tb}), 500


@app.route('/api/alerts', methods=['GET'])
def get_alerts():
    try:
        city = request.args.get('city', 'Selected location')
        latitude = request.args.get('lat')
        longitude = request.args.get('lon')

        alerts: List[Dict[str, str]] = []
        source = "synthetic-fallback"
        fallback_reason = None

        if latitude and longitude:
            try:
                alerts = _fetch_openmeteo_alert_records(city=city, lat=latitude, lon=longitude)
                source = "open-meteo"
            except Exception as fetch_error:
                fallback_reason = str(fetch_error)
                alerts = _build_alert_records(city=city, lat=latitude)
        else:
            fallback_reason = "Missing lat/lon for live Open-Meteo lookup."
            alerts = _build_alert_records(city=city, lat=latitude)

        return jsonify({
            "city": city,
            "count": len(alerts),
            "generatedAt": datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
            "source": source,
            "fallbackReason": fallback_reason,
            "data": alerts,
            "alerts": alerts,
        })
    except Exception as e:
        tb = traceback.format_exc()
        return jsonify({"error": str(e), "trace": tb}), 500


@app.route('/api/preparedness', methods=['GET'])
def get_preparedness():
    try:
        city = request.args.get('city', 'Selected location')
        latitude = request.args.get('lat')
        requested_severity = request.args.get('severity')
        requested_hazards = {
            hazard.strip().lower()
            for hazard in (request.args.get('hazards') or '').split(',')
            if hazard.strip()
        }

        alerts = _build_alert_records(city=city, lat=latitude)
        if requested_hazards:
            filtered_alerts = [alert for alert in alerts if alert.get('hazard') in requested_hazards]
            if filtered_alerts:
                alerts = filtered_alerts

        preparedness = _build_preparedness_payload(
            city=city,
            alerts=alerts,
            severity_override=requested_severity,
        )

        return jsonify({
            "city": city,
            "data": preparedness,
            "generatedAt": datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
        })
    except Exception as e:
        tb = traceback.format_exc()
        return jsonify({"error": str(e), "trace": tb}), 500


if __name__ == '__main__':
    if not VC_API_KEY:
        pass # print("[WARNING] VC_API_KEY missing - Visual Crossing endpoint will fail.")
    if not GEE_INITIALIZED:
        pass # print("[WARNING] GEE not initialized - NDVI endpoint will fail.")
    app.run(debug=True, port=5000)
