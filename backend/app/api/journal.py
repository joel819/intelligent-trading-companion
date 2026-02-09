from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import json
import os
import uuid
import logging
from datetime import datetime

import fcntl
from contextlib import contextmanager

router = APIRouter()
logger = logging.getLogger("api_journal")

# Resolve DATA_FILE relative to this script for consistency
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
DATA_FILE = os.path.join(BASE_DIR, "data/journal_entries.json")

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

@contextmanager
def locked_journal(mode="r"):
    """Context manager for locked access to the journal file."""
    # Ensure file exists for reading
    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, "w") as f:
            json.dump([], f)
    
    # Use a separate lock file to avoid issues with truncating the data file
    lock_file = DATA_FILE + ".lock"
    with open(lock_file, "w") as lf:
        if mode == "r":
            fcntl.flock(lf, fcntl.LOCK_SH)
        else:
            fcntl.flock(lf, fcntl.LOCK_EX)
            
        try:
            with open(DATA_FILE, mode) as f:
                yield f
        finally:
            fcntl.flock(lf, fcntl.LOCK_UN)

def load_entries():
    try:
        with locked_journal("r") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Failed to load journal: {e}")
        return []

def save_entries(entries):
    try:
        with locked_journal("w") as f:
            json.dump(entries, f, indent=2)
    except Exception as e:
        logger.error(f"Failed to save journal: {e}")

def add_journal_entry(entry_data):
    """Atomically add a new journal entry."""
    try:
        with locked_journal("r+") as f:
            entries = json.load(f)
            entries.insert(0, entry_data)
            f.seek(0)
            f.truncate()
            json.dump(entries, f, indent=2)
    except Exception as e:
        logger.error(f"Failed to add journal entry: {e}")

def update_journal_entry_by_trade_id(trade_id, update_data):
    """Atomically update a journal entry by its trade ID."""
    try:
        with locked_journal("r+") as f:
            entries = json.load(f)
            updated = False
            for entry in entries:
                if str(entry.get('tradeId')) == str(trade_id):
                    entry.update(update_data)
                    updated = True
                    break
            if updated:
                f.seek(0)
                f.truncate()
                json.dump(entries, f, indent=2)
            return updated
    except Exception as e:
        logger.error(f"Failed to update journal entry: {e}")
        return False

@router.get("/", response_model=List[JournalEntry])
async def get_entries():
    return load_entries()

@router.post("/", response_model=JournalEntry)
async def create_entry(entry: JournalEntry):
    with locked_journal("r+") as f:
        entries = json.load(f)
        
        new_entry = entry.dict()
        new_entry["id"] = str(uuid.uuid4())
        # Ensure date is string
        if not isinstance(new_entry["date"], str):
             new_entry["date"] = new_entry["date"].isoformat()

        entries.insert(0, new_entry) # Add to top
        
        f.seek(0)
        f.truncate()
        json.dump(entries, f, indent=2)
        return new_entry

@router.put("/{entry_id}", response_model=JournalEntry)
async def update_entry(entry_id: str, updated_entry: JournalEntry):
    with locked_journal("r+") as f:
        entries = json.load(f)
        
        found = False
        data = None
        for i, entry in enumerate(entries):
            if entry["id"] == entry_id:
                # Preserve ID
                data = updated_entry.dict()
                data["id"] = entry_id
                entries[i] = data
                found = True
                break
        
        if not found:
            raise HTTPException(status_code=404, detail="Entry not found")
            
        f.seek(0)
        f.truncate()
        json.dump(entries, f, indent=2)
        return data

@router.delete("/{entry_id}")
async def delete_entry(entry_id: str):
    with locked_journal("r+") as f:
        entries = json.load(f)
        initial_len = len(entries)
        entries = [e for e in entries if e["id"] != entry_id]
        
        if len(entries) == initial_len:
            raise HTTPException(status_code=404, detail="Entry not found")
            
        f.seek(0)
        f.truncate()
        json.dump(entries, f, indent=2)
        return {"status": "success", "message": "Entry deleted"}
