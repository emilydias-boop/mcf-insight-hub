import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { CarrinhoConfig } from '@/hooks/useCarrinhoConfig';
import { getCarrinhoMetricBoundaries } from '@/lib/carrinhoWeekBoundaries';

export interface CarrinhoLeadRow {
  attendee_id: string;
  attendee_name: string | null;
  attendee_phone: string | null;
  attendee_status: string | null;
  r2_status_id: string | null;
  r2_status_name: string | null;
  r2_status_color: string | null;
  carrinho_status: string | null;
  carrinho_updated_at: string | null;
  carrinho_week_start: string | null;
  deal_id: string | null;
  contact_id: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  contact_name: string | null;
  partner_name: string | null;
  contract_paid_at: string | null;
  meeting_slot_id: string | null;
  meeting_status: string | null;
  scheduled_at: string | null;
  r2_closer_id: string | null;
  r2_closer_name: string | null;
  r2_closer_color: string | null;
  deal_name: string | null;
  r1_scheduled_at: string | null;
  r1_closer_name: string | null;
  r1_closer_id: string | null;
  r1_contract_paid_at: string | null;
  is_encaixado: boolean;
  phone_dedup_key: string | null;
  /** True quando o contrato foi pago dentro da janela do corte da safra. */
  dentro_corte: boolean;
  /** Data efetiva do contrato: COALESCE(r1_contract_paid_at, contract_paid_at, hubla_A000) */
  effective_contract_date: string | null;
  /** Origem da data: 'r1' | 'r2' | 'hubla' | 'none' */
  contract_source: 'r1' | 'r2' | 'hubla' | 'none' | null;
}

/**
 * Unified data source for all Carrinho R2 views.
 * Calls the `get_carrinho_r2_attendees` RPC which handles:
 * - Week scoping (window + encaixados, excluding other weeks)
 * - Phone-based deduplication (last 9 digits)
 * - R1 enrichment, closer data, contact data
 * 
 * All consumer hooks should derive their data from this single source.
 */
export function useCarrinhoUnifiedData(
  weekStart: Date,
  weekEnd: Date,
  carrinhoConfig?: CarrinhoConfig,
  previousConfig?: CarrinhoConfig
) {
  const cutoffKey = carrinhoConfig?.carrinhos?.[0]?.horario_corte || '12:00';
  const prevCutoffKey = previousConfig?.carrinhos?.[0]?.horario_corte || '12:00';

  return useQuery({
    queryKey: ['carrinho-unified-data', format(weekStart, 'yyyy-MM-dd'), format(weekEnd, 'yyyy-MM-dd'), cutoffKey, prevCutoffKey],
    queryFn: async (): Promise<CarrinhoLeadRow[]> => {
      const boundaries = getCarrinhoMetricBoundaries(weekStart, weekEnd, carrinhoConfig, previousConfig);
      const weekStartStr = format(weekStart, 'yyyy-MM-dd');

      const { data, error } = await supabase.rpc('get_carrinho_r2_attendees', {
        p_week_start: weekStartStr,
        p_window_start: boundaries.r2Meetings.start.toISOString(),
        p_window_end: boundaries.r2Meetings.end.toISOString(),
        p_apply_contract_cutoff: true,
        p_previous_cutoff: boundaries.previousCutoff.toISOString(),
      });

      if (error) {
        console.error('Error fetching carrinho unified data:', error);
        throw error;
      }

      return (data || []) as CarrinhoLeadRow[];
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });
}

// ===== Derived helpers =====

const APROVADO_NAMES = ['aprovado', 'approved'];
const FORA_NAMES = ['reembolso', 'desistente', 'reprovado', 'próxima semana', 'cancelado'];
const PENDENTE_NAMES = ['pendente', 'pending'];
const EM_ANALISE_NAMES = ['análise', 'analise'];

export function isAprovado(row: CarrinhoLeadRow): boolean {
  const name = (row.r2_status_name || '').toLowerCase();
  return APROVADO_NAMES.some(n => name.includes(n));
}

export function isForaDoCarrinho(row: CarrinhoLeadRow): boolean {
  const name = (row.r2_status_name || '').toLowerCase();
  return FORA_NAMES.some(n => name.includes(n));
}

export function isPendente(row: CarrinhoLeadRow): boolean {
  const name = (row.r2_status_name || '').toLowerCase();
  return PENDENTE_NAMES.some(n => name.includes(n));
}

export function isEmAnalise(row: CarrinhoLeadRow): boolean {
  const name = (row.r2_status_name || '').toLowerCase();
  return EM_ANALISE_NAMES.some(n => name.includes(n));
}

export function isAgendada(row: CarrinhoLeadRow): boolean {
  return row.meeting_status !== 'cancelled' && row.meeting_status !== 'rescheduled';
}

export function isRealizada(row: CarrinhoLeadRow): boolean {
  return row.attendee_status === 'completed' || row.attendee_status === 'presente' || row.meeting_status === 'completed';
}
