import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { Account, BotStatus, Notification, Position, LogEntry } from '@/types/trading';
import { useState, useEffect } from 'react';

// Temporary mock for things not yet in backend
const MOCK_POSITIONS: Position[] = [];
const MOCK_LOGS: LogEntry[] = [];
const MOCK_NOTIFICATIONS: Notification[] = [];

export const useTradingData = () => {
    const queryClient = useQueryClient();
    const [selectedAccountId, setSelectedAccountId] = useState<string>("ACC-001");

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
        refetchInterval: 1000, // Poll every second for status
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
        positions: MOCK_POSITIONS, // TODO: Implement /positions endpoint
        ticks: [], // TODO: WebSocket/SSE for ticks
        logs: MOCK_LOGS, // TODO: WebSocket/SSE for logs
        botStatus,
        toggleBot: () => toggleBotMutation.mutate(botStatus.isRunning),
        notifications: MOCK_NOTIFICATIONS,
        markNotificationRead: (id: string) => console.log("Read", id),
    };
};
