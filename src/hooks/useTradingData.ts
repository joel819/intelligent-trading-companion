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
    const {
        isConnected,
        isAuthorized,
        authError,
        account: derivAccount,
        accountsMetadata,
        activeAccountId,
        addAccount,
        removeAccount,
        switchAccount,
        ticks: derivTicks,
        symbols,
        selectedSymbol,
        setSelectedSymbol,
        subscribeToTicks,
        send
    } = useDeriv();
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
    useEffect(() => {
        let ws: WebSocket | null = null;
        let reconnectTimer: any;
        const connect = () => {
            try {
                ws = new WebSocket('ws://localhost:8000/stream/ws');
                ws.onopen = () => console.log('Connected to Local Trading Stream');
                ws.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data);
                        if (message.type === 'log') setLogs(prev => [message.data, ...prev].slice(0, 100));
                    } catch (e) { }
                };
                ws.onclose = () => reconnectTimer = setTimeout(connect, 30000);
                ws.onerror = () => ws?.close();
            } catch (e) { }
        };
        connect();
        return () => { if (ws) ws.close(); clearTimeout(reconnectTimer); };
    }, []);

    // Accounts
    // Map account metadata to display-ready accounts, injecting live balance if authorized
    const accounts = accountsMetadata.map(meta => {
        // If this is the active AND authorized account, use the live data from derivAccount
        if (meta.id === activeAccountId && derivAccount) {
            return derivAccount;
        }
        // Otherwise use the metadata as a placeholder
        return {
            id: meta.id,
            name: meta.name,
            balance: 0,
            equity: 0,
            type: meta.type,
            currency: 'USD',
            isActive: meta.id === activeAccountId
        };
    });

    const selectedAccount = accounts.find(a => a.id === activeAccountId) || accounts[0] || {
        id: "loading", name: "Connecting to Deriv...", balance: 0, equity: 0, type: "demo", currency: "USD", isActive: false
    };

    // Bot Status
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
        enabled: false,
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
