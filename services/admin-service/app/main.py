from fastapi import FastAPI, HTTPException, Depends, Header
from app.models import BatchCreate, BatchResponse
from app.database import init_db_pool, get_pool
import os
from datetime import datetime

API_KEY = os.getenv("ADMIN_API_KEY", "secret-admin-key")

app = FastAPI(title="Admin Service")

@app.on_event("startup")
async def startup():
    await init_db_pool()

def verify_api_key(api_key: str = Header(...)):
    if api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API Key")
    return True

@app.post("/batches", status_code=201)
async def add_batch(batch: BatchCreate, _: bool = Depends(verify_api_key)):
    pool = await get_pool()
    if pool is None:
        raise HTTPException(503, "Database not ready")
    async with pool.acquire() as conn:
        # Insert if not exists; ignore duplicate (or raise conflict)
        try:
            await conn.execute(
                "INSERT INTO verified_batches (batch_number) VALUES ($1)",
                batch.batch_number
            )
        except asyncpg.exceptions.UniqueViolationError:
            raise HTTPException(409, "Batch already exists")
    return {"message": "Batch added successfully"}

@app.get("/batches", response_model=list[BatchResponse])
async def list_batches(_: bool = Depends(verify_api_key)):
    pool = await get_pool()
    if pool is None:
        raise HTTPException(503, "Database not ready")
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT id, batch_number, created_at FROM verified_batches ORDER BY created_at DESC"
        )
    return [
        BatchResponse(
            id=row["id"],
            batch_number=row["batch_number"],
            created_at=row["created_at"].isoformat()
        ) for row in rows
    ]