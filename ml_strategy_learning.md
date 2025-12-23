# Machine Learning Strategy & Learning Mechanism

This document explains how the Intelligent Trading Companion processes market data, calculates trade confidence, and "learns" from the market environment.

## 1. Core Logic: Dynamic Grid Analysis
The bot uses a **Dynamic Grid Strategy** implemented in C++ for maximum execution speed. While it doesn't use a Deep Neural Network (yet), it employs **Empirical Heuristics** that act as a fundamental layer of Machine Learning.

### How it "Scores" a Trade
When a tick (price update) arrives, the engine performs the following calculation:
1. **Level Detection**: It identifies the nearest "Grid Line" based on the `grid_size` setting.
2. **Proximity Mapping**: It measures the distance between the current price and that line.
3. **Confidence Calculation**: 
   - A trade is highly confident (near 100%) when the price is **exactly** on a grid line.
   - Confidence drops as the price moves further away from the level.
   - **Learning Aspect**: The bot effectively learns where "support" and "resistance" are by mapping these grid levels in real-time.

## 2. Threshold Enforcement
The `confidenceThreshold` setting you control in the dashboard acts as the **Signal Filter**.
- **High Threshold (e.g., 90%)**: The bot will only take trades where the price is perfectly aligned with a major level. This results in fewer, but higher-quality trades.
- **Low Threshold (e.g., 10%)**: The bot is more aggressive and will take trades even if the price is drifting between levels.

## 3. Adaptive Risk (Future Proofing)
The engine is structured to support **Online Learning**:
- **Current state**: It adapts to volatility by checking distance relative to the grid size.
- **V2 implementation**: We are adding a "Scalp Momentum" layer (already in basic form in the C++ code) that learns the current trend direction over the last $N$ ticks to decide if a grid bounce is safe or if the price is "breaking out."

## 4. Why Use C++ for ML?
By running the "Prediction" logic in a compiled C++ shared library, we achieve **Microsecond Latency**. In high-frequency trading (like Volatility Indices), being 10 milliseconds faster than other bots is the difference between a winning and losing trade. 

---
*Note: This document is part of the system documentation and will be updated as the ML models are further trained and refined.*
