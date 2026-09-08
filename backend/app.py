from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import backend.auth.models  # noqa: F401
import backend.db as db
from backend.auth.routes import auth_router, oauth_router
from backend.chat.routes import chat_router
from backend.config import get_settings
from backend.db import Base
from backend.users.routes import download_router, users_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=db.engine)
    yield


app = FastAPI(title="OpenChatBI API", lifespan=lifespan)
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(oauth_router)
app.include_router(auth_router)
app.include_router(chat_router)
app.include_router(users_router)
app.include_router(download_router)


@app.get("/health")
def health():
    return {"status": "ok"}
