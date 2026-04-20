import { useMemo } from 'react';
import { useCarrinhoUnifiedData, isForaDoCarrinho, CarrinhoLeadRow } from '@/hooks/useCarrinhoUnifiedData';
import { CarrinhoConfig } from '@/hooks/useCarrinhoConfig';
import { getCarrinhoMetricBoundaries } from '@/lib/carrinhoWeekBoundaries';

export interface R2ForaDoCarrinhoAttendee {
  id: string;
  attendee_name: string | null;
  attendee_phone: string | null;
  r2_status_id: string | null;
  r2_status_name: string;
  r2_status_color: string;
  motivo: string | null;
  closer_name: string | null;
  closer_color: string | null;
  scheduled_at: string;
  deal_name: string | null;
  contact_phone: string | null;
  meeting_id: string;
}

export function useR2ForaDoCarrinhoData(weekStart: Date, weekEnd: Date, carrinhoConfig?: CarrinhoConfig, previousConfig?: CarrinhoConfig) {
  const { data: unifiedData, isLoading } = useCarrinhoUnifiedData(weekStart, weekEnd, carrinhoConfig, previousConfig);

  const data = useMemo((): R2ForaDoCarrinhoAttendee[] => {
    if (!unifiedData) return [];

    const { carrinhoOperacional } = getCarrinhoMetricBoundaries(weekStart, weekEnd, carrinhoConfig, previousConfig);
    const opStart = carrinhoOperacional.start.getTime();
    const opEnd = carrinhoOperacional.end.getTime();
    const inOperationalWindow = (row: CarrinhoLeadRow) => {
      if (row.is_encaixado) return true;
      if (!row.scheduled_at) return false;
      const t = new Date(row.scheduled_at).getTime();
      return t >= opStart && t < opEnd;
    };

    return unifiedData
      .filter(r => isForaDoCarrinho(r) && inOperationalWindow(r))
      .map((row): R2ForaDoCarrinhoAttendee => ({
        id: row.attendee_id,
        attendee_name: row.attendee_name,
        attendee_phone: row.attendee_phone,
        r2_status_id: row.r2_status_id,
        r2_status_name: row.r2_status_name || 'Desconhecido',
        r2_status_color: row.r2_status_color || '#6B7280',
        motivo: null, // Motivo requires custom_fields from deals - not in RPC
        closer_name: row.r2_closer_name,
        closer_color: row.r2_closer_color,
        scheduled_at: row.scheduled_at || '',
        deal_name: row.deal_name,
        contact_phone: row.contact_phone,
        meeting_id: row.meeting_slot_id || '',
      }))
      .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
  }, [unifiedData, weekStart, weekEnd, carrinhoConfig, previousConfig]);

  return { data, isLoading };
}
