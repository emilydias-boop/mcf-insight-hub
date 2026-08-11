import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type DialerEngine = 'twilio' | 'sonax';

export interface DialerEngineConfig {
  engine: DialerEngine;
  ramal: string | null;
}

/**
 * Motor de discagem do Auto-Discador para o usuário logado.
 * Fase 1 do rollout Sonax: só quem estiver com auto_dialer_engine='sonax'
 * em sdr_ramal_mapping usa o novo motor. Default = twilio (sem mudanças).
 */
export function useDialerEngine() {
  const { user } = useAuth();
  const email = (user?.email || '').toLowerCase();

  return useQuery({
    queryKey: ['dialer-engine', email],
    queryFn: async (): Promise<DialerEngineConfig> => {
      if (!email) return { engine: 'twilio', ramal: null };
      const { data } = await supabase
        .from('sdr_ramal_mapping')
        .select('ramal, auto_dialer_engine, active')
        .eq('sdr_email', email)
        .eq('active', true)
        .maybeSingle();
      const engine = ((data as any)?.auto_dialer_engine === 'sonax' ? 'sonax' : 'twilio') as DialerEngine;
      return { engine, ramal: (data as any)?.ramal ?? null };
    },
    enabled: !!email,
    staleTime: 10 * 60 * 1000,
  });
}

/** Mapa email -> motor, para o painel de métricas saber a fonte de dados de cada SDR. */
export function useDialerEngineMap() {
  return useQuery({
    queryKey: ['dialer-engine-map'],
    queryFn: async (): Promise<Record<string, { engine: DialerEngine; ramal: string | null }>> => {
      const { data } = await supabase
        .from('sdr_ramal_mapping')
        .select('sdr_email, ramal, auto_dialer_engine');
      const map: Record<string, { engine: DialerEngine; ramal: string | null }> = {};
      (data || []).forEach((row: any) => {
        if (!row.sdr_email) return;
        map[String(row.sdr_email).toLowerCase()] = {
          engine: row.auto_dialer_engine === 'sonax' ? 'sonax' : 'twilio',
          ramal: row.ramal ?? null,
        };
      });
      return map;
    },
    staleTime: 10 * 60 * 1000,
  });
}
