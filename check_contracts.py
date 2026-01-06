
import asyncio
import websockets
import json
import ssl

async def check():
    uri = "wss://ws.derivws.com/websockets/v3?app_id=1089"
    async with websockets.connect(uri) as ws:
        req = {"contracts_for": "1HZ75V"}
        await ws.send(json.dumps(req))
        res = await ws.recv()
        data = json.loads(res)
        if 'contracts_for' in data:
            available = data['contracts_for']['available']
            multipliers = [c for c in available if c['contract_type'] == 'MULTUP']
            print(f"Found {len(multipliers)} MULTUP contracts.")
            if multipliers:
                print("Multipliers:", [c['multiplier'] for c in multipliers])
        else:
            print("Error:", data)

if __name__ == "__main__":
    asyncio.run(check())
