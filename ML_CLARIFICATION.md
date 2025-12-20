# Machine Learning Setup & Clarification

## Current Status
The project is currently running on a **Node.js Trading Engine** (`server/`) which handles:
- Connection to Deriv API
- Live Ticks
- Trade Execution
- Safety Checks

The **Machine Learning (ML)** components reside in the legacy `backend/` (Python) directory. **The Node.js engine does NOT currently use the Python ML models**. It is running a basic algorithmic strategy.

## How to Enable ML (Future Steps)
To fully enable ML, we need to bridge the Node.js backend with the Python ML service.

1.  **Data Requirements**:
    - The ML models typically require historical tick data to train/predict.
    - Currently, the Node.js backend receives *live* ticks but might need to buffer them or fetch a history CSV to "warm up" the ML model.

2.  **Validation**:
    - If you believe the ML "isn't working," it is because it is effectively **disconnected** in this Node.js version.
    - **No manual download is required** right now because the ML isn't active.

## Recommendation
For now, run the app to verify connectivity and basic trading. Once stable, we can re-integrate the Python ML layer by having the Node.js server send market data to the Python service for trade signals.
