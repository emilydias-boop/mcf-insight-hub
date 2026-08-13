import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SonaxCallEventRow {
  id: string;
  evento: string;
  ramal: string | null;
  aliasramal: string | null;
  numero: string | null;
  numero_rec: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  status_atendimento: string | null;
  duracao_chamada: string | null;
  url_gravacao: string | null;
  sdr_email: string | null;
  sdr_name: string | null;
  deal_id: string | null;
  contact_id: string | null;
  created_at: string;
  deal_name?: string | null;
  deal_phone?: string | null;
}

const SELECT =
  'id,evento,ramal,aliasramal,numero,numero_rec,data_inicio,data_fim,status_atendimento,duracao_chamada,url_gravacao,sdr_email,sdr_name,deal_id,contact_id,created_at';

function isPlaceholder(v: string | null | undefined) {
  return !v || v.startsWith('<');
}

export function sonaxClientPhone(row: SonaxCallEventRow): string | null {
  if (!isPlaceholder(row.numero_rec)) return row.numero_rec!;
  if (!isPlaceholder(row.numero)) return row.numero!;
  return null;
}

async function attachDeals(rows: SonaxCallEventRow[]): Promise<SonaxCallEventRow[]> {
  const ids = [...new Set(rows.map((r) => r.deal_id).filter((v): v is string => !!v))];
  if (!ids.length) return rows;
  const { data } = await supabase
    .from('crm_deals')
    .select('id,name,phone')
    .in('id', ids);
  const map = new Map((data || []).map((d: any) => [d.id, d]));
  return rows.map((r) => {
    const d = r.deal_id ? map.get(r.deal_id) : null;
    return { ...r, deal_name: d?.name ?? null, deal_phone: d?.phone ?? null };
  });
}

/** Eventos de desligamento (chamadas completas) vinculados a um deal. */
export function useSonaxCallEventsByDeal(dealIds: string[]) {
  return useQuery({
    queryKey: ['sonax-call-events-deal', dealIds],
    enabled: dealIds.length > 0,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<SonaxCallEventRow[]> => {
      const { data, error } = await supabase
        .from('sonax_call_events')
        .select(SELECT)
        .eq('evento', 'desligamento')
        .in('deal_id', dealIds)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as SonaxCallEventRow[];
    },
  });
}

export interface SonaxCallsFilter {
  days: number;
  sdrEmail: string | 'all';
  search: string;
}

/** Lista geral de ligações Sonax (o RLS já limita o que cada usuário vê). */
export function useSonaxCallEvents(filter: SonaxCallsFilter) {
  return useQuery({
    queryKey: ['sonax-call-events', filter.days, filter.sdrEmail],
    staleTime: 30 * 1000,
    queryFn: async (): Promise<SonaxCallEventRow[]> => {
      const since = new Date();
      since.setDate(since.getDate() - filter.days);

      let query = supabase
        .from('sonax_call_events')
        .select(SELECT)
        .eq('evento', 'desligamento')
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false })
        .limit(500);

      if (filter.sdrEmail !== 'all') query = query.eq('sdr_email', filter.sdrEmail);

      const { data, error } = await query;
      if (error) throw error;
      return attachDeals((data || []) as SonaxCallEventRow[]);
    },
  });
}
