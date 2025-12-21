import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { Account, Position, LogEntry, Notification } from '@/types/trading';
import { useState, useEffect } from 'react';

const MOCK_NOTIFICATIONS: Notification[] = [];

export const useTradingData = () => {
    const queryClient = useQueryClient();
    const [isConnected, setIsConnected] = useState(false);
    const [derivTicks, setDerivTicks] = useState<any[]>([]);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [positions, setPositions] = useState<Position[]>([]);
    const [symbols, setSymbols] = useState<any[]>([]);
    const [selectedSymbol, setSelectedSymbol] = useState('R_100');
    const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

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
    } } = useQuery({
        queryKey: ['botStatus'],
        queryFn: api.bot.getStatus,
        refetchInterval: 1000
    });

    useEffect(() => {
        setIsConnected(botStatus.isConnected);
        if (botStatus.symbol) {
            setSelectedSymbol(botStatus.symbol);
        }
    }, [botStatus.isConnected, botStatus.symbol]);

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
    };

    // 5. Mutations
    const toggleBotMutation = useMutation({
        mutationFn: (currentStatus: boolean) => api.bot.toggle(currentStatus ? 'stop' : 'start'),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['botStatus'] });
        }
    });

    const executeTradeMutation = useMutation({
        mutationFn: (params: any) => api.trade(params),
        onSuccess: (data) => {
            setLogs(prev => [{
                id: Date.now().toString(),
                timestamp: new Date().toISOString(),
                level: 'success',
                message: `Manual Trade: ${data.message}`,
                source: 'User'
            }, ...prev]);
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

    // 6. SSE Stream
    useEffect(() => {
        const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
        const evtSource = new EventSource(`${apiUrl}/stream/feed/`);

        evtSource.onmessage = (event) => {
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
            } catch (e) {
                console.error("SSE parse error", e);
            }
        };

        return () => evtSource.close();
    }, []);

    return {
        accounts,
        selectedAccount,
        selectedAccountId: selectedAccount.id,
        setSelectedAccountId: switchAccount,
        addAccount: (data: any) => addAccountMutation.mutate(data),
        removeAccount: (id: string) => console.log("Remove", id),
        accountsMetadata: [],
        authError: null,
        isAuthorized: botStatus.isAuthorized,
        isConnected,
        positions,
        ticks: derivTicks,
        symbols,
        selectedSymbol,
        setSelectedSymbol,
        logs,
        botStatus,
        toggleBot: () => toggleBotMutation.mutate(botStatus.isRunning),
        executeTrade: (params: any) => executeTradeMutation.mutate(params),
        notifications: MOCK_NOTIFICATIONS,
        markNotificationRead: (id: string) => console.log("Read", id),
    };
};
