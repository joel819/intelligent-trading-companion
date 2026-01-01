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
    closePosition: (contractId: string) => Promise<any>;
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
    const [selectedSymbol, setSelectedSymbol] = useState('R_10');
    const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
    const [skippedSignals, setSkippedSignals] = useState<SkippedSignal[]>([]);
    const [marketStatuses, setMarketStatuses] = useState<Record<string, any>>({});

    const marketStatus = marketStatuses[selectedSymbol] || {
        regime: 'Analyzing...',
        volatility: 'Unknown',
        active_strategy: 'Loading...',
        symbol: selectedSymbol
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

    useEffect(() => {
        // REMOVED: setIsConnected(botStatus.isConnected); 
        // We rely SOLELY on WebSocket for connection state to prevent race conditions/flickering.

        // Sync selectedSymbol with backend if it changes (e.g. from another client or on initial load)
        if (botStatus.symbol && botStatus.symbol !== selectedSymbol) {
            setSelectedSymbol(botStatus.symbol);
        }
    }, [botStatus.symbol]);

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
    // 6. WebSocket Stream (with Auto-Reconnect & Debugging)
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
    const isMounted = useRef(true);
    const reconnectCount = useRef(0);
    const notificationRef = useRef(showNotification);

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

                    if (data.type === 'tick') setDerivTicks(prev => [data.data, ...prev].slice(0, 50));
                    if (data.type === 'log') setLogs(prev => {
                        if (prev.some(l => l.id === data.data.id)) return prev;
                        return [data.data, ...prev].slice(0, 100);
                    });
                    if (data.type === 'positions') setPositions(data.data);
                    if (data.type === 'balance') queryClient.setQueryData(['accounts'], (old: any) => {
                        if (!Array.isArray(old)) return old;
                        return old.map(acc => acc.id === data.data.account_id ? { ...acc, ...data.data } : acc);
                    });
                    if (data.type === 'market_status') {
                        setMarketStatuses(prev => ({
                            ...prev,
                            [data.data.symbol]: data.data
                        }));
                    }
                    if (data.type === 'signal_skipped') setSkippedSignals(prev => [data.data, ...prev].slice(0, 50));
                    if (data.type === 'notification') {
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
        closePosition: (contractId: string) => closePositionMutation.mutateAsync(contractId),
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
