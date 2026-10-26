"""
Gemini AI Assistant Backend
Connects to Google Gemini APIs and integrates with the Kenya SME Platform system.

Features:
- Gemini API key authentication
- Chat completion endpoint
- System integration (queries SME platform APIs)
- Full access mode
- Floating assistant ready for React frontend integration
"""

import os
import json
import asyncio
import aiohttp
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
import uvicorn
from dotenv import load_dotenv
import google.generativeai as genai

# Load environment variables from .env file
load_dotenv()

# --- Configuration ---
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-pro")
SYSTEM_API_BASE = "http://localhost:3000"

# Configure Gemini
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# Initialize FastAPI app
app = FastAPI(
    title="Gemini AI Assistant - Kenya SME Platform",
    description="AI Assistant integrated with Kenya SME Platform system",
    version="1.0.0"
)

# Add CORS middleware for React frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Models ---

class ChatMessage(BaseModel):
    role: str = Field(..., description="Message role: user, assistant, system")
    content: str = Field(..., description="Message content")

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    temperature: Optional[float] = Field(0.7, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(1024, ge=1, le=4096)
    stream: Optional[bool] = Field(False)

class ChatResponse(BaseModel):
    response: str
    usage: Optional[Dict[str, Any]] = None
    model: str = GEMINI_MODEL

class SystemQuery(BaseModel):
    endpoint: str
    method: str = "GET"
    params: Optional[Dict[str, Any]] = None
    body: Optional[Dict[str, Any]] = None

class SystemResponse(BaseModel):
    data: Any
    status: str
    error: Optional[str] = None

# --- Dependencies ---

def get_gemini_model():
    """Get configured Gemini model."""
    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="GEMINI_API_KEY not configured. Set the environment variable."
        )
    return genai.GenerativeModel(GEMINI_MODEL)

# --- Routes ---

@app.get("/")
async def root():
    return {"message": "Gemini AI Assistant Backend is running", "status": "healthy"}

@app.get("/health")
async def health_check():
    return {"status": "ok", "gemini_key_configured": bool(GEMINI_API_KEY)}

@app.post("/v1/chat/completions", response_model=ChatResponse)
async def chat_completion(request: ChatRequest):
    """
    Chat completion endpoint using Google Gemini API.
    Full access mode - can handle complex reasoning and system integration.
    """
    model = get_gemini_model()
    
    # Build the system prompt with system integration context
    system_prompt = """You are an AI assistant for the Kenya SME Platform. 
    You have access to business data, sales, customers, products, and expenses.
    Help users with:
    - Sales analysis and insights
    - Customer questions and support
    - Product inventory and management
    - Expense tracking and analysis
    - Business optimization suggestions
    
    Always be helpful, professional, and focused on SME business growth.
    Use the provided context and tools to give accurate, actionable advice.
    """
    
    # Prepare messages for Gemini API
    # Convert messages to Gemini format
    gemini_messages = []
    for msg in request.messages:
        role = "user" if msg.role == "user" else "model" if msg.role == "assistant" else "user"
        gemini_messages.append({"role": role, "parts": [msg.content]})
    
    # Add system prompt as first message if not present
    if not any(m["role"] == "user" and "system" in m["parts"][0].lower() for m in gemini_messages):
        gemini_messages.insert(0, {"role": "user", "parts": [system_prompt]})
        gemini_messages.insert(1, {"role": "model", "parts": ["I understand. I'm ready to help with your Kenya SME Platform business."]})
    
    try:
        response = model.generate_content(
            gemini_messages,
            generation_config=genai.types.GenerationConfig(
                temperature=request.temperature,
                max_output_tokens=request.max_tokens,
            )
        )
        
        return {
            "response": response.text,
            "usage": {
                "prompt_tokens": response.usage_metadata.prompt_token_count if response.usage_metadata else 0,
                "completion_tokens": response.usage_metadata.candidates_token_count if response.usage_metadata else 0,
                "total_tokens": response.usage_metadata.total_token_count if response.usage_metadata else 0,
            },
            "model": GEMINI_MODEL
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Gemini API error: {str(e)}")

@app.post("/api/v1/system/query", response_model=SystemResponse)
async def system_query(query: SystemQuery, x_auth_token: str = Header(None)):
    """
    Query the Kenya SME Platform system APIs.
    Full access - can query dashboard, sales, customers, products, etc.
    Requires authentication token from the SME platform.
    """
    headers = {
        "Authorization": f"Bearer {x_auth_token}",
        "X-Business-Id": os.getenv("KS_BUSINESS_ID", ""),
        "Content-Type": "application/json",
    }
    
    async with aiohttp.ClientSession() as session:
        try:
            url = f"http://localhost:3000/api/v1/{query.endpoint}"
            async with session.request(
                method=query.method,
                url=url,
                headers=headers,
                params=query.params,
                json=query.body
            ) as resp:
                data = await resp.json()
                return {
                    "data": data,
                    "status": resp.status,
                    "error": None
                }
        except aiohttp.ClientError as e:
            return {
                "data": None,
                "status": "error",
                "error": str(e)
            }

@app.get("/api/v1/dashboard", response_model=SystemResponse)
async def dashboard_data(x_auth_token: str = Header(None)):
    """Quick endpoint for dashboard data - integrates with SME platform."""
    headers = {
        "Authorization": f"Bearer {x_auth_token}",
        "X-Business-Id": os.getenv("KS_BUSINESS_ID", ""),
    }
    
    async with aiohttp.ClientSession() as session:
        try:
            # Query the actual SME platform dashboard
            async with session.get(
                "http://127.0.0.1:3000/api/v1/dashboard",
                headers=headers
            ) as resp:
                data = await resp.json()
                return {"data": data, "status": resp.status, "error": None}
        except Exception as e:
            return {"data": None, "status": "error", "error": str(e)}

# --- Startup Event ---

@app.on_event("startup")
async def startup_event():
    """Validate Gemini API key on startup."""
    if not GEMINI_API_KEY:
        print("WARNING: GEMINI_API_KEY not set. AI features will not work.")
    else:
        print(f"Gemini AI Assistant initialized with key: {GEMINI_API_KEY[:10]}...")

# --- Run the server ---
if __name__ == "__main__":
    port = int(os.getenv("AI_ASSISTANT_PORT", "8000"))
    host = os.getenv("AI_ASSISTANT_HOST", "0.0.0.0")
    print(f"\n=== Gemini AI Assistant Starting ===")
    print(f"Server: http://{host}:{port}")
    print(f"Gemini API: {'Configured' if GEMINI_API_KEY else 'Not configured'}")
    print(f"Model: {GEMINI_MODEL}")
    print(f"Docs: http://{host}:{port}/docs")
    print(f"===============================\n")
    uvicorn.run(app, host=host, port=port)