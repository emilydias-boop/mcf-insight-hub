import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRealtimeAlerts } from "@/hooks/useRealtimeAlerts";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";

export function RealTimeAlerts() {
  const { user } = useAuth();
  const { alerts, unreadCount, markAsRead } = useRealtimeAlerts(user?.id);
  const navigate = useNavigate();

  const recentAlerts = alerts.slice(0, 5);

  const getAlertIcon = (tipo: string) => {
    switch (tipo) {
      case 'critico':
        return '🔴';
      case 'aviso':
        return '🟡';
      default:
        return '🔵';
    }
  };

  const getAlertColor = (tipo: string) => {
    switch (tipo) {
      case 'critico':
        return 'text-destructive';
      case 'aviso':
        return 'text-warning';
      default:
        return 'text-primary';
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Alertas</span>
          {unreadCount > 0 && (
            <Badge variant="secondary">{unreadCount} não lidos</Badge>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {recentAlerts.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Nenhum alerta recente
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            {recentAlerts.map((alert) => (
              <DropdownMenuItem
                key={alert.id}
                className={cn(
                  "flex flex-col items-start gap-1 p-3 cursor-pointer",
                  !alert.lido && "bg-accent/50"
                )}
                onClick={() => {
                  markAsRead(alert.id);
                  navigate('/alertas');
                }}
              >
                <div className="flex items-center gap-2 w-full">
                  <span>{getAlertIcon(alert.tipo)}</span>
                  <div className="flex-1 min-w-0">
                    <p className={cn("font-medium text-sm truncate", getAlertColor(alert.tipo))}>
                      {alert.titulo}
                    </p>
                    {alert.descricao && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {alert.descricao}
                      </p>
                    )}
                  </div>
                  {!alert.lido && (
                    <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(alert.created_at), { 
                    addSuffix: true, 
                    locale: ptBR 
                  })}
                </span>
              </DropdownMenuItem>
            ))}
          </ScrollArea>
        )}
        
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="justify-center text-primary cursor-pointer"
          onClick={() => navigate('/alertas')}
        >
          Ver todos os alertas
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
