from fastapi import APIRouter
from app.services.deriv_connector import deriv_client

router = APIRouter()

@router.get("/symbols/")
async def get_symbols():
    symbols = await deriv_client.get_active_symbols()
    return symbols

@router.get("/positions/")
async def get_positions():
    return deriv_client.open_positions
