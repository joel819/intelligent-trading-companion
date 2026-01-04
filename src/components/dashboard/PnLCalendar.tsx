import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  startOfYear,
  eachMonthOfInterval,
  getWeek,
  getYear,
  isToday
} from 'date-fns';

// Mock P&L data - replace with real data from API
const generateMockPnLData = () => {
  const data: Record<string, number> = {};
  const today = new Date();
  
  // Generate random P&L for the past 365 days
  for (let i = 0; i < 365; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateKey = format(date, 'yyyy-MM-dd');
    
    // Random P&L between -500 and 800 with some days having no trades
    const hasTrades = Math.random() > 0.3;
    if (hasTrades) {
      data[dateKey] = Math.round((Math.random() * 1300 - 500) * 100) / 100;
    }
  }
  
  return data;
};

const mockPnLData = generateMockPnLData();

interface PnLCalendarProps {
  pnlData?: Record<string, number>;
}

export const PnLCalendar = ({ pnlData = mockPnLData }: PnLCalendarProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  // Get color based on P&L value
  const getPnLColor = (pnl: number | undefined) => {
    if (pnl === undefined) return 'bg-muted/30';
    if (pnl > 0) return 'bg-success/20 border-success/40';
    if (pnl < 0) return 'bg-destructive/20 border-destructive/40';
    return 'bg-muted/50';
  };

  const getPnLTextColor = (pnl: number | undefined) => {
    if (pnl === undefined) return 'text-muted-foreground';
    if (pnl > 0) return 'text-success';
    if (pnl < 0) return 'text-destructive';
    return 'text-muted-foreground';
  };

  const getIntensity = (pnl: number | undefined, maxAbsPnL: number) => {
    if (pnl === undefined || maxAbsPnL === 0) return 0;
    return Math.min(Math.abs(pnl) / maxAbsPnL, 1);
  };

  // Calculate statistics
  const stats = useMemo(() => {
    const values = Object.values(pnlData);
    const totalPnL = values.reduce((sum, v) => sum + v, 0);
    const winDays = values.filter(v => v > 0).length;
    const lossDays = values.filter(v => v < 0).length;
    const bestDay = values.length ? Math.max(...values) : 0;
    const worstDay = values.length ? Math.min(...values) : 0;
    const avgPnL = values.length ? totalPnL / values.length : 0;
    const maxAbsPnL = Math.max(Math.abs(bestDay), Math.abs(worstDay));
    
    return { totalPnL, winDays, lossDays, bestDay, worstDay, avgPnL, maxAbsPnL };
  }, [pnlData]);

  // Daily view calendar
  const renderDailyView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h3 className="font-semibold text-lg">
            {format(currentDate, 'MMMM yyyy')}
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {weekDays.map(day => (
            <div
              key={day}
              className="text-center text-xs font-medium text-muted-foreground py-2"
            >
              {day}
            </div>
          ))}
          
          {days.map(day => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const pnl = pnlData[dateKey];
            const isCurrentMonth = isSameMonth(day, currentDate);
            const intensity = getIntensity(pnl, stats.maxAbsPnL);

            return (
              <div
                key={dateKey}
                className={cn(
                  "aspect-square p-1 rounded-md border transition-all hover:scale-105 cursor-pointer",
                  !isCurrentMonth && "opacity-40",
                  isToday(day) && "ring-2 ring-primary",
                  getPnLColor(pnl)
                )}
                style={{
                  opacity: isCurrentMonth ? (pnl !== undefined ? 0.5 + intensity * 0.5 : 0.3) : 0.2
                }}
                title={pnl !== undefined ? `${format(day, 'MMM d')}: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}` : format(day, 'MMM d')}
              >
                <div className="h-full flex flex-col items-center justify-center">
                  <span className={cn(
                    "text-xs font-medium",
                    isToday(day) ? "text-primary" : "text-foreground"
                  )}>
                    {format(day, 'd')}
                  </span>
                  {pnl !== undefined && (
                    <span className={cn(
                      "text-[10px] font-mono font-semibold",
                      getPnLTextColor(pnl)
                    )}>
                      {pnl >= 0 ? '+' : ''}{pnl.toFixed(0)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Weekly view
  const renderWeeklyView = () => {
    const weeks: { weekNum: number; year: number; startDate: Date; pnl: number }[] = [];
    const yearStart = startOfYear(currentDate);
    const today = new Date();
    
    let currentWeekStart = startOfWeek(yearStart, { weekStartsOn: 1 });
    
    while (currentWeekStart <= today) {
      const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
      const daysInWeek = eachDayOfInterval({ start: currentWeekStart, end: weekEnd });
      
      const weekPnL = daysInWeek.reduce((sum, day) => {
        const dateKey = format(day, 'yyyy-MM-dd');
        return sum + (pnlData[dateKey] || 0);
      }, 0);

      weeks.push({
        weekNum: getWeek(currentWeekStart, { weekStartsOn: 1 }),
        year: getYear(currentWeekStart),
        startDate: currentWeekStart,
        pnl: weekPnL
      });

      currentWeekStart = addWeeks(currentWeekStart, 1);
    }

    const maxAbsWeekPnL = Math.max(...weeks.map(w => Math.abs(w.pnl)));

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">
            Weekly P&L - {format(currentDate, 'yyyy')}
          </h3>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-13 gap-2">
          {weeks.slice(-52).map((week, idx) => {
            const intensity = getIntensity(week.pnl, maxAbsWeekPnL);
            
            return (
              <div
                key={idx}
                className={cn(
                  "aspect-square p-1 rounded-md border transition-all hover:scale-105 cursor-pointer flex flex-col items-center justify-center",
                  getPnLColor(week.pnl !== 0 ? week.pnl : undefined)
                )}
                style={{
                  opacity: week.pnl !== 0 ? 0.5 + intensity * 0.5 : 0.3
                }}
                title={`Week ${week.weekNum}: ${week.pnl >= 0 ? '+' : ''}$${week.pnl.toFixed(2)}`}
              >
                <span className="text-[10px] text-muted-foreground">W{week.weekNum}</span>
                <span className={cn(
                  "text-xs font-mono font-semibold",
                  getPnLTextColor(week.pnl !== 0 ? week.pnl : undefined)
                )}>
                  {week.pnl !== 0 ? (week.pnl >= 0 ? '+' : '') + week.pnl.toFixed(0) : '-'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Monthly view
  const renderMonthlyView = () => {
    const months = eachMonthOfInterval({
      start: startOfYear(currentDate),
      end: endOfMonth(currentDate)
    });

    const monthlyData = months.map(month => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
      
      const monthPnL = daysInMonth.reduce((sum, day) => {
        const dateKey = format(day, 'yyyy-MM-dd');
        return sum + (pnlData[dateKey] || 0);
      }, 0);

      const tradingDays = daysInMonth.filter(day => {
        const dateKey = format(day, 'yyyy-MM-dd');
        return pnlData[dateKey] !== undefined;
      }).length;

      return { month, pnl: monthPnL, tradingDays };
    });

    const maxAbsMonthPnL = Math.max(...monthlyData.map(m => Math.abs(m.pnl)));

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentDate(subMonths(currentDate, 12))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h3 className="font-semibold text-lg">
            Monthly P&L - {format(currentDate, 'yyyy')}
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentDate(addMonths(currentDate, 12))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {monthlyData.map((data, idx) => {
            const intensity = getIntensity(data.pnl, maxAbsMonthPnL);
            
            return (
              <Card
                key={idx}
                className={cn(
                  "transition-all hover:scale-105 cursor-pointer border-2",
                  getPnLColor(data.pnl !== 0 ? data.pnl : undefined)
                )}
                style={{
                  opacity: data.pnl !== 0 ? 0.6 + intensity * 0.4 : 0.4
                }}
              >
                <CardContent className="p-3 text-center">
                  <div className="text-sm font-medium text-muted-foreground">
                    {format(data.month, 'MMM')}
                  </div>
                  <div className={cn(
                    "text-lg font-mono font-bold mt-1",
                    getPnLTextColor(data.pnl !== 0 ? data.pnl : undefined)
                  )}>
                    {data.pnl !== 0 ? (data.pnl >= 0 ? '+' : '') + '$' + data.pnl.toFixed(0) : '-'}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {data.tradingDays} days
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Statistics Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Total P&L</div>
            <div className={cn(
              "text-xl font-mono font-bold mt-1",
              stats.totalPnL >= 0 ? "text-success" : "text-destructive"
            )}>
              {stats.totalPnL >= 0 ? '+' : ''}${stats.totalPnL.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Win Rate</div>
            <div className="text-xl font-mono font-bold mt-1 text-success">
              {stats.winDays + stats.lossDays > 0 
                ? ((stats.winDays / (stats.winDays + stats.lossDays)) * 100).toFixed(1) 
                : 0}%
            </div>
            <div className="text-xs text-muted-foreground">
              {stats.winDays}W / {stats.lossDays}L
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Best Day</div>
            <div className="text-xl font-mono font-bold mt-1 text-success">
              +${stats.bestDay.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Worst Day</div>
            <div className="text-xl font-mono font-bold mt-1 text-destructive">
              ${stats.worstDay.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Avg Daily</div>
            <div className={cn(
              "text-xl font-mono font-bold mt-1",
              stats.avgPnL >= 0 ? "text-success" : "text-destructive"
            )}>
              {stats.avgPnL >= 0 ? '+' : ''}${stats.avgPnL.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Trading Days</div>
            <div className="text-xl font-mono font-bold mt-1">
              {stats.winDays + stats.lossDays}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-success/40 border border-success/60" />
          <span className="text-muted-foreground">Profit</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-destructive/40 border border-destructive/60" />
          <span className="text-muted-foreground">Loss</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-muted/50 border border-muted" />
          <span className="text-muted-foreground">No trades</span>
        </div>
      </div>

      {/* Calendar Views */}
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-primary" />
              P&L Calendar
            </CardTitle>
            <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
              <TabsList>
                <TabsTrigger value="daily">Daily</TabsTrigger>
                <TabsTrigger value="weekly">Weekly</TabsTrigger>
                <TabsTrigger value="monthly">Monthly</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {view === 'daily' && renderDailyView()}
          {view === 'weekly' && renderWeeklyView()}
          {view === 'monthly' && renderMonthlyView()}
        </CardContent>
      </Card>
    </div>
  );
};
