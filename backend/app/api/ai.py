"""
AI Assistant API Endpoints
Provides conversational AI capabilities for the trading companion.
"""

from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import Optional, Dict, Any
from app.services.ai_assistant import ai_assistant
from app.services.speech_recognition import transcribe_audio

router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    context: Optional[Dict[str, Any]] = None


class ChatResponse(BaseModel):
    response: str
    

class TradeAnalysisRequest(BaseModel):
    trade_data: Dict[str, Any]


class RejectionExplanationRequest(BaseModel):
    rejection_data: Dict[str, Any]


class TranscriptionResponse(BaseModel):
    text: str


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Chat with the AI trading assistant.
    
    Send a message and optionally include trading context for more relevant responses.
    """
    try:
        response = await ai_assistant.chat(request.message, request.context)
        return ChatResponse(response=response)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze-trade", response_model=ChatResponse)
async def analyze_trade(request: TradeAnalysisRequest):
    """
    Get AI analysis of a specific trade decision.
    """
    try:
        response = await ai_assistant.analyze_trade(request.trade_data)
        return ChatResponse(response=response)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/explain-rejection", response_model=ChatResponse)
async def explain_rejection(request: RejectionExplanationRequest):
    """
    Get AI explanation for why a trade was rejected.
    """
    try:
        response = await ai_assistant.explain_rejection(request.rejection_data)
        return ChatResponse(response=response)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe(audio: UploadFile = File(...)):
    """
    Transcribe audio to text using Whisper API.
    
    Accepts audio file uploads (webm, wav, mp3, mp4, etc.)
    Returns the transcribed text.
    """
    try:
        audio_data = await audio.read()
        text = await transcribe_audio(audio_data, audio.filename or "audio.webm")
        return TranscriptionResponse(text=text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/clear-history")
async def clear_history():
    """
    Clear the AI assistant's conversation history.
    """
    ai_assistant.clear_history()
    return {"message": "Conversation history cleared"}


@router.get("/health")
async def health():
    """
    Check if the AI assistant is operational.
    """
    return {"status": "operational", "model": ai_assistant.model}

