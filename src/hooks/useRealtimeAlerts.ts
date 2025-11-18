import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Alert } from "@/types/dashboard";

export function useRealtimeAlerts(userId?: string) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Buscar alertas iniciais
  const fetchAlerts = async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('alertas')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const typedData = (data || []).map(alert => ({
        ...alert,
        tipo: alert.tipo as 'critico' | 'aviso' | 'info',
        descricao: alert.descricao || null,
        metadata: (alert.metadata || null) as Record<string, any> | null,
      }));
      setAlerts(typedData);
      setUnreadCount(typedData.filter(a => !a.lido).length || 0);
    } catch (error) {
      console.error('Erro ao buscar alertas:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Marcar alerta como lido
  const markAsRead = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('alertas')
        .update({ lido: true, updated_at: new Date().toISOString() })
        .eq('id', alertId);

      if (error) throw error;

      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, lido: true } : a));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Erro ao marcar alerta como lido:', error);
    }
  };

  // Marcar alerta como resolvido
  const markAsResolved = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('alertas')
        .update({ resolvido: true, updated_at: new Date().toISOString() })
        .eq('id', alertId);

      if (error) throw error;

      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, resolvido: true } : a));
    } catch (error) {
      console.error('Erro ao marcar alerta como resolvido:', error);
    }
  };

  // Subscrever em tempo real
  useEffect(() => {
    if (!userId) return;

    fetchAlerts();

    const channel = supabase
      .channel('alertas-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'alertas',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          const newAlert = {
            ...payload.new,
            tipo: (payload.new as any).tipo as 'critico' | 'aviso' | 'info',
            descricao: (payload.new as any).descricao || null,
          } as Alert;
          
          setAlerts(prev => [newAlert, ...prev]);
          setUnreadCount(prev => prev + 1);

          // Mostrar toast
          toast({
            title: newAlert.titulo,
            description: newAlert.descricao || undefined,
            variant: newAlert.tipo === 'critico' ? 'destructive' : 'default',
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, toast]);

  return {
    alerts,
    unreadCount,
    isLoading,
    markAsRead,
    markAsResolved,
    refetch: fetchAlerts,
  };
}
