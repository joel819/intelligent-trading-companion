import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  className?: string;
}

export const StatCard = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendValue,
  className,
}: StatCardProps) => {
  return (
    <div className={cn("glass-card p-4 md:p-5 animate-fade-in", className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl md:text-3xl font-bold font-mono tracking-tight">
            {typeof value === 'number' 
              ? value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              : value
            }
          </p>
          {(subtitle || trend) && (
            <div className="flex items-center gap-2 pt-1">
              {trend && (
                <div className={cn(
                  "flex items-center gap-1 text-xs font-medium",
                  trend === 'up' && "text-success",
                  trend === 'down' && "text-destructive",
                  trend === 'neutral' && "text-muted-foreground"
                )}>
                  {trend === 'up' && <TrendingUp className="w-3 h-3" />}
                  {trend === 'down' && <TrendingDown className="w-3 h-3" />}
                  {trendValue && <span>{trendValue}</span>}
                </div>
              )}
              {subtitle && (
                <span className="text-xs text-muted-foreground">{subtitle}</span>
              )}
            </div>
          )}
        </div>
        {icon && (
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};
