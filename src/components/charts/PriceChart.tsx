import { useState, useMemo, useEffect, useRef } from 'react';
import { createChart, ColorType, CandlestickSeries, LineSeries, LineStyle, SeriesMarkerPosition, IChartApi, ISeriesApi, Time, createSeriesMarkers } from 'lightweight-charts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, TrendingDown, BarChart3, Activity, ZoomIn, ZoomOut } from 'lucide-react';

interface CandleData {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface PriceChartProps {
  symbol?: string;
  className?: string;
  ticks?: any[];
  positions?: any[];
}

export const PriceChart = ({ symbol = 'R_100', className, ticks = [], positions = [] }: PriceChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const rsiContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const rsiChartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const smaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const emaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbUpperSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbLowerSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const rsiSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const lastCandleRef = useRef<CandleData | null>(null);
  const markersPluginRef = useRef<any>(null);

  const [timeframe, setTimeframe] = useState('1m');
  const [showIndicators, setShowIndicators] = useState({
    sma: true,
    ema: true,
    bollinger: false,
  });

  const [loading, setLoading] = useState(true);
  const [candles, setCandles] = useState<CandleData[]>([]);

  // 1. Initial Chart Setup
  useEffect(() => {
    if (!chartContainerRef.current || !rsiContainerRef.current) return;

    const chartOptions = {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: 'rgba(255, 255, 255, 0.5)',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      crosshair: {
        mode: 0,
        vertLine: { labelBackgroundColor: '#2b2b43' },
        horzLine: { labelBackgroundColor: '#2b2b43' },
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
      rightPriceScale: {
        minimumWidth: 70, // Force fixed width to align stacked charts
        visible: true,
      },
    };

    const chart = createChart(chartContainerRef.current, {
      ...chartOptions,
      height: 300,
    });

    const rsiChart = createChart(rsiContainerRef.current, {
      ...chartOptions,
      height: 100,
      timeScale: {
        ...chartOptions.timeScale,
        visible: false, // Hide time axis on RSI
      }
    });

    // Synchronize charts (Visible Range)
    const syncTimeScale = (source: IChartApi, target: IChartApi) => {
      source.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (range) target.timeScale().setVisibleLogicalRange(range);
      });
    };

    syncTimeScale(chart, rsiChart);
    syncTimeScale(rsiChart, chart);

    // Synchronize Crosshair
    const syncCrosshair = (source: IChartApi, target: IChartApi, sourceSeries: ISeriesApi<"Candlestick"> | ISeriesApi<"Line">) => {
      source.subscribeCrosshairMove((param) => {
        if (!param.time || param.point === undefined) {
          target.clearCrosshairPosition();
          return;
        }

        target.setCrosshairPosition(0, param.time, sourceSeries);
      });
    };

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    const smaSeries = chart.addSeries(LineSeries, {
      color: '#3b82f6',
      lineWidth: 2,
      visible: showIndicators.sma,
    });

    const emaSeries = chart.addSeries(LineSeries, {
      color: '#fbbf24',
      lineWidth: 2,
      visible: showIndicators.ema,
    });

    const bbUpper = chart.addSeries(LineSeries, {
      color: 'rgba(255, 255, 255, 0.3)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      visible: showIndicators.bollinger,
    });

    const bbLower = chart.addSeries(LineSeries, {
      color: 'rgba(255, 255, 255, 0.3)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      visible: showIndicators.bollinger,
    });

    const rsiSeries = rsiChart.addSeries(LineSeries, {
      color: '#a855f7',
      lineWidth: 2,
      priceFormat: {
        type: 'custom',
        formatter: (price: number) => price.toFixed(0),
      },
    });

    // Add RSI reference lines (30, 70)
    rsiSeries.createPriceLine({
      price: 70,
      color: 'rgba(239, 68, 68, 0.5)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: '70',
    });

    rsiSeries.createPriceLine({
      price: 30,
      color: 'rgba(34, 197, 94, 0.5)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: '30',
    });

    // Handle Resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
      if (rsiContainerRef.current) {
        rsiChart.applyOptions({ width: rsiContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    chartRef.current = chart;
    rsiChartRef.current = rsiChart;
    candleSeriesRef.current = candleSeries;
    smaSeriesRef.current = smaSeries;
    emaSeriesRef.current = emaSeries;
    bbUpperSeriesRef.current = bbUpper;
    bbLowerSeriesRef.current = bbLower;
    rsiSeriesRef.current = rsiSeries;

    const markersPlugin = createSeriesMarkers(candleSeries);
    markersPluginRef.current = markersPlugin;

    // Synchronize Crosshair
    syncCrosshair(chart, rsiChart, candleSeries);
    syncCrosshair(rsiChart, chart, rsiSeries);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      rsiChart.remove();
    };
  }, []);

  // 2. Data Fetching & Enrichment
  useEffect(() => {
    const fetchCandles = async () => {
      setLoading(true);
      try {
        const granMap: Record<string, number> = { '1m': 60, '5m': 300, '15m': 900, '1h': 3600 };
        const response = await fetch(`/api/market/candles/${encodeURIComponent(symbol)}?granularity=${granMap[timeframe] || 60}&count=200`);
        const rawData = await response.json();

        if (Array.isArray(rawData) && rawData.length > 0) {
          const formatted = rawData.map(c => {
            const timeVal = c.epoch || (c.time ? Math.floor(new Date(c.time).getTime() / 1000) : 0);
            return {
              time: timeVal as any,
              open: parseFloat(c.open),
              high: parseFloat(c.high),
              low: parseFloat(c.low),
              close: parseFloat(c.close),
            };
          }).filter(c => !isNaN(c.time as number) && c.time > 0)
            .sort((a, b) => (a.time as number) - (b.time as number));

          setCandles(formatted);
          updateChartData(formatted);
        }
      } catch (error) {
        console.error('Failed to fetch candles:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCandles();
  }, [symbol, timeframe]);

  // 3. Indicators Logic
  const updateChartData = (data: any[]) => {
    if (!candleSeriesRef.current) return;

    candleSeriesRef.current.setData(data);
    if (data.length > 0) {
      lastCandleRef.current = { ...data[data.length - 1] };
    }

    // SMA 20
    const smaData = [];
    const smaPeriod = 20;
    for (let i = smaPeriod; i <= data.length; i++) {
      const slice = data.slice(i - smaPeriod, i);
      const sum = slice.reduce((a, b) => a + b.close, 0);
      smaData.push({ time: data[i - 1].time, value: sum / smaPeriod });
    }
    smaSeriesRef.current.setData(smaData);

    // EMA 9
    const emaData = [];
    const emaPeriod = 9;
    let k = 2 / (emaPeriod + 1);
    let ema = data[0].close;
    emaData.push({ time: data[0].time, value: ema });
    for (let i = 1; i < data.length; i++) {
      ema = data[i].close * k + ema * (1 - k);
      emaData.push({ time: data[i].time, value: ema });
    }
    emaSeriesRef.current.setData(emaData);

    // RSI 14 - Wilder's Smoothing (Standard)
    const rsiData = [];
    const rsiPeriod = 14;

    if (data.length > 0) {
      // Fill initial gap with NaN to maintain index alignment for synchronization
      for (let i = 0; i < Math.min(data.length, rsiPeriod); i++) {
        rsiData.push({ time: data[i].time, value: NaN });
      }

      if (data.length > rsiPeriod) {
        let avgGain = 0;
        let avgLoss = 0;

        // 1. Initial SMA (First 14 periods)
        for (let i = 1; i <= rsiPeriod; i++) {
          const change = data[i].close - data[i - 1].close;
          if (change >= 0) avgGain += change;
          else avgLoss += Math.abs(change);
        }
        avgGain /= rsiPeriod;
        avgLoss /= rsiPeriod;

        let rs = avgGain / (avgLoss || 0.0001);
        let rsi = 100 - (100 / (1 + rs));

        // Push the first calculated point matching index 'rsiPeriod'
        rsiData.push({ time: data[rsiPeriod].time, value: rsi });

        // 2. Wilder's Smoothing
        for (let i = rsiPeriod + 1; i < data.length; i++) {
          const change = data[i].close - data[i - 1].close;
          let currentGain = 0;
          let currentLoss = 0;

          if (change >= 0) currentGain = change;
          else currentLoss = Math.abs(change);

          avgGain = ((avgGain * 13) + currentGain) / 14;
          avgLoss = ((avgLoss * 13) + currentLoss) / 14;

          rs = avgGain / (avgLoss || 0.0001);
          rsi = 100 - (100 / (1 + rs));
          rsiData.push({ time: data[i].time, value: rsi });
        }
      }
    }
    rsiSeriesRef.current.setData(rsiData);

    // Bollinger Bands
    const upperData = [];
    const lowerData = [];
    for (let i = smaPeriod; i <= data.length; i++) {
      const slice = data.slice(i - smaPeriod, i);
      const mean = slice.reduce((sum, c) => sum + c.close, 0) / smaPeriod;
      const variance = slice.reduce((sum, c) => sum + Math.pow(c.close - mean, 2), 0) / smaPeriod;
      const stdDev = Math.sqrt(variance);
      upperData.push({ time: data[i - 1].time, value: mean + (stdDev * 2) });
      lowerData.push({ time: data[i - 1].time, value: mean - (stdDev * 2) });
    }
    bbUpperSeriesRef.current.setData(upperData);
    bbLowerSeriesRef.current.setData(lowerData);

    // Trade Markers
    const markers = positions
      .filter(p => p.symbol === symbol)
      .map(pos => ({
        time: Math.floor(new Date(pos.openTime).getTime() / 1000) as any,
        position: (pos.side === 'buy' ? 'belowBar' : 'aboveBar') as SeriesMarkerPosition,
        color: pos.side === 'buy' ? '#22c55e' : '#ef4444',
        shape: (pos.side === 'buy' ? 'arrowUp' : 'arrowDown') as any,
        text: pos.side === 'buy' ? 'BUY @ ' + pos.entryPrice : 'SELL @ ' + pos.entryPrice,
      }));

    if (markersPluginRef.current) {
      markersPluginRef.current.setMarkers(markers);
    }
  };

  // 4. Real-time Ticks - Update candles AND indicators
  useEffect(() => {
    if (ticks.length === 0 || !candleSeriesRef.current) return;
    const lastTick = ticks[0];
    if (lastTick.symbol !== symbol) return;

    const tickTime = Math.floor(new Date(lastTick.timestamp).getTime() / 1000);
    const granMap: Record<string, number> = { '1m': 60, '5m': 300, '15m': 900, '1h': 3600 };
    const granularity = granMap[timeframe] || 60;
    const currentSymbolTime = (Math.floor(tickTime / granularity) * granularity) as Time;

    let updatedCandle: CandleData;
    let isNewCandle = false;

    if (lastCandleRef.current && (lastCandleRef.current.time === currentSymbolTime)) {
      updatedCandle = {
        ...lastCandleRef.current,
        high: Math.max(lastCandleRef.current.high, lastTick.bid),
        low: Math.min(lastCandleRef.current.low, lastTick.bid),
        close: lastTick.bid,
      };
    } else {
      updatedCandle = {
        time: currentSymbolTime as any,
        open: lastTick.bid,
        high: lastTick.bid,
        low: lastTick.bid,
        close: lastTick.bid,
      };
      isNewCandle = true;
    }

    lastCandleRef.current = updatedCandle;
    candleSeriesRef.current.update(updatedCandle);

    // Update candles state for indicator calculation
    setCandles(prevCandles => {
      let newCandles: CandleData[];
      if (isNewCandle) {
        newCandles = [...prevCandles, updatedCandle];
      } else {
        // Update the last candle
        newCandles = [...prevCandles];
        if (newCandles.length > 0) {
          newCandles[newCandles.length - 1] = updatedCandle;
        } else {
          newCandles = [updatedCandle];
        }
      }

      // Limit to 500 candles to prevent memory issues
      if (newCandles.length > 500) {
        newCandles = newCandles.slice(-500);
      }

      // Update indicators with new data
      const data = newCandles;
      if (data.length >= 20) {
        // SMA 20 - update last point
        const smaPeriod = 20;
        const smaSlice = data.slice(-smaPeriod);
        const smaValue = smaSlice.reduce((a, b) => a + b.close, 0) / smaPeriod;
        smaSeriesRef.current?.update({ time: data[data.length - 1].time, value: smaValue });

        // EMA 9 - incremental update
        if (emaSeriesRef.current && data.length > 0) {
          const emaPeriod = 9;
          const k = 2 / (emaPeriod + 1);
          // Get previous EMA or calculate from scratch
          let ema = data[0].close;
          for (let i = 1; i < data.length; i++) {
            ema = data[i].close * k + ema * (1 - k);
          }
          emaSeriesRef.current.update({ time: data[data.length - 1].time, value: ema });
        }

        // Bollinger Bands - update last point
        const bbSlice = data.slice(-smaPeriod);
        const mean = bbSlice.reduce((sum, c) => sum + c.close, 0) / smaPeriod;
        const variance = bbSlice.reduce((sum, c) => sum + Math.pow(c.close - mean, 2), 0) / smaPeriod;
        const stdDev = Math.sqrt(variance);
        bbUpperSeriesRef.current?.update({ time: data[data.length - 1].time, value: mean + (stdDev * 2) });
        bbLowerSeriesRef.current?.update({ time: data[data.length - 1].time, value: mean - (stdDev * 2) });
      }

      // RSI 14 - update last point
      // RSI 14 - Recalculate full series for accuracy (Wilder's Smoothing)
      // Recalculating 500 points is negligible and ensures consistency with TradingView
      const rsiPeriod = 14;
      const rsiData = [];

      if (data.length > rsiPeriod) {
        let avgGain = 0;
        let avgLoss = 0;

        // 1. Initial SMA (First 14 periods)
        for (let i = 1; i <= rsiPeriod; i++) {
          const change = data[i].close - data[i - 1].close;
          if (change >= 0) avgGain += change;
          else avgLoss += Math.abs(change);
        }
        avgGain /= rsiPeriod;
        avgLoss /= rsiPeriod;

        // Push first RSI point
        let rs = avgGain / (avgLoss || 0.0001);
        let rsi = 100 - (100 / (1 + rs));
        // correlate time with the end of the period
        rsiData.push({ time: data[rsiPeriod].time, value: rsi });

        // 2. Wilder's Smoothing (Subsequent periods)
        for (let i = rsiPeriod + 1; i < data.length; i++) {
          const change = data[i].close - data[i - 1].close;
          let currentGain = 0;
          let currentLoss = 0;

          if (change >= 0) currentGain = change;
          else currentLoss = Math.abs(change);

          avgGain = ((avgGain * 13) + currentGain) / 14;
          avgLoss = ((avgLoss * 13) + currentLoss) / 14;

          rs = avgGain / (avgLoss || 0.0001);
          rsi = 100 - (100 / (1 + rs));
          rsiData.push({ time: data[i].time, value: rsi });
        }

        // Update the RSI series
        // Using setData prevents artifacts from partial updates and ensures the whole line is correct
        rsiSeriesRef.current?.setData(rsiData);
      }

      return newCandles;
    });
  }, [ticks, symbol, timeframe]);

  // 5. Toggle Indicators
  useEffect(() => {
    if (smaSeriesRef.current) smaSeriesRef.current.applyOptions({ visible: showIndicators.sma });
    if (emaSeriesRef.current) emaSeriesRef.current.applyOptions({ visible: showIndicators.ema });
    if (bbUpperSeriesRef.current) bbUpperSeriesRef.current.applyOptions({ visible: showIndicators.bollinger });
    if (bbLowerSeriesRef.current) bbLowerSeriesRef.current.applyOptions({ visible: showIndicators.bollinger });
  }, [showIndicators]);

  const latestCandle = candles[candles.length - 1];
  const previousCandle = candles[candles.length - 2];
  const priceChange = latestCandle && previousCandle
    ? ((latestCandle.close - previousCandle.close) / previousCandle.close * 100).toFixed(3)
    : '0';
  const isPositive = parseFloat(priceChange) >= 0;

  return (
    <Card className={`glass-card ${className} border-0 overflow-hidden`}>
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

      <CardContent className="pt-0 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}
        <div ref={chartContainerRef} className="w-full" style={{ height: '300px' }} />
        <div className="border-t border-white/5 mt-1" />
        <div ref={rsiContainerRef} className="w-full" style={{ height: '100px' }} />
      </CardContent>
    </Card>
  );
};
