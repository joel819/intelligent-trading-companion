import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { Account, Position, LogEntry, Notification } from '@/types/trading';
import { useState, useEffect } from 'react';

// Temporary mock for things not yet in backend
const MOCK_POSITIONS: Position[] = [];
const MOCK_NOTIFICATIONS: Notification[] = [];

export const useTradingData = () => {
    const queryClient = useQueryClient();
    const [selectedAccountId, setSelectedAccountId] = useState<string>("ACC-001");

    // Real-time State
    const [ticks, setTicks] = useState<any[]>([]);
    const [logs, setLogs] = useState<LogEntry[]>([]);

    useEffect(() => {
        let ws: WebSocket | null = null;
        let reconnectTimer: any;

        const connect = () => {
            ws = new WebSocket('ws://localhost:8000/stream/ws');

            ws.onopen = () => {
                console.log('Connected to Trading Stream');
                setLogs(prev => [{
                    id: Date.now().toString(),
                    timestamp: new Date().toISOString(),
                    level: 'success',
                    message: 'Connected to Data Stream',
                    source: 'System'
                }, ...prev]);
            };

            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    if (message.type === 'tick') {
                        const tickData = message.data;
                        const newTick = {
                            timestamp: new Date(tickData.epoch * 1000).toISOString(),
                            symbol: tickData.symbol,
                            bid: tickData.bid,
                            ask: tickData.ask,
                            spread: tickData.ask - tickData.bid
                        };
                        setTicks(prev => [newTick, ...prev].slice(0, 50));
                    } else if (message.type === 'log') {
                        setLogs(prev => [message.data, ...prev].slice(0, 100));
                    }
                } catch (e) {
                    console.error("WS Parse Error", e);
                }
            };

            ws.onclose = () => {
                console.log('Trading Stream Disconnected. Reconnecting...');
                // Simple reconnect logic
                reconnectTimer = setTimeout(connect, 3000);
            };

            ws.onerror = (err) => {
                console.error("WS Error", err);
                ws?.close();
            };
        };

        connect();

        return () => {
            if (ws) ws.close();
            clearTimeout(reconnectTimer);
        };
    }, []);

    // Accounts
    const { data: accounts = [] } = useQuery({
        queryKey: ['accounts'],
        queryFn: api.accounts.get,
    });

    const selectedAccount = accounts.find((a: Account) => a.id === selectedAccountId) || accounts[0] || {
        id: "loading", name: "Loading...", balance: 0, equity: 0, type: "demo", currency: "USD", isActive: false
    };

    // Bot Status
    const { data: botStatus = {
        isRunning: false,
        strategy: "Loading...",
        lastTrade: null,
        uptime: 0,
        tradesExecuted: 0,
        profitToday: 0
    } } = useQuery({
        queryKey: ['botStatus'],
        queryFn: api.bot.getStatus,
        refetchInterval: 1000,
    });

    // Toggle Bot Mutation
    const toggleBotMutation = useMutation({
        mutationFn: (currentStatus: boolean) => api.bot.toggle(currentStatus ? 'stop' : 'start'),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['botStatus'] });
        }
    });

    return {
        accounts,
        selectedAccount,
        selectedAccountId,
        setSelectedAccountId,
        positions: MOCK_POSITIONS,
        ticks,
        logs,
        botStatus,
        toggleBot: () => toggleBotMutation.mutate(botStatus.isRunning),
        notifications: MOCK_NOTIFICATIONS,
        markNotificationRead: (id: string) => console.log("Read", id),
    };
};
