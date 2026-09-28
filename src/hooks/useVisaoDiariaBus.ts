import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface VDTotais {
  entrada: number;
  entrada_a010: number;
  entrada_anamnese: number;
  entrada_importados: number;
  agendamentos: number;
  agendamentos_a: number;
  agendamentos_b: number;
  agendamentos_outros: number;
  reagendamentos: number;
  r1_marcadas: number;
  r1_realizadas: number;
  r1_no_show: number;
  r1_pendentes: number;
  fechamentos: number;
  fechamentos_sem_r1: number;
  fechamentos_total?: number;
  cartas: number;
  valor: number;
}

export interface VDTaxas {
  entrada_agendamento: number | null;
  comparecimento: number | null;
  realizada_fechamento: number | null;
  entrada_fechamento: number | null;
  no_show: number | null;
}

export interface VDBu {
  bu: 'incorporador' | 'consorcio' | 'solar';
  label: string;
  fechamento_label: string;
  totais: VDTotais;
  taxas: VDTaxas;
  dias: (Omit<VDTotais, 'fechamentos_total'> & { data: string; taxa_no_show: number | null })[];
}

export interface VDResult {
  periodo: { de: string; ate: string };
  gerado_em: string;
  bus: VDBu[];
}

/** Dia civil em São Paulo, sem converter a data solicitada para instante UTC. */
export function hojeSaoPaulo(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function useVisaoDiariaBus(from: string, to: string) {
  return useQuery<VDResult>({
    queryKey: ['visao-diaria-bus', from, to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('visao_diaria_bus' as any, { p_from: from, p_to: to });
      if (error) throw error;
      return data as VDResult;
    },
    enabled: !!from && !!to && from <= to,
    staleTime: 60_000,
    refetchInterval: from <= hojeSaoPaulo() && to >= hojeSaoPaulo() ? 120_000 : false,
  });
}