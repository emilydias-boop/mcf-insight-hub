import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface WaEnvioStatusRaw {
  liberado?: boolean;
  pausado?: boolean;
  motivo?: string | null;
  desde?: string | null;
  por_nome?: string | null;
}

/** Status da chave única de pausa do envio de WhatsApp (RPC wa_envio_status). Em erro, pausado=false. */
export function useWaEnvioStatus() {
  const { data, isLoading } = useQuery({
    queryKey: ['wa-envio-status'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('wa_envio_status');
      if (error) throw error;
      return (data ?? {}) as WaEnvioStatusRaw;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  return {
    pausado: data?.pausado === true,
    motivo: data?.motivo ?? null,
    desde: data?.desde ?? null,
    porNome: data?.por_nome ?? null,
    isLoading,
  };
}

/** Formata `desde` em dd/MM HH:mm no fuso America/Sao_Paulo. */
export function formatDesdePausa(desde: string | null): string {
  if (!desde) return '—';
  const d = new Date(desde);
  if (isNaN(d.getTime())) return desde;
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d).replace(',', '');
}

export const WA_PAUSADO_TOOLTIP = 'Envio pausado — conta do WhatsApp suspensa';
