import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { INSIDE_SALES_ORIGIN_ID, SDR_LIST } from "@/constants/team";
import { startOfWeek, endOfWeek } from "date-fns";

interface SdrData {
  nome: string;
  email: string;
  novoLead: number;
  r1Agendada: number;
  r1Realizada: number;
  noShow: number;
  convRate: number;
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

      // Buscar funil Lead A
      const { data: funnelA } = await supabase
        .from("crm_stages")
        .select("*")
        .eq("origin_id", INSIDE_SALES_ORIGIN_ID)
        .eq("is_active", true)
        .order("stage_order");

      // Buscar funil Lead B (mesmo funil, mas separado por custom_fields)
      const funnelB = funnelA || [];

      // Buscar deals da semana para calcular performance
      const { data: deals } = await supabase
        .from("crm_deals")
        .select("*, stage:crm_stages(stage_name), contact:crm_contacts(custom_fields)")
        .eq("origin_id", INSIDE_SALES_ORIGIN_ID)
        .gte("created_at", weekStart.toISOString())
        .lte("created_at", weekEnd.toISOString());

      // Buscar atividades da semana
      const { data: activities } = await supabase
        .from("deal_activities")
        .select("*, deal:crm_deals(contact_id, custom_fields)")
        .gte("created_at", weekStart.toISOString())
        .lte("created_at", weekEnd.toISOString());

      // Calcular performance individual de cada SDR
      const sdrsData: SdrData[] = SDR_LIST.map((sdr) => {
        // Filtrar deals deste SDR
        const sdrDeals = deals?.filter((d) => {
          const customFields = d.contact?.custom_fields as any;
          return customFields?.user_email === sdr.email;
        }) || [];

        // Calcular métricas
        const novoLead = sdrDeals.length;
        const r1Agendada = sdrDeals.filter((d) => d.stage?.stage_name === "R1 Agendada").length;
        const r1Realizada = sdrDeals.filter((d) => d.stage?.stage_name === "R1 Realizada").length;
        const noShow = sdrDeals.filter((d) => d.stage?.stage_name === "No-Show").length;
        const convRate = r1Agendada > 0 ? Math.round((r1Realizada / r1Agendada) * 100) : 0;

        // Calcular score (fórmula simples: R1R * 10 + ConvRate * 2)
        const score = r1Realizada * 10 + convRate * 2;

        return {
          nome: sdr.nome,
          email: sdr.email,
          novoLead,
          r1Agendada,
          r1Realizada,
          noShow,
          convRate,
          score,
          trend: "stable", // TODO: calcular trend comparando com semana anterior
        };
      });

      // Ordenar por score
      const topSdrs = [...sdrsData].sort((a, b) => b.score - a.score).slice(0, 4);

      // Preparar dados do funil
      const funnelDataA = funnelA?.map((stage) => ({
        etapa: stage.stage_name,
        leads: deals?.filter((d) => d.stage_id === stage.id)?.length || 0,
        meta: 50, // TODO: buscar meta da tabela team_targets
      })) || [];

      const funnelDataB = funnelB?.map((stage) => ({
        etapa: stage.stage_name,
        leads: deals?.filter((d) => d.stage_id === stage.id)?.length || 0,
        meta: 30, // TODO: buscar meta da tabela team_targets
      })) || [];

      return {
        funnelDataA,
        funnelDataB,
        topSdrs,
        allSdrs: sdrsData,
      };
    },
    refetchInterval: 30000, // Auto-refresh a cada 30 segundos
  });
};
