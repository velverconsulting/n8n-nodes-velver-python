FROM python:3.11-slim

# Instalación de dependencias del sistema para OpenCV y Ultralytics
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    libsm6 \
    libxext6 \
  && rm -rf /var/lib/apt/lists/*

# Instalación de librerías de Python
RUN pip install --no-cache-dir \
    fastapi \
    uvicorn[standard] \
    python-multipart \
    requests \
    httpx \
    beautifulsoup4 \
    ultralytics \
    opencv-python-headless \
    pandas \
    onnxruntime \
    pillow

WORKDIR /app
COPY server.py /app/server.py

# no-root para seguridad
RUN useradd -m appuser
RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 8000
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]