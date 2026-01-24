import json, os, hashlib, base64, time, subprocess, requests, asyncio
from collections import OrderedDict
from typing import Dict, Any, Optional
from fastapi import FastAPI
from pydantic import BaseModel
from ultralytics import YOLO

app = FastAPI()

# --- Configuración ---
BASE_DIR = "/tmp/py_runner"
MODELS_DIR = os.path.join(BASE_DIR, "models")
MAX_MODELS_IN_RAM = 10
EXTERNAL_CACHE_DAYS = 7 # N días para borrar modelos externos

loaded_models = OrderedDict()
os.makedirs(MODELS_DIR, exist_ok=True)

class YoloReq(BaseModel):
    modelUrl: str
    modelType: str
    imageBuffer: str
    clearCache: bool = False

def is_velver_resource(url: str) -> bool:
    return "velver.mx" in url.lower()

async def continuous_cleanup():
    """Limpia modelos externos cada 24 horas sin depender de peticiones"""
    while True:
        now = time.time()
        for f in os.listdir(MODELS_DIR):
            # Solo borramos si empieza con 'ext_' (externo)
            if f.startswith("ext_"):
                path = os.path.join(MODELS_DIR, f)
                age_days = (now - os.path.getmtime(path)) / 86400
                if age_days > EXTERNAL_CACHE_DAYS:
                    try:
                        os.remove(path)
                        m_hash = f.replace("ext_", "").split('.')[0]
                        if m_hash in loaded_models: del loaded_models[m_hash]
                    except: pass
        await asyncio.sleep(86400) # Esperar un día

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(continuous_cleanup())

@app.post("/yolo")
async def run_yolo(req: YoloReq):
    try:
        m_hash = hashlib.md5(req.modelUrl.encode()).hexdigest()
        is_velver = is_velver_resource(req.modelUrl)

        # Prefijo para distinguir persistencia
        prefix = "vel_" if is_velver else "ext_"
        ext = ".onnx" if ".onnx" in req.modelUrl.lower() else ".pt"
        model_filename = f"{prefix}{m_hash}{ext}"
        model_path = os.path.join(MODELS_DIR, model_filename)

        if req.clearCache and os.path.exists(model_path):
            os.remove(model_path)
            if m_hash in loaded_models: del loaded_models[m_hash]

        # Descarga si no existe
        if not os.path.exists(model_path):
            r = requests.get(req.modelUrl, stream=True, timeout=300)
            r.raise_for_status()
            with open(model_path, "wb") as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)

        # Carga en RAM (LRU Cache)
        if m_hash in loaded_models:
            loaded_models.move_to_end(m_hash)
        else:
            if len(loaded_models) >= MAX_MODELS_IN_RAM:
                loaded_models.popitem(last=False)
            loaded_models[m_hash] = YOLO(model_path, task=req.modelType)

        # Procesar Imagen
        img_path = os.path.join(BASE_DIR, f"temp_{os.getpid()}.jpg")
        with open(img_path, "wb") as f:
            f.write(base64.b64decode(req.imageBuffer))

        results = loaded_models[m_hash].predict(source=img_path, save=False, verbose=False)
        if os.path.exists(img_path): os.remove(img_path)

        return {"success": True, "results": json.loads(results[0].tojson())}
    except Exception as e:
        return {"success": False, "error": str(e)}