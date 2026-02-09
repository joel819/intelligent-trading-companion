import { StrategySettings } from '@/types/trading';


const API_BASE = '/api';

export const api = {
    bot: {
        getStatus: async () => {
            const res = await fetch(`${API_BASE}/bot/`);
            if (!res.ok) throw new Error('Failed to fetch bot status');
            return res.json();
        },
        toggle: async (command: 'start' | 'stop' | 'panic') => {
            const res = await fetch(`${API_BASE}/bot/toggle/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command }),
            });
            if (!res.ok) throw new Error('Failed to toggle bot');
            return res.json();
        },
        downloadLogs: async () => {
            const res = await fetch(`${API_BASE}/bot/download-logs/`);
            if (!res.ok) throw new Error('Failed to download logs');
            return res.blob();
        }
    },
    ml: {
        getLatestPrediction: async (symbol: string) => {
            const res = await fetch(`${API_BASE}/ml/latest?symbol=${symbol}`);
            if (!res.ok) throw new Error('Failed to fetch latest ML prediction');
            return res.json();
        }
    },
    settings: {
        get: async () => {
            try {
                const res = await fetch(`${API_BASE}/settings/`);
                if (!res.ok) return null;
                return res.json();
            } catch (e) { return null; }
        },
        setSymbol: async (symbol: string) => {
            const res = await fetch(`${API_BASE}/settings/symbol`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbol }),
            });
            if (!res.ok) throw new Error('Failed to switch symbol');
            return res.json();
        },
        update: async (settings: Partial<StrategySettings>) => {
            const res = await fetch(`${API_BASE}/settings/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings),
            });
            if (!res.ok) throw new Error('Failed to save settings');
            return res.json();
        }
    },
    // Adding accounts/positions/logs as per requirements
    accounts: {
        get: async () => {
            const res = await fetch(`${API_BASE}/accounts/`);
            return res.json();
        },
        add: async (token: string, appId: string) => {
            const res = await fetch(`${API_BASE}/accounts/add/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, app_id: appId }),
            });
            if (!res.ok) throw new Error('Failed to add account');
            return res.json();
        },
        select: async (accountId: string) => {
            const res = await fetch(`${API_BASE}/accounts/select/?account_id=${accountId}`, {
                method: 'POST'
            });
            if (!res.ok) throw new Error('Failed to select account');
            return res.json();
        }
    },
    trade: {
        execute: async (params: any) => {
            const res = await fetch(`${API_BASE}/trade/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(params),
            });
            if (!res.ok) throw new Error('Failed to execute trade');
            return res.json();
        },
        close: async (contractId: string) => {
            const res = await fetch(`${API_BASE}/trade/close/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contract_id: contractId }),
            });
            if (!res.ok) throw new Error('Failed to close position');
            return res.json();
        },
        getHistory: async (limit: number = 50, offset: number = 0) => {
            const res = await fetch(`${API_BASE}/trade/history/?limit=${limit}&offset=${offset}`);
            if (!res.ok) throw new Error('Failed to fetch trade history');
            return res.json();
        },
        getAnalytics: async () => {
            const res = await fetch(`${API_BASE}/trade/analytics/`);
            if (!res.ok) throw new Error('Failed to fetch analytics');
            return res.json();
        }
    },
    market: {
        getSymbols: async () => {
            const res = await fetch(`${API_BASE}/market/symbols/`);
            if (!res.ok) throw new Error('Failed to fetch symbols');
            return res.json();
        },
        getPositions: async () => {
            const res = await fetch(`${API_BASE}/market/positions/`);
            if (!res.ok) throw new Error('Failed to fetch positions');
            return res.json();
        }
    },
    logs: {
        get: async () => {
            const res = await fetch(`${API_BASE}/logs/`);
            if (!res.ok) throw new Error('Failed to fetch logs');
            return res.json();
        }
    },
    ai: {
        chat: async (message: string, context?: Record<string, unknown>) => {
            const res = await fetch(`${API_BASE}/ai/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, context }),
            });
            if (!res.ok) throw new Error('Failed to send chat message');
            return res.json();
        },
        transcribe: async (audioBlob: Blob) => {
            const formData = new FormData();
            formData.append('audio', audioBlob, 'recording.webm');
            const res = await fetch(`${API_BASE}/ai/transcribe`, {
                method: 'POST',
                body: formData,
            });
            if (!res.ok) throw new Error('Failed to transcribe audio');
            return res.json();
        },
        clearHistory: async () => {
            const res = await fetch(`${API_BASE}/ai/clear-history`, {
                method: 'POST',
            });
            if (!res.ok) throw new Error('Failed to clear chat history');
            return res.json();
        }
    },
    backtest: {
        run: async (config: any) => {
            const res = await fetch(`${API_BASE}/backtest/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || 'Backtest failed');
            }
            return res.json();
        }
    }
};
