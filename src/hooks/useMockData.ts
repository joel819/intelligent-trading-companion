import { useState, useEffect, useCallback } from 'react';
import type { Account, Position, Tick, LogEntry, BotStatus, Notification } from '@/types/trading';

const SYMBOLS = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'VOLATILITY 75', 'BOOM 1000'];

const generateRandomTick = (symbol: string): Tick => {
  const basePrice = symbol === 'EUR/USD' ? 1.0850 :
                    symbol === 'GBP/USD' ? 1.2650 :
                    symbol === 'USD/JPY' ? 149.50 :
                    symbol === 'VOLATILITY 75' ? 185000 :
                    5000;
  
  const variation = (Math.random() - 0.5) * 0.001 * basePrice;
  const bid = basePrice + variation;
  const ask = bid + (Math.random() * 0.0005 * basePrice);
  
  return {
    timestamp: new Date().toISOString(),
    symbol,
    bid: parseFloat(bid.toFixed(symbol.includes('JPY') ? 3 : 5)),
    ask: parseFloat(ask.toFixed(symbol.includes('JPY') ? 3 : 5)),
    spread: parseFloat((ask - bid).toFixed(5)),
  };
};

const mockAccounts: Account[] = [
  { id: '1', name: 'Main Trading', balance: 10500.50, equity: 10750.25, type: 'live', currency: 'USD', isActive: true },
  { id: '2', name: 'Scalping Bot', balance: 5200.00, equity: 5180.75, type: 'live', currency: 'USD', isActive: false },
  { id: '3', name: 'Demo Testing', balance: 100000.00, equity: 102500.00, type: 'demo', currency: 'USD', isActive: false },
];

const mockPositions: Position[] = [
  { id: '1', symbol: 'EUR/USD', side: 'buy', lots: 0.5, entryPrice: 1.0825, currentPrice: 1.0852, pnl: 135.00, sl: 1.0800, tp: 1.0900, openTime: '2024-01-15T10:30:00Z' },
  { id: '2', symbol: 'VOLATILITY 75', side: 'sell', lots: 0.1, entryPrice: 185500, currentPrice: 185200, pnl: 30.00, sl: 186000, tp: 184500, openTime: '2024-01-15T11:15:00Z' },
  { id: '3', symbol: 'GBP/USD', side: 'buy', lots: 0.25, entryPrice: 1.2600, currentPrice: 1.2655, pnl: 137.50, sl: 1.2550, tp: 1.2750, openTime: '2024-01-15T09:45:00Z' },
];

const logMessages = [
  { level: 'info' as const, message: 'Tick received: EUR/USD @ 1.0852', source: 'TickHandler' },
  { level: 'success' as const, message: 'Order executed: BUY 0.5 lots EUR/USD', source: 'ExecutionEngine' },
  { level: 'info' as const, message: 'ML confidence: 0.87 (threshold: 0.75)', source: 'MLInference' },
  { level: 'warn' as const, message: 'Spread widening detected on VOLATILITY 75', source: 'RiskManager' },
  { level: 'info' as const, message: 'Grid level 3 triggered', source: 'GridStrategy' },
  { level: 'error' as const, message: 'Connection timeout, reconnecting...', source: 'WebSocket' },
  { level: 'success' as const, message: 'Take profit hit: +$45.50', source: 'ExecutionEngine' },
  { level: 'info' as const, message: 'Volatility breakout signal detected', source: 'BreakoutStrategy' },
];

export const useMockData = () => {
  const [accounts] = useState<Account[]>(mockAccounts);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(mockAccounts[0].id);
  const [positions, setPositions] = useState<Position[]>(mockPositions);
  const [ticks, setTicks] = useState<Tick[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [botStatus, setBotStatus] = useState<BotStatus>({
    isRunning: true,
    strategy: 'ML Scalping + Grid',
    lastTrade: '2 minutes ago',
    uptime: 14520,
    tradesExecuted: 47,
    profitToday: 285.50,
  });
  const [notifications, setNotifications] = useState<Notification[]>([
    { id: '1', type: 'trade', title: 'Trade Executed', message: 'BUY 0.5 lots EUR/USD @ 1.0825', timestamp: new Date().toISOString(), read: false },
    { id: '2', type: 'alert', title: 'Drawdown Warning', message: 'Account drawdown reached 5%', timestamp: new Date(Date.now() - 300000).toISOString(), read: false },
    { id: '3', type: 'system', title: 'Bot Started', message: 'Trading engine initialized successfully', timestamp: new Date(Date.now() - 600000).toISOString(), read: true },
  ]);

  // Simulate real-time tick updates
  useEffect(() => {
    const interval = setInterval(() => {
      const randomSymbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      const newTick = generateRandomTick(randomSymbol);
      setTicks(prev => [newTick, ...prev.slice(0, 49)]);
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // Simulate log updates
  useEffect(() => {
    const interval = setInterval(() => {
      const randomLog = logMessages[Math.floor(Math.random() * logMessages.length)];
      const newLog: LogEntry = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        ...randomLog,
      };
      setLogs(prev => [newLog, ...prev.slice(0, 99)]);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Simulate position P&L updates
  useEffect(() => {
    const interval = setInterval(() => {
      setPositions(prev => prev.map(pos => ({
        ...pos,
        currentPrice: pos.currentPrice + (Math.random() - 0.5) * 0.001 * pos.currentPrice,
        pnl: pos.pnl + (Math.random() - 0.5) * 10,
      })));
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const toggleBot = useCallback(() => {
    setBotStatus(prev => ({ ...prev, isRunning: !prev.isRunning }));
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const selectedAccount = accounts.find(a => a.id === selectedAccountId) || accounts[0];

  return {
    accounts,
    selectedAccount,
    selectedAccountId,
    setSelectedAccountId,
    positions,
    ticks,
    logs,
    botStatus,
    toggleBot,
    notifications,
    markNotificationRead,
  };
};
