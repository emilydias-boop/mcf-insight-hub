import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";

// Stage name patterns for classification
const STAGE_PATTERNS = {
  agendada: ['reunião', 'r1', 'r2'].map(s => `${s}.*agendada`),
  realizada: ['reunião', 'r1', 'r2'].map(s => `${s}.*realizada`),
  noShow: ['no-show', 'no show', 'noshow'],
  contratoPago: ['contrato.*pago', 'contrato pago']
};

const matchesPattern = (stageName: string, patterns: string[]): boolean => {
  const normalized = stageName.toLowerCase();
  return patterns.some(pattern => {
    const regex = new RegExp(pattern, 'i');
    return regex.test(normalized);
  });
};

const classifyStage = (stageName: string): 'agendada' | 'realizada' | 'noShow' | 'contratoPago' | 'other' => {
  if (matchesPattern(stageName, STAGE_PATTERNS.agendada)) return 'agendada';
  if (matchesPattern(stageName, STAGE_PATTERNS.realizada)) return 'realizada';
  if (matchesPattern(stageName, STAGE_PATTERNS.noShow)) return 'noShow';
  if (matchesPattern(stageName, STAGE_PATTERNS.contratoPago)) return 'contratoPago';
  return 'other';
};

export interface MeetingFilters {
  startDate?: Date;
  endDate?: Date;
  resultado?: 'pendente' | 'realizada' | 'no_show' | 'reagendada' | 'all';
  originId?: string;
}

export interface Meeting {
  id: string;
  dealId: string;
  dealName: string;
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  originId: string | null;
  originName: string;
  currentStage: string;
  currentStageClassification: 'agendada' | 'realizada' | 'noShow' | 'contratoPago' | 'other';
  scheduledDate: string | null;
  probability: number | null;
  timeToSchedule: number | null; // in hours
  timeToContract: number | null; // in hours
  createdAt: string;
}

export interface MeetingSummary {
  reunioesAgendadas: number;
  reunioesRealizadas: number;
  noShows: number;
  taxaConversao: number;
}

export interface DealTimelineEvent {
  id: string;
  stageName: string;
  stageClassification: 'agendada' | 'realizada' | 'noShow' | 'contratoPago' | 'other';
  date: string;
  completed: boolean;
}

export const useSdrMeetings = (filters: MeetingFilters = {}) => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['sdr-meetings', user?.email, filters],
    queryFn: async () => {
      if (!user?.email) return { meetings: [], summary: { reunioesAgendadas: 0, reunioesRealizadas: 0, noShows: 0, taxaConversao: 0 } };
      
      // Get deals owned by current SDR
      let query = supabase
        .from('crm_deals')
        .select(`
          id,
          clint_id,
          name,
          probability,
          created_at,
          origin_id,
          stage_id,
          contact_id,
          crm_contacts (
            name,
            email,
            phone
          ),
          crm_origins (
            name
          ),
          crm_stages (
            stage_name
          )
        `)
        .eq('owner_id', user.email);
      
      if (filters.originId) {
        query = query.eq('origin_id', filters.originId);
      }
      
      const { data: deals, error: dealsError } = await query;
      
      if (dealsError) throw dealsError;
      if (!deals || deals.length === 0) {
        return { 
          meetings: [], 
          summary: { reunioesAgendadas: 0, reunioesRealizadas: 0, noShows: 0, taxaConversao: 0 } 
        };
      }
      
      // Get deal activities for all deals
      const dealIds = deals.map(d => d.id);
      const { data: activities, error: activitiesError } = await supabase
        .from('deal_activities')
        .select('*')
        .in('deal_id', dealIds)
        .eq('activity_type', 'stage_change')
        .order('created_at', { ascending: true });
      
      if (activitiesError) throw activitiesError;
      
      // Group activities by deal
      const activitiesByDeal: Record<string, typeof activities> = {};
      (activities || []).forEach(activity => {
        if (!activitiesByDeal[activity.deal_id]) {
          activitiesByDeal[activity.deal_id] = [];
        }
        activitiesByDeal[activity.deal_id].push(activity);
      });
      
      // Process deals into meetings
      const meetings: Meeting[] = [];
      let agendadasCount = 0;
      let realizadasCount = 0;
      let noShowsCount = 0;
      
      for (const deal of deals) {
        const dealActivities = activitiesByDeal[deal.id] || [];
        const currentStageName = (deal.crm_stages as any)?.stage_name || 'Desconhecido';
        const currentClassification = classifyStage(currentStageName);
        
        // Find first "agendada" activity
        const firstAgendada = dealActivities.find(a => 
          a.to_stage && classifyStage(a.to_stage) === 'agendada'
        );
        
        // Find first entry (any stage change)
        const firstEntry = dealActivities[0];
        
        // Find "contrato pago" activity
        const contratoPago = dealActivities.find(a => 
          a.to_stage && classifyStage(a.to_stage) === 'contratoPago'
        );
        
        // Calculate times
        let timeToSchedule: number | null = null;
        let timeToContract: number | null = null;
        
        if (firstEntry && firstAgendada) {
          const entryDate = new Date(firstEntry.created_at);
          const agendadaDate = new Date(firstAgendada.created_at);
          timeToSchedule = Math.round((agendadaDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60));
        }
        
        if (firstAgendada && contratoPago) {
          const agendadaDate = new Date(firstAgendada.created_at);
          const contratoDate = new Date(contratoPago.created_at);
          timeToContract = Math.round((contratoDate.getTime() - agendadaDate.getTime()) / (1000 * 60 * 60));
        }
        
        // Count metrics based on activities
        const hasAgendada = dealActivities.some(a => a.to_stage && classifyStage(a.to_stage) === 'agendada');
        const hasRealizada = dealActivities.some(a => a.to_stage && classifyStage(a.to_stage) === 'realizada');
        const hasNoShow = dealActivities.some(a => a.to_stage && classifyStage(a.to_stage) === 'noShow');
        
        if (hasAgendada) agendadasCount++;
        if (hasRealizada) realizadasCount++;
        if (hasNoShow) noShowsCount++;
        
        // Filter by date if specified
        const scheduledDate = firstAgendada?.created_at || null;
        if (filters.startDate && scheduledDate) {
          if (new Date(scheduledDate) < filters.startDate) continue;
        }
        if (filters.endDate && scheduledDate) {
          if (new Date(scheduledDate) > filters.endDate) continue;
        }
        
        // Filter by resultado
        if (filters.resultado && filters.resultado !== 'all') {
          if (filters.resultado === 'realizada' && currentClassification !== 'realizada') continue;
          if (filters.resultado === 'no_show' && currentClassification !== 'noShow') continue;
          if (filters.resultado === 'pendente' && currentClassification !== 'agendada') continue;
        }
        
        // Only include deals that have been through "agendada" stage
        if (!hasAgendada) continue;
        
        meetings.push({
          id: deal.id,
          dealId: deal.id,
          dealName: deal.name,
          contactName: (deal.crm_contacts as any)?.name || deal.name,
          contactEmail: (deal.crm_contacts as any)?.email || null,
          contactPhone: (deal.crm_contacts as any)?.phone || null,
          originId: deal.origin_id,
          originName: (deal.crm_origins as any)?.name || 'Desconhecida',
          currentStage: currentStageName,
          currentStageClassification: currentClassification,
          scheduledDate,
          probability: deal.probability,
          timeToSchedule,
          timeToContract,
          createdAt: deal.created_at || ''
        });
      }
      
      // Sort by scheduled date descending
      meetings.sort((a, b) => {
        if (!a.scheduledDate) return 1;
        if (!b.scheduledDate) return -1;
        return new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime();
      });
      
      const taxaConversao = agendadasCount > 0 ? (realizadasCount / agendadasCount) * 100 : 0;
      
      return {
        meetings,
        summary: {
          reunioesAgendadas: agendadasCount,
          reunioesRealizadas: realizadasCount,
          noShows: noShowsCount,
          taxaConversao: Math.round(taxaConversao * 10) / 10
        }
      };
    },
    enabled: !!user?.email,
    staleTime: 30000
  });
};

export const useDealTimeline = (dealId: string | null) => {
  return useQuery({
    queryKey: ['deal-timeline', dealId],
    queryFn: async () => {
      if (!dealId) return [];
      
      const { data, error } = await supabase
        .from('deal_activities')
        .select('*')
        .eq('deal_id', dealId)
        .eq('activity_type', 'stage_change')
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      const timeline: DealTimelineEvent[] = (data || []).map(activity => ({
        id: activity.id,
        stageName: activity.to_stage || 'Desconhecido',
        stageClassification: classifyStage(activity.to_stage || ''),
        date: activity.created_at || '',
        completed: true
      }));
      
      return timeline;
    },
    enabled: !!dealId
  });
};

export const useCreateReviewRequest = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (data: {
      periodo: string;
      tipo_problema: string;
      descricao?: string;
    }) => {
      if (!user?.id) throw new Error('Usuário não autenticado');
      
      const { data: result, error } = await supabase
        .from('sdr_review_requests')
        .insert({
          user_id: user.id,
          periodo: data.periodo,
          tipo_problema: data.tipo_problema,
          descricao: data.descricao || null,
          status: 'aberto'
        })
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sdr-review-requests'] });
    }
  });
};

export const useSdrReviewRequests = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['sdr-review-requests', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sdr_review_requests')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });
};
