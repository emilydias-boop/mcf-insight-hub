import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { INSIDE_SALES_ORIGIN_ID, SDR_LIST, PIPELINE_STAGES } from "@/constants/team";
import { startOfDay, endOfDay } from "date-fns";

// Helper para verificar se deal_created_at é de hoje (formato: "DD/MM/YYYY HH:mm:ss")
const isDealCreatedToday = (dealCreatedAt: string | null): boolean => {
  if (!dealCreatedAt) return false;
  
  // Formato brasileiro: "28/11/2025 00:48:06"
  const parts = dealCreatedAt.split(' ')[0]?.split('/');
  if (!parts || parts.length !== 3) return false;
  
  const [day, month, year] = parts;
  
  // Comparar apenas dia/mês/ano (sem problemas de timezone)
  const today = new Date();
  const todayDay = today.getDate();
  const todayMonth = today.getMonth() + 1; // getMonth() retorna 0-11
  const todayYear = today.getFullYear();
  
  return parseInt(day) === todayDay && 
         parseInt(month) === todayMonth && 
         parseInt(year) === todayYear;
};

// Função para determinar tipo de lead baseado na tag
const getLeadType = (contactTag: string | string[] | null): 'A' | 'B' | null => {
  if (!contactTag) return null;
  const tagStr = Array.isArray(contactTag) ? contactTag.join(' ') : String(contactTag);
  const lower = tagStr.toLowerCase();
  if (lower.includes('lead a')) return 'A';
  if (lower.includes('lead b')) return 'B';
  return null;
};

// Função para determinar tipo de lead baseado no VALOR do produto Hubla
// Lead A = R$ 497 (valor >= 450), Lead B = R$ 397 (valor >= 350)
const getLeadTypeFromHubla = (productName: string, productPrice: number | null): 'A' | 'B' | null => {
  const lower = productName.toLowerCase();
  
  // Excluir produtos que NÃO são Inside Sales
  if (lower.includes('clube do arremate')) return null;
  if (lower.includes('efeito alavanca')) return null;
  if (lower.includes('clube arremate')) return null;
  
  // Classificar por VALOR (não por nome)
  const price = productPrice || 0;
  
  // Lead A = R$ 497 (geralmente entre 450-500)
  if (price >= 450) return 'A';
  
  // Lead B = R$ 397 (geralmente entre 350-420)
  if (price >= 350) return 'B';
  
  // Valores muito baixos (recorrências, etc) = não contar
  return null;
};

interface SdrData {
  nome: string;
  email: string;
  novoLead: number;
  r1Agendada: number;
  convRate: number;
  noShow: number;
  r1Realizada: number;
  intermediacao: number;
  score: number;
  trend?: "up" | "down" | "stable";
}

export const useTVSdrData = (viewDate: Date = new Date()) => {
  const dateKey = viewDate.toISOString().split("T")[0];
  const queryClient = useQueryClient();
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  
  // Listener Realtime para webhook_events
  useEffect(() => {
    const channel = supabase
      .channel('tv-sdr-webhook-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'webhook_events'
        },
        (payload) => {
          console.log('[TV-SDR Realtime] Novo evento recebido:', payload);
          // Invalidar cache e forçar refetch
          queryClient.invalidateQueries({ queryKey: ["tv-sdr-data", dateKey] });
          setLastUpdate(new Date());
        }
      )
      .subscribe((status) => {
        console.log('[TV-SDR Realtime] Status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dateKey, queryClient]);

  const query = useQuery({
    queryKey: ["tv-sdr-data", dateKey],
    queryFn: async () => {
      const targetDate = new Date(viewDate);
      const todayStart = startOfDay(targetDate);
      const todayEnd = endOfDay(targetDate);
      const today = targetDate.toISOString().split("T")[0];

      // Calcular início do dia no timezone brasileiro (UTC-3)
      const targetBrazil = new Date(targetDate);
      targetBrazil.setHours(targetBrazil.getHours() - 3);
      const todayStartBrazil = new Date(targetBrazil);
      todayStartBrazil.setHours(3, 0, 0, 0); // 00:00 Brasil = 03:00 UTC
      const todayEndBrazil = new Date(todayStartBrazil);
      todayEndBrazil.setDate(todayEndBrazil.getDate() + 1);

      // 1. Buscar contratos pagos do Hubla (mais confiável que Clint)
      const { data: allHublaContracts } = await supabase
        .from("hubla_transactions")
        .select("customer_email, customer_name, product_name, product_price, raw_data")
        .gte("sale_date", todayStartBrazil.toISOString())
        .lt("sale_date", todayEndBrazil.toISOString())
        .eq("sale_status", "completed")
        .ilike("product_name", "%contrato%");

      // Filtrar apenas vendas NOVAS (não recorrências e não duplicados)
      const hublaContracts = allHublaContracts?.filter(contract => {
        const rawData = contract.raw_data as any;
        
        // Ignorar transações sem customer_email (newsale-xxx duplicados)
        if (!contract.customer_email) return false;
        
        const smartInstallment = rawData?.event?.invoice?.smartInstallment;
        
        // Se não tem smartInstallment = venda única (OK)
        if (!smartInstallment) return true;
        
        // Se tem smartInstallment mas é parcela 1 = primeira venda (OK)
        if (smartInstallment.installment === 1) return true;
        
        // Parcela 2, 3, 4... = recorrência (IGNORAR)
        return false;
      }) || [];

      // Contar contratos por tipo de lead (usando VALOR)
      const contratosLeadA = hublaContracts?.filter(c => 
        getLeadTypeFromHubla(c.product_name, c.product_price) === 'A'
      ).length || 0;

      const contratosLeadB = hublaContracts?.filter(c => 
        getLeadTypeFromHubla(c.product_name, c.product_price) === 'B'
      ).length || 0;

      console.log('[TV-SDR] Hubla contracts - Lead A:', contratosLeadA, 'Lead B:', contratosLeadB, 'Total filtrado:', hublaContracts.length);

      // 2. Rastrear SDR original usando APENAS emails dos contratos Hubla filtrados
      const hublaEmails = hublaContracts.map(c => c.customer_email).filter(Boolean) as string[];
      
      console.log('[TV-SDR] Emails de contratos Hubla (sem recorrências):', hublaEmails.length);

      let dealIds: string[] = [];
      
      if (hublaEmails.length > 0) {
        // Buscar eventos do Clint que correspondem aos emails do Hubla
        const { data: dealEvents } = await supabase
          .from("webhook_events")
          .select("event_data")
          .eq("event_type", "deal.stage_changed")
          .in("event_data->>contact_email", hublaEmails);

        // Extrair deal_ids únicos desses deals
        dealIds = [...new Set(
          dealEvents?.map(e => (e.event_data as any)?.deal_id).filter(Boolean) || []
        )];
      }

      console.log('[TV-SDR] Contratos Pagos hoje:', dealIds.length);

      // Buscar histórico completo de cada deal
      const sdrIntermediacao = new Map<string, number>();
      
      if (dealIds.length > 0) {
        const { data: historicos } = await supabase
          .from("webhook_events")
          .select("event_data, created_at")
          .eq("event_type", "deal.stage_changed")
          .in("event_data->>deal_id", dealIds)
          .order("created_at", { ascending: true });

        // Para cada deal, encontrar quem moveu para "Reunião 01 Agendada"
        for (const dealId of dealIds) {
          const dealHistory = historicos?.filter(h => 
            (h.event_data as any)?.deal_id === dealId
          ) || [];
          
          // Encontrar o evento de "Reunião 01 Agendada"
          const r1Event = dealHistory.find(h => 
            (h.event_data as any)?.deal_stage === PIPELINE_STAGES.R1_AGENDADA
          );
          
          if (r1Event) {
            const sdrEmail = (r1Event.event_data as any)?.deal_user;
            if (sdrEmail && SDR_LIST.some(sdr => sdr.email === sdrEmail)) {
              sdrIntermediacao.set(sdrEmail, (sdrIntermediacao.get(sdrEmail) || 0) + 1);
            }
          }
        }
      }

      console.log('[TV-SDR] Intermediações por SDR:', Array.from(sdrIntermediacao.entries()));

      // 3. USAR RPC PARA CONTORNAR LIMITE DE 1000 REGISTROS DO SUPABASE
      // A função get_tv_sdr_metrics agrega dados diretamente no banco
      const { data: sdrMetricsRpc, error: rpcError } = await supabase
        .rpc('get_tv_sdr_metrics', { target_date: today });

      if (rpcError) {
        console.error('[TV-SDR] RPC error:', rpcError);
      }

      // Converter resultado da RPC em Map para acesso rápido
      const rpcMetricsMap = new Map<string, { r1_agendada: number; r1_realizada: number; no_show: number; novo_lead: number }>();
      if (Array.isArray(sdrMetricsRpc)) {
        sdrMetricsRpc.forEach((m: any) => {
          if (m.sdr_email) {
            rpcMetricsMap.set(m.sdr_email, {
              r1_agendada: m.r1_agendada || 0,
              r1_realizada: m.r1_realizada || 0,
              no_show: m.no_show || 0,
              novo_lead: m.novo_lead || 0,
            });
          }
        });
      }

      // Calcular totais da RPC
      let totalR1Agendada = 0;
      let totalNovoLeadCount = 0;
      rpcMetricsMap.forEach((metrics) => {
        totalR1Agendada += metrics.r1_agendada;
        totalNovoLeadCount += metrics.novo_lead;
      });

      console.log('[TV-SDR] RPC metrics - Total R1 Agendada:', totalR1Agendada, 'Total Novo Lead:', totalNovoLeadCount);
      console.log('[TV-SDR] RPC metrics por SDR:', Array.from(rpcMetricsMap.entries()));

      // 4. Buscar metas da tabela team_targets
      const { data: targets } = await supabase
        .from("team_targets")
        .select("*")
        .eq("origin_id", INSIDE_SALES_ORIGIN_ID)
        .lte("week_start", today)
        .gte("week_end", today);

      // Metas DIÁRIAS (meta semanal / 7)
      const dailyTargetMap = new Map(
        targets?.map((t) => [t.target_name, Math.round(t.target_value / 7)]) || []
      );

      const totalNovoLeadMeta = dailyTargetMap.get(PIPELINE_STAGES.NOVO_LEAD) || 80;

      // 5. Calcular métricas por SDR usando dados da RPC
      const sdrsData: SdrData[] = SDR_LIST.map((sdr) => {
        const rpcMetrics = rpcMetricsMap.get(sdr.email);
        
        const novoLead = rpcMetrics?.novo_lead || 0;
        const r1Agendada = rpcMetrics?.r1_agendada || 0;
        const noShow = rpcMetrics?.no_show || 0;
        const r1Realizada = rpcMetrics?.r1_realizada || 0;
        
        // Intermediação: buscar do Map que rastreou o SDR original da R1
        const intermediacao = sdrIntermediacao.get(sdr.email) || 0;

        // Conversão: (R1 Agendada / Novo Lead) * 100
        const convRate = novoLead > 0 ? Math.round((r1Agendada / novoLead) * 100) : 0;

        // Score: priorizar intermediação e conversão
        const score = intermediacao * 20 + r1Agendada * 5 + convRate * 2;

        return {
          nome: sdr.nome,
          email: sdr.email,
          novoLead,
          r1Agendada,
          convRate,
          noShow,
          r1Realizada,
          intermediacao,
          score,
          trend: "stable",
        };
      });

      // 7. Ordenar por score
      const topSdrs = [...sdrsData].sort((a, b) => b.score - a.score).slice(0, 4);

      // 8. Buscar deals atuais para verificar deals sem closer
      const { data: deals } = await supabase
        .from("crm_deals")
        .select("*, stage:crm_stages(stage_name)")
        .eq("origin_id", INSIDE_SALES_ORIGIN_ID)
        .gte("created_at", todayStart.toISOString())
        .lte("created_at", todayEnd.toISOString());

      const dealsWithoutCloser = deals?.filter((d) => {
        const stageName = d.stage?.stage_name;
        const customFields = d.custom_fields as any;
        const closer = customFields?.deal_closer || customFields?.closer;
        return (
          (stageName === PIPELINE_STAGES.R1_REALIZADA || stageName === PIPELINE_STAGES.CONTRATO_PAGO) &&
          (!closer || closer.trim() === "")
        );
      }).length || 0;

      // 9. Preparar dados do funil separados por Lead A/B
      const funnelStages = [
        PIPELINE_STAGES.R1_AGENDADA,
        PIPELINE_STAGES.R1_REALIZADA,
        PIPELINE_STAGES.NO_SHOW,
        PIPELINE_STAGES.CONTRATO_PAGO,
      ];

      // Contar por stage E por tipo de lead (A/B)
      const stageCountsA = new Map<string, number>();
      const stageCountsB = new Map<string, number>();
      
      funnelStages.forEach(stageName => {
        const emailsInStageA = new Set<string>();
        const emailsInStageB = new Set<string>();
        
        events
          .filter(e => {
            const eventData = e.event_data as any;
            return eventData?.deal_stage === stageName;
          })
          .forEach(e => {
            const eventData = e.event_data as any;
            const email = eventData?.contact_email;
            const tag = eventData?.contact_tag;
            if (email) {
              const leadType = getLeadType(tag);
              if (leadType === 'A') {
                emailsInStageA.add(email);
              } else if (leadType === 'B') {
                emailsInStageB.add(email);
              }
            }
          });
        
        stageCountsA.set(stageName, emailsInStageA.size);
        stageCountsB.set(stageName, emailsInStageB.size);
      });

      const funnelDataA = funnelStages.map((stageName) => ({
        etapa: stageName,
        // Usar Hubla para Contrato Pago, Clint para outras etapas
        leads: stageName === PIPELINE_STAGES.CONTRATO_PAGO 
          ? contratosLeadA 
          : stageCountsA.get(stageName) || 0,
        meta: dailyTargetMap.get(stageName) || 0,
      }));

      const funnelDataB = funnelStages.map((stageName) => ({
        etapa: stageName,
        // Usar Hubla para Contrato Pago, Clint para outras etapas
        leads: stageName === PIPELINE_STAGES.CONTRATO_PAGO 
          ? contratosLeadB 
          : stageCountsB.get(stageName) || 0,
        meta: Math.round((dailyTargetMap.get(stageName) || 0) * 0.6),
      }));

      console.log('[TV-SDR] Final data:', {
        totalNovoLead: totalNovoLeadCount,
        topSdrs: topSdrs.length,
        allSdrs: sdrsData.length,
      });

      return {
        totalNovoLead: {
          valor: totalNovoLeadCount,
          meta: totalNovoLeadMeta,
        },
        funnelDataA,
        funnelDataB,
        topSdrs,
        allSdrs: sdrsData,
        dealsWithoutCloser,
      };
    },
    refetchInterval: 30000, // Auto-refresh a cada 30 segundos
    staleTime: 0, // Sempre considerar dados stale para forçar refetch
  });

  return {
    ...query,
    lastUpdate,
  };
};
