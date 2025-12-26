export interface Account {
  id: string;
  name: string;
  balance: number;
  equity: number;
  type: 'demo' | 'live';
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
