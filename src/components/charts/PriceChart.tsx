import { useState, useMemo } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, TrendingDown, BarChart3, Activity } from 'lucide-react';

interface CandleData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  sma20?: number;
  ema9?: number;
  rsi?: number;
  upperBand?: number;
  lowerBand?: number;
}

// Generate mock candlestick data
const generateMockCandles = (symbol: string, count: number = 50): CandleData[] => {
  const basePrice = symbol === 'VOLATILITY 75' ? 185000 :
                    symbol === 'BOOM 1000' ? 5000 :
                    symbol === 'EUR/USD' ? 1.0850 : 1.2650;
  
  const candles: CandleData[] = [];
  let currentPrice = basePrice;
  const now = new Date();
  
  for (let i = count - 1; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60000);
    const volatility = basePrice * 0.002;
    
    const open = currentPrice;
    const change = (Math.random() - 0.5) * volatility * 2;
    const close = open + change;
    const high = Math.max(open, close) + Math.random() * volatility * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * 0.5;
    const volume = Math.floor(Math.random() * 1000) + 100;
    
    currentPrice = close;
    
    candles.push({
      time: time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      open: parseFloat(open.toFixed(5)),
      high: parseFloat(high.toFixed(5)),
      low: parseFloat(low.toFixed(5)),
      close: parseFloat(close.toFixed(5)),
      volume,
    });
  }
  
  // Calculate indicators
  const smaWindow = 20;
  const emaWindow = 9;
  let emaValue = candles[0]?.close || 0;
  const multiplier = 2 / (emaWindow + 1);
  
  candles.forEach((candle, index) => {
    // SMA 20
    if (index >= smaWindow - 1) {
      const sum = candles.slice(index - smaWindow + 1, index + 1).reduce((a, b) => a + b.close, 0);
      candle.sma20 = parseFloat((sum / smaWindow).toFixed(5));
    }
    
    // EMA 9
    emaValue = (candle.close - emaValue) * multiplier + emaValue;
    candle.ema9 = parseFloat(emaValue.toFixed(5));
    
    // Simple RSI approximation (14 period)
    if (index >= 14) {
      const gains: number[] = [];
      const losses: number[] = [];
      for (let j = index - 13; j <= index; j++) {
        const diff = candles[j].close - candles[j - 1].close;
        if (diff > 0) gains.push(diff);
        else losses.push(Math.abs(diff));
      }
      const avgGain = gains.reduce((a, b) => a + b, 0) / 14;
      const avgLoss = losses.reduce((a, b) => a + b, 0) / 14 || 0.0001;
      const rs = avgGain / avgLoss;
      candle.rsi = parseFloat((100 - 100 / (1 + rs)).toFixed(2));
    }
    
    // Bollinger Bands (20 period, 2 std dev)
    if (index >= smaWindow - 1 && candle.sma20) {
      const slice = candles.slice(index - smaWindow + 1, index + 1);
      const mean = candle.sma20;
      const variance = slice.reduce((sum, c) => sum + Math.pow(c.close - mean, 2), 0) / smaWindow;
      const stdDev = Math.sqrt(variance);
      candle.upperBand = parseFloat((mean + 2 * stdDev).toFixed(5));
      candle.lowerBand = parseFloat((mean - 2 * stdDev).toFixed(5));
    }
  });
  
  return candles;
};

interface PriceChartProps {
  symbol?: string;
  className?: string;
}

// Custom candlestick shape
const CandlestickBar = (props: any) => {
  const { x, y, width, height, payload } = props;
  if (!payload) return null;
  
  const { open, close, high, low } = payload;
  const isUp = close >= open;
  const fill = isUp ? 'hsl(var(--buy))' : 'hsl(var(--sell))';
  const stroke = fill;
  
  // Calculate positions
  const bodyHeight = Math.max(Math.abs(height), 2);
  const bodyY = y;
  const wickX = x + width / 2;
  
  // For the wick, we need to calculate based on the actual price range
  const priceRange = high - low;
  if (priceRange === 0) return null;
  
  return (
    <g>
      {/* Wick */}
      <line
        x1={wickX}
        y1={bodyY - (isUp ? (high - close) / priceRange * bodyHeight : (high - open) / priceRange * bodyHeight)}
        x2={wickX}
        y2={bodyY + bodyHeight + (isUp ? (open - low) / priceRange * bodyHeight : (close - low) / priceRange * bodyHeight)}
        stroke={stroke}
        strokeWidth={1}
      />
      {/* Body */}
      <rect
        x={x + 1}
        y={bodyY}
        width={Math.max(width - 2, 2)}
        height={bodyHeight}
        fill={isUp ? fill : fill}
        stroke={stroke}
        strokeWidth={1}
      />
    </g>
  );
};

export const PriceChart = ({ symbol = 'VOLATILITY 75', className }: PriceChartProps) => {
  const [timeframe, setTimeframe] = useState('1m');
  const [showIndicators, setShowIndicators] = useState({
    sma: true,
    ema: true,
    bollinger: false,
  });
  
  const candles = useMemo(() => generateMockCandles(symbol), [symbol]);
  
  const latestCandle = candles[candles.length - 1];
  const previousCandle = candles[candles.length - 2];
  const priceChange = latestCandle && previousCandle 
    ? ((latestCandle.close - previousCandle.close) / previousCandle.close * 100).toFixed(3)
    : '0';
  const isPositive = parseFloat(priceChange) >= 0;
  
  const minPrice = Math.min(...candles.map(c => c.low));
  const maxPrice = Math.max(...candles.map(c => c.high));
  const priceRange = maxPrice - minPrice;
  
  // Transform data for candlestick rendering
  const chartData = candles.map(candle => ({
    ...candle,
    // For the bar chart, we use the body range
    bodyLow: Math.min(candle.open, candle.close),
    bodyHigh: Math.max(candle.open, candle.close),
    bodyRange: Math.abs(candle.close - candle.open),
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.[0]) return null;
    const data = payload[0].payload;
    const isUp = data.close >= data.open;
    
    return (
      <div className="glass-card p-3 border border-border/50 text-xs space-y-1">
        <div className="text-muted-foreground">{data.time}</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <span className="text-muted-foreground">Open:</span>
          <span className="font-mono">{data.open}</span>
          <span className="text-muted-foreground">High:</span>
          <span className="font-mono text-buy">{data.high}</span>
          <span className="text-muted-foreground">Low:</span>
          <span className="font-mono text-sell">{data.low}</span>
          <span className="text-muted-foreground">Close:</span>
          <span className={`font-mono ${isUp ? 'text-buy' : 'text-sell'}`}>{data.close}</span>
        </div>
        {data.rsi && (
          <div className="pt-1 border-t border-border/50">
            <span className="text-muted-foreground">RSI:</span>
            <span className={`ml-2 font-mono ${data.rsi > 70 ? 'text-sell' : data.rsi < 30 ? 'text-buy' : ''}`}>
              {data.rsi}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className={`glass-card ${className}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              {symbol}
            </CardTitle>
            <div className={`flex items-center gap-1 text-sm ${isPositive ? 'text-buy' : 'text-sell'}`}>
              {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              <span className="font-mono">{isPositive ? '+' : ''}{priceChange}%</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {['1m', '5m', '15m', '1h'].map((tf) => (
                <Button
                  key={tf}
                  variant={timeframe === tf ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setTimeframe(tf)}
                >
                  {tf}
                </Button>
              ))}
            </div>
            
            <Select defaultValue="candles">
              <SelectTrigger className="h-7 w-24 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="candles">Candles</SelectItem>
                <SelectItem value="line">Line</SelectItem>
                <SelectItem value="area">Area</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="flex gap-2 pt-2">
          <Button
            variant={showIndicators.sma ? 'secondary' : 'ghost'}
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setShowIndicators(prev => ({ ...prev, sma: !prev.sma }))}
          >
            <Activity className="h-3 w-3 mr-1" />
            SMA 20
          </Button>
          <Button
            variant={showIndicators.ema ? 'secondary' : 'ghost'}
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setShowIndicators(prev => ({ ...prev, ema: !prev.ema }))}
          >
            <Activity className="h-3 w-3 mr-1" />
            EMA 9
          </Button>
          <Button
            variant={showIndicators.bollinger ? 'secondary' : 'ghost'}
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setShowIndicators(prev => ({ ...prev, bollinger: !prev.bollinger }))}
          >
            <Activity className="h-3 w-3 mr-1" />
            BB
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <XAxis 
                dataKey="time" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[minPrice - priceRange * 0.05, maxPrice + priceRange * 0.05]}
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                tickFormatter={(value) => value.toFixed(symbol.includes('USD') ? 4 : 0)}
                width={70}
                orientation="right"
              />
              <Tooltip content={<CustomTooltip />} />
              
              {/* Bollinger Bands */}
              {showIndicators.bollinger && (
                <>
                  <Line
                    type="monotone"
                    dataKey="upperBand"
                    stroke="hsl(var(--muted-foreground))"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    dot={false}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="lowerBand"
                    stroke="hsl(var(--muted-foreground))"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    dot={false}
                    connectNulls
                  />
                </>
              )}
              
              {/* Candlesticks using bars */}
              <Bar
                dataKey="bodyRange"
                shape={(props: any) => {
                  const { x, width, payload } = props;
                  if (!payload) return null;
                  
                  const { open, close, high, low } = payload;
                  const isUp = close >= open;
                  const fill = isUp ? 'hsl(var(--buy))' : 'hsl(var(--sell))';
                  
                  const yScale = (value: number) => {
                    const range = maxPrice + priceRange * 0.05 - (minPrice - priceRange * 0.05);
                    const chartHeight = 260; // approximate
                    return chartHeight - ((value - (minPrice - priceRange * 0.05)) / range) * chartHeight + 10;
                  };
                  
                  const bodyTop = yScale(Math.max(open, close));
                  const bodyBottom = yScale(Math.min(open, close));
                  const wickTop = yScale(high);
                  const wickBottom = yScale(low);
                  const wickX = x + width / 2;
                  
                  return (
                    <g>
                      <line
                        x1={wickX}
                        y1={wickTop}
                        x2={wickX}
                        y2={wickBottom}
                        stroke={fill}
                        strokeWidth={1}
                      />
                      <rect
                        x={x + 2}
                        y={bodyTop}
                        width={Math.max(width - 4, 2)}
                        height={Math.max(bodyBottom - bodyTop, 1)}
                        fill={fill}
                        stroke={fill}
                        strokeWidth={1}
                      />
                    </g>
                  );
                }}
              />
              
              {/* SMA 20 */}
              {showIndicators.sma && (
                <Line
                  type="monotone"
                  dataKey="sma20"
                  stroke="hsl(var(--primary))"
                  strokeWidth={1.5}
                  dot={false}
                  connectNulls
                />
              )}
              
              {/* EMA 9 */}
              {showIndicators.ema && (
                <Line
                  type="monotone"
                  dataKey="ema9"
                  stroke="hsl(var(--warning))"
                  strokeWidth={1.5}
                  dot={false}
                  connectNulls
                />
              )}
              
              {/* RSI reference lines */}
              <ReferenceLine y={0} stroke="transparent" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        
        {/* RSI Indicator */}
        <div className="mt-2 pt-2 border-t border-border/30">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>RSI (14)</span>
            <span className={`font-mono ${latestCandle?.rsi && latestCandle.rsi > 70 ? 'text-sell' : latestCandle?.rsi && latestCandle.rsi < 30 ? 'text-buy' : ''}`}>
              {latestCandle?.rsi || '--'}
            </span>
          </div>
          <div className="h-12 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <XAxis dataKey="time" hide />
                <YAxis domain={[0, 100]} hide width={70} orientation="right" />
                <ReferenceLine y={70} stroke="hsl(var(--sell))" strokeDasharray="2 2" strokeOpacity={0.5} />
                <ReferenceLine y={30} stroke="hsl(var(--buy))" strokeDasharray="2 2" strokeOpacity={0.5} />
                <Line
                  type="monotone"
                  dataKey="rsi"
                  stroke="hsl(var(--primary))"
                  strokeWidth={1}
                  dot={false}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
