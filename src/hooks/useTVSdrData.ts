import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { INSIDE_SALES_ORIGIN_ID, PIPELINE_STAGES } from "@/constants/team";
import { startOfDay, endOfDay } from "date-fns";

// Funções isDealCreatedToday e getLeadType foram movidas para RPCs do banco
// para contornar limite de 1000 registros do Supabase client

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

      // 0. Buscar SDRs visíveis na TV do banco (em vez de SDR_LIST hardcoded)
      const { data: tvSdrs } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("show_on_tv", true)
        .not("email", "is", null)
        .ilike("email", "%@minhacasafinanciada%");

      const SDR_LIST_DYNAMIC = (tvSdrs || []).map(p => ({
        nome: p.full_name || p.email?.split('@')[0] || 'SDR',
        email: p.email || ''
      })).filter(s => s.email);

      console.log('[TV-SDR] SDRs visíveis na TV:', SDR_LIST_DYNAMIC.length);

      // 1. Buscar contratos pagos do HUBLA (fonte primária)
      const { data: hublaSourceContracts } = await supabase
        .from("hubla_transactions")
        .select("customer_email, customer_name, product_name, product_price, raw_data")
        .gte("sale_date", todayStartBrazil.toISOString())
        .lt("sale_date", todayEndBrazil.toISOString())
        .eq("sale_status", "completed")
        .eq("source", "hubla")
        .ilike("product_name", "%contrato%");

      // 2. Buscar contratos do MAKE (fallback)
      const { data: makeSourceContracts } = await supabase
        .from("hubla_transactions")
        .select("customer_email, customer_name, product_name, product_price, raw_data")
        .gte("sale_date", todayStartBrazil.toISOString())
        .lt("sale_date", todayEndBrazil.toISOString())
        .eq("sale_status", "completed")
        .eq("source", "make")
        .ilike("product_name", "%contrato%");

      // 3. Combinar: Hubla como primário, Make como fallback (só se email não existe no Hubla)
      const hublaContractEmails = new Set(
        hublaSourceContracts?.map(c => c.customer_email?.toLowerCase()).filter(Boolean) || []
      );
      
      const makeFallbackContracts = makeSourceContracts?.filter(c => {
        const email = c.customer_email?.toLowerCase();
        return email && !hublaContractEmails.has(email);
      }) || [];

      const allHublaContracts = [
        ...(hublaSourceContracts || []),
        ...makeFallbackContracts
      ];

      console.log('[TV-SDR] Contratos - Hubla:', hublaSourceContracts?.length || 0, 'Make fallback:', makeFallbackContracts.length);

      // Filtrar apenas vendas NOVAS (não recorrências, não duplicados, apenas contratos válidos)
      const hublaContracts = allHublaContracts?.filter(contract => {
        const rawData = contract.raw_data as any;
        const productName = contract.product_name?.toLowerCase() || '';
        
        // Ignorar transações sem customer_email (newsale-xxx duplicados)
        if (!contract.customer_email) return false;
        
        // EXCLUIR Sócio MCF - não é contrato Inside Sales válido
        if (productName.includes('sócio mcf') || productName.includes('socio mcf')) {
          return false;
        }
        
        // Manter apenas "A000 - Contrato" e "Contrato - Anticrise"
        const isValidContract = 
          (productName.includes('a000') && productName.includes('contrato')) ||
          (productName.includes('contrato') && productName.includes('anticrise'));
        
        if (!isValidContract) return false;
        
        const smartInstallment = rawData?.event?.invoice?.smartInstallment;
        
        // Se não tem smartInstallment = venda única (OK)
        if (!smartInstallment) return true;
        
        // Se tem smartInstallment mas é parcela 1 = primeira venda (OK)
        if (smartInstallment.installment === 1) return true;
        
        // Parcela 2, 3, 4... = recorrência (IGNORAR)
        return false;
      }) || [];

      // Deduplicar por email único (mesmo cliente = 1 contrato)
      const seenContractEmails = new Set<string>();
      const uniqueHublaContracts = hublaContracts.filter(contract => {
        const email = contract.customer_email?.toLowerCase();
        if (!email || seenContractEmails.has(email)) return false;
        seenContractEmails.add(email);
        return true;
      });

      console.log('[TV-SDR] Contratos após dedup por email:', uniqueHublaContracts.length, 'de', hublaContracts.length);

      // Contar contratos por tipo de lead (usando VALOR)
      const contratosLeadA = uniqueHublaContracts.filter(c => {
        const leadType = getLeadTypeFromHubla(c.product_name, c.product_price);
        return leadType === 'A' || leadType === 'B'; // Contar ambos como Lead A
      }).length || 0;

      console.log('[TV-SDR] Hubla contracts - Total:', contratosLeadA);

      // 2. Rastrear SDR original usando APENAS emails dos contratos únicos
      const hublaEmails = uniqueHublaContracts.map(c => c.customer_email).filter(Boolean) as string[];
      
      console.log('[TV-SDR] Emails de contratos únicos:', hublaEmails.length);

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
            if (sdrEmail && SDR_LIST_DYNAMIC.some(sdr => sdr.email === sdrEmail)) {
              sdrIntermediacao.set(sdrEmail, (sdrIntermediacao.get(sdrEmail) || 0) + 1);
            }
          }
        }
      }

      console.log('[TV-SDR] Intermediações por SDR:', Array.from(sdrIntermediacao.entries()));

      // 3. USAR RPC get_sdr_metrics_v2 (mesma que Relatórios usam)
      const { data: sdrMetricsRpc, error: rpcError } = await supabase
        .rpc('get_sdr_metrics_v2', { 
          start_date: today,
          end_date: today,
          sdr_email_filter: null
        });

      if (rpcError) {
        console.error('[TV-SDR] RPC error:', rpcError);
      }

      // 4. Buscar Novos Leads via RPC dedicada (conta leads genuinamente novos)
      // Filtrar apenas emails dos SDRs visíveis na TV
      const sdrEmails = SDR_LIST_DYNAMIC.map(sdr => sdr.email.toLowerCase());
      const { data: novoLeadRpc, error: novoLeadError } = await supabase
        .rpc('get_novo_lead_count', { target_date: today, valid_emails: sdrEmails });

      if (novoLeadError) {
        console.error('[TV-SDR] Novo Lead RPC error:', novoLeadError);
      }

      // Processar resultado de Novos Leads
      const novoLeadResult = novoLeadRpc as { total: number; por_sdr: { sdr_email: string; count: number }[] } | null;
      const totalNovoLeadCount = novoLeadResult?.total || 0;
      
      // Map de Novo Lead por SDR
      const novoLeadPorSdr = new Map<string, number>();
      if (novoLeadResult?.por_sdr && Array.isArray(novoLeadResult.por_sdr)) {
        novoLeadResult.por_sdr.forEach((item) => {
          if (item.sdr_email) {
            novoLeadPorSdr.set(item.sdr_email.toLowerCase(), item.count);
          }
        });
      }

      console.log('[TV-SDR] Novos Leads - Total:', totalNovoLeadCount, 'Por SDR:', Array.from(novoLeadPorSdr.entries()));

      // Converter resultado da RPC em Map para acesso rápido
      const rpcMetricsMap = new Map<string, { 
        r1_agendada: number; 
        r1_realizada: number; 
        no_show: number; 
        primeiro_agendamento: number;
        reagendamento: number;
      }>();
      
      const metricsResult = sdrMetricsRpc as unknown as { metrics: any[] };
      if (metricsResult?.metrics && Array.isArray(metricsResult.metrics)) {
        metricsResult.metrics.forEach((m: any) => {
          if (m.sdr_email) {
            rpcMetricsMap.set(m.sdr_email, {
              r1_agendada: m.total_agendamentos || 0,
              r1_realizada: m.realizadas || 0,
              no_show: m.no_shows || 0,
              primeiro_agendamento: m.primeiro_agendamento || 0,
              reagendamento: m.reagendamento || 0,
            });
          }
        });
      }

      // Calcular totais da RPC
      let totalR1Agendada = 0;
      rpcMetricsMap.forEach((metrics) => {
        totalR1Agendada += metrics.r1_agendada;
      });

      console.log('[TV-SDR] RPC metrics (v2) - Total R1 Agendada:', totalR1Agendada);
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
      const sdrsData: SdrData[] = SDR_LIST_DYNAMIC.map((sdr) => {
        const rpcMetrics = rpcMetricsMap.get(sdr.email);
        
        // Novo Lead: buscar da RPC get_novo_lead_count
        const novoLead = novoLeadPorSdr.get(sdr.email.toLowerCase()) || 0;
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

      // 9. Buscar métricas do funil via RPC
      const { data: funnelMetricsRpc } = await supabase
        .rpc('get_tv_funnel_metrics', { target_date: today });

      // Processar resultado da RPC do funil
      const stageCountsA = new Map<string, number>();
      
      if (Array.isArray(funnelMetricsRpc)) {
        funnelMetricsRpc.forEach((m: any) => {
          stageCountsA.set(m.stage_name, (stageCountsA.get(m.stage_name) || 0) + (m.unique_leads || 0));
        });
      }

      console.log('[TV-SDR] Funnel RPC:', Array.from(stageCountsA.entries()));

      const funnelStages = [
        PIPELINE_STAGES.R1_AGENDADA,
        PIPELINE_STAGES.R1_REALIZADA,
        PIPELINE_STAGES.NO_SHOW,
        PIPELINE_STAGES.CONTRATO_PAGO,
      ];

      const funnelDataA = funnelStages.map((stageName) => ({
        etapa: stageName,
        // Usar Hubla para Contrato Pago, Clint para outras etapas
        leads: stageName === PIPELINE_STAGES.CONTRATO_PAGO 
          ? contratosLeadA 
          : stageCountsA.get(stageName) || 0,
        meta: dailyTargetMap.get(stageName) || 0,
      }));

      console.log('[TV-SDR] Final data:', {
        totalNovoLead: totalNovoLeadCount,
        topSdrs: topSdrs.length,
        allSdrs: sdrsData.length,
        funnelDataA,
      });

      return {
        totalNovoLead: {
          valor: totalNovoLeadCount,
          meta: totalNovoLeadMeta,
        },
        funnelDataA,
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
