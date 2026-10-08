FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m -u 1000 user
USER user
ENV PATH="/home/user/.local/bin:$PATH" \
    HF_HOME=/home/user/.cache/huggingface
WORKDIR /home/user/app

COPY --chown=user requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && pip install --no-cache-dir -r requirements.txt

# bake the models into the image so the first request is not a multi-minute download
RUN python -c "from transformers import SamModel, SamProcessor, AutoModel, AutoImageProcessor; \
SamModel.from_pretrained('facebook/sam-vit-base'); SamProcessor.from_pretrained('facebook/sam-vit-base'); \
AutoModel.from_pretrained('facebook/dinov2-base'); AutoImageProcessor.from_pretrained('facebook/dinov2-base')"

COPY --chown=user . .
EXPOSE 7860
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
