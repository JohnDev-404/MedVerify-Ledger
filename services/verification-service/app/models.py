from pydantic import BaseModel

class VerifyRequest(BaseModel):
    batch_number: str

class VerifyResponse(BaseModel):
    status: str  # "authentic" or "fake"