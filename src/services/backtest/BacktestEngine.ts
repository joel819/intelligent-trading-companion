import { api } from '@/api/client';
import { BacktestResult, BacktestConfig } from '@/types/trading';

/**
 * Runs a backtest by calling the backend API.
 * The backend handles data fetching (Deriv) and strategy execution.
 */
export async function runBacktest(config: BacktestConfig): Promise<BacktestResult> {
  console.log('[BacktestEngine] Requesting backtest from backend:', config);
  try {
    const result = await api.backtest.run(config);
    return result;
  } catch (error) {
    console.error('[BacktestEngine] Backend error:', error);
    // Rethrow to let UI handle it 
    throw error;
  }
}
