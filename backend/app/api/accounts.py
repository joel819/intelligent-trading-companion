from fastapi import APIRouter
from app.services.deriv_connector import deriv_client

router = APIRouter()

@router.get("/")
def get_accounts():
    if deriv_client.available_accounts:
        return deriv_client.available_accounts
        
    # Fallback to Mock if not connected yet or empty
    return [
        {
            "id": "ACC-Loading",
            "name": "Connecting to Deriv...",
            "balance": 0.0,
            "equity": 0.0,
            "type": "demo",
            "currency": "USD",
            "isActive": False
        }
    ]

@router.post("/select")
def select_account(account_id: str):
    # In real impl, we would switch token or re-auth, but for now we just verify it exists
    return {"status": "success", "selected": account_id}
