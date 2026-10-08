---
title: Wound Analysis API — Backend
sdk: docker
app_port: 7860
---

# WoundWatch — Wound Analysis API (Backend)

Python / FastAPI backend for WoundWatch. Provides wound outline + area (SAM),
tissue-colour mix, healing-phase rules, and an experimental healed / not-healed
indicator for surgical wounds. Decision support only — not a diagnosis.

> **Frontend:** See the React Native / Expo app in the `main` branch.

## Setup

1. In the training Colab, run:
   ```python
   import sklearn; print(sklearn.__version__)
   from google.colab import files; files.download("healing_status_logreg.joblib")
   ```
2. Put `healing_status_logreg.joblib` next to `main.py`.
3. Pin scikit-learn in `requirements.txt` to the version printed above (already set to `1.6.1`).
4. Create a **private** Docker Space on Hugging Face, push these files, and add Space secret `API_KEY`
   (any long random string).

## Local test (needs Docker)

```bash
docker build -t wound-api .
docker run -p 7860:7860 -e API_KEY=test123 wound-api

curl -X POST http://localhost:7860/analyze \
  -H "x-api-key: test123" \
  -F image=@photo.jpg \
  -F 'wound_boxes=[[0.30,0.30,0.65,0.60]]' \
  -F 'ref_box=[0.80,0.05,0.90,0.12]' -F ref_cm=2.0 \
  -F wound_kind=surgical
```

## Local test (Python venv)

```bash
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 7860 --reload
```

Interactive API docs → `http://localhost:7860/docs`

Boxes are fractions of image width/height: `[x1, y1, x2, y2]` in `0..1`.
Omit `ref_box`/`ref_cm` to get pixel areas (comparable only at the same camera distance).

## Project structure

```
wound-api/
├── main.py                  # App entry point (thin wiring only)
├── requirements.txt         # All deps pinned for reproducibility
├── Dockerfile
├── healing_status_logreg.joblib
└── src/
    ├── config.py            # Constants & env vars
    ├── exceptions.py        # Error hierarchy + handlers
    ├── dependencies.py      # API key auth (FastAPI Depends)
    ├── schemas/             # Pydantic request/response models
    ├── ml/                  # Model loading (SAM, DINOv2, joblib)
    ├── services/            # Image, segmentation, tissue, healing
    ├── facades/             # Orchestration per endpoint
    └── routers/             # HTTP layer (health, analyze, assess)
```

## Licenses to respect

SAM (check its model card), DINOv2 (check its model card), SurgWound (CC BY-SA 4.0, credit the authors),
CO2Wounds-V2 (CC BY-NC 3.0, non-commercial) if you train on it later.
