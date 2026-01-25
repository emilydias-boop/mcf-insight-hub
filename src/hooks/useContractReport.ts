import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth, format } from 'date-fns';

export interface ContractReportFilters {
  startDate: Date;
  endDate: Date;
  closerId?: string;
  originId?: string;
}

export interface ContractReportRow {
  id: string;
  closerName: string;
  closerEmail: string;
  meetingDate: string;
  meetingType: string;
  leadName: string;
  leadPhone: string;
  sdrEmail: string;
  sdrName: string;
  originName: string;
  currentStage: string;
  contractPaidAt: string;
  customFields: {
    profissao?: string;
    renda?: string;
    estado?: string;
    [key: string]: unknown;
  };
}

export const useContractReport = (
  filters: ContractReportFilters,
  allowedCloserIds: string[] | null // null = all closers (admin/manager)
) => {
  return useQuery({
    queryKey: ['contract-report', filters, allowedCloserIds],
    queryFn: async (): Promise<ContractReportRow[]> => {
      const startISO = format(filters.startDate, 'yyyy-MM-dd') + 'T00:00:00';
      const endISO = format(filters.endDate, 'yyyy-MM-dd') + 'T23:59:59';
      
      // Query meeting_slot_attendees with status = 'contract_paid'
      let query = supabase
        .from('meeting_slot_attendees')
        .select(`
        id,
        attendee_name,
        attendee_phone,
        status,
        deal_id,
          meeting_slots!inner (
            id,
            scheduled_at,
            meeting_type,
            closer_id,
            closers (
              id,
              name,
              email,
              color
            )
          ),
          crm_deals (
            id,
            name,
            owner_id,
            custom_fields,
            origin_id,
            stage_id,
            crm_origins (
              id,
              name,
              display_name
            ),
            crm_stages (
              id,
              stage_name
            )
          )
        `)
        .eq('status', 'contract_paid')
        .gte('meeting_slots.scheduled_at', startISO)
        .lte('meeting_slots.scheduled_at', endISO);
      
      // Filter by specific closer if provided
      if (filters.closerId) {
        query = query.eq('meeting_slots.closer_id', filters.closerId);
      }
      
      // Filter by allowed closers (for gestor/coordenador)
      if (allowedCloserIds && allowedCloserIds.length > 0) {
        query = query.in('meeting_slots.closer_id', allowedCloserIds);
      } else if (allowedCloserIds && allowedCloserIds.length === 0) {
        // No allowed closers means no access
        return [];
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      if (!data) return [];
      
      // Sort by meeting date (DESC - most recent first)
      const sortedData = [...data].sort((a: any, b: any) => {
        const dateA = a.meeting_slots?.scheduled_at || '';
        const dateB = b.meeting_slots?.scheduled_at || '';
        return dateB.localeCompare(dateA);
      });
      
      // Fetch SDR names from profiles based on owner_id (email)
      const sdrEmails = [...new Set(
        sortedData
          .map((row: any) => row.crm_deals?.owner_id)
          .filter(Boolean)
      )];
      
      let sdrNameMap: Record<string, string> = {};
      
      if (sdrEmails.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, email')
          .in('email', sdrEmails);
        
        if (profiles) {
          sdrNameMap = profiles.reduce((acc: Record<string, string>, p: any) => {
            if (p.email) acc[p.email] = p.name || p.email;
            return acc;
          }, {});
        }
      }
      
      // Transform data
      return sortedData.map((row: any) => {
        const slot = row.meeting_slots;
        const closer = slot?.closers;
        const deal = row.crm_deals;
        const origin = deal?.crm_origins;
        const stage = deal?.crm_stages;
        const customFields = deal?.custom_fields || {};
        const sdrEmail = deal?.owner_id || '';
        
        return {
          id: row.id,
          closerName: closer?.name || 'N/A',
          closerEmail: closer?.email || '',
          meetingDate: slot?.scheduled_at || '',
          meetingType: slot?.meeting_type || 'r1',
          leadName: row.attendee_name || 'N/A',
          leadPhone: row.attendee_phone || '',
          sdrEmail,
          sdrName: sdrNameMap[sdrEmail] || sdrEmail,
          originName: origin?.display_name || origin?.name || 'N/A',
          currentStage: stage?.stage_name || 'N/A',
          contractPaidAt: slot?.scheduled_at || '',
          customFields,
        };
      });
    },
    enabled: filters.startDate instanceof Date && filters.endDate instanceof Date,
    staleTime: 2 * 60 * 1000,
  });
};

// Helper to get default filter dates (current month)
export const getDefaultContractReportFilters = (): ContractReportFilters => ({
  startDate: startOfMonth(new Date()),
  endDate: endOfMonth(new Date()),
});
