import os
import uvicorn
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from backend.routes.api_routes import router as api_router
from backend.api.websocket import router as ws_router

app = FastAPI(
    title="Clinical Voice AI Agent Server",
    description="Real-Time Multilingual Clinical Booking Voice AI Pipeline",
    version="1.0.0"
)

# Enable CORS for local cross-origin browser testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Setup initial database and profiles
from scheduler.appointment_engine.db_store import init_db
from memory.persistent_memory.db_memory import init_profiles
init_db()
init_profiles()

# Register API Router
app.include_router(api_router, prefix="/api")

# Register WebSockets Router
app.include_router(ws_router)

# Mount Static Files (HTML, CSS, JS)
static_dir = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(static_dir, exist_ok=True)

# Main route serves index.html directly
@app.get("/")
def read_index():
    return FileResponse(os.path.join(static_dir, "index.html"))

# Mount remaining static assets (js, css, images)
app.mount("/", StaticFiles(directory=static_dir), name="static")

if __name__ == "__main__":
    # Start ASGI server on port 8000
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
