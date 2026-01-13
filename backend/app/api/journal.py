from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import json
import os
import uuid
import logging
from datetime import datetime

router = APIRouter()
logger = logging.getLogger("api_journal")

DATA_FILE = "data/journal_entries.json"

# Ensure data directory exists
os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)

class JournalEntry(BaseModel):
    id: Optional[str] = None
    tradeId: str
    symbol: str
    side: str
    entryPrice: float
    exitPrice: float
    pnl: float
    date: str  # ISO format string
    notes: str
    tags: List[str]
    screenshots: List[str]
    lessons: str
    emotions: str
    strategy: str

    class Config:
        json_schema_extra = {
            "example": {
                "tradeId": "TRD-123",
                "symbol": "Volatility 75 Index",
                "side": "buy",
                "entryPrice": 1000.50,
                "exitPrice": 1050.50,
                "pnl": 50.00,
                "date": "2024-01-01T10:00:00",
                "notes": "Good entry on breakout",
                "tags": ["Breakout"],
                "screenshots": [],
                "lessons": "Patience pays",
                "emotions": "Calm",
                "strategy": "V75 Sniper"
            }
        }

def load_entries():
    if not os.path.exists(DATA_FILE):
        return []
    try:
        with open(DATA_FILE, "r") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Failed to load journal: {e}")
        return []

def save_entries(entries):
    with open(DATA_FILE, "w") as f:
        json.dump(entries, f, indent=2)

@router.get("/", response_model=List[JournalEntry])
async def get_entries():
    return load_entries()

@router.post("/", response_model=JournalEntry)
async def create_entry(entry: JournalEntry):
    entries = load_entries()
    
    new_entry = entry.dict()
    new_entry["id"] = str(uuid.uuid4())
    # Ensure date is string if passed as object (though Pydantic handles this usually)
    if not isinstance(new_entry["date"], str):
         new_entry["date"] = new_entry["date"].isoformat()

    entries.insert(0, new_entry) # Add to top
    save_entries(entries)
    return new_entry

@router.put("/{entry_id}", response_model=JournalEntry)
async def update_entry(entry_id: str, updated_entry: JournalEntry):
    entries = load_entries()
    
    for i, entry in enumerate(entries):
        if entry["id"] == entry_id:
            # Preserve ID
            data = updated_entry.dict()
            data["id"] = entry_id
            entries[i] = data
            save_entries(entries)
            return data
            
    raise HTTPException(status_code=404, detail="Entry not found")

@router.delete("/{entry_id}")
async def delete_entry(entry_id: str):
    entries = load_entries()
    initial_len = len(entries)
    entries = [e for e in entries if e["id"] != entry_id]
    
    if len(entries) == initial_len:
        raise HTTPException(status_code=404, detail="Entry not found")
        
    save_entries(entries)
    return {"status": "success", "message": "Entry deleted"}
