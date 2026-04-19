import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { CarrinhoConfig } from '@/hooks/useCarrinhoConfig';
import { useCarrinhoUnifiedData, isAprovado, isForaDoCarrinho, CarrinhoLeadRow } from '@/hooks/useCarrinhoUnifiedData';
import { getCarrinhoMetricBoundaries } from '@/lib/carrinhoWeekBoundaries';

export interface CloserConversion {
  closerId: string;
  closerName: string;
  closerColor: string;
  aprovados: number;
  vendas: number;
  conversion: number;
}

export interface R2MetricsData {
  totalLeads: number;
  leadsAtivos: number;
  desistentes: number;
  reprovados: number;
  reembolsos: number;
  proximaSemana: number;
  noShow: number;
  leadsPerdidosPercent: number;
  noShowAttendees: Array<{
    id: string;
    name: string;
    phone: string | null;
    meetingId: string;
  }>;
  selecionados: number;
  vendas: number;
  vendasExtras: number;
  conversaoGeral: number;
  closerConversions: CloserConversion[];
  /** Aprovados cujo contrato foi pago APÓS o corte de Sex 12:00 (vão p/ próxima safra) */
  tardios: number;
  tardiosList: Array<{ id: string; name: string; phone: string | null; contractPaidAt: string | null; closerName: string | null }>;
  /** R2s realizadas (completed) sem r2_status_id definido — closer esqueceu de carimbar */
  pendentesStatus: number;
  pendentesStatusList: Array<{ id: string; name: string; closerName: string | null }>;
}

const normalizePhone = (phone: string | null): string | null => {
  if (!phone) return null;
  return phone.replace(/\D/g, '').slice(-11);
};

export function useR2MetricsData(weekStart: Date, weekEnd: Date, carrinhoConfig?: CarrinhoConfig, previousConfig?: CarrinhoConfig) {
  const { data: unifiedData } = useCarrinhoUnifiedData(weekStart, weekEnd, carrinhoConfig, previousConfig);
  const cutoffKey = carrinhoConfig?.carrinhos?.[0]?.horario_corte || '12:00';
  const prevCutoffKey = previousConfig?.carrinhos?.[0]?.horario_corte || '12:00';

  return useQuery({
    queryKey: ['r2-metrics-data', format(weekStart, 'yyyy-MM-dd'), format(weekEnd, 'yyyy-MM-dd'), cutoffKey, prevCutoffKey, unifiedData?.length],
    queryFn: async (): Promise<R2MetricsData> => {
      if (!unifiedData) return emptyMetrics();

      const boundaries = getCarrinhoMetricBoundaries(weekStart, weekEnd, carrinhoConfig, previousConfig);

      // Count by status from unified data
      let desistentes = 0;
      let reprovados = 0;
      let proximaSemana = 0;
      let noShow = 0;
      let aprovados = 0;
      let reembolsosCount = 0;
      let tardiosCount = 0;
      const tardiosList: R2MetricsData['tardiosList'] = [];
      const pendentesStatusList: R2MetricsData['pendentesStatusList'] = [];

      const approvedEmails: string[] = [];
      const approvedPhones: string[] = [];
      const noShowAttendees: R2MetricsData['noShowAttendees'] = [];
      const closerStats = new Map<string, { name: string; color: string; aprovados: number; vendas: number }>();
      const approvedAttendeeIds = new Set<string>();
      const attendeeIdToCloser = new Map<string, string>();

      for (const row of unifiedData) {
        const statusName = (row.r2_status_name || '').toLowerCase();
        const closerId = row.r2_closer_id || 'unknown';
        const closerName = row.r2_closer_name || 'Sem closer';
        const closerColor = row.r2_closer_color || '#6B7280';

        if (!closerStats.has(closerId)) {
          closerStats.set(closerId, { name: closerName, color: closerColor, aprovados: 0, vendas: 0 });
        }

        // Detectar R2 realizada SEM status (closer esqueceu de carimbar)
        const realizadaSemStatus =
          (row.attendee_status === 'completed' || row.attendee_status === 'presente' || row.meeting_status === 'completed')
          && row.attendee_status !== 'no_show'
          && !row.r2_status_id;
        if (realizadaSemStatus) {
          pendentesStatusList.push({
            id: row.attendee_id,
            name: row.attendee_name || 'Sem nome',
            closerName: row.r2_closer_name,
          });
        }

        if (statusName.includes('desistente')) {
          desistentes++;
        } else if (statusName.includes('reembolso')) {
          reembolsosCount++;
        } else if (statusName.includes('reprovado')) {
          reprovados++;
        } else if (statusName.includes('próxima semana') || statusName.includes('proxima semana')) {
          proximaSemana++;
        } else if (row.attendee_status === 'no_show') {
          noShow++;
          noShowAttendees.push({
            id: row.attendee_id,
            name: row.attendee_name || 'Sem nome',
            phone: row.attendee_phone,
            meetingId: row.attendee_id,
          });
        } else if (statusName.includes('aprovado') || statusName.includes('approved')) {
          // Filtro de corte por DATA DO CONTRATO PAGO:
          // - dentro_corte = true → conta como aprovado da safra
          // - dentro_corte = false → "tardio" (vai pra próxima safra), aparece em badge
          if (row.dentro_corte === false) {
            tardiosCount++;
            tardiosList.push({
              id: row.attendee_id,
              name: row.attendee_name || 'Sem nome',
              phone: row.attendee_phone,
              contractPaidAt: row.contract_paid_at,
              closerName: row.r2_closer_name,
            });
            continue;
          }
          aprovados++;
          closerStats.get(closerId)!.aprovados++;
          approvedAttendeeIds.add(row.attendee_id);
          attendeeIdToCloser.set(row.attendee_id, closerId);

          if (row.contact_email) approvedEmails.push(row.contact_email.toLowerCase());
          if (row.contact_phone) {
            const normalized = normalizePhone(row.contact_phone);
            if (normalized) approvedPhones.push(normalized);
          }
        }
      }

      const agendadosPendentes = unifiedData.length - desistentes - reprovados - reembolsosCount - proximaSemana - noShow - aprovados - tardiosCount;
      const totalLeads = agendadosPendentes + aprovados;

      // Vendas (partnership sales)
      const { data: hublaVendas } = await supabase
        .from('hubla_transactions')
        .select('id, customer_email, customer_phone, net_value, linked_attendee_id')
        .eq('product_category', 'parceria')
        .gte('sale_date', boundaries.vendasParceria.start.toISOString())
        .lte('sale_date', boundaries.vendasParceria.end.toISOString());

      const { data: vendasExtras } = await supabase
        .from('r2_vendas_extras')
        .select('*')
        .eq('week_start', format(weekStart, 'yyyy-MM-dd'));

      const matchedClosers = new Map<string, number>();
      const countedSaleKeys = new Set<string>();

      hublaVendas?.forEach(venda => {
        const vendaEmail = venda.customer_email?.toLowerCase();
        const vendaPhone = normalizePhone(venda.customer_phone);

        const emailMatch = vendaEmail && approvedEmails.includes(vendaEmail);
        const phoneMatch = vendaPhone && approvedPhones.includes(vendaPhone);
        const linkedMatch = venda.linked_attendee_id && approvedAttendeeIds.has(venda.linked_attendee_id);

        if (emailMatch || phoneMatch || linkedMatch) {
          const saleKey = vendaEmail || vendaPhone || venda.id;
          if (countedSaleKeys.has(saleKey)) return;
          countedSaleKeys.add(saleKey);

          let matchedCloserId: string | null = null;
          if (linkedMatch && venda.linked_attendee_id) {
            matchedCloserId = attendeeIdToCloser.get(venda.linked_attendee_id) || null;
          } else {
            for (const row of unifiedData) {
              if (!isAprovado(row)) continue;
              const leadEmail = row.contact_email?.toLowerCase();
              const leadPhone = normalizePhone(row.contact_phone);
              if ((vendaEmail && leadEmail === vendaEmail) || (vendaPhone && leadPhone === vendaPhone)) {
                matchedCloserId = row.r2_closer_id || null;
                break;
              }
            }
          }

          if (matchedCloserId) {
            matchedClosers.set(matchedCloserId, (matchedClosers.get(matchedCloserId) || 0) + 1);
          }
        }
      });

      const vendas = countedSaleKeys.size;
      matchedClosers.forEach((count, closerId) => {
        const stats = closerStats.get(closerId);
        if (stats) stats.vendas = count;
      });

      const reembolsos = reembolsosCount;
      const leadsPerdidosCount = desistentes + reprovados + reembolsosCount;
      const leadsPerdidosPercent = totalLeads > 0 ? (leadsPerdidosCount / totalLeads) * 100 : 0;
      const leadsAtivos = aprovados;
      const selecionados = aprovados;
      const totalVendasExtras = (vendasExtras?.length || 0);
      const totalVendas = vendas + totalVendasExtras;
      const conversaoGeral = selecionados > 0 ? (totalVendas / selecionados) * 100 : 0;

      const closerConversions: CloserConversion[] = Array.from(closerStats.entries())
        .filter(([_, stats]) => stats.aprovados > 0)
        .map(([closerId, stats]) => ({
          closerId,
          closerName: stats.name,
          closerColor: stats.color,
          aprovados: stats.aprovados,
          vendas: stats.vendas,
          conversion: stats.aprovados > 0 ? (stats.vendas / stats.aprovados) * 100 : 0,
        }))
        .sort((a, b) => b.aprovados - a.aprovados);

      return {
        totalLeads,
        leadsAtivos,
        desistentes,
        reprovados,
        reembolsos,
        proximaSemana,
        noShow,
        leadsPerdidosPercent,
        noShowAttendees,
        selecionados,
        vendas: totalVendas,
        vendasExtras: totalVendasExtras,
        conversaoGeral,
        closerConversions,
        tardios: tardiosCount,
        tardiosList,
        pendentesStatus: pendentesStatusList.length,
        pendentesStatusList,
      };
    },
    enabled: !!unifiedData,
    staleTime: 30000,
    refetchInterval: 60000,
  });
}

function emptyMetrics(): R2MetricsData {
  return {
    totalLeads: 0,
    leadsAtivos: 0,
    desistentes: 0,
    reprovados: 0,
    reembolsos: 0,
    proximaSemana: 0,
    noShow: 0,
    leadsPerdidosPercent: 0,
    noShowAttendees: [],
    selecionados: 0,
    vendas: 0,
    vendasExtras: 0,
    conversaoGeral: 0,
    closerConversions: [],
    tardios: 0,
    tardiosList: [],
    pendentesStatus: 0,
    pendentesStatusList: [],
  };
}

// Hook for adding external sales
export function useAddVendaExtra() {
  return {
    addVenda: async (data: {
      weekStart: Date;
      attendeeName: string;
      attendeePhone?: string;
      attendeeEmail?: string;
      closerId?: string;
      notes?: string;
    }) => {
      const { error } = await supabase
        .from('r2_vendas_extras')
        .insert({
          week_start: format(data.weekStart, 'yyyy-MM-dd'),
          attendee_name: data.attendeeName,
          attendee_phone: data.attendeePhone || null,
          attendee_email: data.attendeeEmail || null,
          closer_id: data.closerId || null,
          notes: data.notes || null,
        });

      if (error) throw error;
    },
  };
}
