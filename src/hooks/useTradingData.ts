import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { Account, Position, LogEntry, Notification } from '@/types/trading';
import { useState, useEffect } from 'react';
import { useDeriv } from './useDeriv';

// Temporary mock for things not yet in backend
const MOCK_POSITIONS: Position[] = [];
const MOCK_NOTIFICATIONS: Notification[] = [];

export const useTradingData = () => {
    const queryClient = useQueryClient();
    // Context removed - fetching from backend
    // const { ... } = useDeriv();
    const [isConnected, setIsConnected] = useState(false); // Can check backend health
    const [isAuthorized, setIsAuthorized] = useState(false); // Backend auth status

    // Polling backend for status
    const { data: backendStatus } = useQuery({
        queryKey: ['backendStatus'],
        queryFn: api.bot.getStatus,
        refetchInterval: 1000
    });

    useEffect(() => {
        if (backendStatus) {
            setIsConnected(true);
            setIsAuthorized(backendStatus.strategy !== 'Connecting...');
        }
    }, [backendStatus]);

    // Mock ticks/symbols for now as they are not in REST requirements
    const derivTicks: any[] = [];
    const symbols: any[] = [];
    const selectedSymbol = 'R_100';
    const setSelectedSymbol = () => { };
    const switchAccount = () => { };
    const addAccount = () => { };
    const removeAccount = () => { };
    const accountsMetadata: any[] = [];
    const authError = null;
    const send = async () => { };
    // We don't use this state anymore as it's governed by activeAccountId in DerivContext
    // const [selectedAccountId, setSelectedAccountId] = useState<string>("ACC-001");

    // Real-time State
    const [logs, setLogs] = useState<LogEntry[]>([]);

    useEffect(() => {
        if (isConnected) {
            setLogs(prev => [{
                id: Date.now().toString(),
                timestamp: new Date().toISOString(),
                level: 'success',
                message: 'Connected to Deriv WebSocket',
                source: 'System'
            }, ...prev]);
        }
    }, [isConnected]);

    useEffect(() => {
        if (isAuthorized) {
            setLogs(prev => [{
                id: Date.now().toString(),
                timestamp: new Date().toISOString(),
                level: 'success',
                message: `Deriv Authorized (${selectedSymbol})`,
                source: 'System'
            }, ...prev]);
        }
    }, [isAuthorized, selectedSymbol]);

    // ... (rest of local websocket logic kept for now) ...
    // Fetch logs from backend
    useQuery({
        queryKey: ['logs'],
        queryFn: async () => {
            const res = await fetch('http://localhost:8000/logs');
            if (res.ok) {
                const newLogs = await res.json();
                setLogs(newLogs);
            }
            return [];
        },
        refetchInterval: 2000
    });

    // Accounts
    // Map account metadata to display-ready accounts, injecting live balance if authorized
    // Load accounts from backend
    const { data: accountsRaw = [] } = useQuery({
        queryKey: ['accounts'],
        queryFn: api.accounts.get,
        refetchInterval: 5000
    });

    // Map backend accounts to frontend format if needed (api returns correct format)
    const accounts = accountsRaw;

    const selectedAccount = accounts.length > 0 ? accounts[0] : {
        id: "loading", name: "Connecting to Backend...", balance: 0, equity: 0, type: "demo", currency: "USD", isActive: false
    };
    const activeAccountId = selectedAccount.id;

    // Bot Status - Real Backend
    const { data: botStatus = {
        isRunning: false,
        strategy: "Ready",
        lastTrade: null,
        uptime: 0,
        tradesExecuted: 0,
        profitToday: 0
    } } = useQuery({
        queryKey: ['botStatus'],
        queryFn: api.bot.getStatus,
        refetchInterval: 1000
    });

    const toggleBotMutation = useMutation({
        mutationFn: (currentStatus: boolean) => api.bot.toggle(currentStatus ? 'stop' : 'start'),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['botStatus'] });
        }
    });

    return {
        accounts,
        selectedAccount,
        selectedAccountId: activeAccountId || 'none',
        setSelectedAccountId: switchAccount,
        addAccount,
        removeAccount,
        accountsMetadata,
        authError,
        isAuthorized,
        isConnected,
        positions: MOCK_POSITIONS,
        ticks: derivTicks,
        symbols,
        selectedSymbol,
        setSelectedSymbol,
        logs,
        botStatus: {
            ...botStatus,
            isRunning: isAuthorized,
            strategy: isAuthorized ? "Deriv Live" : "Connecting..."
        },
        toggleBot: () => toggleBotMutation.mutate(botStatus.isRunning),
        notifications: MOCK_NOTIFICATIONS,
        markNotificationRead: (id: string) => console.log("Read", id),
    };
};
