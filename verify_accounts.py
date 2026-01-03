
import requests
import json
import sys

BASE_URL = "http://localhost:8000"

def verify_accounts():
    print("--- Verifying Account Data ---")
    url = f"{BASE_URL}/accounts/"
    try:
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            accounts = response.json()
            print(f"✅ Fetch Success. Found {len(accounts)} accounts.")
            print(json.dumps(accounts, indent=2))
            
            # Analyze "type" field
            real_count = sum(1 for a in accounts if a.get('type') == 'real')
            demo_count = sum(1 for a in accounts if a.get('type') == 'demo')
            
            print(f"\nAnalysis:")
            print(f"Real Accounts: {real_count}")
            print(f"Demo Accounts: {demo_count}")
            
            if real_count == 0:
                print("❌ CRITICAL: No Real accounts detected! Backend parsing logic may be flawed.")
            else:
                print("✅ Real account detected.")
                
        else:
            print(f"❌ Failed to fetch accounts: {response.text}")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    verify_accounts()
