---
title: Wound Analysis API
sdk: docker
app_port: 7860
---

# Wound analysis API (prototype)

Outline + area (SAM), tissue-color mix and phase rules, and an experimental healed / not-healed
indicator for surgical wounds. Decision support only, not a diagnosis.

## Setup

1. In the training Colab, run:
   ```python
   import sklearn; print(sklearn.__version__)
   from google.colab import files; files.download("healing_status_logreg.joblib")
   ```
2. Put `healing_status_logreg.joblib` next to `app.py`.
3. In `requirements.txt`, replace the scikit-learn line with `scikit-learn==<that version>`.
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

Boxes are fractions of the image width/height: [x1, y1, x2, y2] in 0..1.
Omit `ref_box`/`ref_cm` to get pixel areas (comparable only at the same camera distance).

## Licenses to respect

SAM (check its model card), DINOv2 (check its model card), SurgWound (CC BY-SA 4.0, credit the authors),
CO2Wounds-V2 (CC BY-NC 3.0, non-commercial) if you train on it later.
