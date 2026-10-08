# WoundWatch

AI-powered wound monitoring app — take a photo, get an instant tissue breakdown and healing assessment.

> **Prototype / decision support only. Not a medical diagnosis.**

---

## Repository structure

```
WoundWatch/
├── backend/         ← Python / FastAPI wound analysis API
│   ├── main.py      ← App entry point
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── healing_status_logreg.joblib
│   └── src/
│       ├── config.py
│       ├── exceptions.py
│       ├── dependencies.py
│       ├── schemas/       # Pydantic request/response models
│       ├── ml/            # SAM + DINOv2 + classifier loader
│       ├── services/      # Image, segmentation, tissue, healing
│       ├── facades/       # Endpoint orchestration
│       └── routers/       # HTTP layer (health / analyze / assess)
│
└── frontend/        ← React Native / Expo mobile app
    ├── src/
    │   ├── app/           # Expo Router screens
    │   ├── components/    # Reusable UI components
    │   ├── hooks/
    │   └── constants/
    ├── assets/
    ├── app.json
    └── package.json
```

---

## Backend

FastAPI service exposing three endpoints:

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Liveness probe |
| `POST` | `/analyze` | Wound photo → area, tissue mix, overlay image |
| `POST` | `/assess` | Two visits → healing status + phase |

### Run locally

```bash
cd backend
python3.11 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 7860 --reload
```

Interactive docs → `http://localhost:7860/docs`

### Run with Docker

```bash
cd backend
docker build -t wound-api .
docker run -p 7860:7860 -e API_KEY=your_secret wound-api
```

---

## Frontend

Expo / React Native app (iOS + Android).

```bash
cd frontend
npm install
npx expo start
```

Set `API_URL` in `src/app/index.tsx` to your deployed backend URL before switching `USE_MOCK` to `false`.

---

## Branches

| Branch | Purpose |
|---|---|
| `main` | Expo frontend (original) |
| `dev-backend` | Backend — initial scaffold |
| `pre-dev-backend` | Backend — structured monorepo (current) |

---

## Licences

SAM — see model card · DINOv2 — see model card · SurgWound (CC BY-SA 4.0) · CO2Wounds-V2 (CC BY-NC 3.0, non-commercial)
