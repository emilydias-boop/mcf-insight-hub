import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { INSIDE_SALES_ORIGIN_ID, SDR_LIST, PIPELINE_STAGES } from "@/constants/team";
import { startOfWeek, endOfWeek } from "date-fns";

interface SdrData {
  nome: string;
  email: string;
  novoLead: number;
  r1Agendada: number;
  convRate: number; // (R1 Agendada / Novo Lead) * 100
  noShow: number;
  r1Realizada: number;
  intermediacao: number; // Deals em "Contrato Pago"
  score: number;
  trend?: "up" | "down" | "stable";
}

export const useTVSdrData = () => {
  return useQuery({
    queryKey: ["tv-sdr-data"],
    queryFn: async () => {
      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

      // Buscar stages da origem Inside Sales
      const { data: stages } = await supabase
        .from("crm_stages")
        .select("*")
        .eq("origin_id", INSIDE_SALES_ORIGIN_ID)
        .eq("is_active", true)
        .order("stage_order");

      // Mapear stages por nome
      const stageMap = new Map(stages?.map((s) => [s.stage_name, s.id]) || []);

      // Buscar deals da semana
      const { data: deals } = await supabase
        .from("crm_deals")
        .select("*, stage:crm_stages(stage_name), contact:crm_contacts(custom_fields)")
        .eq("origin_id", INSIDE_SALES_ORIGIN_ID)
        .gte("created_at", weekStart.toISOString())
        .lte("created_at", weekEnd.toISOString());

      // Buscar metas da tabela team_targets
      const { data: targets } = await supabase
        .from("team_targets")
        .select("*")
        .eq("origin_id", INSIDE_SALES_ORIGIN_ID)
        .gte("week_start", weekStart.toISOString().split("T")[0])
        .lte("week_end", weekEnd.toISOString().split("T")[0]);

      // Mapear metas por target_name
      const targetMap = new Map(targets?.map((t) => [t.target_name, t.target_value]) || []);

      // Calcular performance individual de cada SDR
      const sdrsData: SdrData[] = SDR_LIST.map((sdr) => {
        // Filtrar deals deste SDR
        const sdrDeals = deals?.filter((d) => {
          const customFields = d.custom_fields as any;
          return customFields?.user_email === sdr.email;
        }) || [];

        // Calcular métricas por stage
        const novoLead = sdrDeals.filter((d) => d.stage?.stage_name === PIPELINE_STAGES.NOVO_LEAD).length;
        const r1Agendada = sdrDeals.filter((d) => d.stage?.stage_name === PIPELINE_STAGES.R1_AGENDADA).length;
        const noShow = sdrDeals.filter((d) => d.stage?.stage_name === PIPELINE_STAGES.NO_SHOW).length;
        const r1Realizada = sdrDeals.filter((d) => d.stage?.stage_name === PIPELINE_STAGES.R1_REALIZADA).length;
        const intermediacao = sdrDeals.filter((d) => d.stage?.stage_name === PIPELINE_STAGES.CONTRATO_PAGO).length;

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

      // Ordenar por score
      const topSdrs = [...sdrsData].sort((a, b) => b.score - a.score).slice(0, 4);

      // Contar deals sem closer (em R1 Realizada ou Contrato Pago)
      const dealsWithoutCloser = deals?.filter((d) => {
        const stageName = d.stage?.stage_name;
        const closer = (d.custom_fields as any)?.closer;
        return (
          (stageName === PIPELINE_STAGES.R1_REALIZADA || stageName === PIPELINE_STAGES.CONTRATO_PAGO) &&
          (!closer || closer.trim() === "")
        );
      }).length || 0;

      // Preparar dados do funil (usando metas reais)
      const funnelStages = [
        PIPELINE_STAGES.NOVO_LEAD,
        PIPELINE_STAGES.R1_AGENDADA,
        PIPELINE_STAGES.R1_REALIZADA,
        PIPELINE_STAGES.NO_SHOW,
        PIPELINE_STAGES.CONTRATO_PAGO,
      ];

      const funnelDataA = funnelStages.map((stageName) => ({
        etapa: stageName,
        leads: deals?.filter((d) => d.stage?.stage_name === stageName).length || 0,
        meta: targetMap.get(stageName) || 0,
      }));

      const funnelDataB = funnelStages.map((stageName) => ({
        etapa: stageName,
        leads: 0, // TODO: separar por perfil Lead A/B quando campo estiver disponível
        meta: Math.round((targetMap.get(stageName) || 0) * 0.6), // 60% da meta de Lead A
      }));

      return {
        funnelDataA,
        funnelDataB,
        topSdrs,
        allSdrs: sdrsData,
        dealsWithoutCloser,
      };
    },
    refetchInterval: 30000, // Auto-refresh a cada 30 segundos
  });
};
