type DerivCallback = (response: any) => void;

export class DerivWebSocket {
    private socket: WebSocket | null = null;
    private app_id: string;
    private pendingRequests: Map<number, { resolve: DerivCallback; reject: DerivCallback }> = new Map();
    private subscriptions: Map<string, DerivCallback> = new Map();
    private reqIdCounter = 1;
    private onOpenCallback?: () => void;
    private onMessageCallback?: (data: any) => void;

    constructor(app_id: string) {
        this.app_id = app_id;
    }

    connect() {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) return;

        const url = `wss://ws.deriv.com/websockets/v3?app_id=${this.app_id}`;
        this.socket = new WebSocket(url);

        this.socket.onopen = () => {
            console.log("Deriv WebSocket connected.");
            if (this.onOpenCallback) this.onOpenCallback();
        };

        this.socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log("Incoming message:", data);

                if (this.onMessageCallback) this.onMessageCallback(data);

                // Handle request-response map
                if (data.req_id && this.pendingRequests.has(data.req_id)) {
                    const { resolve, reject } = this.pendingRequests.get(data.req_id)!;
                    if (data.error) {
                        reject(data.error);
                    } else {
                        resolve(data);
                    }
                    this.pendingRequests.delete(data.req_id);
                }

                // Handle subscriptions (e.g., tick updates)
                if (data.msg_type === "tick" && data.tick) {
                    // Logic to broadcast specific subscription updates could be added here
                    // For now, we rely on the generic onMessageCallback if the consumer wants to filter
                }

            } catch (error) {
                console.error("Error parsing message:", error);
            }
        };

        this.socket.onerror = (error) => {
            console.error("Deriv WebSocket error:", error);
        };

        this.socket.onclose = () => {
            console.log("Deriv WebSocket closed.");
            this.socket = null;
        };
    }

    send(payload: any): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
                reject(new Error("WebSocket is not connected"));
                return;
            }

            const req_id = this.reqIdCounter++;
            this.pendingRequests.set(req_id, { resolve, reject });

            const message = { ...payload, req_id };
            this.socket.send(JSON.stringify(message));
        });
    }

    authorize(token: string) {
        return this.send({ authorize: token });
    }

    isConnected(): boolean {
        return this.socket?.readyState === WebSocket.OPEN;
    }

    // Method to register a generic callback if the context needs to react to open events
    onOpen(callback: () => void) {
        this.onOpenCallback = callback;
    }

    onMessage(callback: (data: any) => void) {
        this.onMessageCallback = callback;
    }
}
