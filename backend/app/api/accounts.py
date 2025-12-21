from fastapi import APIRouter
from app.services.deriv_connector import deriv_client

from pydantic import BaseModel

router = APIRouter()

class AccountAddRequest(BaseModel):
    token: str
    app_id: str = "1089"

@router.get("/")
async def get_accounts():
    return deriv_client.available_accounts

@router.post("/select/")
async def select_account(account_id: str):
    target_acc = None
    for acc in deriv_client.available_accounts:
        if acc['id'] == account_id:
            target_acc = acc
            break
            
    if not target_acc:
        return {"status": "error", "message": "Account not found"}
        
    deriv_client.active_account_id = account_id
    
    # Trigger re-authorization if we have a token for this account
    # Note: Tokens are often provided in the authorize response or can be switched manually
    if target_acc.get("token"):
        await deriv_client.authorize(target_acc["token"])
    else:
        # If no token, we still mark it active internally for balance state
        # In a real app, the user would need to provide the token for each account
        for acc in deriv_client.available_accounts:
            acc['isActive'] = (acc['id'] == account_id)
            if acc['isActive']:
                 deriv_client.current_account = {
                    "id": acc['id'],
                    "balance": acc.get("balance", 0.0),
                    "currency": acc.get("currency", "USD")
                }
            
    return {"status": "success", "selected": account_id}

@router.post("/add/")
async def add_account(request: AccountAddRequest):
    reconnect_needed = False
    if request.app_id and request.app_id != deriv_client.app_id:
        deriv_client.app_id = request.app_id
        reconnect_needed = True
        
    deriv_client.token = request.token
    
    if reconnect_needed:
        await deriv_client.disconnect()
        await deriv_client.connect()
    else:
        await deriv_client.authorize()
    
    return {"status": "success", "message": "Token updated and authorization attempted"}
