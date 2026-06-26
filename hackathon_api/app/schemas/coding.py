# app/schemas/coding.py
from pydantic import BaseModel
from typing import Optional

# What the React frontend sends to FastAPI
class CodeSubmitRequest(BaseModel):
    problem_id: int
    source_code: str
    language_id: int # e.g., 71 for Python, 54 for C++

# What Judge0 sends back to our FastAPI Webhook
class Judge0Status(BaseModel):
    id: int
    description: str

class Judge0WebhookResponse(BaseModel):
    token: str
    status: Judge0Status
    time: Optional[str] = None
    memory: Optional[int] = None