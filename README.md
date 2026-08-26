# ISU-GeoBot 🎓🗺️

An intelligent campus navigation and faculty availability assistant integrating **Enhanced RAG** (Retrieval-Augmented Generation) with a **Random Forest** availability classifier for the **Isabela State University – Echague Main Campus**.

**Undergraduate Thesis**  
BS in Computer Science (Data Mining Track)  
College of Computing Studies, Information and Communication Technology (CCSICT)  
**Christian Paul Simbulan · Michael Allan Almario**

---

## 🌟 Key Features

1. **Interactive Geospatial Campus Map**
   - Built with Leaflet & React.
   - Dual-representation indexing: POI coordinates drive the map UI while automatically generated natural-language "place-cards" are vectorized for RAG retrieval.
   - Live hovering tooltips for instant place name previews.
   - Administrative portal for adding, editing, and moving campus landmarks in real time.

2. **Faculty Availability Estimation (Random Forest)**
   - Predicts real-time faculty availability (`Available for Consultation`, `In Scheduled Class`, `Unavailable / Off-Schedule`).
   - Trained across 37 CCSICT faculty profiles and 850+ schedule blocks with balanced precision, recall, and F1 metrics.
   - Schedule-derived consultation window intelligence and next-free-period predictions.
   - Privacy-preserving Status Masking Protocol & Egress Boundary (strictly protecting physical room numbers and live tracking).

3. **Institutional Knowledge Assistant (Enhanced RAG)**
   - Vectorized institutional database with `pgvector` and `all-MiniLM-L6-v2` (384-dimensional dense embeddings).
   - Knowledge base contains the ISU Student Handbook, Academic Calendar, and Campus POI Place Cards.
   - Fast generative response composition via Groq (`openai/gpt-oss-120b`).

---

## 🏛️ System Architecture

```
React 18 SPA (Port 5173)  ──►  Node.js / Express (Port 4000)  ──►  Python Flask ML (Port 5001)
  Interactive Leaflet Map        Query Router & Presence            Random Forest Classifier
  Conversational Assistant       Status Masking Boundary            all-MiniLM-L6-v2 Embedder
  Admin & Security Portals       Context Fusion
                                       │
                                       ├──►  Supabase (PostgreSQL + pgvector)
                                       └──►  Groq Cloud API (openai/gpt-oss-120b)
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js**: v18+ or v20+
- **Python**: v3.10+ or v3.11+
- **Git**

### 1. One-Click Launch (Windows)
To start all 3 services (ML Microservice, Backend API, and Frontend Vite):
```cmd
start.bat
```

To gracefully stop all background services:
```cmd
stop.bat
```

---

### 2. Manual Service Setup

#### Terminal 1: Python ML Microservice
```bash
cd machine-learning
pip install -r requirements.txt
python ai_api_service.py
```
*Runs on `http://127.0.0.1:5001`*

#### Terminal 2: Node.js Backend API
```bash
cd backend
npm install
npm run dev
```
*Runs on `http://localhost:4000`*

#### Terminal 3: React Frontend Web App
```bash
cd frontend
npm install
npm run dev
```
*Runs on `http://localhost:5173`*

---

## 📂 Repository Structure

```
├── backend/            # Express REST API, Query Router, RAG Pipeline & Masking Middleware
├── frontend/           # React SPA, Leaflet Campus Map, Chat Interface & Admin Portals
├── machine-learning/   # Python Flask ML Service, Random Forest Trainer & Embedder
├── database/           # PostgreSQL Schema, SQL Migrations & Sample Schedules
├── start.bat           # 1-click startup script for all services
├── stop.bat            # 1-click shutdown script
└── README.md           # Project Documentation
```

---

## 🧪 Testing & Verification

Run the automated backend test suites:
```bash
cd backend
npm test
```
All 95 unit, security, and integration tests should pass with 0 failures.
