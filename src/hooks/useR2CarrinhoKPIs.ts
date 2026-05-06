import { useCarrinhoUnifiedData, isAprovado, isForaDoCarrinho, isPendente, isEmAnalise, isAgendada, isRealizada, isCarrinhoEligible, isProximaSafra, CarrinhoLeadRow } from '@/hooks/useCarrinhoUnifiedData';
import { CarrinhoConfig } from '@/hooks/useCarrinhoConfig';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays } from 'date-fns';
import { getCarrinhoMetricBoundaries } from '@/lib/carrinhoWeekBoundaries';
import { useR2PendingLeadsBreakdown } from '@/hooks/useR2PendingLeads';

export interface R2CarrinhoKPIs {
  contratosPagos: number;
  /** Contratos desta safra cujo lead já havia comprado parceria na janela
   *  `vendasParceria` da semana ANTERIOR (Sex passada 12:00 → Seg desta semana 23:59).
   *  Explica por que esses leads aparecem em "Contratos novos" mesmo já sendo parceiros. */
  contratosComParceriaSemanaAnterior: number;
  /** Leads que entraram nesta safra mas o contrato foi pago em semanas anteriores. */
  semanasAnteriores: number;
  /** Quebra dos "Semanas Anteriores" pelo bucket operacional atual em que estão. */
  semanasAnterioresRealizadas: number;
  semanasAnterioresAgendadas: number;
  semanasAnterioresNoShow: number;
  semanasAnterioresForaDoCarrinho: number;
  /** Leads de semanas anteriores que não caem em nenhum dos 4 buckets (ex.: rescheduled, sem status). */
  semanasAnterioresOutros: number;
  /** Leads desta safra que foram empurrados para a próxima semana (status ou agendamento). */
  proximaSemana: number;
  r2Agendadas: number;
  /** Pendentes de agendamento (Contrato Pago sem R2 marcada). Realtime via useR2PendingLeads. */
  pendentesAgendamento: number;
  /** Quantos dos pendentes vieram de semanas anteriores (contrato pago antes do corte de abertura desta safra). */
  pendentesAgendamentoSemanasAnteriores: number;
  r2Realizadas: number;
  /** No-Shows da janela operacional do carrinho. */
  noShowR2: number;
  /** Reembolsos Hubla na safra (mesma janela de contratos). */
  reembolsos: number;
  /** Status R2 = "Desistente" na janela operacional. */
  desistentes: number;
  foraDoCarrinho: number;
  aprovados: number;
  aprovadosForaCorte: number;
  pendentes: number;
  emAnalise: number;
  /** Indicadores de PARCERIA por bucket: leads que também compraram A001-A009/R001/INCORPORADOR/Renovação/Parceria na janela. */
  parceriaR2Agendadas: number;
  parceriaR2Realizadas: number;
  parceriaNoShowR2: number;
  parceriaPendentes: number;
  parceriaAprovados: number;
  parceriaForaDoCarrinho: number;
}

export function useR2CarrinhoKPIs(weekStart: Date, weekEnd: Date, carrinhoConfig?: CarrinhoConfig, previousConfig?: CarrinhoConfig) {
  const { data: unifiedData, isLoading: unifiedLoading } = useCarrinhoUnifiedData(weekStart, weekEnd, carrinhoConfig, previousConfig);
  // Cutoff de abertura operacional desta safra (Sex 12:00 da semana anterior).
  // Usado para determinar "semana anterior" tanto em sub-cards quanto no breakdown dos Pendentes.
  // Regra: o ciclo do carrinho ABRE no corte da sexta — quem pagou contrato antes desse corte
  // (mesmo na própria quinta da safra) é considerado "vindo de semana anterior".
  const previousCutoffForPending = useMemo(
    () => getCarrinhoMetricBoundaries(weekStart, weekEnd, carrinhoConfig, previousConfig).previousCutoff,
    [weekStart, weekEnd, carrinhoConfig, previousConfig]
  );
  const pendentesBreakdown = useR2PendingLeadsBreakdown(previousCutoffForPending);
  
  // Contratos pagos still comes from hubla_transactions (not part of the RPC)
  const cutoffKey = carrinhoConfig?.carrinhos?.[0]?.horario_corte || '12:00';
  const prevCutoffKey = previousConfig?.carrinhos?.[0]?.horario_corte || '12:00';
  const cutoffDayKey = carrinhoConfig?.carrinhos?.[0]?.dia_corte ?? carrinhoConfig?.carrinhos?.[0]?.dias?.join(',') ?? 'default';
  const prevCutoffDayKey = previousConfig?.carrinhos?.[0]?.dia_corte ?? previousConfig?.carrinhos?.[0]?.dias?.join(',') ?? 'default';
  
  const { data: contratosData, isLoading: contratosLoading } = useQuery({
    queryKey: ['r2-carrinho-contratos', format(weekStart, 'yyyy-MM-dd'), format(weekEnd, 'yyyy-MM-dd'), cutoffDayKey, cutoffKey, prevCutoffDayKey, prevCutoffKey],
    queryFn: async (): Promise<{ contratos: number; reembolsos: number; partnerEmails: string[]; contratosComParceriaSemanaAnterior: number }> => {
      const boundaries = getCarrinhoMetricBoundaries(weekStart, weekEnd, carrinhoConfig, previousConfig);
      // Janela de parceria da SEMANA ANTERIOR (Sex passada 12:00 → Seg desta semana 23:59
      // da safra anterior). Usada para detectar contratos novos desta safra cujo lead
      // já havia comprado parceria contabilizada no carrinho passado.
      const prevWeekStart = subDays(weekStart, 7);
      const prevWeekEnd = subDays(weekEnd, 7);
      const prevBoundaries = getCarrinhoMetricBoundaries(prevWeekStart, prevWeekEnd, previousConfig, undefined);
      
      const { data: contratosTx } = await supabase
        .from('hubla_transactions')
        .select('customer_email, hubla_id, source, product_name, installment_number, sale_status')
        .eq('product_name', 'A000 - Contrato')
        .in('sale_status', ['completed', 'refunded'])
        .in('source', ['hubla', 'manual', 'make', 'mcfpay', 'kiwify'])
        .gte('sale_date', boundaries.contratos.start.toISOString())
        .lte('sale_date', boundaries.contratos.end.toISOString());

      const validTx = (contratosTx || []).filter(t => {
        if (t.hubla_id?.startsWith('newsale-')) return false;
        if (t.source === 'make' && t.product_name?.toLowerCase() === 'contrato') return false;
        if (t.installment_number && t.installment_number > 1) return false;
        return true;
      });

      // Buscar emails que também compraram produto de PARCERIA/RENOVAÇÃO na mesma safra.
      // Esses clientes são tratados como recorrência/parceiro pela Hubla e devem ser
      // excluídos da contagem de "Contratos novos" (regra: Partner/renewal products
      // A001-A009, R001, INCORPORADOR são excluídos das métricas).
      const { data: partnerTx } = await supabase
        .from('hubla_transactions')
        .select('customer_email, hubla_id, source, product_name, installment_number, sale_status')
        .eq('sale_status', 'completed')
        .in('source', ['hubla', 'manual', 'make', 'mcfpay', 'kiwify'])
        .or(
          'product_name.ilike.A001%,product_name.ilike.A002%,product_name.ilike.A003%,' +
          'product_name.ilike.A004%,product_name.ilike.A005%,product_name.ilike.A006%,' +
          'product_name.ilike.A007%,product_name.ilike.A008%,product_name.ilike.A009%,' +
          'product_name.ilike.R001%,product_name.ilike.INCORPORADOR%,' +
          'product_name.ilike.%Renovação%,product_name.ilike.%Renovacao%,' +
          'product_name.ilike.Parceria%'
        )
        .gte('sale_date', boundaries.contratos.start.toISOString())
        .lte('sale_date', boundaries.contratos.end.toISOString());

      const partnerEmails = new Set<string>();
      for (const tx of partnerTx || []) {
        if (tx.hubla_id?.startsWith('newsale-')) continue;
        if (tx.installment_number && tx.installment_number > 1) continue;
        const email = (tx.customer_email || '').toLowerCase().trim();
        if (email) partnerEmails.add(email);
      }

      // Parcerias compradas na janela `vendasParceria` da semana ANTERIOR.
      const { data: prevWeekPartnerTx } = await supabase
        .from('hubla_transactions')
        .select('customer_email, hubla_id, source, product_name, installment_number, sale_status')
        .eq('sale_status', 'completed')
        .in('source', ['hubla', 'manual', 'make', 'mcfpay', 'kiwify'])
        .or(
          'product_name.ilike.A001%,product_name.ilike.A002%,product_name.ilike.A003%,' +
          'product_name.ilike.A004%,product_name.ilike.A005%,product_name.ilike.A006%,' +
          'product_name.ilike.A007%,product_name.ilike.A008%,product_name.ilike.A009%,' +
          'product_name.ilike.R001%,product_name.ilike.INCORPORADOR%,' +
          'product_name.ilike.%Renovação%,product_name.ilike.%Renovacao%,' +
          'product_name.ilike.Parceria%'
        )
        .gte('sale_date', prevBoundaries.vendasParceria.start.toISOString())
        .lte('sale_date', prevBoundaries.vendasParceria.end.toISOString());

      const prevWeekPartnerEmails = new Set<string>();
      for (const tx of prevWeekPartnerTx || []) {
        if (tx.hubla_id?.startsWith('newsale-')) continue;
        if (tx.installment_number && tx.installment_number > 1) continue;
        const email = (tx.customer_email || '').toLowerCase().trim();
        if (email) prevWeekPartnerEmails.add(email);
      }

      const emailMap = new Map<string, boolean>();
      const refundEmails = new Set<string>();
      for (const tx of validTx) {
        const email = (tx.customer_email || '').toLowerCase().trim();
        if (!email) continue;
        // Excluir clientes que também compraram produto de parceria/renovação na safra.
        if (partnerEmails.has(email)) continue;
        emailMap.set(email, true);
        if (tx.sale_status === 'refunded') refundEmails.add(email);
      }
      // Contar quantos dos contratos desta safra têm parceria atribuída à semana anterior.
      let contratosComParceriaSemanaAnterior = 0;
      for (const email of emailMap.keys()) {
        if (prevWeekPartnerEmails.has(email)) contratosComParceriaSemanaAnterior++;
      }
      return {
        contratos: emailMap.size,
        reembolsos: refundEmails.size,
        partnerEmails: Array.from(partnerEmails),
        contratosComParceriaSemanaAnterior,
      };
    },
    staleTime: 30000,
  });

  // Derive KPIs from unified data
  const kpis = useMemo((): R2CarrinhoKPIs | undefined => {
    if (!unifiedData) return undefined;

    // Set de emails de parceiros: leads cujo email aparece aqui são EXCLUÍDOS
    // de TODOS os KPIs operacionais (regra core: parceiros não entram em métricas).
    const partnerEmailsSet = new Set<string>(contratosData?.partnerEmails ?? []);

    let r2Agendadas = 0;
    let r2Realizadas = 0;
    let foraDoCarrinho = 0;
    let aprovados = 0;
    let aprovadosForaCorte = 0;
    let pendentes = 0;
    let emAnalise = 0;
    let semanasAnteriores = 0;
    let semanasAnterioresRealizadas = 0;
    let semanasAnterioresAgendadas = 0;
    let semanasAnterioresNoShow = 0;
    let semanasAnterioresForaDoCarrinho = 0;
    let semanasAnterioresOutros = 0;
    let proximaSemana = 0;
    let noShowR2 = 0;
    let desistentes = 0;
    // Indicadores de parceria por bucket: parceiros AGORA aparecem nos KPIs (não são mais excluídos);
    // contamos quantos de cada bucket também compraram parceria para mostrar como sub-indicador.
    let parceriaR2Agendadas = 0;
    let parceriaR2Realizadas = 0;
    let parceriaNoShowR2 = 0;
    let parceriaPendentes = 0;
    let parceriaAprovados = 0;
    let parceriaForaDoCarrinho = 0;

    // Janela operacional (corte anterior → corte atual) para R2 agendadas/realizadas/fora.
    // Para "semana anterior" usamos o `previousCutoff` (Sex 12:00) — o carrinho abre no corte da sexta.
    const { carrinhoOperacional, previousCutoff } = getCarrinhoMetricBoundaries(weekStart, weekEnd, carrinhoConfig, previousConfig);
    const opStart = carrinhoOperacional.start.getTime();
    const opEnd = carrinhoOperacional.end.getTime();
    const prevCutoffTs = previousCutoff.getTime();
    const inOperationalWindow = (row: CarrinhoLeadRow) => {
      if (row.is_encaixado) return true;
      if (!row.scheduled_at) return false;
      const t = new Date(row.scheduled_at).getTime();
      return t >= opStart && t < opEnd;
    };
    const isAfterCurrentCutoff = (row: CarrinhoLeadRow) => {
      if (!row.scheduled_at) return false;
      return new Date(row.scheduled_at).getTime() >= opEnd;
    };
    const statusContains = (row: CarrinhoLeadRow, needle: string) => {
      return (row.r2_status_name || '').toLowerCase().includes(needle);
    };

    // 'rescheduled' incluído: quando o attendee foi remarcado, o status do attendee fica
    // 'rescheduled' mesmo quando o slot novo está ativo (meeting_status = 'scheduled').
    // O isAgendada(row) já garante que o slot atual não foi cancelado/desmarcado,
    // então tratamos esse caso como agendamento válido. Sem isso, o lead some do KPI
    // R2 Agendadas e cai no bucket "Outros" de Semanas Anteriores (caso Alexandre Donizete).
    const SCHEDULED_STATES = new Set(['invited', 'scheduled', 'pending', 'pre_scheduled', 'rescheduled']);
    for (const row of unifiedData) {
      // Parceiros NÃO são mais excluídos dos KPIs operacionais — apenas marcamos
      // a flag para incrementar os contadores de "Parceria" em cada bucket.
      // (A exclusão de parceiros do `contratosPagos` continua na query, pois
      // contratos novos não devem incluir quem comprou parceria/renovação.)
      const rowEmail = (row.contact_email || '').toLowerCase().trim();
      const isParceria = !!rowEmail && partnerEmailsSet.has(rowEmail);

      const opOk = inOperationalWindow(row);
      // R2 Agendadas: apenas pendentes (ainda não realizadas / no-show / contrato)
      if (opOk && isAgendada(row) && SCHEDULED_STATES.has((row.attendee_status || '').toLowerCase())) {
        r2Agendadas++;
        if (isParceria) parceriaR2Agendadas++;
      }
      if (opOk && isRealizada(row)) {
        r2Realizadas++;
        if (isParceria) parceriaR2Realizadas++;
      }
      if (opOk && isForaDoCarrinho(row)) {
        foraDoCarrinho++;
        if (isParceria) parceriaForaDoCarrinho++;
      }
      if (isCarrinhoEligible(row)) {
        aprovados++;
        if (isParceria) parceriaAprovados++;
      }
      else if (isProximaSafra(row)) aprovadosForaCorte++;
      if (isPendente(row)) {
        pendentes++;
        if (isParceria) parceriaPendentes++;
      }
      if (isEmAnalise(row)) emAnalise++;

      // Semanas Anteriores: R2 nesta janela operacional, mas contrato pago ANTES do corte de abertura desta safra (Sex 12:00).
      if (opOk && row.effective_contract_date) {
        const contractTs = new Date(row.effective_contract_date).getTime();
        if (contractTs < prevCutoffTs) {
          semanasAnteriores++;
          // Sub-quebra pelo bucket operacional onde o lead aparece hoje.
          // Garantia: a soma dos sub-buckets bate com o total via o bucket "Outros".
          if (isRealizada(row)) {
            semanasAnterioresRealizadas++;
          } else if (
            (row.attendee_status || '').toLowerCase() === 'no_show' ||
            (row.meeting_status || '').toLowerCase() === 'no_show'
          ) {
            semanasAnterioresNoShow++;
          } else if (isForaDoCarrinho(row)) {
            semanasAnterioresForaDoCarrinho++;
          } else if (isAgendada(row) && SCHEDULED_STATES.has((row.attendee_status || '').toLowerCase())) {
            semanasAnterioresAgendadas++;
          } else {
            semanasAnterioresOutros++;
          }
        }
      }

      // Próxima Semana: status R2 = "próxima semana" OU agendado após o corte atual (próxima janela).
      const status = (row.attendee_status || '').toLowerCase();
      const isCancelledLike = status === 'cancelled' || status === 'rescheduled';
      if (!isCancelledLike && (statusContains(row, 'próxima semana') || statusContains(row, 'proxima semana') || isAfterCurrentCutoff(row))) {
        proximaSemana++;
      }

      // No-Show R2: realtime — janela operacional, attendee/meeting status no_show.
      if (opOk && (status === 'no_show' || (row.meeting_status || '').toLowerCase() === 'no_show')) {
        noShowR2++;
        if (isParceria) parceriaNoShowR2++;
      }

      // Desistente: status R2 contém "desistente" na janela operacional.
      if (opOk && statusContains(row, 'desistente')) desistentes++;
    }

    return {
      contratosPagos: contratosData?.contratos ?? 0,
      semanasAnteriores,
      semanasAnterioresRealizadas,
      semanasAnterioresAgendadas,
      semanasAnterioresNoShow,
      semanasAnterioresForaDoCarrinho,
      semanasAnterioresOutros,
      proximaSemana,
      r2Agendadas,
      pendentesAgendamento: pendentesBreakdown.total,
      pendentesAgendamentoSemanasAnteriores: pendentesBreakdown.semanasAnteriores,
      r2Realizadas,
      noShowR2,
      reembolsos: contratosData?.reembolsos ?? 0,
      desistentes,
      foraDoCarrinho,
      aprovados,
      aprovadosForaCorte,
      pendentes,
      emAnalise,
      parceriaR2Agendadas,
      parceriaR2Realizadas,
      parceriaNoShowR2,
      parceriaPendentes,
      parceriaAprovados,
      parceriaForaDoCarrinho,
    };
  }, [unifiedData, contratosData, pendentesBreakdown.total, pendentesBreakdown.semanasAnteriores, weekStart, weekEnd, carrinhoConfig, previousConfig]);

  return {
    data: kpis,
    isLoading: unifiedLoading || contratosLoading,
    refetch: () => {},
  };
}
