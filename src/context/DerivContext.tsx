import React, { createContext, useEffect, useState, useRef, ReactNode } from "react";
import { DerivWebSocket } from "../services/deriv/DerivWebSocket";
import { Account } from "../types/trading";

export interface AccountMetadata {
    id: string;
    name: string;
    appId: string;
    token: string;
    type: 'demo' | 'live' | 'real';
}

interface DerivContextType {
    isConnected: boolean;
    isAuthorized: boolean;
    authError: string | null;
    account: Account | null;
    accountsMetadata: AccountMetadata[];
    activeAccountId: string | null;
    addAccount: (metadata: AccountMetadata) => void;
    removeAccount: (id: string) => void;
    switchAccount: (id: string) => void;
    toggleAccountType: () => void;
    symbols: any[];
    selectedSymbol: string;
    setSelectedSymbol: (symbol: string) => void;
    ticks: any[];
    send: (payload: any) => Promise<any>;
    subscribeToTicks: (symbol: string) => void;
    buyContract: (payload: any) => Promise<any>;
}

export const DerivContext = createContext<DerivContextType | undefined>(undefined);

export const DerivProvider = ({ children }: { children: ReactNode }) => {
    const [isConnected, setIsConnected] = useState(false);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);
    const [account, setAccount] = useState<Account | null>(null);
    const [accountsMetadata, setAccountsMetadata] = useState<AccountMetadata[]>([]);
    const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
    const [lastDemoAccountId, setLastDemoAccountId] = useState<string | null>(null);
    const [lastRealAccountId, setLastRealAccountId] = useState<string | null>(null);
    const [symbols, setSymbols] = useState<any[]>([]);
    const [selectedSymbol, setSelectedSymbol] = useState<string>('R_100');
    const [ticks, setTicks] = useState<any[]>([]);
    const socketRef = useRef<DerivWebSocket | null>(null);

    // Persist last used account IDs
    useEffect(() => {
        const savedDemo = localStorage.getItem('last_demo_account_id');
        const savedReal = localStorage.getItem('last_real_account_id');
        if (savedDemo) setLastDemoAccountId(savedDemo);
        if (savedReal) setLastRealAccountId(savedReal);
    }, []);

    // Load accounts from LocalStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem('deriv_accounts');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setAccountsMetadata(parsed);

                // Prioritize Real account if exists and no preference saved
                const realAcc = parsed.find((acc: any) => acc.type === 'real' || acc.type === 'live');
                const lastReal = localStorage.getItem('last_real_account_id');
                const lastDemo = localStorage.getItem('last_demo_account_id');

                if (realAcc && !lastDemo && !lastReal) {
                    setActiveAccountId(realAcc.id);
                } else if (parsed.length > 0) {
                    setActiveAccountId(parsed[0].id);
                }
            } catch (e) {
                console.error("Failed to parse saved accounts", e);
            }
        } else {
            // Add default account from .env if it exists
            const defaultAppId = import.meta.env.VITE_DERIV_APP_ID;
            const defaultToken = import.meta.env.VITE_DERIV_API_TOKEN;
            if (defaultAppId && defaultToken) {
                const defaultAccount: AccountMetadata = {
                    id: 'default-demo',
                    name: 'Default Demo',
                    appId: defaultAppId,
                    token: defaultToken,
                    type: 'demo'
                };
                setAccountsMetadata([defaultAccount]);
                setActiveAccountId(defaultAccount.id);
                localStorage.setItem('deriv_accounts', JSON.stringify([defaultAccount]));
            }
        }
    }, []);

    const addAccount = (metadata: AccountMetadata) => {
        setAccountsMetadata(prev => {
            const next = [...prev, metadata];
            localStorage.setItem('deriv_accounts', JSON.stringify(next));
            return next;
        });
    };

    const removeAccount = (id: string) => {
        setAccountsMetadata(prev => {
            const next = prev.filter(acc => acc.id !== id);
            localStorage.setItem('deriv_accounts', JSON.stringify(next));
            return next;
        });
        if (activeAccountId === id) {
            setActiveAccountId(null);
            // Will trigger disconnect via effect
        }
    };

    const switchAccount = (id: string) => {
        setActiveAccountId(id);
        const acc = accountsMetadata.find(a => a.id === id);
        if (acc) {
            if (acc.type === 'demo') {
                setLastDemoAccountId(id);
                localStorage.setItem('last_demo_account_id', id);
            } else {
                setLastRealAccountId(id);
                localStorage.setItem('last_real_account_id', id);
            }
        }
    };

    const toggleAccountType = () => {
        const currentAcc = accountsMetadata.find(acc => acc.id === activeAccountId);
        if (!currentAcc) return;

        const targetType = (currentAcc.type === 'demo') ? 'real' : 'demo';
        const lastId = targetType === 'demo' ? lastDemoAccountId : lastRealAccountId;

        let targetAcc = accountsMetadata.find(acc => acc.id === lastId && (acc.type === targetType || (targetType === 'real' && acc.type === 'live')));

        if (!targetAcc) {
            targetAcc = accountsMetadata.find(acc => acc.type === targetType || (targetType === 'real' && acc.type === 'live'));
        }

        if (targetAcc) {
            switchAccount(targetAcc.id);
        }
    };

    // Effect to handle connection/re-connection when activeAccountId changes
    useEffect(() => {
        const activeAccount = accountsMetadata.find(acc => acc.id === activeAccountId);

        // Reset states
        setIsConnected(false);
        setIsAuthorized(false);
        setAuthError(null);
        setAccount(null);
        setTicks([]);

        if (socketRef.current) {
            // Close existing socket properly if possible
            socketRef.current = null;
        }

        if (activeAccount) {
            const socket = new DerivWebSocket(activeAccount.appId);
            socketRef.current = socket;

            socket.onOpen(() => {
                setIsConnected(true);

                // Fetch symbols
                socket.send({ active_symbols: "brief", product_type: "basic" })
                    .then(response => {
                        if (response.active_symbols) setSymbols(response.active_symbols);
                    });

                // Authorize
                socket.authorize(activeAccount.token)
                    .then(response => {
                        if (response.error) {
                            setAuthError(response.error.message || "Authorization failed");
                            return;
                        }
                        if (response.authorize) {
                            setIsAuthorized(true);
                            setAuthError(null);
                            const authData = response.authorize;
                            setAccount({
                                id: authData.loginid,
                                name: authData.fullname || authData.loginid,
                                balance: authData.balance || 0,
                                equity: authData.balance || 0,
                                type: authData.is_virtual ? 'demo' : 'live',
                                currency: authData.currency || 'USD',
                                isActive: true
                            });

                            // Token sync with backend
                            fetch('/api/accounts/add', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    token: activeAccount.token,
                                    appId: activeAccount.appId
                                })
                            }).then(() => {
                                console.log("[DerivContext] Token synced to backend");
                            }).catch(err => {
                                console.error("[DerivContext] Token sync failed", err);
                            });
                        }
                    })
                    .catch(err => {
                        console.error("Switch account auth failed:", err);
                        setAuthError("Network or Authorization error");
                    });
            });

            socket.onMessage((data) => {
                if (data.msg_type === 'balance') {
                    setAccount(prev => prev ? { ...prev, balance: data.balance.balance, equity: data.balance.balance } : null);
                }
                if (data.msg_type === 'tick') {
                    const tick = data.tick;
                    const newTick = {
                        timestamp: new Date(tick.epoch * 1000).toISOString(),
                        symbol: tick.symbol,
                        bid: tick.bid,
                        ask: tick.ask,
                        spread: tick.ask - tick.bid
                    };
                    setTicks(prev => [newTick, ...prev].slice(0, 50));
                }
            });

            socket.connect();
        }

        return () => {
            // socketRef.current?.close();
        };
    }, [activeAccountId, accountsMetadata]);

    // Automatically subscribe to ticks for the selected symbol
    useEffect(() => {
        if (isAuthorized && selectedSymbol) {
            console.log(`Subscribing to ticks for ${selectedSymbol}`);
            subscribeToTicks(selectedSymbol);
        }
    }, [isAuthorized, selectedSymbol]);

    const send = (payload: any) => {
        if (!socketRef.current) return Promise.reject("Socket not initialized");
        return socketRef.current.send(payload);
    };

    const subscribeToTicks = (symbol: string) => {
        send({ ticks: symbol, subscribe: 1 });
    };

    const buyContract = (payload: any) => {
        return send({ buy: 1, ...payload });
    };

    return (
        <DerivContext.Provider value={{
            isConnected,
            isAuthorized,
            authError,
            account,
            accountsMetadata,
            activeAccountId,
            addAccount,
            removeAccount,
            switchAccount,
            toggleAccountType,
            symbols,
            selectedSymbol,
            setSelectedSymbol,
            ticks,
            send,
            subscribeToTicks,
            buyContract
        }}>
            {children}
        </DerivContext.Provider>
    );
};
