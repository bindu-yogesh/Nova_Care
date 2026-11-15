# 🚀 Nova Care — Astronaut Health Monitoring Platform

**A crew-health monitoring and decision-support prototype for long-duration space missions.**

Long missions expose astronauts to radiation, isolation and confinement, altered gravity, and a hostile closed environment, and crews must spot health changes in themselves when Earth is far away. Nova Care gathers health indicators in one place, compares them against each astronaut's own baseline, raises severity-ranked alerts, and lets the crew log check-ins even when connectivity is lost.

Built for the **NASA Space Apps Challenge 2026**.

---

## ✨ Features

**Monitoring and analysis**
- **Mission dashboard:** crew status, mission overview, and active alerts at a glance.
- **Live monitoring:** simulated vitals streamed over Socket.IO every ~2.5 s, with an ECG-style waveform. Heart rate, HRV, SpO₂, respiratory rate, body temperature, blood pressure, and sleep are tracked.
- **Personal-baseline anomaly detection:** each astronaut's baseline (mean and standard deviation) is built from their own history, and new readings are scored by z-score plus rule-based thresholds in `server/analysis.js`.
- **Experimental ML anomaly check (optional service):** an Isolation Forest, with per-metric trend slopes and baselines, runs in the Python service. It needs at least 14 complete records and is explicitly flagged as experimental.
- **Alerts center:** severity-ranked alerts pushed in real time, with acknowledge and resolve workflows.
- **Health analytics, anomaly and AI-risk views:** historical charts and trends.
- **Scenario simulator:** a control bar to pause/resume the telemetry stream and inject anomaly scenarios for demos.

**Crew health modules**
- **Behavioral health:** mood and stress check-ins with an optional journal entry. Journal sentiment is scored with a simple **word-list (lexicon) method with negation handling, not machine learning**. Access is role-restricted, and astronauts can only see their own records.
- **Gravity & body (GravityMind):** exercise logs, mental-health records, and bone-health assessments.
- **Environment monitoring:** cabin temperature, humidity, CO₂, pressure, and radiation readings (simulated).
- **Medical assistant:** a deterministic assistant that answers from the astronaut's latest data and a small set of illustrative mission protocols. It is not an LLM.

**Operations**
- **Offline check-ins:** check-ins are queued locally in IndexedDB when offline and synced when connectivity returns. Each record carries an **idempotency key**, and the server records it in `sync_logs` to reject duplicates.
- **Crew and mission management, mission timeline.**
- **Reports:** printable summaries via the browser's print-to-PDF, plus a **telemetry CSV export**.
- **Roles:** `astronaut` and `medical` (mission control / flight surgeon).

**NASA and space data (see the section below for exactly what is real)**
- **NASA Research Explorer:** search and browse studies from NASA's Open Science Data Repository.
- **ISS tracker:** live ISS position from a third-party API.

---

## 📊 Data Sources — What Is Real and What Is Simulated

| Data | Source | Status |
|---|---|---|
| Astronaut vitals (HR, HRV, SpO₂, etc.) | Built-in simulator (`server/simulator.js`) | **Simulated** |
| Environment readings (radiation, CO₂, cabin conditions) | Built-in simulator | **Simulated** |
| Check-ins, mood, exercise, bone records | Entered by users / seeded demo data | Demo data |
| Research studies in "NASA Research Explorer" | **NASA Open Science Data Repository (OSDR)** public search API (`osdr.nasa.gov`) | **Real, live NASA data** |
| ISS position in "ISS Tracker" | Third-party *Where The ISS At?* API (`api.wheretheiss.at`) | Real, live, **not a NASA source** |
| Mission protocols used by the assistant | Written by the team for demonstration | **Illustrative, not official NASA procedures** |

**How NASA data is used today:** the OSDR integration is a research-reference module. It lets crew and flight surgeons look up space-biology studies relevant to spaceflight health. It does **not** currently feed the anomaly detection or alert logic.

**Not implemented:** live spacecraft or astronaut telemetry, NASA space-weather feeds for radiation, and clinically validated thresholds or models.

---

## 🧱 Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React, TypeScript, Vite, Recharts, Lucide |
| Backend | Node.js, Express, Socket.IO, JWT auth (bcryptjs) |
| Database | PostgreSQL 16 (via Docker Compose) |
| Optional ML service | Python, FastAPI, NumPy, scikit-learn |
| Offline support | IndexedDB queue, basic service worker (caches fetched pages/assets) |

---

## 🏗️ Architecture

```text
                    NOVA CARE
                        |
            +-----------+-----------+
            |                       |
      React Client             Express API ──► NASA OSDR / ISS APIs
      localhost:5173           localhost:4000
                                    |
                      +-------------+-------------+
                      |                           |
                 PostgreSQL                 AI Service (optional)
                 localhost:5433             FastAPI, localhost:8000
```

- The Express backend contains the core analysis (baselines, z-scores, rules) and runs without the Python service.
- The Python service powers only the experimental Isolation Forest endpoint (`/api/ai/ml-analysis`). Without it, that endpoint returns `503` and the rest of the app works.
- Docker Compose runs **PostgreSQL only**. The backend, frontend, and AI service run locally.

---

## 📋 Prerequisites

- Git
- Node.js 20+
- Docker Desktop with Docker Compose
- Python 3.10+ (only for the optional AI service)

---

## ⚙️ Installation and Setup

### 1. Clone

```bash
git clone https://github.com/bindu-yogesh/Nova_Care.git
cd Nova_Care
```

### 2. Start PostgreSQL

```bash
docker compose up -d
```

This starts PostgreSQL 16 on `localhost:5433` (database `astrovital_db`, user `postgres`, password `postgres`) and loads `server/schema.sql` on first creation.

### 3. Apply the behavioral-health migration

The behavioral-health table is defined in a separate SQL file and is **not** created automatically. Apply it once:

**macOS / Linux:**
```bash
docker compose exec -T db psql -U postgres -d astrovital_db < server/behavioral-health-migration.sql
```

**Windows PowerShell:**
```powershell
Get-Content server/behavioral-health-migration.sql | docker compose exec -T db psql -U postgres -d astrovital_db
```

### 4. Configure and start the backend

```bash
cd server
cp .env.example .env        # PowerShell: Copy-Item .env.example .env
```

Edit `server/.env`. Note that the example file uses port 5432, but this project's Docker setup uses **5433**:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/astrovital_db
JWT_SECRET=replace-with-a-long-random-secret
AI_URL=http://localhost:8000
PORT=4000
```

```bash
npm install
npm run seed
npm start
```

API: `http://localhost:4000`

### 5. (Optional) Start the AI service

```bash
cd ai-service
python -m venv .venv
source .venv/bin/activate      # PowerShell: .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Health check: `http://localhost:8000/health`

### 6. Start the frontend

```bash
cd client
npm install
npm run dev
```

Open **http://localhost:5173**. If the backend is elsewhere, set `VITE_API`.

---

## 🔐 Demo Accounts

| Role | Email | Password |
|---|---|---|
| Astronaut | `astro@demo.space` | `demo1234` |
| Mission Control | `medical@demo.space` | `demo1234` |

For local demonstration only. Always set your own `JWT_SECRET` before any shared or public deployment: the server falls back to a built-in development secret if the variable is missing, which is unsafe outside local use.

---

## 📴 Testing Offline Check-ins

1. Log in and open the **Check-in** page.
2. In browser DevTools → Network, enable **Offline**.
3. Submit a check-in. It is queued in IndexedDB.
4. Disable Offline. The queue syncs to the backend, and a repeated upload with the same idempotency key is rejected as a duplicate.

---

## 🧪 Tests

- `server/behavioral-health.test.js`: unit tests for the behavioral-health API with a mocked database (`node --test behavioral-health.test.js`, run from `server/`).
- `server/test-suite.js`: an integration script that needs the database seeded and the backend running on `localhost:4000`.

---

## 🗂️ Project Structure

```text
Nova_Care/
├── ai-service/          # FastAPI + scikit-learn (optional)
├── client/              # React + TypeScript frontend
│   ├── public/sw.js     # service worker
│   └── src/             # views/, components/, api.ts, offline.ts
├── server/
│   ├── index.js                      # Express API + Socket.IO
│   ├── analysis.js                   # baselines, z-scores, rules
│   ├── simulator.js                  # simulated telemetry + scenarios
│   ├── nasa.js                       # NASA OSDR + ISS endpoints
│   ├── behavioral-health.js          # mood/stress API
│   ├── behavioral-sentiment.js       # lexicon sentiment
│   ├── behavioral-health-migration.sql
│   ├── schema.sql  seed.js  migrate.js
│   └── test-suite.js  behavioral-health.test.js
├── docker-compose.yml   # PostgreSQL
└── README.md
```

---

## 🛠️ Troubleshooting

- **Database connection refused:** make sure Docker is running, `docker compose ps` shows the container, and `DATABASE_URL` uses port **5433**.
- **Behavioral health errors or missing table:** apply `server/behavioral-health-migration.sql` (setup step 3).
- **Tables do not exist:** `schema.sql` loads only when the database volume is first created. For an existing volume, apply it manually.
- **ML analysis returns 503:** the optional AI service isn't running on port 8000.
- **NASA Research Explorer or ISS Tracker shows an error:** these call external APIs, so check your internet connection. The backend returns a 502 when the source is unreachable.
- **Port in use:** 4000, 5173, 5433, or 8000 may be occupied.

---

## 🔭 Future Scope

- Drive radiation-risk indicators from NASA space-weather data and radiation research.
- Use published spaceflight-physiology research (e.g., OSDR studies) to inform and validate baselines and thresholds.
- Integrate wearable and sensor data, and clinically review the protocols with domain experts.
- Harden security (secrets management, audit logging) and privacy for crew medical data.
- Extend offline synchronization to all modules.

These are proposed directions, not existing functionality.

---

## 📚 References and Credits

**Data and services**
- [NASA Open Science Data Repository (OSDR)](https://osdr.nasa.gov/): public study search API
- [Where The ISS At? API](https://wheretheiss.at/w/developer): ISS position (third-party)

**Background reading**
- [NASA Human Research Program](https://www.nasa.gov/hrp/)
- [NASA Open Science](https://science.nasa.gov/open-science/)

**Open-source software:** React, TypeScript, Vite, Recharts, Lucide, Node.js, Express, Socket.IO, PostgreSQL, FastAPI, NumPy, scikit-learn.

---

## 👩‍🚀 About

**Nova Care** was built for the NASA Space Apps Challenge 2026 to explore how health analytics, offline-capable check-ins, and mission-control workflows can support crew health awareness on long-duration missions.

Repository: [github.com/bindu-yogesh/Nova_Care](https://github.com/bindu-yogesh/Nova_Care)
