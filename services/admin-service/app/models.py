from pydantic import BaseModel

class BatchCreate(BaseModel):
    batch_number: str

class BatchResponse(BaseModel):
    id: int
    batch_number: str
    created_at: str

class BatchUpdate(BaseModel):
    new_batch_number: str