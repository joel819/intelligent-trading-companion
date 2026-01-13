import asyncio
import logging
from app.api.backtest import run_backtest, BacktestRequest, calculate_rsi
from app.services.deriv_connector import deriv_client
import pandas as pd

# Setup basic logging
logging.basicConfig(level=logging.INFO)

async def test_backtest_logic():
    print("Testing Backtest Logic...")
    
    # Mock request
    request = BacktestRequest(
        strategyId="v75_super_safe",
        symbol="R_100", # Use a common symbol
        startDate="2024-01-01",
        endDate="2024-01-02",
        initialBalance=10000.0
    )
    
    try:
        # We need to initialize deriv client or mock it
        # Since I can't easily mock the async client connection without a lot of code,
        # I'll rely on the actual connection if possible, or mock the get_candles method.
        
        # Mocking get_candles for offline testing (or partial integration)
        # But wait, the environment might not have credentials if run this way.
        # Let's try to verify if `calculate_rsi` works first.
        
        data = [10, 12, 11, 13, 15, 14, 16, 18, 17, 19, 21, 23, 22, 24, 25, 27]
        df = pd.DataFrame(data, columns=['close'])
        print("Calcing RSI...")
        rsi = calculate_rsi(df['close'])
        print(f"RSI Result: {rsi.tail()}")
        
        print("Done.")
        
    except Exception as e:
        print(f"Caught exception: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_backtest_logic())
