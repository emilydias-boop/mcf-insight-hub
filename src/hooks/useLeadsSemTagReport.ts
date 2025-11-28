import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface LeadSemTag {
  nome: string;
  email: string;
  telefone: string;
  tags: string[];
  sdr: string;
  data: string;
  dealId: string;
  clintId: string;
}

interface ReportData {
  total: number;
  leads: LeadSemTag[];
}

interface SavedReport {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  data: ReportData;
  created_at: string;
  created_by: string | null;
}

export function useLeadsSemTagReport(startDate?: Date, endDate?: Date) {
  return useQuery({
    queryKey: ["leads-sem-tag-report", startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      if (!startDate || !endDate) return null;

      console.log('[Relatório] Buscando R1 Agendadas entre', startDate, endDate);

      // Buscar eventos de R1 Agendada no período
      const { data: r1Events, error } = await supabase
        .from("webhook_events")
        .select("event_data, created_at")
        .eq("event_type", "deal.stage_changed")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      if (error) {
        console.error('[Relatório] Erro ao buscar eventos:', error);
        throw error;
      }

      console.log('[Relatório] Total de eventos encontrados:', r1Events?.length);

      // Filtrar apenas os que mudaram para "Reunião 01 Agendada"
      const r1AgendadaEvents = r1Events?.filter(e => {
        const eventData = e.event_data as any;
        return eventData?.deal_stage === "Reunião 01 Agendada" &&
               eventData?.deal_origin === "PIPELINE INSIDE SALES";
      }) || [];

      console.log('[Relatório] R1 Agendadas encontradas:', r1AgendadaEvents.length);

      // Filtrar os que NÃO têm tag Lead A, Lead B ou Lead C
      const leadsSemTag: LeadSemTag[] = r1AgendadaEvents
        .filter(e => {
          const eventData = e.event_data as any;
          const tags = eventData?.contact_tag || [];
          const hasLeadTag = tags.some((t: string) => 
            t.includes('Lead A') || t.includes('Lead B') || t.includes('Lead C')
          );
          return !hasLeadTag;
        })
        .map(e => {
          const eventData = e.event_data as any;
          return {
            nome: eventData?.contact_name || 'Sem nome',
            email: eventData?.contact_email || 'Sem email',
            telefone: eventData?.contact_phone || 'Sem telefone',
            tags: eventData?.contact_tag || [],
            sdr: eventData?.deal_user || 'Sem SDR',
            data: e.created_at,
            dealId: eventData?.deal_id || '',
            clintId: eventData?.clint_id || ''
          };
        });

      console.log('[Relatório] Leads sem tag Lead A/B/C:', leadsSemTag.length);

      return {
        total: leadsSemTag.length,
        leads: leadsSemTag
      } as ReportData;
    },
    enabled: !!startDate && !!endDate
  });
}

export function useSavedReports() {
  return useQuery({
    queryKey: ["saved-reports-leads-sem-tag"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .eq("type", "leads_sem_tag_r1")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return data;
    }
  });
}

export function useSaveReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      name,
      startDate,
      endDate,
      data
    }: {
      name: string;
      startDate: Date;
      endDate: Date;
      data: ReportData;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase.from("reports").insert({
        name,
        type: "leads_sem_tag_r1",
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        data: data as any,
        created_by: userData.user?.id
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-reports-leads-sem-tag"] });
      toast({
        title: "Relatório salvo",
        description: "O relatório foi salvo com sucesso"
      });
    },
    onError: () => {
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar o relatório",
        variant: "destructive"
      });
    }
  });
}

export function useDeleteReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reportId: string) => {
      const { error } = await supabase
        .from("reports")
        .delete()
        .eq("id", reportId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-reports-leads-sem-tag"] });
      toast({
        title: "Relatório excluído",
        description: "O relatório foi excluído com sucesso"
      });
    },
    onError: () => {
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir o relatório",
        variant: "destructive"
      });
    }
  });
}
