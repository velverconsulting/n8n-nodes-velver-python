import json
import os
import hashlib
import base64
import time
import requests
import asyncio
import traceback
import platform
import sys
import io
from collections import OrderedDict
from typing import Dict, Any, Optional
from contextlib import asynccontextmanager, redirect_stdout
from pathlib import Path
from fastapi import FastAPI
from pydantic import BaseModel
from ultralytics import YOLO

# --- Configuración de Rutas Multi-plataforma ---
if platform.system() == "Windows":
    BASE_DIR = Path(__file__).parent.parent.resolve() / "py_runner_data"
else:
    BASE_DIR = Path("/tmp/py_runner")

MODELS_DIR = BASE_DIR / "models"
MAX_MODELS_IN_RAM = 10
EXTERNAL_CACHE_DAYS = 7

# Asegurar que existan los directorios
MODELS_DIR.mkdir(parents=True, exist_ok=True)

loaded_models = OrderedDict()

# --- Logic: Cleanup ---
def sync_cleanup():
    """Cleanup old external models from disk."""
    now = time.time()
    if not MODELS_DIR.exists():
        return
    for file_path in MODELS_DIR.glob("ext_*"):
        try:
            age_days = (now - file_path.stat().st_mtime) / 86400
            if age_days > EXTERNAL_CACHE_DAYS:
                file_path.unlink()
                m_hash = file_path.name.replace("ext_", "").split('.')[0]
                if m_hash in loaded_models:
                    del loaded_models[m_hash]
        except Exception as e:
            print(f"[Cleanup Error] {e}")

async def continuous_cleanup():
    """Periodic background cleanup task."""
    try:
        while True:
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, sync_cleanup)
            await asyncio.sleep(86400)
    except asyncio.CancelledError:
        pass

# --- Lifespan ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"[Startup] Operating System: {platform.system()}")
    print(f"[Startup] Base Directory: {BASE_DIR}")
    cleanup_task = asyncio.create_task(continuous_cleanup())
    yield
    cleanup_task.cancel()

app = FastAPI(lifespan=lifespan)

# --- Modelos de Entrada ---
class YoloReq(BaseModel):
    modelUrl: str
    modelType: str
    imageBuffer: str
    clearCache: bool = False

class RunReq(BaseModel):
    code: str
    input: Dict[str, Any] = {}

# --- Helpers ---
def is_velver_resource(url: str) -> bool:
    return "velver.mx" in url.lower()

# --- Endpoint: YOLO (Ultralytics) ---
@app.post("/yolo")
async def run_yolo(req: YoloReq):
    try:
        m_hash = hashlib.md5(req.modelUrl.encode()).hexdigest()
        is_velver = is_velver_resource(req.modelUrl)
        prefix = "vel_" if is_velver else "ext_"
        ext = ".onnx" if ".onnx" in req.modelUrl.lower() else ".pt"
        model_filename = f"{prefix}{m_hash}{ext}"
        model_path = MODELS_DIR / model_filename

        if req.clearCache and model_path.exists():
            model_path.unlink()
            if m_hash in loaded_models: del loaded_models[m_hash]

        # Descargar Modelo
        if not model_path.exists():
            print(f"[Download] {req.modelUrl}")
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
            print(f"[Model Load] {model_filename}")
            loaded_models[m_hash] = YOLO(str(model_path), task=req.modelType)

        # Procesar Imagen
        img_temp = BASE_DIR / f"temp_{os.getpid()}.jpg"
        with open(img_temp, "wb") as f:
            f.write(base64.b64decode(req.imageBuffer))

        results = loaded_models[m_hash].predict(source=str(img_temp), save=False, verbose=False)

        # Parseo Manual de Resultados
        res = results[0]
        # 1. Intentar serialización nativa (Perfecto para Detect, Segment, Pose, OBB)
        # normalize=False entrega coordenadas en píxeles (mejor para dibujar en frontend/n8n)
        try:
            output_data = json.loads(res.to_json(normalize=False))
        except Exception:
            output_data = []

        # 2. Fallback para Modelos de Clasificación (Si to_json devuelve vacío pero hay probabilidades)
        if not output_data and res.probs is not None:
            # Es un modelo de clasificación (ej: yolov8n-cls.pt)
            # Extraemos el Top-5 si existe
            if hasattr(res.probs, 'top5') and res.probs.top5:
                for rank, (cls_idx, conf) in enumerate(zip(res.probs.top5, res.probs.top5conf)):
                    output_data.append({
                        "type": "classification",
                        "rank": rank + 1,
                        "name": res.names[int(cls_idx)],
                        "class": int(cls_idx),
                        "confidence": round(float(conf), 5)
                    })
            else:
                # Fallback a Top-1
                idx = int(res.probs.top1)
                output_data.append({
                    "type": "classification",
                    "rank": 1,
                    "name": res.names[idx],
                    "class": idx,
                    "confidence": round(float(res.probs.top1conf), 5)
                })

        # 3. Limpieza de archivo temporal
        if img_temp.exists():
            img_temp.unlink()

        # 4. Retorno Extendido con Metadata (Specs)
        return {
            "success": True,
            "results": output_data, # Lista principal de detecciones
            "specs": {
                "task": getattr(res, 'task', 'unknown'), # detect, segment, classify...
                "speed": res.speed, # Diccionario con tiempos de inferencia (ms)
                "shape": res.orig_shape, # Tamaño original (height, width)
                "path": str(res.path)
            }
        }

    except Exception as e:
        print("-" * 30)
        traceback.print_exc()
        print("-" * 30)
        return {"success": False, "error": str(e)}

# --- Endpoint: Python Ejecutor Generico ---
@app.post("/run")
async def run_code(req: RunReq):
    """
    Ejecuta código Python arbitrario.
    Prioridad de retorno:
    1. Variable 'output' definida explícitamente.
    2. El último print() parseado como JSON.
    3. El último print() como texto plano.
    4. None si no hubo prints ni output.
    """
    f_stdout = io.StringIO()

    local_scope = {
        "input": req.input,
        "json": json,
        "requests": requests,
        "output": None
    }

    try:
        with redirect_stdout(f_stdout):
            exec(req.code, local_scope, local_scope)

        logs = f_stdout.getvalue().splitlines()

        # 1. Intentar obtener variable 'output'
        result_data = local_scope.get("output", None)

        # Lógica de Fallback si output es None
        if result_data is None and logs:
            last_line = logs[-1].strip()
            # 2. Intentar parsear último log como JSON
            try:
                result_data = json.loads(last_line)
            except json.JSONDecodeError:
                # 3. Usar como texto plano
                result_data = last_line

        return {
            "success": True,
            "data": result_data,
            "logs": logs,
            "error": None
        }

    except Exception as e:
        logs = f_stdout.getvalue().splitlines()
        error_msg = traceback.format_exc()
        return {
            "success": False,
            "data": None,
            "logs": logs,
            "error": error_msg
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)