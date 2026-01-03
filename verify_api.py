
import requests
import time
import sys

BASE_URL = "http://localhost:8000"

def test_endpoint(method, endpoint, payload=None, description=""):
    url = f"{BASE_URL}{endpoint}"
    print(f"Testing {description} ({method} {endpoint})...", end=" ")
    try:
        if method == "GET":
            response = requests.get(url, timeout=5)
        elif method == "POST":
            response = requests.post(url, json=payload, timeout=5)
        
        if response.status_code in [200, 201]:
            print(f"SUCCESS ({response.status_code})")
            return True, response.json()
        else:
            print(f"FAILED ({response.status_code}): {response.text}")
            return False, response.text
    except Exception as e:
        print(f"ERROR: {e}")
        return False, str(e)

def run_tests():
    print("--- Starting API Endpoint Verification ---")
    results = []

    # 1. Bot Status
    results.append(test_endpoint("GET", "/bot/", description="Bot Status"))

    # 2. Market Data
    results.append(test_endpoint("GET", "/market/symbols/", description="Active Symbols"))
    results.append(test_endpoint("GET", "/market/positions/", description="Open Positions"))
    results.append(test_endpoint("GET", "/market/candles/R_100?granularity=60&count=10", description="Candles (R_100)"))

    # 3. Trades
    # Note: excluding Execute/Close to avoid placing real trades during test, but checking history/analytics
    results.append(test_endpoint("GET", "/trade/history/?limit=5", description="Trade History"))
    results.append(test_endpoint("GET", "/trade/analytics/", description="Performance Analytics"))

    # 4. Settings
    results.append(test_endpoint("GET", "/settings/", description="Get Settings"))
    
    # 5. Accounts
    results.append(test_endpoint("GET", "/accounts/", description="Get Accounts"))

    # Summary
    success_count = sum(1 for r in results if r[0])
    total_count = len(results)
    
    print(f"\n--- Test Summary: {success_count}/{total_count} Passed ---")
    if success_count == total_count:
        print("✅ All verifiction endpoints are functioning correctly.")
    else:
        print("❌ Some endpoints failed.")
        sys.exit(1)

if __name__ == "__main__":
    run_tests()
