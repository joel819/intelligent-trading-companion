# Intelligent Trading Companion

This guide explains how to start the application on your local machine. You will need two separate terminal windows (one for the Backend, one for the Frontend).

## Prerequisites
- **Python** (3.10 or higher)
- **Node.js** (v18 or higher)

---

## Step 1: Start the Backend (Trading Engine)
The backend manages the connection to Deriv and runs the C++ trading strategy.

1.  Open your terminal.
2.  Navigate to the `backend` folder:
    ```bash
    cd backend
    ```
3.  (Optional) Install dependencies if you haven't recently:
    ```bash
    pip install -r requirements.txt
    ```
4.  Start the server:
    ```bash
    uvicorn app.main:app --reload --port 8000
    ```
    *You should see logs indicating "Uvicorn running on http://127.0.0.1:8000". Keep this terminal open.*

---

## Step 2: Start the Frontend (Dashboard)
The frontend provides the visual dashboard.

1.  Open a **NEW** terminal window.
2.  Navigate to the project root folder (where this README is):
    ```bash
    # Ensure you are not inside 'backend' folder
    cd /home/joel-oyewole/Documents/intelligent-trading-companion
    ```
3.  (Optional) Install dependencies if you haven't recently:
    ```bash
    npm install
    ```
4.  Start the development server:
    ```bash
    npm run dev
    ```
    *You should see "Local: http://localhost:8080/". Keep this terminal open.*

---

## Step 3: Access the Application
1.  Open your web browser (Chrome recommended).
2.  Go to: **http://localhost:8080**

### Verification
- **Ticks**: You should see live numbers updating in the "Tick Stream" panel.
- **Logs**: The logs panel should say "Connected to Trading Stream".
- **Bot Control**: You can click "Run Strategy" to start the automated trading logic.

---

## Troubleshooting

### "Backend connection failed"
- Ensure the Backend terminal (Step 1) is still running and hasn't crashed.
- Check if port 8000 is occupied by another process.

### "Page not loading"
- Ensure the Frontend terminal (Step 2) is running.
- Try refreshing the page.

### Stopping the App
- Press `Ctrl + C` in both terminals to stop the servers.
