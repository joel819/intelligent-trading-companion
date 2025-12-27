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
    }
};
