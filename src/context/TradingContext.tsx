import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { Account, Position, LogEntry, Notification, BotStatus, SkippedSignal } from '@/types/trading';
import { useNotifications } from '@/hooks/useNotifications';

interface TradingContextType {
    isConnected: boolean;
    isAuthorized: boolean;
    accounts: Account[];
    selectedAccount: Account;
    selectedAccountId: string | null;
    setSelectedAccountId: (id: string) => void;
    toggleAccountType: () => void;
    addAccount: (data: { token: string; appId: string }) => void;
    removeAccount: (id: string) => void;
    accountsMetadata: any[];
    authError: string | null;
    positions: Position[];
    ticks: Record<string, any[]>;
    symbols: any[];
    selectedSymbol: string;
    setSelectedSymbol: (symbol: string) => void;
    logs: LogEntry[];
    skippedSignals: SkippedSignal[];
    botStatus: BotStatus;
    toggleBot: () => void;
    executeTrade: (params: any) => void;
    closePosition: (contractId: string) => Promise<any>;
    notifications: Notification[];
    markNotificationRead: (id: string) => void;
    tradeHistory: any[];
    performanceAnalytics: any[];
    latestPrediction: any;
    marketStatus: {
        regime: string;
        volatility: string;
        active_strategy: string;
        symbol: string;
        tick_count?: number;
        spike_counter?: number;
        cooldown?: number;
    };
}

const TradingContext = createContext<TradingContextType | undefined>(undefined);

const MOCK_NOTIFICATIONS: Notification[] = [];

export const TradingProvider = ({ children }: { children: ReactNode }) => {
    const queryClient = useQueryClient();
    const [isConnected, setIsConnected] = useState(false);
    const [derivTicks, setDerivTicks] = useState<Record<string, any[]>>({});
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [positions, setPositions] = useState<Position[]>([]);
    const [symbols, setSymbols] = useState<any[]>([]);
    const [selectedSymbol, setSelectedSymbol] = useState('R_10');
    const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
    const [skippedSignals, setSkippedSignals] = useState<SkippedSignal[]>([]);
    const [marketStatuses, setMarketStatuses] = useState<Record<string, any>>({});

    const marketStatus = marketStatuses[selectedSymbol] || {
        regime: 'Analyzing...',
        volatility: 'Unknown',
        active_strategy: 'Loading...',
        symbol: selectedSymbol,
        tick_count: 0,
        spike_counter: 0,
        cooldown: 0
    };

    const { showNotification } = useNotifications();

    // 1. Fetch Bot status
    const { data: botStatus = {
        isConnected: false,
        isRunning: false,
        isAuthorized: false,
        strategy: "Ready",
        lastTrade: null,
        uptime: 0,
        tradesExecuted: 0,
        profitToday: 0,
        symbol: "R_10"
    } as BotStatus } = useQuery({
        queryKey: ['botStatus'],
        queryFn: api.bot.getStatus,
        refetchInterval: 1000
    });

    // Sync selectedSymbol with backend if it changes
    const handleSetSelectedSymbol = async (symbol: string) => {
        setSelectedSymbol(symbol);
        try {
            await api.settings.setSymbol(symbol);
            queryClient.invalidateQueries({ queryKey: ['botStatus'] });
        } catch (error) {
            console.error('Failed to sync symbol with backend:', error);
        }
    };

    useEffect(() => {
        if (botStatus.symbol && botStatus.symbol !== selectedSymbol) {
            setSelectedSymbol(botStatus.symbol);
        }
    }, [botStatus.symbol]);

    // Clear ticks on symbol change? No, keep history for multi-symbol.
    // But we might want to prune old ones if memory is an issue.
    // For now, let's NOT clear them to allow instant switching.
    /*
    useEffect(() => {
        setDerivTicks({}); // Don't clear for simultaneous support
        setSkippedSignals([]);
    }, [selectedSymbol]);
    */
    useEffect(() => {
        setSkippedSignals([]);
    }, [selectedSymbol]);

    // 2. Fetch Symbols
    useQuery({
        queryKey: ['symbols'],
        queryFn: async () => {
            const data = await api.market.getSymbols();
            setSymbols(data);
            return data;
        },
        enabled: isConnected && botStatus.isAuthorized
    });

    // 3. Fetch Positions
    useQuery({
        queryKey: ['positions'],
        queryFn: async () => {
            const data = await api.market.getPositions();
            setPositions(data);
            return data;
        },
        enabled: isConnected && botStatus.isAuthorized
    });

    // 4. Fetch Trade History
    const { data: tradeHistory = [] } = useQuery({
        queryKey: ['tradeHistory'],
        queryFn: () => api.trade.getHistory(),
        refetchInterval: 10000,
        enabled: isConnected && botStatus.isAuthorized
    });

    // 5. Fetch Performance Analytics
    const { data: performanceAnalytics = [] } = useQuery({
        queryKey: ['performanceAnalytics'],
        queryFn: () => api.trade.getAnalytics(),
        refetchInterval: 30000,
        enabled: isConnected && botStatus.isAuthorized
    });

    // 6. Fetch Latest ML Prediction
    const { data: latestPrediction = {
        buyProbability: 0.5,
        sellProbability: 0.5,
        confidence: 0,
        regime: "Analyzing...",
        volatility: "Unknown",
        lastUpdated: new Date().toISOString()
    } } = useQuery({
        queryKey: ['latestPrediction', selectedSymbol],
        queryFn: () => api.ml.getLatestPrediction(selectedSymbol),
        refetchInterval: 5000,
        enabled: isConnected
    });

    // 7. Fetch initial logs
    useQuery({
        queryKey: ['logs'],
        queryFn: async () => {
            try {
                const data = await api.logs.get();
                if (Array.isArray(data)) {
                    setLogs(prev => {
                        const existingIds = new Set(prev.map(l => l.id));
                        const newLogs = data
                            .filter(log => !existingIds.has(log.id || log.timestamp || ''))
                            .map(log => ({
                                id: log.id || log.timestamp || Date.now().toString(),
                                timestamp: log.timestamp || new Date().toISOString(),
                                level: log.level || 'info',
                                message: log.message || '',
                                source: log.source || 'System'
                            }));
                        return [...newLogs, ...prev].slice(0, 100);
                    });
                }
                return data;
            } catch (error) {
                console.error('Failed to fetch logs:', error);
                return [];
            }
        },
        enabled: isConnected
    });

    // 7. Fetch Accounts
    const { data: accountsRaw = [] } = useQuery({
        queryKey: ['accounts'],
        queryFn: api.accounts.get,
        refetchInterval: 5000,
        enabled: isConnected
    });

    const accounts = Array.isArray(accountsRaw) ? accountsRaw : [];

    // Determine selected account - prioritize what backend says is active
    const activeAccount = accounts.find(a => a.isActive);
    const selectedAccountVisible = activeAccount || accounts.find(a => a.id === selectedAccountId) || accounts[0];
    // DEBUG: Trace why selectedAccount might be missing/defaulting
    // console.log("[TradingContext] Selection Trace:", { selectedAccountId, visible: selectedAccountVisible, all: accounts });

    const selectedAccount = selectedAccountVisible || {
        id: "not_found",
        name: isConnected ? (botStatus.isAuthorized ? "No Account Selected" : "Waiting for Authorization...") : "Backend Disconnected",
        balance: 0,
        equity: 0,
        type: "demo",
        currency: "USD",
        isActive: false
    } as Account;

    // 8. Mutations
    const toggleBotMutation = useMutation({
        mutationFn: (currentStatus: boolean) => api.bot.toggle(currentStatus ? 'stop' : 'start'),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['botStatus'] });
        }
    });

    const executeTradeMutation = useMutation({
        mutationFn: (params: any) => api.trade.execute(params),
        onSuccess: (data: any) => {
            setLogs(prev => [{
                id: Date.now().toString(),
                timestamp: new Date().toISOString(),
                level: 'success',
                message: `Manual Trade: ${data.message}`,
                source: 'User'
            } as LogEntry, ...prev]);
        }
    });

    const closePositionMutation = useMutation({
        mutationFn: (contractId: string) => api.trade.close(contractId),
        onSuccess: (data: any) => {
            setLogs(prev => [{
                id: Date.now().toString(),
                timestamp: new Date().toISOString(),
                level: 'info',
                message: `Close Request: ${data.message}`,
                source: 'User'
            } as LogEntry, ...prev]);
            queryClient.invalidateQueries({ queryKey: ['positions'] });
        }
    });

    const addAccountMutation = useMutation({
        mutationFn: (data: { token: string; appId: string }) => api.accounts.add(data.token, data.appId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
        }
    });

    const switchAccount = (id: string) => {
        setSelectedAccountId(id);
        api.accounts.select(id).catch(err => console.error("Failed to select account", err));
    };

    // Safety: Ensure selectedAccountId is valid, else default to first
    useEffect(() => {
        if (accounts.length > 0) {
            const exists = accounts.find(a => a.id === selectedAccountId);
            if (!exists) {
                console.log("[TradingContext] Selected account ID not found in list, defaulting to first:", accounts[0].id);
                switchAccount(accounts[0].id);
            }
        }
    }, [accounts.length, selectedAccountId]);

    const toggleAccountType = () => {

        // Use the derived selectedAccount (or fallback) instead of just the state
        const currentAcc = accounts.find(acc => acc.id === selectedAccountId) || accounts[0];

        if (!currentAcc) return;

        const targetType = (currentAcc.type === 'demo') ? 'real' : 'demo';

        // Find accounts of the other type
        const otherTypeAccounts = accounts.filter(acc =>
            (targetType === 'demo' && acc.type === 'demo') ||
            (targetType === 'real' && (acc.type === 'real' || acc.type === 'live'))
        );

        if (otherTypeAccounts.length > 0) {
            // In TradingContext, we'll just switch to the first one available for now
            // as multi-account persistence is handled in DerivContext which this context
            // might be eventually merged with or simplified by.
            switchAccount(otherTypeAccounts[0].id);
        }
    };

    // 9. WebSocket Stream (Singleton)
    // 9. WebSocket Stream (with Auto-Reconnect & Debugging)
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<any>(null);
    const isMounted = useRef(true);
    const reconnectCount = useRef(0);
    const notificationRef = useRef(showNotification);
    const selectedSymbolRef = useRef(selectedSymbol);

    // Keep selectedSymbol ref in sync
    useEffect(() => {
        selectedSymbolRef.current = selectedSymbol;
    }, [selectedSymbol]);

    // Keep notification ref updated without triggering useEffect re-runs
    useEffect(() => {
        notificationRef.current = showNotification;
    }, [showNotification]);

    useEffect(() => {
        isMounted.current = true;
        console.log("[TradingContext] WS Effect initialized. Deps: [queryClient]");

        const connectWs = () => {
            if (!isMounted.current) return;

            // Exponential backoff: min 1s, max 30s
            const delay = Math.min(30000, Math.pow(2, reconnectCount.current) * 1000);
            console.log(`[TradingContext] Connecting WebSocket (Attempt ${reconnectCount.current + 1}) in ${delay}ms...`);

            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = window.location.host;
            const wsUrl = `${protocol}//${host}/stream/ws`;

            const socket = new WebSocket(wsUrl);
            wsRef.current = socket;

            socket.onopen = () => {
                if (!isMounted.current) { socket.close(); return; }
                console.log("[TradingContext] WebSocket Connected");
                setIsConnected(true);
                reconnectCount.current = 0; // Reset count on success
            };

            socket.onmessage = (event) => {
                if (!isMounted.current) return;
                try {
                    const data = JSON.parse(event.data);

                    if (data.type === 'ping') return;

                    if (data.type === 'tick' && data.data) {
                        const tick = data.data;
                        setDerivTicks(prev => {
                            const symbolTicks = prev[tick.symbol] || [];
                            // Keep last 50 ticks per symbol
                            const newSymbolTicks = [tick, ...symbolTicks].slice(0, 50);
                            return { ...prev, [tick.symbol]: newSymbolTicks };
                        });
                    }
                    if (data.type === 'log' && data.data) setLogs(prev => {
                        if (prev.some(l => l.id === data.data.id)) return prev;
                        return [data.data, ...prev].slice(0, 100);
                    });
                    if (data.type === 'positions' && data.data) {
                        console.log('[TradingContext] Received positions update:', data.data.length, 'positions', data.data.map((p: any) => p.id));
                        setPositions(data.data);
                    }
                    if (data.type === 'accounts' && data.data) {
                        console.log("[TradingContext] Received accounts update:", data.data);
                        queryClient.setQueryData(['accounts'], data.data);
                    }
                    if (data.type === 'balance' && data.data) queryClient.setQueryData(['accounts'], (old: any) => {
                        if (!Array.isArray(old)) return old;
                        return old.map(acc => acc.id === data.data.account_id ? { ...acc, ...data.data } : acc);
                    });
                    if (data.type === 'market_status' && data.data) {
                        setMarketStatuses(prev => ({
                            ...prev,
                            [data.data.symbol]: data.data
                        }));
                    }
                    if (data.type === 'signal_skipped' && data.data) setSkippedSignals(prev => [data.data, ...prev].slice(0, 50));
                    if (data.type === 'notification' && data.data) {
                        const { title, body } = data.data;
                        notificationRef.current(title, { body, icon: '/favicon.ico', tag: title });
                    }
                } catch (e) {
                    console.error("[TradingContext] WebSocket parse error", e);
                }
            };

            socket.onerror = (err) => {
                console.error("[TradingContext] WebSocket error", err);
            };

            socket.onclose = (event) => {
                if (!isMounted.current) return;
                console.warn(`[TradingContext] WebSocket Closed (Code: ${event.code}, Reason: ${event.reason || 'None'}). Reconnecting...`);
                setIsConnected(false);

                reconnectCount.current += 1;
                if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = setTimeout(connectWs, delay);
            };
        };

        connectWs();

        return () => {
            console.log("[TradingContext] Cleanup WebSocket effect...");
            isMounted.current = false;
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
            if (wsRef.current) {
                wsRef.current.onclose = null; // Prevent onclose loop
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, [queryClient]); // Removed showNotification to prevent re-runs

    const value: TradingContextType = {
        accounts,
        selectedAccount,
        selectedAccountId: selectedAccount.id,
        setSelectedAccountId: switchAccount,
        toggleAccountType,
        addAccount: (data: any) => addAccountMutation.mutate(data),
        removeAccount: (id: string) => console.log("Remove", id),
        accountsMetadata: [],
        authError: null,
        positions,
        ticks: derivTicks,
        symbols,
        selectedSymbol,
        setSelectedSymbol: handleSetSelectedSymbol,
        logs,
        skippedSignals,
        botStatus,
        toggleBot: () => toggleBotMutation.mutate(botStatus.isRunning),
        executeTrade: (params: any) => executeTradeMutation.mutate(params),
        closePosition: (contractId: string) => closePositionMutation.mutateAsync(contractId),
        notifications: MOCK_NOTIFICATIONS,
        markNotificationRead: (id: string) => console.log("Read", id),
        tradeHistory,
        performanceAnalytics,
        latestPrediction,
        marketStatus,
        isConnected,
        isAuthorized: botStatus.isAuthorized,
    };

    return <TradingContext.Provider value={value}>{children}</TradingContext.Provider>;
};

export const useTradingContext = () => {
    const context = useContext(TradingContext);
    if (context === undefined) {
        throw new Error('useTradingContext must be used within a TradingProvider');
    }
    return context;
};
