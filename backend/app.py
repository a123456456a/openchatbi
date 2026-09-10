from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import backend.auth.models  # noqa: F401
import backend.db as db
import backend.warehouse.models  # noqa: F401
from backend.auth.routes import auth_router, oauth_router
from backend.chat.routes import chat_router
from backend.config import get_settings
from backend.db import Base
from backend.llm.routes import llm_settings_router
from backend.users.routes import download_router, users_router
from backend.validation import redact_sensitive_fields
from backend.warehouse import service as warehouse_service
from backend.warehouse.routes import warehouse_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=db.engine)
    db.ensure_sqlite_schema(db.engine)
    session = db.SessionLocal()
    try:
        warehouse_service.apply_active_connection_on_startup(session)
    finally:
        session.close()
    yield


app = FastAPI(title="OpenChatBI API", lifespan=lifespan)
settings = get_settings()


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={"detail": redact_sensitive_fields(exc.errors())},
    )


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
app.include_router(llm_settings_router)
app.include_router(warehouse_router)


@app.get("/health")
def health():
    return {"status": "ok"}
