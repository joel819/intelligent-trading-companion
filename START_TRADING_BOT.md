# How to Start Your Trading Bot

## Quick Start (3 Simple Steps)

### Step 1: Start the Backend Server
```bash
cd ~/Documents/intelligent-trading-companion/backend
../.venv/bin/uvicorn app.main:app --port 8000 &
```

### Step 2: Start the Frontend Dashboard
```bash
cd ~/Documents/intelligent-trading-companion
npm run dev &
```

### Step 3: Activate the Bot
```bash
curl -X POST http://localhost:8000/bot/toggle/ -H "Content-Type: application/json" -d '{"command": "start"}'
```

---

## Detailed Instructions

### 1️⃣ Starting the Backend

Open a terminal and run:
```bash
cd ~/Documents/intelligent-trading-companion/backend
../.venv/bin/uvicorn app.main:app --port 8000
```

**What you should see:**
```
INFO:     Uvicorn running on http://127.0.0.1:8000
Starting ML Service...
INFO:     Application startup complete.
```

✅ Backend is ready when you see "Application startup complete"

---

### 2️⃣ Starting the Frontend

Open a **NEW terminal** and run:
```bash
cd ~/Documents/intelligent-trading-companion
npm run dev
```

**What you should see:**
```
VITE v5.4.19  ready in 300 ms

➜  Local:   http://localhost:8081/
```

✅ Frontend is ready when you see the localhost URL

---

### 3️⃣ Activating the Trading Bot

Open a **NEW terminal** and run:
```bash
curl -X POST http://localhost:8000/bot/toggle/ \
  -H "Content-Type: application/json" \
  -d '{"command": "start"}'
```

**What you should see:**
```json
{
  "status": "success",
  "command": "start"
}
```

✅ Bot is now running and will start trading!

---

## Checking Everything Works

### Check Backend Status
```bash
curl http://localhost:8000/bot/ | jq .
```

**Look for:**
- `"isConnected": true` ✅
- `"isAuthorized": true` ✅
- `"isRunning": true` ✅
- `"account": "VRTC5565891"` ✅

### Check Frontend
Open your browser and go to:
```
http://localhost:8081
```

**You should see:**
- Live price ticks updating ✅
- Your account balance ✅ 
- Trades being executed ✅
- Profit/Loss updates ✅

---

## Stopping the Bot

### Stop the Bot (but keep servers running)
```bash
curl -X POST http://localhost:8000/bot/toggle/ \
  -H "Content-Type: application/json" \
  -d '{"command": "stop"}'
```

### Stop Everything Completely
```bash
# Stop backend
pkill -f uvicorn

# Stop frontend
pkill -f vite
```

---

## Troubleshooting

### Problem: "Connection refused" error

**Solution:** Backend not running. Start it:
```bash
cd ~/Documents/intelligent-trading-companion/backend
../.venv/bin/uvicorn app.main:app --port 8000 &
```

### Problem: No live ticks showing

**Solution:** Restart the backend:
```bash
pkill -f uvicorn
sleep 2
cd ~/Documents/intelligent-trading-companion/backend
../.venv/bin/uvicorn app.main:app --port 8000 &
sleep 5
curl -X POST http://localhost:8000/bot/toggle/ -H "Content-Type: application/json" -d '{"command": "start"}'
```

### Problem: Port already in use

**Solution:** Kill the process using that port:
```bash
# For backend (port 8000)
lsof -t -i:8000 | xargs kill -9

# For frontend (port 8081)
lsof -t -i:8081 | xargs kill -9
```

Then start the servers again.

### Problem: "Not Authorized" status

**Check your token:**
```bash
cat ~/Documents/intelligent-trading-companion/backend/.env | grep DERIV_TOKEN
```

If empty, add your Deriv token to the `.env` file.

---

## Advanced: Running in Background

### Start backend in background (keeps running even if you close terminal)
```bash
cd ~/Documents/intelligent-trading-companion/backend
nohup ../.venv/bin/uvicorn app.main:app --port 8000 > /tmp/backend.log 2>&1 &
```

### Start frontend in background
```bash
cd ~/Documents/intelligent-trading-companion
nohup npm run dev > /tmp/frontend.log 2>&1 &
```

### View logs
```bash
# Backend logs
tail -f /tmp/backend.log

# Frontend logs
tail -f /tmp/frontend.log
```

---

## Quick Reference

| Action | Command |
|--------|---------|
| Start Backend | `cd ~/Documents/intelligent-trading-companion/backend && ../.venv/bin/uvicorn app.main:app --port 8000 &` |
| Start Frontend | `cd ~/Documents/intelligent-trading-companion && npm run dev &` |
| Start Trading | `curl -X POST http://localhost:8000/bot/toggle/ -H "Content-Type: application/json" -d '{"command": "start"}'` |
| Stop Trading | `curl -X POST http://localhost:8000/bot/toggle/ -H "Content-Type: application/json" -d '{"command": "stop"}'` |
| Check Status | `curl http://localhost:8000/bot/ \| jq .` |
| View Dashboard | Open browser: `http://localhost:8081` |
| Stop All | `pkill -f uvicorn && pkill -f vite` |

---

## Important Notes

⚠️ **Current Account**: You're using demo account (VRTC5565891) with virtual money  
⚠️ **For Real Trading**: Switch to a real account and deposit funds  
⚠️ **Confidence Threshold**: Currently set to 60% - only trades with ≥60% confidence execute  
⚠️ **Risk Per Trade**: 1% of your balance per trade  

---

## Support

If something doesn't work:
1. Check the troubleshooting section above
2. Make sure both backend and frontend are running
3. Check that you have internet connection (needs to connect to Deriv)
4. Restart everything using the "Stop All" command and start fresh

**Dashboard**: http://localhost:8081  
**API Docs**: http://localhost:8000/docs
