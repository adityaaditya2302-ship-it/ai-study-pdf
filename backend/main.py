"""AI Study PDF — FastAPI backend."""

from __future__ import annotations

import asyncio
import json
import logging
import shutil
import tempfile
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator

from fastapi import FastAPI, File, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from export import export_to_html, export_to_markdown, export_to_pdf
from models import (
    ExportFormat,
    ExportRequest,
    ExportResponse,
    ProcessingRequest,
    ProcessingResponse,
    StyleInfo,
    WSMessage,
)
from pipeline import run_pipeline

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

UPLOAD_DIR = Path(tempfile.gettempdir()) / "ai_study_pdf_uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

AVAILABLE_STYLES: list[StyleInfo] = [
    StyleInfo(id="modern",   name="Modern",   description="Clean, modern aesthetic with subtle gradients and rounded callouts.", color="#6366f1"),
    StyleInfo(id="academic", name="Academic",  description="Formal, academic look with serif fonts and classical styling.",    color="#0f766e"),
    StyleInfo(id="minimal",  name="Minimal",   description="Strip everything to the essentials. Monochrome, content-first.",  color="#374151"),
    StyleInfo(id="colorful", name="Colorful",  description="Vibrant palette, playful badges, and bold accent colours.",       color="#ec4899"),
    StyleInfo(id="dark",     name="Dark",      description="Dark background with neon accents — cyberpunk inspired.",         color="#8b5cf6"),
    StyleInfo(id="pastel",   name="Pastel",    description="Soft pastel tones with rounded shapes and gentle shadows.",      color="#a78bfa"),
    StyleInfo(id="neon",     name="Neon",      description="High-contrast black with electric neon highlights.",             color="#22d3ee"),
    StyleInfo(id="vintage",  name="Vintage",   description="Sepia tones, paper textures, and old-book styling.",            color="#b45309"),
    StyleInfo(id="tech",     name="Tech",      description="Monospace fonts, terminal-green accents, and grid layouts.",     color="#22c55e"),
    StyleInfo(id="organic",  name="Organic",   description="Earth tones, hand-drawn borders, warm inviting colours.",        color="#ca8a04"),
]


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("AI Study PDF backend starting up")
    yield
    logger.info("AI Study PDF backend shutting down")
    # Clean up temp uploads on shutdown
    if UPLOAD_DIR.exists():
        shutil.rmtree(UPLOAD_DIR, ignore_errors=True)


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="AI Study PDF",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# In-memory store (file_id → path)
# ---------------------------------------------------------------------------

_file_store: dict[str, Path] = {}

# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------

@app.post("/api/upload")
async def upload_image(file: UploadFile = File(...)) -> JSONResponse:
    """Receive an image, save to temp, return a file ID."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are accepted")

    file_id = uuid.uuid4().hex
    suffix = Path(file.filename or "upload.png").suffix or ".png"
    dest = UPLOAD_DIR / f"{file_id}{suffix}"

    with open(dest, "wb") as f:
        content = await file.read()
        f.write(content)

    _file_store[file_id] = dest
    logger.info("Uploaded %s (%d bytes) → %s", file.filename, len(content), dest)

    return JSONResponse({"file_id": file_id, "filename": file.filename, "size": len(content)})


@app.post("/api/process", response_model=ProcessingResponse)
async def process_image(req: ProcessingRequest) -> ProcessingResponse:
    """Run the AI pipeline on an uploaded image."""
    path = _file_store.get(req.file_id)
    if path is None or not path.exists():
        raise HTTPException(status_code=404, detail="File not found – upload first")

    try:
        note_data, elapsed = run_pipeline(
            path, style=req.style, mock=req.mock, api_key=None
        )
        return ProcessingResponse(
            success=True,
            note_data=note_data,
            processing_time_ms=elapsed,
        )
    except Exception as exc:
        logger.exception("Processing failed")
        return ProcessingResponse(success=False, error=str(exc))


@app.post("/api/export", response_model=ExportResponse)
async def export_notes(req: ExportRequest) -> ExportResponse:
    """Export HTML content to the requested format."""
    ts = int(time.time())
    try:
        if req.format == ExportFormat.PDF:
            out = export_to_pdf(req.html_content, filename=f"notes_{ts}.pdf")
        elif req.format == ExportFormat.HTML:
            out = export_to_html(req.html_content, filename=f"notes_{ts}.html")
        else:
            out = export_to_markdown(req.html_content, filename=f"notes_{ts}.md")

        return ExportResponse(success=True, file_path=str(out), filename=out.name)
    except Exception as exc:
        logger.exception("Export failed")
        return ExportResponse(success=False, error=str(exc))


@app.get("/api/download/{filename}")
async def download_file(filename: str) -> FileResponse:
    """Download an exported file by name."""
    from export import OUTPUT_DIR

    path = OUTPUT_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path, filename=filename)


@app.get("/api/styles", response_model=list[StyleInfo])
async def get_styles() -> list[StyleInfo]:
    """Return available design styles."""
    return AVAILABLE_STYLES


# ---------------------------------------------------------------------------
# WebSocket — real-time processing
# ---------------------------------------------------------------------------

@app.websocket("/ws/process")
async def ws_process(websocket: WebSocket) -> None:
    """Stream processing updates over a WebSocket connection.

    Client sends JSON: {"file_id": "...", "style": "modern", "mock": false}
    Server streams: status → progress → result/error
    """
    await websocket.accept()
    try:
        raw = await websocket.receive_text()
        payload = json.loads(raw)
        file_id: str = payload.get("file_id", "")
        style: str = payload.get("style", "modern")
        mock: bool = payload.get("mock", False)

        path = _file_store.get(file_id)
        if path is None or not path.exists():
            await websocket.send_json(WSMessage(event="error", data="File not found").model_dump())
            return

        await websocket.send_json(WSMessage(event="status", data="Enhancing image…").model_dump())
        await asyncio.sleep(0.1)  # allow UI to render

        await websocket.send_json(WSMessage(event="status", data="Running OCR…").model_dump())

        await websocket.send_json(WSMessage(event="progress", data={"step": 3, "total": 4, "label": "Analyzing layout…"}).model_dump())

        note_data, elapsed = run_pipeline(path, style=style, mock=mock)

        await websocket.send_json(WSMessage(event="progress", data={"step": 4, "total": 4, "label": "Generating notes…"}).model_dump())

        await websocket.send_json(
            WSMessage(
                event="result",
                data={
                    "note_data": note_data.model_dump(),
                    "processing_time_ms": elapsed,
                },
            ).model_dump()
        )

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as exc:
        logger.exception("WebSocket error")
        try:
            await websocket.send_json(WSMessage(event="error", data=str(exc)).model_dump())
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Static file serving (frontend)
# ---------------------------------------------------------------------------

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
