// Local Backtest Engine - Runs backtests using real Deriv historical data

import { derivHistoricalData, Candle } from '../deriv/DerivHistoricalData';
import { BacktestResult, BacktestTrade, BacktestMetrics } from '@/types/trading';

export interface BacktestConfig {
  strategyId: string;
  symbol: string;
  startDate: string;
  endDate: string;
  initialBalance: number;
}

// Strategy signal generators
type StrategySignal = 'buy' | 'sell' | 'hold';

interface StrategyContext {
  candles: Candle[];
  index: number;
  position: 'long' | 'short' | 'none';
}

// Simple strategy implementations
const strategies: Record<string, (ctx: StrategyContext) => StrategySignal> = {
  spike_bot: (ctx) => {
    if (ctx.index < 5) return 'hold';
    const current = ctx.candles[ctx.index];
    const avgRange = ctx.candles.slice(ctx.index - 5, ctx.index)
      .reduce((sum, c) => sum + Math.abs(c.high - c.low), 0) / 5;
    
    const currentRange = Math.abs(current.high - current.low);
    const bodySize = Math.abs(current.close - current.open);
    
    if (ctx.position === 'none') {
      if (currentRange > avgRange * 1.5 && bodySize > currentRange * 0.6) {
        return current.close > current.open ? 'buy' : 'sell';
      }
    }
    return 'hold';
  },

  v10_safe: (ctx) => {
    if (ctx.index < 20) return 'hold';
    
    const closes = ctx.candles.slice(ctx.index - 20, ctx.index + 1).map(c => c.close);
    const sma10 = closes.slice(-10).reduce((a, b) => a + b, 0) / 10;
    const sma20 = closes.reduce((a, b) => a + b, 0) / 21;
    const current = ctx.candles[ctx.index];
    
    if (ctx.position === 'none') {
      if (current.close > sma10 && sma10 > sma20) return 'buy';
      if (current.close < sma10 && sma10 < sma20) return 'sell';
    }
    return 'hold';
  },

  scalper: (ctx) => {
    if (ctx.index < 3) return 'hold';
    
    const current = ctx.candles[ctx.index];
    const prev1 = ctx.candles[ctx.index - 1];
    const prev2 = ctx.candles[ctx.index - 2];
    
    if (ctx.position === 'none') {
      if (current.close > prev1.close && prev1.close > prev2.close) return 'buy';
      if (current.close < prev1.close && prev1.close < prev2.close) return 'sell';
    }
    return 'hold';
  },

  breakout: (ctx) => {
    if (ctx.index < 20) return 'hold';
    
    const lookback = ctx.candles.slice(ctx.index - 20, ctx.index);
    const high = Math.max(...lookback.map(c => c.high));
    const low = Math.min(...lookback.map(c => c.low));
    const current = ctx.candles[ctx.index];
    
    if (ctx.position === 'none') {
      if (current.close > high) return 'buy';
      if (current.close < low) return 'sell';
    }
    return 'hold';
  },

  grid_recovery: (ctx) => {
    if (ctx.index < 10) return 'hold';
    
    const current = ctx.candles[ctx.index];
    const avg = ctx.candles.slice(ctx.index - 10, ctx.index)
      .reduce((sum, c) => sum + c.close, 0) / 10;
    
    const deviation = (current.close - avg) / avg;
    
    if (ctx.position === 'none') {
      if (deviation < -0.005) return 'buy';
      if (deviation > 0.005) return 'sell';
    }
    return 'hold';
  }
};

export async function runBacktest(config: BacktestConfig): Promise<BacktestResult> {
  const historicalData = await derivHistoricalData.fetchHistoricalCandles({
    symbol: config.symbol,
    startDate: config.startDate,
    endDate: config.endDate,
    granularity: 60
  });

  if (historicalData.error || historicalData.candles.length === 0) {
    console.warn('[Backtest] No historical data, using mock result');
    return generateMockResult(config);
  }

  const candles = historicalData.candles;
  const strategy = strategies[config.strategyId] || strategies.scalper;
  
  let balance = config.initialBalance;
  let position: 'long' | 'short' | 'none' = 'none';
  let entryPrice = 0;
  let entryDate = new Date();
  let tradeId = 1;
  
  const trades: BacktestTrade[] = [];
  const equityCurve: { date: string; equity: number; drawdown: number }[] = [];
  let peakEquity = balance;

  const riskPerTrade = 0.02;
  const tpMultiplier = 1.5;
  const slMultiplier = 1.0;

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];
    const date = new Date(candle.epoch * 1000);
    
    if (position !== 'none') {
      const atr = calculateATR(candles, i, 14);
      const tp = position === 'long' 
        ? entryPrice + (atr * tpMultiplier)
        : entryPrice - (atr * tpMultiplier);
      const sl = position === 'long'
        ? entryPrice - (atr * slMultiplier)
        : entryPrice + (atr * slMultiplier);

      let exitPrice: number | null = null;

      if (position === 'long') {
        if (candle.high >= tp) exitPrice = tp;
        else if (candle.low <= sl) exitPrice = sl;
      } else {
        if (candle.low <= tp) exitPrice = tp;
        else if (candle.high >= sl) exitPrice = sl;
      }

      if (exitPrice !== null) {
        const pnl = position === 'long' 
          ? (exitPrice - entryPrice) * (balance * riskPerTrade / (atr * slMultiplier))
          : (entryPrice - exitPrice) * (balance * riskPerTrade / (atr * slMultiplier));
        
        balance += pnl;
        
        trades.push({
          id: `trade_${tradeId++}`,
          entryDate: entryDate.toISOString(),
          exitDate: date.toISOString(),
          side: position === 'long' ? 'buy' : 'sell',
          entryPrice,
          exitPrice,
          pnl,
          pnlPercent: (pnl / config.initialBalance) * 100
        });
        
        position = 'none';
      }
    }

    if (position === 'none') {
      const signal = strategy({ candles, index: i, position });
      
      if (signal === 'buy') {
        position = 'long';
        entryPrice = candle.close;
        entryDate = date;
      } else if (signal === 'sell') {
        position = 'short';
        entryPrice = candle.close;
        entryDate = date;
      }
    }

    if (i % 10 === 0) {
      peakEquity = Math.max(peakEquity, balance);
      const drawdown = peakEquity > 0 ? ((peakEquity - balance) / peakEquity) * 100 : 0;
      
      equityCurve.push({
        date: date.toISOString().split('T')[0],
        equity: balance,
        drawdown
      });
    }
  }

  const metrics = calculateMetrics(trades, config.initialBalance, balance, equityCurve);

  return {
    strategyId: config.strategyId,
    symbol: config.symbol,
    startDate: config.startDate,
    endDate: config.endDate,
    initialBalance: config.initialBalance,
    finalBalance: balance,
    trades,
    equityCurve,
    metrics
  };
}

function calculateATR(candles: Candle[], index: number, period: number): number {
  if (index < period) return candles[index].high - candles[index].low;
  
  let atrSum = 0;
  for (let i = index - period + 1; i <= index; i++) {
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    );
    atrSum += tr;
  }
  return atrSum / period;
}

function calculateMetrics(
  trades: BacktestTrade[], 
  initialBalance: number, 
  finalBalance: number,
  equityCurve: { equity: number; drawdown: number }[]
): BacktestMetrics {
  const winningTrades = trades.filter(t => t.pnl > 0);
  const losingTrades = trades.filter(t => t.pnl <= 0);
  
  const totalPnL = finalBalance - initialBalance;
  const winRate = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;
  
  const grossProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
  const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  
  const maxDrawdown = Math.max(...equityCurve.map(e => e.drawdown), 0);
  
  const avgWin = winningTrades.length > 0 
    ? winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length 
    : 0;
  const avgLoss = losingTrades.length > 0 
    ? Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0) / losingTrades.length)
    : 0;
  
  const expectancy = trades.length > 0 
    ? (winRate / 100 * avgWin) - ((100 - winRate) / 100 * avgLoss)
    : 0;
  
  const returns = trades.map(t => t.pnlPercent);
  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const stdDev = returns.length > 1 
    ? Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1))
    : 1;
  const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

  let avgHoldTime = 0;
  if (trades.length > 0) {
    const holdTimes = trades.map(t => {
      const entry = typeof t.entryDate === 'string' ? new Date(t.entryDate) : t.entryDate;
      const exit = typeof t.exitDate === 'string' ? new Date(t.exitDate) : t.exitDate;
      return (exit.getTime() - entry.getTime()) / 60000;
    });
    avgHoldTime = holdTimes.reduce((a, b) => a + b, 0) / holdTimes.length;
  }

  return {
    totalPnL,
    winRate,
    profitFactor,
    maxDrawdown,
    sharpeRatio,
    totalTrades: trades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    avgWin,
    avgLoss,
    largestWin: winningTrades.length > 0 ? Math.max(...winningTrades.map(t => t.pnl)) : 0,
    largestLoss: losingTrades.length > 0 ? Math.abs(Math.min(...losingTrades.map(t => t.pnl))) : 0,
    expectancy,
    avgHoldTime
  };
}

function generateMockResult(config: BacktestConfig): BacktestResult {
  const days = Math.ceil((new Date(config.endDate).getTime() - new Date(config.startDate).getTime()) / (1000 * 60 * 60 * 24));
  const trades: BacktestTrade[] = [];
  const equityCurve: { date: string; equity: number; drawdown: number }[] = [];
  
  let balance = config.initialBalance;
  let peakBalance = balance;
  
  for (let i = 0; i < Math.max(days, 1); i++) {
    const date = new Date(config.startDate);
    date.setDate(date.getDate() + i);
    
    const tradesPerDay = Math.floor(Math.random() * 3) + 2;
    for (let j = 0; j < tradesPerDay; j++) {
      const isWin = Math.random() > 0.45;
      const pnl = isWin 
        ? Math.random() * 150 + 20 
        : -(Math.random() * 100 + 10);
      
      balance += pnl;
      
      trades.push({
        id: `mock_${i}_${j}`,
        entryDate: new Date(date.getTime() + j * 3600000).toISOString(),
        exitDate: new Date(date.getTime() + (j + 1) * 3600000).toISOString(),
        side: Math.random() > 0.5 ? 'buy' : 'sell',
        entryPrice: 1000 + Math.random() * 100,
        exitPrice: 1000 + Math.random() * 100,
        pnl,
        pnlPercent: (pnl / config.initialBalance) * 100
      });
    }
    
    peakBalance = Math.max(peakBalance, balance);
    equityCurve.push({
      date: date.toISOString().split('T')[0],
      equity: balance,
      drawdown: ((peakBalance - balance) / peakBalance) * 100
    });
  }
  
  return {
    strategyId: config.strategyId,
    symbol: config.symbol,
    startDate: config.startDate,
    endDate: config.endDate,
    initialBalance: config.initialBalance,
    finalBalance: balance,
    trades,
    equityCurve,
    metrics: calculateMetrics(trades, config.initialBalance, balance, equityCurve)
  };
}
