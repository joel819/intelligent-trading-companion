import { StrategySettings } from '@/types/trading';

const API_BASE = "http://localhost:8000";

export const api = {
    bot: {
        getStatus: async () => {
            const res = await fetch(`${API_BASE}/bot/status`);
            return res.json();
        },
        toggle: async (command: 'start' | 'stop' | 'panic') => {
            const res = await fetch(`${API_BASE}/bot/toggle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command }),
            });
            return res.json();
        },
    },
    settings: {
        get: async () => {
            const res = await fetch(`${API_BASE}/settings`);
            return res.json();
        },
        update: async (settings: Partial<StrategySettings>) => {
            const res = await fetch(`${API_BASE}/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings),
            });
            return res.json();
        }
    },
    accounts: {
        get: async () => {
            const res = await fetch(`${API_BASE}/accounts`);
            return res.json();
        }
    }
};
