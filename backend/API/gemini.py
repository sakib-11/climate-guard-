# ============================================================
# Purpose: Central climate data + Gemini fallback aggregator
# ============================================================

from flask import Flask, request, jsonify
import requests
import os
import json
import time
from dotenv import load_dotenv
from datetime import datetime, timedelta
from typing import Tuple, Dict, Any, List
from flask_cors import CORS

# [NEW IMPORT] Import the official Google Generative AI SDK
from google import genai
from google.genai import types
from google.genai.errors import APIError

import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore_v1.base_client import BaseClient as FirestoreClient # For type hinting

# ------------------------------------------------------------
# Environment Setup
# ------------------------------------------------------------
load_dotenv()
app = Flask(__name__)
CORS(app)
# ------------------------------------------------------------
# Configuration
# ------------------------------------------------------------

# Local/internal endpoints (adjust host/ports if needed)
LOCAL_BASE = os.getenv("LOCAL_BASE", "http://localhost:5000")
OPENMETEO_UNIFIED = f"{LOCAL_BASE}/api/climate/unified"
NDVI_ENDPOINT = f"{LOCAL_BASE}/api/climate/ndvi"
ALERTS_ENDPOINT = f"{LOCAL_BASE}/api/alerts"
PREP_ENDPOINT = f"{LOCAL_BASE}/api/preparedness"

# Gemini API Configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")  # primary key
GEMINI_API_KEY_FALLBACK = os.getenv("GEMINI_API_KEY_FALLBACK")  # optional fallback key
# Primary model with ordered fallback list
GEMINI_MODEL_PRIMARY = "gemini-2.0-flash"
GEMINI_MODEL_FALLBACK = "gemini-2.0-flash-lite"
GEMINI_MODEL = GEMINI_MODEL_PRIMARY  # active model (may switch at runtime)
# All models to try in order (most capable → lightest)
GEMINI_MODELS_PRIORITY = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-pro",
    "gemini-1.5-flash",
]

# Initialize the Gemini Client globally
GEMINI_API_KEYS = [
    api_key for api_key in [GEMINI_API_KEY, GEMINI_API_KEY_FALLBACK]
    if api_key
]
GEMINI_CLIENTS = []

try:
    if GEMINI_API_KEYS:
        GEMINI_CLIENTS = [genai.Client(api_key=api_key) for api_key in GEMINI_API_KEYS]
        GEMINI_CLIENT = GEMINI_CLIENTS[0]
    else:
        raise ValueError("GEMINI_API_KEY is not set.")
except Exception as e:
    print(f"[ERROR] Failed to initialize Gemini Client: {e}")
    GEMINI_CLIENTS = []
    GEMINI_CLIENT = None

# HTTP timeout (seconds)

FIREBASE_CREDENTIALS_PATH = os.getenv("FIREBASE_CREDENTIALS_PATH")
DB_CLIENT: FirestoreClient | None = None

try:
    if FIREBASE_CREDENTIALS_PATH and os.path.exists(FIREBASE_CREDENTIALS_PATH):
        # Initialize the Firebase app with service account credentials
        cred = credentials.Certificate(FIREBASE_CREDENTIALS_PATH)
        firebase_admin.initialize_app(cred)
        # Get the Firestore client
        DB_CLIENT = firestore.client()
        print("[SUCCESS] Firestore Client Initialized.")
    else:
        print("[WARNING] FIREBASE_CREDENTIALS_PATH not set or file not found. Firestore logging disabled.")
except Exception as e:
    print(f"[ERROR] Failed to initialize Firebase Admin SDK: {e}")
    DB_CLIENT = None


HTTP_TIMEOUT = 8


# ------------------------------------------------------------
# Helper Functions
# ------------------------------------------------------------
def safe_get(url: str, params: dict = None) -> Tuple[bool, Any]:
    """Try local endpoints safely; returns (success, parsed_json_or_error)."""
    try:
        resp = requests.get(url, params=params, timeout=HTTP_TIMEOUT)
        resp.raise_for_status()
        return True, resp.json()
    except Exception as e:
        return False, {"error": str(e), "url": url}
    
def log_gemini_query(
    query_city: str,
    gemini_prompt: str,
    gemini_response: dict | None,
    success: bool,
    error_message: str = None
):
    """Logs the Gemini query and response to the 'gemini_logs' collection in Firestore."""
    global DB_CLIENT
    if DB_CLIENT is None:
        return

    log_entry = {
        "timestamp": datetime.now(),
        "query_city": query_city,
        "gemini_model": GEMINI_MODEL,
        "success": success,
        "prompt": gemini_prompt,
        "response_data": gemini_response, 
        "error_message": error_message,
    }
    
    # Store in the 'gemini_logs' collection
    try:
        DB_CLIENT.collection("gemini_logs").add(log_entry)
        # Optional: print("Query successfully logged to Firestore.")
    except Exception as e:
        print(f"[ERROR] Error writing log to Firestore: {e}")


# Gemini output schema (UPDATED)
OUTPUT_SCHEMA = types.Schema(
    type=types.Type.OBJECT,
    properties={
        "location": types.Schema(type=types.Type.OBJECT, properties={
            "city": types.Schema(type=types.Type.STRING),
            "lat": types.Schema(type=types.Type.STRING),
            "lon": types.Schema(type=types.Type.STRING),
        }, required=["city", "lat", "lon"]),

        "riskAnalysis": types.Schema(type=types.Type.OBJECT, properties={
            "title": types.Schema(type=types.Type.STRING),
            "riskScore": types.Schema(type=types.Type.NUMBER),
            "riskLevel": types.Schema(type=types.Type.STRING),
            "riskTrend": types.Schema(type=types.Type.OBJECT, properties={
                "trend": types.Schema(type=types.Type.STRING),
                "period": types.Schema(type=types.Type.STRING)
            }),
            "severityBar": types.Schema(type=types.Type.OBJECT, properties={
                "label": types.Schema(type=types.Type.STRING),
                "level": types.Schema(type=types.Type.NUMBER),
                "minLabel": types.Schema(type=types.Type.STRING),
                "maxLabel": types.Schema(type=types.Type.STRING)
            }),
            "riskGauge": types.Schema(type=types.Type.OBJECT, properties={
                "score": types.Schema(type=types.Type.NUMBER),
                "status": types.Schema(type=types.Type.STRING),
                "color": types.Schema(type=types.Type.STRING)
            }),
            "mapVisualization": types.Schema(type=types.Type.OBJECT, properties={
                "title": types.Schema(type=types.Type.STRING),
                "status": types.Schema(type=types.Type.STRING),
                "description": types.Schema(type=types.Type.STRING)
            }),
            "keyFactors": types.Schema(type=types.Type.ARRAY, items=types.Schema(type=types.Type.OBJECT, properties={
                "factor": types.Schema(type=types.Type.STRING),
                "status": types.Schema(type=types.Type.STRING)
            })),
            "forecast": types.Schema(type=types.Type.ARRAY, items=types.Schema(type=types.Type.OBJECT, properties={
                "day": types.Schema(type=types.Type.STRING),
                "date": types.Schema(type=types.Type.STRING),
                "condition": types.Schema(type=types.Type.STRING),
                "probability": types.Schema(type=types.Type.STRING)
            })),
            "recommendations": types.Schema(type=types.Type.OBJECT, properties={
                "title": types.Schema(type=types.Type.STRING),
                "subtitle": types.Schema(type=types.Type.STRING),
                "actions": types.Schema(type=types.Type.ARRAY, items=types.Schema(type=types.Type.STRING))
            }),

            # 🆕 Add Active Alerts Section
            "activeAlerts": types.Schema(type=types.Type.ARRAY, items=types.Schema(type=types.Type.OBJECT, properties={
                "severity": types.Schema(type=types.Type.STRING),
                "title": types.Schema(type=types.Type.STRING),
                "location": types.Schema(type=types.Type.STRING),
                "time": types.Schema(type=types.Type.STRING),
                "description": types.Schema(type=types.Type.STRING)
            })),

            # 🆕 Add Environmental Sensitivity Filters
            "sensitivityFilters": types.Schema(type=types.Type.ARRAY, items=types.Schema(type=types.Type.OBJECT, properties={
                "factor": types.Schema(type=types.Type.STRING),
                "value": types.Schema(type=types.Type.STRING),
                "filterStrength": types.Schema(type=types.Type.STRING)
            })),
        }),

        "threatSummary": types.Schema(type=types.Type.OBJECT, properties={
            "criticalAlertsCount": types.Schema(type=types.Type.NUMBER),
            "severeAlertsCount": types.Schema(type=types.Type.NUMBER),
            "totalActiveWarnings": types.Schema(type=types.Type.NUMBER),
            "statusColor": types.Schema(type=types.Type.STRING)
        }),
    },
    required=["location", "riskAnalysis", "threatSummary"]
)


# ai_aggregator.py (Replacement for existing call_gemini)

MAX_RETRIES = 3          # number of retry attempts per model
RETRY_DELAY_BASE = 2     # seconds (doubles each retry: 2, 4, 8)

def _attempt_gemini(client, model: str, instruction: str, config) -> dict:
    """Single attempt against a specific Gemini client and model. Raises on failure."""
    response = client.models.generate_content(
        model=model,
        contents=[instruction],
        config=config
    )
    return json.loads(response.text)


def call_gemini(city: str, lat: str = None, lon: str = None, missing_fields: List[str] = None) -> dict:
    if GEMINI_CLIENT is None or not GEMINI_CLIENTS:
        raise RuntimeError("Gemini Client failed to initialize.")

    # We use the requested city, lat, and lon in the prompt
    now = datetime.utcnow().strftime("%Y-%m-%d")

    instruction = f"""
    You are an AI environmental analyst generating structured data for a Climate Risk Dashboard.
    Generate realistic, JSON-formatted climate risk data for:
    City: {city}
    Latitude: {lat or 'N/A'}
    Longitude: {lon or 'N/A'}
    Date: {now}
    Include all of these fields inside the JSON response:

    1. location → city, lat, lon
    2. riskAnalysis → 
    - title (e.g., "Real-time climate risk assessment powered by AI")
    - riskScore (0–100)
    - riskLevel (Low, Moderate, High, Severe)
    - riskTrend (trend + period)
    - severityBar (label, level 0–10, minLabel, maxLabel)
    - riskGauge (score, status, color)
    - mapVisualization (title, status, description)
    - keyFactors (array of factor + status)
    - forecast (day, date, condition, probability)
    - recommendations (title, subtitle, actions[])
    - activeAlerts (array of severity, title, location, time, description)
    - sensitivityFilters (array of factor, value, filterStrength)
    3. threatSummary → criticalAlertsCount, severeAlertsCount, totalActiveWarnings, statusColor

    Keep all values internally consistent (riskScore aligns with severityBar & alerts). 
    Avoid unrealistic extremes unless clearly justified (e.g., storm season).
    Output only valid JSON according to schema.
    """

    config = types.GenerateContentConfig(
        temperature=0.2,
        max_output_tokens=4096,
        response_mime_type="application/json",
        response_schema=OUTPUT_SCHEMA
    )

    # ── Initialise tracking variables BEFORE the try block so `finally` never
    #    hits a NameError regardless of where an exception is raised. ──────────
    gemini_result = None
    error_str     = None
    success       = False
    used_model    = GEMINI_MODEL_PRIMARY
    used_key_slot = 1

    try:
        # Try each model in priority order, each with exponential-backoff
        # retries to handle transient rate-limit / timeout / quota errors.
        last_exc = None

        for model in GEMINI_MODELS_PRIORITY:
            used_model = model
            for attempt in range(1, MAX_RETRIES + 1):
                try:
                    print(f"[GEMINI] Calling {model} (attempt {attempt}/{MAX_RETRIES})...")
                    gemini_result = _attempt_gemini(GEMINI_CLIENT, model, instruction, config)
                    success = True
                    last_exc = None
                    break   # success — stop retrying this model

                except Exception as exc:
                    last_exc = exc
                    err_msg = str(exc).lower()
                    # On quota exhaustion, skip immediately to next model (don't retry)
                    is_quota = any(kw in err_msg for kw in [
                        "quota", "resource_exhausted", "429"
                    ])
                    is_transient = any(kw in err_msg for kw in [
                        "503", "500", "timeout", "deadline", "unavailable"
                    ])
                    if is_quota:
                        print(f"[GEMINI] Quota exceeded on {model}, trying next model...")
                        break  # skip to next model immediately
                    elif is_transient and attempt < MAX_RETRIES:
                        delay = RETRY_DELAY_BASE ** attempt
                        print(f"[GEMINI] Transient error on {model}, retrying in {delay}s: {exc}")
                        time.sleep(delay)
                    else:
                        print(f"[GEMINI] Non-retryable / max retries reached on {model}: {exc}")
                        break   # move on to next model

            if success:
                break   # don't try next model if current succeeded

        if not success:
            error_str = str(last_exc) if last_exc else "Unknown Gemini error"

    except Exception as outer_exc:
        # Catch anything unexpected in the loop logic itself
        error_str = str(outer_exc)
        success   = False

    finally:
        # 🔥 INTEGRATION POINT: Log the attempt regardless of success/failure
        log_gemini_query(
            query_city=city,
            gemini_prompt=instruction,
            gemini_response=gemini_result,
            success=success,
            error_message=error_str
        )

        # If there was an error, raise it now to stop processing the request
    if error_str:
        raise RuntimeError(f"Gemini API SDK Failure ({used_model}): {error_str}")

    return gemini_result

def merge_sources(primary: dict, fallback: dict) -> dict:
    if primary is None:
        return fallback or {}
    if fallback is None:
        return primary or {}

    result = dict(primary)
    for k, v in fallback.items():
        if isinstance(result.get(k), dict) and isinstance(v, dict):
            result[k] = merge_sources(result[k], v)
        elif k not in result or result.get(k) in (None, "", [], {}):
            result[k] = v
    return result


def compute_derived_fields(core_alerts: List[dict]) -> dict:
    critical = severe = 0
    active = []

    for alert in core_alerts:
        sev = str(alert.get("severity", "")).lower()
        if sev == "critical": critical += 1
        if sev == "severe": severe += 1
        if alert.get("issuedAt"): active.append(alert)

    return {
        "threatSummary": {
            "criticalAlertsCount": critical,
            "severeAlertsCount": severe,
            "totalActiveWarnings": len(active),
            "statusColor": ("red" if critical > 0 else ("orange" if severe > 0 else "green"))
        }
    }


def highest_alert_severity(core_alerts: List[dict]) -> str:
    severity_order = {
        "critical": 3,
        "severe": 2,
        "high": 2,
        "moderate": 1,
        "minor": 0,
    }
    ranked = sorted(
        (str(alert.get("severity", "")).lower() for alert in core_alerts),
        key=lambda severity: severity_order.get(severity, -1),
        reverse=True,
    )
    return ranked[0] if ranked else "moderate"


def to_active_alerts(core_alerts: List[dict]) -> List[dict]:
    formatted_alerts = []
    for alert in core_alerts:
        severity = str(alert.get("severity", "moderate")).lower()
        formatted_alerts.append({
            "severity": severity.capitalize(),
            "title": alert.get("title", "Climate alert"),
            "location": alert.get("location", "Selected location"),
            "time": alert.get("issuedAt") or alert.get("time") or datetime.utcnow().isoformat() + "Z",
            "description": alert.get("description", ""),
        })
    return formatted_alerts


def extract_preparedness(preparedness_response: dict | None) -> dict | None:
    if not isinstance(preparedness_response, dict):
        return None

    payload = preparedness_response.get("data", preparedness_response)
    if not isinstance(payload, dict):
        return None

    title = payload.get("title")
    subtitle = payload.get("subtitle")
    actions = payload.get("actions")

    if not title or not subtitle or not isinstance(actions, list):
        return None

    return {
        "title": title,
        "subtitle": subtitle,
        "actions": actions,
    }


# ------------------------------------------------------------
# Main Endpoint
# ------------------------------------------------------------
@app.route("/api/ai/city/<string:city>", methods=["GET"])
def ai_city(city):
    lat = request.args.get("lat")
    lon = request.args.get("lon")

    start_date = request.args.get("start_date", (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d"))
    end_date = request.args.get("end_date", datetime.utcnow().strftime("%Y-%m-%d"))

    unified_success, unified = safe_get(OPENMETEO_UNIFIED, params={"lat": lat, "lon": lon, "start_date": start_date, "end_date": end_date})
    alerts_success, alerts = safe_get(ALERTS_ENDPOINT, params={"city": city, "lat": lat, "lon": lon})

    payload = {
        "location": {"city": city, "lat": lat, "lon": lon},
        "riskAnalysis": {
            "activeAlerts": [],
        },
        "threatSummary": {},
        "coreAlerts": [],
        "unifiedData": unified if unified_success else None
    }

    if alerts_success and isinstance(alerts, dict):
        alert_list = alerts.get("data") or alerts.get("alerts") or []
        if isinstance(alert_list, list):
            payload["coreAlerts"] = alert_list

    payload["riskAnalysis"]["activeAlerts"] = to_active_alerts(payload["coreAlerts"])
    payload["threatSummary"] = compute_derived_fields(payload["coreAlerts"])["threatSummary"]

    prep_success, preparedness = safe_get(
        PREP_ENDPOINT,
        params={
            "city": city,
            "lat": lat,
            "lon": lon,
            "severity": highest_alert_severity(payload["coreAlerts"]),
            "hazards": ",".join(sorted({str(alert.get("hazard", "")).lower() for alert in payload["coreAlerts"] if alert.get("hazard")})),
        },
    )

    if prep_success:
        preparedness_payload = extract_preparedness(preparedness)
        if preparedness_payload:
            payload["riskAnalysis"]["recommendations"] = preparedness_payload

    gemini_payload = None
    try:
        gemini_payload = call_gemini(city=city, lat=lat, lon=lon)
    except Exception as e:
        payload["_error"] = f"Gemini fallback failed: {str(e)}"

    if gemini_payload:
        payload = merge_sources(payload, gemini_payload)

    return jsonify({
        "location": payload["location"],
        "riskAnalysis": payload.get("riskAnalysis", {}),
        "threatSummary": payload.get("threatSummary", {}),
        "_error": payload.get("_error")
    })


# ------------------------------------------------------------
# Run Server
# ------------------------------------------------------------
if __name__ == "__main__":
    port = int(os.getenv("PORT", 5010))
    app.run(debug=True, host="0.0.0.0", port=port)
