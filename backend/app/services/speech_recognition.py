"""
Speech Recognition Service
Provides voice-to-text transcription using OpenAI's Whisper API.
"""

import os
import io
import logging
import tempfile
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


async def transcribe_audio(audio_data: bytes, filename: str = "audio.webm") -> str:
    """
    Transcribe audio data to text using OpenAI Whisper API.
    
    Args:
        audio_data: Raw audio bytes (supports webm, wav, mp3, mp4, etc.)
        filename: Original filename with extension for format detection
        
    Returns:
        Transcribed text string
    """
    try:
        # Create a temporary file to store the audio
        suffix = os.path.splitext(filename)[1] if filename else ".webm"
        
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temp_file:
            temp_file.write(audio_data)
            temp_file_path = temp_file.name
        
        try:
            # Open and transcribe the audio file
            with open(temp_file_path, "rb") as audio_file:
                response = client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    response_format="text"
                )
            
            transcribed_text = response.strip() if isinstance(response, str) else response.text.strip()
            logger.info(f"Successfully transcribed audio: {transcribed_text[:50]}...")
            return transcribed_text
            
        finally:
            # Clean up temp file
            os.unlink(temp_file_path)
            
    except Exception as e:
        logger.error(f"Speech recognition error: {e}")
        raise Exception(f"Failed to transcribe audio: {str(e)}")
