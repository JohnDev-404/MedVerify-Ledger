from fastapi import FastAPI, HTTPException, Depends, Header
from app.models import BatchCreate, BatchResponse, BatchUpdate
from app.database import init_db_pool, get_pool
import os
import asyncpg

API_KEY = os.getenv("ADMIN_API_KEY", "secret-admin-key")

app = FastAPI(title="Admin Service")

@app.on_event("startup")
async def startup():
    await init_db_pool()
    pool = await get_pool()
    async with pool.acquire() as conn:
        # Create the admin table (for listing)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS admin_batches (
                id SERIAL PRIMARY KEY,
                batch_number TEXT UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        # Ensure the verification table exists
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS verified_batches (
                batch_number TEXT PRIMARY KEY
            )
        """)

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
        try:
            # Insert into admin_batches
            await conn.execute(
                "INSERT INTO admin_batches (batch_number) VALUES ($1)",
                batch.batch_number
            )
            # Also insert into verified_batches
            await conn.execute(
                "INSERT INTO verified_batches (batch_number) VALUES ($1) ON CONFLICT (batch_number) DO NOTHING",
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
            "SELECT id, batch_number, created_at FROM admin_batches ORDER BY created_at DESC"
        )
    return [
        BatchResponse(
            id=row["id"],
            batch_number=row["batch_number"],
            created_at=row["created_at"].isoformat()
        ) for row in rows
    ]

@app.put("/batches/{batch_number}")
async def update_batch(batch_number: str, update: BatchUpdate, _: bool = Depends(verify_api_key)):
    pool = await get_pool()
    if pool is None:
        raise HTTPException(503, "Database not ready")
    async with pool.acquire() as conn:
        # Check if new batch number already exists
        existing = await conn.fetchrow(
            "SELECT batch_number FROM admin_batches WHERE batch_number = $1",
            update.new_batch_number
        )
        if existing:
            raise HTTPException(409, "New batch number already exists")
        # Update admin_batches
        result = await conn.execute(
            "UPDATE admin_batches SET batch_number = $1 WHERE batch_number = $2",
            update.new_batch_number, batch_number
        )
        if result == "UPDATE 0":
            raise HTTPException(404, "Batch not found")
        # Update verified_batches
        await conn.execute(
            "UPDATE verified_batches SET batch_number = $1 WHERE batch_number = $2",
            update.new_batch_number, batch_number
        )
        return {"message": f"Batch {batch_number} updated to {update.new_batch_number}"}

@app.delete("/batches/{batch_number}")
async def delete_batch(batch_number: str, _: bool = Depends(verify_api_key)):
    pool = await get_pool()
    if pool is None:
        raise HTTPException(503, "Database not ready")
    async with pool.acquire() as conn:
        # Delete from admin_batches
        result = await conn.execute(
            "DELETE FROM admin_batches WHERE batch_number = $1",
            batch_number
        )
        if result == "DELETE 0":
            raise HTTPException(404, "Batch not found")
        # Delete from verified_batches
        await conn.execute(
            "DELETE FROM verified_batches WHERE batch_number = $1",
            batch_number
        )
        return {"message": f"Batch {batch_number} deleted successfully"}