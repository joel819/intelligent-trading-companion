from fastapi import APIRouter

router = APIRouter()

@router.get("/")
def get_accounts():
    # Mock Data matching UI
    return [
        {
            "id": "ACC-001",
            "name": "Deriv Demo",
            "balance": 10000.00,
            "equity": 10000.00,
            "type": "demo",
            "currency": "USD",
            "isActive": True
        }
    ]

@router.post("/select")
def select_account(account_id: str):
    return {"status": "success", "selected": account_id}
