# 🌍 **ClimateGuard – Climate Risk Prediction System**

**ClimateGuard** is an intelligent climate analytics platform that aggregates real-time environmental data, alerts, Machine learning models and AI-generated insights from trusted global sources.
It transforms complex climate information into simple, actionable insights — helping individuals make data-driven environmental decisions.

---

## 🌿 **Features**

* 🌱 **Smart Climate Data Aggregation**
  Collects live environmental data — temperature, rainfall, etc — from multiple climate APIs.

* 🌱 **AI-Powered Insight Generation**
  Uses **Google Gemini AI** to interpret trends, detect anomalies, and summarize environmental conditions in plain language.

* 🌱 **Live Climate Alert System**
  Fetches verified disaster and weather alerts (floods, heatwaves, droughts, wildfires, etc.) in real time.

* 🌱 **Geo-Based Risk Scoring**
  Calculates a **regional climate risk index** by combining real-time weather, air quality, and satellite data.

* 🌱 **Dual-Model Disaster Prediction Simulator**
  Built and trained using **EM-DAT** and **NASA Wildfire datasets**, this simulator predicts global disaster risks with over **98% ROC AUC accuracy**, powered by two complementary models — **Random Forest** for explainable insights and **XGBoost** for high-performance forecasting.

* 🌱 **Interactive Map Visualization**
  Displays dynamic, filterable risk maps with region-wise comparison and live updates.

* 🌱 **Firebase Authentication**
  Handles secure user sign-up, login, and session management (Email/Password + Google OAuth).

* 🌱 **Firestore Cloud Database**
  Stores user profiles, preferences, search history, and saved climate reports safely in the cloud.

* 🌱 **Minimal, Responsive Dashboard**
  Clean and fast UI built with **React + TailwindCSS + Shadcn UI**, designed for accessibility and clarity.

---

## 🌿 **How It Works**

1. 🌱 User signs up or logs in securely using **Firebase Authentication**.
2. 🌱 User selects a **region or city**.
3. 🌱 Backend fetches real-time environmental data from global APIs.
4. 🌱 **Gemini AI** analyzes the data, summarizes patterns, and identifies anomalies.
5. 🌱 The system retrieves live alerts for the selected region.
6. 🌱 Results (risk scores, summaries, alerts) are stored in **Firestore** under the user’s profile.
7. 🌱 Dashboard visualizes the results as **cards, charts, and maps** for easy understanding.

---

## 🌿 **APIs Used**

| 🌍 **API / Source**                    | 🧩 **Purpose**                                                                                                                    |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| ☀️ **Open-Meteo API**                  | Fetches **historical and real-time weather data** (temperature, precipitation, humidity, wind speed).                             |
| 🌦️ **Visual Crossing API**            | Provides **extended atmospheric parameters** like solar radiation, pressure, and dew point for detailed analysis.                 |
| 🌱 **Google Earth Engine (GEE)**       | Processes **satellite imagery** (Sentinel-2, Landsat, MODIS) to extract NDVI and vegetation indices for environmental monitoring. |
| 🔥 **NASA FIRMS / Wildfire Archive**   | Supplies **active fire and burned area datasets** used for wildfire trend analysis.                                               |
| 🌐 **EM-DAT Global Disaster Database** | Offers **historical disaster records** for training and evaluating ML models.                                                     |
| 🤖 **Google Gemini API**               | Enables **AI reasoning, summarization, and contextual analysis** of ML and geospatial outputs.                                    |
| 🔐 **Firebase Auth + Firestore**       | Provides **secure user authentication** and **cloud database storage** for user data and analytics logs.                          |

---

## 🌿 **Tech Stack**

* **Frontend:** React.js (VITE) + TailwindCSS + Shadcn UI + Framer Motion
* **Backend:** Flask (Python) + RESTful APIs
* **AI Engine:** Google Gemini for reasoning and insight generation
* **Authentication:** Firebase Auth (Email/Password + Google OAuth)
* **Database:** Firebase Firestore for all data storage (user profiles, reports, alerts, and history)

---

## 🌿 **.env Setup**

Add your private API keys and Firebase credentials:

```
OPEN_METEO_KEY="YOUR_OPEN_METEO_KEY"
NOAA_API_KEY="YOUR_NOAA_KEY"
NASA_API_KEY="YOUR_NASA_KEY"
AIRNOW_API_KEY="YOUR_AIRNOW_KEY"
GEMINI_API_KEY="YOUR_GEMINI_KEY"
ALERTS_API_KEY="YOUR_ALERTS_KEY"

```

---

## 🌿 **Run the Project**

### 🍃 1. Clone the Repository

```bash
git clone <your_repo_url>
cd climateGuard
```

### 🍃 2. Backend Setup

```bash
cd backend
pip install -r requirements.txt
cd API
python api.py
python gemini.py
```

### 🍃 3. Frontend Setup

```bash
npm install
npm run dev
```

---

## 🌿 **Author**

**Built with 💚 by Sakib Inamdar**


