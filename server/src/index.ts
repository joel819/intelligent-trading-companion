
import express from 'express';
import cors from 'cors';
import WebSocket from 'ws';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8000;
const DERIV_APP_ID = process.env.DERIV_APP_ID;
const DERIV_TOKEN = process.env.DERIV_API_TOKEN;

// Application State
let isBotRunning = false;
let isConnected = false;
let isAuthorized = false;
let accountInfo: any = null;
let positions: any[] = [];
let logs: any[] = [];
let settings: any = {
    // Default settings
    riskPercent: 2,
    maxLots: 1.0,
    confidenceThreshold: 0.75
};

const addLog = (level: string, message: string) => {
    const log = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        level,
        message,
        source: 'Backend'
    };
    logs = [log, ...logs].slice(0, 500); // Keep last 500 logs
    console.log(`[${level.toUpperCase()}] ${message}`);
};

// WebSocket Setup
let ws: WebSocket | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let pingInterval: NodeJS.Timeout | null = null;

const connectToDeriv = () => {
    if (!DERIV_APP_ID) {
        addLog('error', 'Deriv App ID is missing from .env');
        return;
    }

    const url = `wss://ws.deriv.com/websockets/v3?app_id=${DERIV_APP_ID}`;
    ws = new WebSocket(url);

    ws.on('open', () => {
        isConnected = true;
        addLog('success', 'Connected to Deriv WebSocket');
        if (DERIV_TOKEN) {
            ws?.send(JSON.stringify({ authorize: DERIV_TOKEN }));
        } else {
            addLog('warn', 'No API Token provided, cannot authorize');
        }

        // Keep alive
        pingInterval = setInterval(() => {
            if (ws?.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ ping: 1 }));
            }
        }, 15000);
    });

    ws.on('message', (data: WebSocket.Data) => {
        try {
            const msg = JSON.parse(data.toString());

            if (msg.msg_type === 'authorize') {
                if (msg.error) {
                    addLog('error', `Authorization failed: ${msg.error.message}`);
                    isAuthorized = false;
                } else {
                    isAuthorized = true;
                    accountInfo = msg.authorize;
                    addLog('success', `Authorized as ${accountInfo.loginid}`);
                    // Subscribe to balance/positions if needed
                    ws?.send(JSON.stringify({ balance: 1, subscribe: 1 }));
                }
            }

            if (msg.msg_type === 'balance') {
                if (accountInfo) {
                    accountInfo.balance = msg.balance.balance;
                    accountInfo.currency = msg.balance.currency;
                }
            }

            // ... handle other messages (ticks, etc.) logic would go here
            if (isBotRunning && isAuthorized) {
                // Placeholder for trading logic
                // If tick comes in => run strategy => ws.send({ buy: ... })
            }

        } catch (e) {
            console.error('Failed to parse WS message', e);
        }
    });

    ws.on('close', () => {
        isConnected = false;
        isAuthorized = false;
        addLog('warn', 'Deriv WebSocket disconnected');
        if (pingInterval) clearInterval(pingInterval);

        // Reconnect
        reconnectTimer = setTimeout(connectToDeriv, 5000);
    });

    ws.on('error', (err) => {
        console.error('WebSocket Error', err);
        addLog('error', 'Deriv WebSocket Error');
    });
};

// Start connection
connectToDeriv();


// REST Endpoints

app.get('/bot/status', (req, res) => {
    res.json({
        isRunning: isBotRunning,
        strategy: isAuthorized ? "Deriv Live" : "Connecting...",
        lastTrade: null,
        uptime: process.uptime(),
        tradesExecuted: 0,
        profitToday: 0
    });
});

app.post('/bot/toggle', (req, res) => {
    const { command } = req.body;
    if (command === 'start') {
        if (!isAuthorized) {
            res.status(400).json({ error: "Cannot start bot: Not authorized" });
            return;
        }
        isBotRunning = true;
        addLog('info', 'Bot Started via API');
    } else if (command === 'stop') {
        isBotRunning = false;
        addLog('info', 'Bot Stopped via API');
    } else if (command === 'panic') {
        isBotRunning = false;
        // Close all positions logic here
        addLog('error', 'PANIC STOP TRIGGERED - Stopping Bot');
    }
    res.json({ success: true, isRunning: isBotRunning });
});

app.get('/accounts', (req, res) => {
    // Return the authorized account or empty list
    // This mocks the AccountsList requirement
    const accounts = [];
    if (accountInfo) {
        accounts.push({
            id: accountInfo.loginid,
            name: accountInfo.fullname,
            balance: accountInfo.balance,
            currency: accountInfo.currency,
            type: accountInfo.is_virtual ? 'demo' : 'live',
            isActive: true
        });
    }
    res.json(accounts);
});

app.get('/logs', (req, res) => {
    res.json(logs);
});

app.get('/settings', (req, res) => {
    res.json(settings);
});

app.post('/settings', (req, res) => {
    settings = { ...settings, ...req.body };
    addLog('info', 'Settings updated');
    res.json(settings);
});


app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
    addLog('info', `Backend server started on port ${PORT}`);
});
