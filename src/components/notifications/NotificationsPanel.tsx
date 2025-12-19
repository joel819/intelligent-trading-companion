import { Bell, TrendingUp, AlertTriangle, XCircle, Settings, Check } from 'lucide-react';
import type { Notification } from '@/types/trading';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface NotificationsPanelProps {
  notifications: Notification[];
  onMarkRead: (id: string) => void;
}

const typeConfig = {
  trade: { icon: TrendingUp, color: 'text-success', bg: 'bg-success/10' },
  alert: { icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10' },
  error: { icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10' },
  system: { icon: Settings, color: 'text-accent', bg: 'bg-accent/10' },
};

const formatTimeAgo = (timestamp: string): string => {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

export const NotificationsPanel = ({ notifications, onMarkRead }: NotificationsPanelProps) => {
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="glass-card p-5 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-foreground">Notifications</h3>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-primary/20 text-primary rounded-full">
              {unreadCount} new
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2 max-h-[500px] overflow-y-auto scrollbar-thin">
        {notifications.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">
            No notifications yet
          </p>
        ) : (
          notifications.map((notification) => {
            const config = typeConfig[notification.type];
            const Icon = config.icon;
            
            return (
              <div
                key={notification.id}
                className={cn(
                  "p-3 rounded-lg transition-all duration-200",
                  notification.read 
                    ? "bg-secondary/30" 
                    : "bg-secondary/60 border border-primary/20"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn("p-2 rounded-lg shrink-0", config.bg)}>
                    <Icon className={cn("w-4 h-4", config.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-medium text-sm text-foreground">{notification.title}</h4>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatTimeAgo(notification.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{notification.message}</p>
                  </div>
                  {!notification.read && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 h-8 w-8"
                      onClick={() => onMarkRead(notification.id)}
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
