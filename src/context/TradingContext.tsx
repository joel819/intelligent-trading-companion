import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { Account, Position, LogEntry, Notification, BotStatus, SkippedSignal } from '@/types/trading';

interface TradingContextType {
    isConnected: boolean;
    isAuthorized: boolean;
    accounts: Account[];
    selectedAccount: Account;
    selectedAccountId: string | null;
    setSelectedAccountId: (id: string) => void;
    addAccount: (data: { token: string; appId: string }) => void;
    removeAccount: (id: string) => void;
    accountsMetadata: any[];
    authError: string | null;
    positions: Position[];
    ticks: any[];
    symbols: any[];
    selectedSymbol: string;
    setSelectedSymbol: (symbol: string) => void;
    logs: LogEntry[];
    skippedSignals: SkippedSignal[];
    botStatus: BotStatus;
    toggleBot: () => void;
    executeTrade: (params: any) => void;
    closePosition: (contractId: string) => void;
    notifications: Notification[];
    markNotificationRead: (id: string) => void;
    marketStatus: {
        regime: string;
        volatility: string;
        active_strategy: string;
        symbol: string;
    };
}

const TradingContext = createContext<TradingContextType | undefined>(undefined);

const MOCK_NOTIFICATIONS: Notification[] = [];

export const TradingProvider = ({ children }: { children: ReactNode }) => {
    const queryClient = useQueryClient();
    const [isConnected, setIsConnected] = useState(false);
    const [derivTicks, setDerivTicks] = useState<any[]>([]);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [positions, setPositions] = useState<Position[]>([]);
    const [symbols, setSymbols] = useState<any[]>([]);
    const [selectedSymbol, setSelectedSymbol] = useState('R_100');
    const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
    const [skippedSignals, setSkippedSignals] = useState<SkippedSignal[]>([]);
    const [marketStatus, setMarketStatus] = useState({
        regime: 'Analyzing...',
        volatility: 'Unknown',
        active_strategy: 'Loading...',
        symbol: '---'
    });

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
        symbol: "R_100"
    } as BotStatus } = useQuery({
        queryKey: ['botStatus'],
        queryFn: api.bot.getStatus,
        refetchInterval: 1000
    });

    useEffect(() => {
        setIsConnected(botStatus.isConnected);
        // Sync selectedSymbol with backend if it changes (e.g. from another client or on initial load)
        if (botStatus.symbol && botStatus.symbol !== selectedSymbol) {
            setSelectedSymbol(botStatus.symbol);
        }
    }, [botStatus.isConnected, botStatus.symbol]);

    useEffect(() => {
        setDerivTicks([]);
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

    // Fetch initial logs on mount and when connected
    useQuery({
        queryKey: ['logs'],
        queryFn: async () => {
            try {
                const data = await api.logs.get();
                if (Array.isArray(data)) {
                    // Merge with existing logs (WebSocket may have added some)
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

    // 4. Fetch Accounts
    const { data: accountsRaw = [] } = useQuery({
        queryKey: ['accounts'],
        queryFn: api.accounts.get,
        refetchInterval: 5000,
        enabled: isConnected
    });

    const accounts = Array.isArray(accountsRaw) ? accountsRaw : [];

    // Determine selected account
    const selectedAccountVisible = accounts.find(a => a.id === selectedAccountId) || accounts[0];
    const selectedAccount = selectedAccountVisible || {
        id: "not_found",
        name: isConnected ? (botStatus.isAuthorized ? "No Account Selected" : "Waiting for Authorization...") : "Backend Disconnected",
        balance: 0,
        equity: 0,
        type: "demo",
        currency: "USD",
        isActive: false
    } as Account;

    // 5. Mutations
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

    // 6. WebSocket Stream (Singleton)
    useEffect(() => {
        console.log("[TradingContext] Initializing WebSocket Stream...");
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        // Vite proxy handles /stream/ws -> http://localhost:8000/stream/ws
        const wsUrl = `${protocol}//${host}/stream/ws`;

        const socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            console.log("[TradingContext] WebSocket Connected");
            setIsConnected(true);
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'tick') {
                    setDerivTicks(prev => [data.data, ...prev].slice(0, 50));
                }
                if (data.type === 'log') {
                    setLogs(prev => {
                        if (prev.some(l => l.id === data.data.id)) return prev;
                        return [data.data, ...prev].slice(0, 100);
                    });
                }
                if (data.type === 'positions') {
                    setPositions(data.data);
                }
                if (data.type === 'balance') {
                    queryClient.setQueryData(['accounts'], (old: any) => {
                        if (!Array.isArray(old)) return old;
                        return old.map(acc => acc.id === data.data.account_id ? { ...acc, ...data.data } : acc);
                    });
                }
                if (data.type === 'market_status') {
                    setMarketStatus(data.data);
                }
                if (data.type === 'signal_skipped') {
                    setSkippedSignals(prev => [data.data, ...prev].slice(0, 50));
                }
            } catch (e) {
                console.error("[TradingContext] WebSocket parse error", e);
            }
        };

        socket.onerror = (err) => {
            console.error("[TradingContext] WebSocket error", err);
            setIsConnected(false);
        };

        socket.onclose = () => {
            console.log("[TradingContext] WebSocket Closed");
            // Only set connected false if it wasn't intentional
            // setIsConnected(false);
        };

        return () => {
            console.log("[TradingContext] Closing WebSocket Stream...");
            socket.close();
        };
    }, [queryClient]);

    const value: TradingContextType = {
        accounts,
        selectedAccount,
        selectedAccountId: selectedAccount.id,
        setSelectedAccountId: switchAccount,
        addAccount: (data: any) => addAccountMutation.mutate(data),
        removeAccount: (id: string) => console.log("Remove", id),
        accountsMetadata: [],
        authError: null,
        positions,
        ticks: derivTicks,
        symbols,
        selectedSymbol,
        setSelectedSymbol,
        logs,
        skippedSignals,
        botStatus,
        toggleBot: () => toggleBotMutation.mutate(botStatus.isRunning),
        executeTrade: (params: any) => executeTradeMutation.mutate(params),
        closePosition: (contractId: string) => closePositionMutation.mutate(contractId),
        notifications: MOCK_NOTIFICATIONS,
        markNotificationRead: (id: string) => console.log("Read", id),
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
