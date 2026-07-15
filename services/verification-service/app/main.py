from fastapi import FastAPI, HTTPException
from app.models import VerifyRequest, VerifyResponse
from app.database import init_db_pool, get_pool, create_tables

app = FastAPI(title="Verification Service")


@app.on_event("startup")
async def startup():
    await init_db_pool()
    await create_tables()

@app.post("/verify", response_model=VerifyResponse)
async def verify_batch(req: VerifyRequest):
    pool = await get_pool()
    if pool is None:
        raise HTTPException(status_code=503, detail="Database not ready")

    async with pool.acquire() as conn:
        # Check if batch exists
        row = await conn.fetchrow(
            "SELECT batch_number FROM verified_batches WHERE batch_number = $1",
            req.batch_number
        )
    if row:
        return VerifyResponse(status="authentic")
    else:
        return VerifyResponse(status="fake")

