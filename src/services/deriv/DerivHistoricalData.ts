// Deriv Historical Data Service - Fetches real OHLC candles from Deriv API

const DERIV_WS_URL = 'wss://ws.deriv.com/websockets/v3?app_id=1089';

export interface Candle {
  epoch: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface HistoricalDataRequest {
  symbol: string;
  startDate: string; // ISO date string
  endDate: string;   // ISO date string
  granularity?: number; // in seconds (60 = 1min, 3600 = 1hr, 86400 = 1day)
}

export interface HistoricalDataResponse {
  candles: Candle[];
  symbol: string;
  error?: string;
}

class DerivHistoricalDataService {
  private socket: WebSocket | null = null;
  private pendingRequests: Map<number, { resolve: (data: any) => void; reject: (error: any) => void }> = new Map();
  private reqIdCounter = 1;
  private connectionPromise: Promise<void> | null = null;

  private async ensureConnection(): Promise<void> {
    if (this.socket?.readyState === WebSocket.OPEN) {
      return;
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      this.socket = new WebSocket(DERIV_WS_URL);
      
      this.socket.onopen = () => {
        console.log('[DerivHistorical] WebSocket connected');
        resolve();
      };

      this.socket.onerror = (error) => {
        console.error('[DerivHistorical] WebSocket error:', error);
        reject(error);
      };

      this.socket.onclose = () => {
        console.log('[DerivHistorical] WebSocket closed');
        this.socket = null;
        this.connectionPromise = null;
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.req_id && this.pendingRequests.has(data.req_id)) {
            const { resolve, reject } = this.pendingRequests.get(data.req_id)!;
            if (data.error) {
              reject(data.error);
            } else {
              resolve(data);
            }
            this.pendingRequests.delete(data.req_id);
          }
        } catch (err) {
          console.error('[DerivHistorical] Parse error:', err);
        }
      };
    });

    return this.connectionPromise;
  }

  private send(payload: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const req_id = this.reqIdCounter++;
      this.pendingRequests.set(req_id, { resolve, reject });
      this.socket.send(JSON.stringify({ ...payload, req_id }));

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(req_id)) {
          this.pendingRequests.delete(req_id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  async fetchHistoricalCandles(request: HistoricalDataRequest): Promise<HistoricalDataResponse> {
    try {
      await this.ensureConnection();

      const startEpoch = Math.floor(new Date(request.startDate).getTime() / 1000);
      const endEpoch = Math.floor(new Date(request.endDate).getTime() / 1000);
      const granularity = request.granularity || 60; // Default 1 minute

      console.log(`[DerivHistorical] Fetching ${request.symbol} from ${request.startDate} to ${request.endDate}`);

      const response = await this.send({
        ticks_history: request.symbol,
        style: 'candles',
        granularity,
        start: startEpoch,
        end: endEpoch,
        adjust_start_time: 1
      });

      if (response.error) {
        return {
          candles: [],
          symbol: request.symbol,
          error: response.error.message || 'Failed to fetch historical data'
        };
      }

      const candles: Candle[] = (response.candles || []).map((c: any) => ({
        epoch: c.epoch,
        open: parseFloat(c.open),
        high: parseFloat(c.high),
        low: parseFloat(c.low),
        close: parseFloat(c.close)
      }));

      console.log(`[DerivHistorical] Received ${candles.length} candles for ${request.symbol}`);

      return {
        candles,
        symbol: request.symbol
      };
    } catch (error: any) {
      console.error('[DerivHistorical] Error fetching candles:', error);
      return {
        candles: [],
        symbol: request.symbol,
        error: error.message || 'Unknown error'
      };
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}

// Singleton instance
export const derivHistoricalData = new DerivHistoricalDataService();
