export interface Account {
  id: string;
  name: string;
  balance: number;
  equity: number;
  type: 'demo' | 'live' | 'real';
  currency: string;
  isActive: boolean;
}

export interface Position {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  lots: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  sl: number | null;
  tp: number | null;
  openTime: string;
}

export interface Tick {
  timestamp: string;
  symbol: string;
  bid: number;
  ask: number;
  spread: number;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  source: string;
}

export interface BotStatus {
  isConnected: boolean;
  isRunning: boolean;
  isAuthorized: boolean;
  strategy: string;
  lastTrade: string | null;
  uptime: number;
  tradesExecuted: number;
  profitToday: number;
  symbol: string;
}

export interface StrategySettings {
  gridSize: number;
  riskPercent: number;
  maxLots: number;
  confidenceThreshold: number;
  stopLossPoints: number;
  takeProfitPoints: number;
  maxOpenTrades: number;
  drawdownLimit: number;
  symbol: string;
  // Advanced Settings
  minATR: number;
  maxATR: number;
  minPips: number;
  atrSpikeMultiplier: number;
  rsiOversold: number;
  rsiOverbought: number;
  maxDailyLoss: number;
  maxSLHits: number;
}

export interface Notification {
  id: string;
  type: 'trade' | 'alert' | 'error' | 'system';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export interface SkippedSignal {
  tick_count: number;
  reason: string;
  symbol: string;
  atr: number;
  confidence: number;
  regime: string;
  volatility: string;
  timestamp: string;
}

export interface JournalEntry {
  id: string;
  tradeId: string;
  symbol: string;
  side: 'buy' | 'sell';
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  date: Date | string;
  notes: string;
  tags: string[];
  screenshots: string[];
  lessons: string;
  emotions: string;
  strategy: string;
}

export interface BacktestConfig {
  strategyId: string;
  symbol: string;
  startDate: string;
  endDate: string;
  initialBalance: number;
}

export interface BacktestTrade {
  id: string;
  entryDate: Date | string;
  exitDate: Date | string;
  symbol?: string;
  side: 'buy' | 'sell';
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  pnlPercent: number;
}

export interface BacktestMetrics {
  totalPnL: number;
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  sharpeRatio: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  avgHoldTime: number;
  expectancy: number;
}

export interface BacktestResult {
  strategyId?: string;
  symbol?: string;
  startDate?: string;
  endDate?: string;
  initialBalance?: number;
  finalBalance?: number;
  trades: BacktestTrade[];
  equityCurve: { date: string; equity: number; drawdown: number }[];
  metrics: BacktestMetrics;
}
