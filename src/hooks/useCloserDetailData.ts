import { useMemo } from 'react';
import { useR1CloserMetrics, R1CloserMetric } from './useR1CloserMetrics';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, format } from 'date-fns';

export interface CloserTeamAverages {
  avgR1Agendada: number;
  avgR1Realizada: number;
  avgNoShow: number;
  avgContratoPago: number;
  avgOutside: number;
  avgR2Agendada: number;
  avgTaxaConversao: number;
  avgTaxaNoShow: number;
}

export interface CloserRanking {
  r1Realizada: number;
  taxaConversao: number;
  taxaNoShow: number;
  contratoPago: number;
  total: number;
}

export interface CloserLead {
  attendee_id: string;
  deal_id: string;
  deal_name: string;
  contact_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  status: string;
  contract_paid_at: string | null;
  scheduled_at: string;
  booked_by_name: string | null;
  origin_name: string | null;
  r1_sdr_name?: string | null;
  is_followup?: boolean;
  is_manual?: boolean;
}

export interface CloserDetailData {
  closerInfo: {
    id: string;
    name: string;
    email: string;
    color: string | null;
    meetingType: string | null;
  } | null;
  closerMetrics: R1CloserMetric | null;
  teamAverages: CloserTeamAverages;
  ranking: CloserRanking;
  leads: CloserLead[];
  noShowLeads: CloserLead[];
  r2Leads: CloserLead[];
  allLeads: CloserLead[];
  allClosers: R1CloserMetric[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

interface UseCloserDetailParams {
  closerId: string;
  startDate: Date;
  endDate: Date;
}

export function useCloserDetailData({
  closerId,
  startDate,
  endDate,
}: UseCloserDetailParams): CloserDetailData {
  const start = startOfDay(startDate).toISOString();
  const end = endOfDay(endDate).toISOString();

  // Fetch all closer metrics for the period
  const {
    data: allClosers = [],
    isLoading: isLoadingMetrics,
    error: metricsError,
    refetch: refetchMetrics,
  } = useR1CloserMetrics(startDate, endDate);

  // Fetch closer basic info
  const {
    data: closerInfo,
    isLoading: isLoadingCloser,
  } = useQuery({
    queryKey: ['closer-info', closerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('closers')
        .select('id, name, email, color, meeting_type')
        .eq('id', closerId)
        .single();

      if (error) throw error;
      return {
        id: data.id,
        name: data.name,
        email: data.email,
        color: data.color,
        meetingType: data.meeting_type,
      };
    },
    enabled: !!closerId,
  });

  // Fetch leads for this closer (completed/contract_paid) + follow-up contracts
  const {
    data: leads = [],
    isLoading: isLoadingLeads,
    refetch: refetchLeads,
  } = useQuery({
    queryKey: ['closer-leads', closerId, start, end],
    queryFn: async () => {
      // Query 1: meetings with scheduled_at in period (existing logic)
      const { data: meetings, error: meetingsError } = await supabase
        .from('meeting_slots')
        .select(`
          id,
          scheduled_at,
          meeting_slot_attendees (
            id,
            status,
            deal_id,
            attendee_name,
            attendee_phone,
            booked_by,
            contract_paid_at
          )
        `)
        .eq('closer_id', closerId)
        .eq('meeting_type', 'r1')
        .gte('scheduled_at', start)
        .lte('scheduled_at', end);

      if (meetingsError) throw meetingsError;

      // Query 2: follow-up contracts — contract_paid_at in period but scheduled_at outside
      const { data: followupAttendees, error: followupError } = await supabase
        .from('meeting_slot_attendees')
        .select(`
          id,
          status,
          deal_id,
          attendee_name,
          attendee_phone,
          booked_by,
          contract_paid_at,
          meeting_slot:meeting_slots!inner(id, scheduled_at, meeting_type, closer_id)
        `)
        .eq('meeting_slot.closer_id', closerId)
        .eq('meeting_slot.meeting_type', 'r1')
        .not('contract_paid_at', 'is', null)
        .gte('contract_paid_at', start)
        .lte('contract_paid_at', end);

      if (followupError) throw followupError;

      // Build attendees from Query 1
      const relevantStatuses = ['completed', 'contract_paid'];
      const attendeesMap = new Map<string, {
        attendeeId: string;
        status: string;
        contractPaidAt: string | null;
        dealId: string;
        attendeeName: string | null;
        attendeePhone: string | null;
        bookedBy: string | null;
        scheduledAt: string;
        isFollowup: boolean;
      }>();

      meetings?.forEach(meeting => {
        meeting.meeting_slot_attendees?.forEach(att => {
          const hasRelevantStatus = relevantStatuses.includes(att.status);
          const hasContractPaid = !!(att as any).contract_paid_at;
          
          if (att.deal_id && (hasRelevantStatus || hasContractPaid)) {
            attendeesMap.set(att.id, {
              attendeeId: att.id,
              status: hasContractPaid ? 'contract_paid' : att.status,
              contractPaidAt: (att as any).contract_paid_at || null,
              dealId: att.deal_id,
              attendeeName: att.attendee_name,
              attendeePhone: att.attendee_phone,
              bookedBy: att.booked_by,
              scheduledAt: meeting.scheduled_at,
              isFollowup: false,
            });
          }
        });
      });

      // Add follow-ups from Query 2 (only if not already present)
      followupAttendees?.forEach(att => {
        if (att.deal_id && !attendeesMap.has(att.id)) {
          const slot = att.meeting_slot as any;
          if (slot) {
            attendeesMap.set(att.id, {
              attendeeId: att.id,
              status: 'contract_paid',
              contractPaidAt: att.contract_paid_at,
              dealId: att.deal_id,
              attendeeName: att.attendee_name,
              attendeePhone: att.attendee_phone,
              bookedBy: att.booked_by,
              scheduledAt: slot.scheduled_at,
              isFollowup: true,
            });
          }
        }
      });

      const attendeesWithDeals = Array.from(attendeesMap.values());
      if (attendeesWithDeals.length === 0) return [];

      // Fetch deal and contact info
      const dealIds = [...new Set(attendeesWithDeals.map(a => a.dealId))];
      const { data: deals } = await supabase
        .from('crm_deals')
        .select(`
          id,
          name,
          origin:crm_origins(name),
          contact:crm_contacts(id, name, email, phone)
        `)
        .in('id', dealIds);

      const dealsMap = new Map<string, {
        name: string;
        originName: string | null;
        contactName: string | null;
        contactEmail: string | null;
        contactPhone: string | null;
      }>();

      deals?.forEach(deal => {
        const origin = Array.isArray(deal.origin) ? deal.origin[0] : deal.origin;
        const contact = Array.isArray(deal.contact) ? deal.contact[0] : deal.contact;
        dealsMap.set(deal.id, {
          name: deal.name,
          originName: origin?.name || null,
          contactName: contact?.name || null,
          contactEmail: contact?.email || null,
          contactPhone: contact?.phone || null,
        });
      });

      // Fetch booked_by profiles
      const bookedByIds = [...new Set(attendeesWithDeals.map(a => a.bookedBy).filter(Boolean))] as string[];
      let profilesMap: Record<string, string> = {};
      
      if (bookedByIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', bookedByIds);

        profiles?.forEach(p => {
          profilesMap[p.id] = p.full_name || 'Desconhecido';
        });
      }

      // Build leads array
      return attendeesWithDeals.map(att => {
        const dealInfo = dealsMap.get(att.dealId);
        return {
          attendee_id: att.attendeeId,
          deal_id: att.dealId,
          deal_name: dealInfo?.name || 'Sem nome',
          contact_name: att.attendeeName || dealInfo?.contactName || 'Sem nome',
          contact_email: dealInfo?.contactEmail,
          contact_phone: att.attendeePhone || dealInfo?.contactPhone,
          status: att.status,
          contract_paid_at: att.contractPaidAt,
          scheduled_at: att.scheduledAt,
          booked_by_name: att.bookedBy ? profilesMap[att.bookedBy] || null : null,
          origin_name: dealInfo?.originName,
          is_followup: att.isFollowup,
        };
      }).sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
    },
    enabled: !!closerId,
  });

  // Fetch no-show leads for this closer
  const {
    data: noShowLeads = [],
    isLoading: isLoadingNoShows,
    refetch: refetchNoShows,
  } = useQuery({
    queryKey: ['closer-noshow-leads', closerId, start, end],
    queryFn: async () => {
      const { data: meetings, error: meetingsError } = await supabase
        .from('meeting_slots')
        .select(`
          id,
          scheduled_at,
          meeting_slot_attendees (
            id,
            status,
            deal_id,
            attendee_name,
            attendee_phone,
            booked_by
          )
        `)
        .eq('closer_id', closerId)
        .eq('meeting_type', 'r1')
        .gte('scheduled_at', start)
        .lte('scheduled_at', end);

      if (meetingsError) throw meetingsError;

      const attendeesWithDeals: {
        attendeeId: string;
        status: string;
        dealId: string;
        attendeeName: string | null;
        attendeePhone: string | null;
        bookedBy: string | null;
        scheduledAt: string;
      }[] = [];

      meetings?.forEach(meeting => {
        meeting.meeting_slot_attendees?.forEach(att => {
          if (att.deal_id && att.status === 'no_show') {
            attendeesWithDeals.push({
              attendeeId: att.id,
              status: att.status,
              dealId: att.deal_id,
              attendeeName: att.attendee_name,
              attendeePhone: att.attendee_phone,
              bookedBy: att.booked_by,
              scheduledAt: meeting.scheduled_at,
            });
          }
        });
      });

      if (attendeesWithDeals.length === 0) return [];

      const dealIds = [...new Set(attendeesWithDeals.map(a => a.dealId))];
      const { data: deals } = await supabase
        .from('crm_deals')
        .select(`id, name, origin:crm_origins(name), contact:crm_contacts(id, name, email, phone)`)
        .in('id', dealIds);

      const dealsMap = new Map<string, { name: string; originName: string | null; contactName: string | null; contactEmail: string | null; contactPhone: string | null }>();
      deals?.forEach(deal => {
        const origin = Array.isArray(deal.origin) ? deal.origin[0] : deal.origin;
        const contact = Array.isArray(deal.contact) ? deal.contact[0] : deal.contact;
        dealsMap.set(deal.id, { name: deal.name, originName: origin?.name || null, contactName: contact?.name || null, contactEmail: contact?.email || null, contactPhone: contact?.phone || null });
      });

      const bookedByIds = [...new Set(attendeesWithDeals.map(a => a.bookedBy).filter(Boolean))] as string[];
      let profilesMap: Record<string, string> = {};
      if (bookedByIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', bookedByIds);
        profiles?.forEach(p => { profilesMap[p.id] = p.full_name || 'Desconhecido'; });
      }

      return attendeesWithDeals.map(att => {
        const dealInfo = dealsMap.get(att.dealId);
        return {
          attendee_id: att.attendeeId,
          deal_id: att.dealId,
          deal_name: dealInfo?.name || 'Sem nome',
          contact_name: att.attendeeName || dealInfo?.contactName || 'Sem nome',
          contact_email: dealInfo?.contactEmail,
          contact_phone: att.attendeePhone || dealInfo?.contactPhone,
          status: 'no_show',
          contract_paid_at: null,
          scheduled_at: att.scheduledAt,
          booked_by_name: att.bookedBy ? profilesMap[att.bookedBy] || null : null,
          origin_name: dealInfo?.originName,
        } as CloserLead;
      }).sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
    },
    enabled: !!closerId,
  });

  // Fetch scheduled leads for this closer (agendados/reagendados)
  const {
    data: scheduledLeads = [],
    isLoading: isLoadingScheduled,
    refetch: refetchScheduled,
  } = useQuery({
    queryKey: ['closer-scheduled-leads', closerId, start, end],
    queryFn: async () => {
      const { data: meetings, error: meetingsError } = await supabase
        .from('meeting_slots')
        .select(`
          id,
          scheduled_at,
          meeting_slot_attendees (
            id,
            status,
            deal_id,
            attendee_name,
            attendee_phone,
            booked_by
          )
        `)
        .eq('closer_id', closerId)
        .eq('meeting_type', 'r1')
        .gte('scheduled_at', start)
        .lte('scheduled_at', end);

      if (meetingsError) throw meetingsError;

      const attendeesWithDeals: {
        attendeeId: string;
        status: string;
        dealId: string;
        attendeeName: string | null;
        attendeePhone: string | null;
        bookedBy: string | null;
        scheduledAt: string;
      }[] = [];

      meetings?.forEach(meeting => {
        meeting.meeting_slot_attendees?.forEach(att => {
          if (att.deal_id && (att.status === 'scheduled' || att.status === 'rescheduled')) {
            attendeesWithDeals.push({
              attendeeId: att.id,
              status: att.status,
              dealId: att.deal_id,
              attendeeName: att.attendee_name,
              attendeePhone: att.attendee_phone,
              bookedBy: att.booked_by,
              scheduledAt: meeting.scheduled_at,
            });
          }
        });
      });

      if (attendeesWithDeals.length === 0) return [];

      const dealIds = [...new Set(attendeesWithDeals.map(a => a.dealId))];
      const { data: deals } = await supabase
        .from('crm_deals')
        .select(`id, name, origin:crm_origins(name), contact:crm_contacts(id, name, email, phone)`)
        .in('id', dealIds);

      const dealsMap = new Map<string, { name: string; originName: string | null; contactName: string | null; contactEmail: string | null; contactPhone: string | null }>();
      deals?.forEach(deal => {
        const origin = Array.isArray(deal.origin) ? deal.origin[0] : deal.origin;
        const contact = Array.isArray(deal.contact) ? deal.contact[0] : deal.contact;
        dealsMap.set(deal.id, { name: deal.name, originName: origin?.name || null, contactName: contact?.name || null, contactEmail: contact?.email || null, contactPhone: contact?.phone || null });
      });

      const bookedByIds = [...new Set(attendeesWithDeals.map(a => a.bookedBy).filter(Boolean))] as string[];
      let profilesMap: Record<string, string> = {};
      if (bookedByIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', bookedByIds);
        profiles?.forEach(p => { profilesMap[p.id] = p.full_name || 'Desconhecido'; });
      }

      return attendeesWithDeals.map(att => {
        const dealInfo = dealsMap.get(att.dealId);
        return {
          attendee_id: att.attendeeId,
          deal_id: att.dealId,
          deal_name: dealInfo?.name || 'Sem nome',
          contact_name: att.attendeeName || dealInfo?.contactName || 'Sem nome',
          contact_email: dealInfo?.contactEmail,
          contact_phone: att.attendeePhone || dealInfo?.contactPhone,
          status: att.status,
          contract_paid_at: null,
          scheduled_at: att.scheduledAt,
          booked_by_name: att.bookedBy ? profilesMap[att.bookedBy] || null : null,
          origin_name: dealInfo?.originName,
        } as CloserLead;
      }).sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
    },
    enabled: !!closerId,
  });

  // Fetch manual sale attributions for this closer
  const {
    data: manualSales = [],
    isLoading: isLoadingManual,
    refetch: refetchManual,
  } = useQuery({
    queryKey: ['closer-manual-sales', closerId, start, end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('manual_sale_attributions' as any)
        .select('*')
        .eq('closer_id', closerId)
        .gte('contract_paid_at', start)
        .lte('contract_paid_at', end);

      if (error) throw error;

      return ((data as any[]) || []).map((item: any) => ({
        attendee_id: `manual-${item.id}`,
        deal_id: `manual-${item.id}`,
        deal_name: item.contact_name,
        contact_name: item.contact_name,
        contact_email: item.contact_email || null,
        contact_phone: item.contact_phone || null,
        status: 'contract_paid',
        contract_paid_at: item.contract_paid_at,
        scheduled_at: item.contract_paid_at,
        booked_by_name: null,
        origin_name: null,
        is_followup: false,
        is_manual: true,
      } as CloserLead));
    },
    enabled: !!closerId,
  });

  // Fetch R2 leads for this closer
  const {
    data: r2Leads = [],
    isLoading: isLoadingR2,
    refetch: refetchR2,
  } = useQuery({
    queryKey: ['closer-r2-leads', closerId, start, end],
    queryFn: async () => {
      // Step 1: Get all deal_ids from R1 meetings of this closer (no period filter)
      const { data: r1Meetings } = await supabase
        .from('meeting_slots')
        .select('meeting_slot_attendees(deal_id)')
        .eq('closer_id', closerId)
        .eq('meeting_type', 'r1')
        .neq('status', 'cancelled');

      const r1DealIds = new Set<string>();
      r1Meetings?.forEach(m => {
        const attendees = m.meeting_slot_attendees as any[];
        attendees?.forEach((att: any) => {
          if (att.deal_id) r1DealIds.add(att.deal_id);
        });
      });

      if (r1DealIds.size === 0) return [];

      // Step 2a: Fetch R1 booked_by (SDR) for each deal_id
      const { data: r1SdrData } = await supabase
        .from('meeting_slot_attendees')
        .select('deal_id, booked_by, meeting_slot:meeting_slots!inner(meeting_type)')
        .in('deal_id', Array.from(r1DealIds))
        .eq('meeting_slot.meeting_type', 'r1');

      const r1SdrMap = new Map<string, string>();
      r1SdrData?.forEach((row: any) => {
        if (row.deal_id && row.booked_by && !r1SdrMap.has(row.deal_id)) {
          r1SdrMap.set(row.deal_id, row.booked_by);
        }
      });

      // Step 2b: Find R2 meetings whose deal_id matches an R1 deal of this closer
      const { data: r2Attendees, error: r2Error } = await supabase
        .from('meeting_slot_attendees')
        .select(`
          id,
          status,
          deal_id,
          attendee_name,
          attendee_phone,
          booked_by,
          meeting_slot:meeting_slots!inner(id, scheduled_at, meeting_type)
        `)
        .eq('meeting_slot.meeting_type', 'r2')
        .in('deal_id', Array.from(r1DealIds))
        .gte('meeting_slot.scheduled_at', start)
        .lte('meeting_slot.scheduled_at', end);

      if (r2Error) throw r2Error;

      const attendeesWithDeals: {
        attendeeId: string;
        status: string;
        dealId: string;
        attendeeName: string | null;
        attendeePhone: string | null;
        bookedBy: string | null;
        scheduledAt: string;
      }[] = [];

      r2Attendees?.forEach(att => {
        const slot = att.meeting_slot as any;
        if (att.deal_id && slot) {
          attendeesWithDeals.push({
            attendeeId: att.id,
            status: att.status,
            dealId: att.deal_id,
            attendeeName: att.attendee_name,
            attendeePhone: att.attendee_phone,
            bookedBy: att.booked_by,
            scheduledAt: slot.scheduled_at,
          });
        }
      });

      if (attendeesWithDeals.length === 0) return [];

      const dealIds = [...new Set(attendeesWithDeals.map(a => a.dealId))];
      const { data: deals } = await supabase
        .from('crm_deals')
        .select(`id, name, origin:crm_origins(name), contact:crm_contacts(id, name, email, phone)`)
        .in('id', dealIds);

      const dealsMap = new Map<string, { name: string; originName: string | null; contactName: string | null; contactEmail: string | null; contactPhone: string | null }>();
      deals?.forEach(deal => {
        const origin = Array.isArray(deal.origin) ? deal.origin[0] : deal.origin;
        const contact = Array.isArray(deal.contact) ? deal.contact[0] : deal.contact;
        dealsMap.set(deal.id, { name: deal.name, originName: origin?.name || null, contactName: contact?.name || null, contactEmail: contact?.email || null, contactPhone: contact?.phone || null });
      });

      // Collect all profile IDs: R2 booked_by + R1 SDR booked_by
      const allProfileIds = new Set<string>();
      attendeesWithDeals.forEach(a => { if (a.bookedBy) allProfileIds.add(a.bookedBy); });
      r1SdrMap.forEach(v => allProfileIds.add(v));

      let profilesMap: Record<string, string> = {};
      if (allProfileIds.size > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', Array.from(allProfileIds));
        profiles?.forEach(p => { profilesMap[p.id] = p.full_name || 'Desconhecido'; });
      }

      return attendeesWithDeals.map(att => {
        const dealInfo = dealsMap.get(att.dealId);
        const r1SdrId = r1SdrMap.get(att.dealId);
        return {
          attendee_id: att.attendeeId,
          deal_id: att.dealId,
          deal_name: dealInfo?.name || 'Sem nome',
          contact_name: att.attendeeName || dealInfo?.contactName || 'Sem nome',
          contact_email: dealInfo?.contactEmail,
          contact_phone: att.attendeePhone || dealInfo?.contactPhone,
          status: att.status,
          contract_paid_at: null,
          scheduled_at: att.scheduledAt,
          booked_by_name: att.bookedBy ? profilesMap[att.bookedBy] || null : null,
          origin_name: dealInfo?.originName,
          r1_sdr_name: r1SdrId ? profilesMap[r1SdrId] || null : null,
        } as CloserLead;
      }).sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
    },
    enabled: !!closerId,
  });

  // Get metrics for the specific closer
  const closerMetrics = useMemo(() => {
    return allClosers.find(c => c.closer_id === closerId) || null;
  }, [allClosers, closerId]);

  // Calculate team averages
  const teamAverages = useMemo((): CloserTeamAverages => {
    if (allClosers.length === 0) {
      return {
        avgR1Agendada: 0,
        avgR1Realizada: 0,
        avgNoShow: 0,
        avgContratoPago: 0,
        avgOutside: 0,
        avgR2Agendada: 0,
        avgTaxaConversao: 0,
        avgTaxaNoShow: 0,
      };
    }

    const totals = allClosers.reduce(
      (acc, c) => ({
        r1Agendada: acc.r1Agendada + c.r1_agendada,
        r1Realizada: acc.r1Realizada + c.r1_realizada,
        noShow: acc.noShow + c.noshow,
        contratoPago: acc.contratoPago + c.contrato_pago,
        outside: acc.outside + c.outside,
        r2Agendada: acc.r2Agendada + c.r2_agendada,
      }),
      { r1Agendada: 0, r1Realizada: 0, noShow: 0, contratoPago: 0, outside: 0, r2Agendada: 0 }
    );

    const count = allClosers.length;
    const avgR1Realizada = totals.r1Realizada / count;
    const avgContratoPago = totals.contratoPago / count;
    const avgOutside = totals.outside / count;
    const avgR1Agendada = totals.r1Agendada / count;
    const avgNoShow = totals.noShow / count;

    return {
      avgR1Agendada,
      avgR1Realizada,
      avgNoShow,
      avgContratoPago,
      avgOutside,
      avgR2Agendada: totals.r2Agendada / count,
      avgTaxaConversao: avgR1Realizada > 0 ? (avgContratoPago / avgR1Realizada) * 100 : 0,
      avgTaxaNoShow: avgR1Agendada > 0 ? (avgNoShow / avgR1Agendada) * 100 : 0,
    };
  }, [allClosers]);

  // Calculate ranking
  const ranking = useMemo((): CloserRanking => {
    if (!closerMetrics || allClosers.length === 0) {
      return { r1Realizada: 0, taxaConversao: 0, taxaNoShow: 0, contratoPago: 0, total: 0 };
    }

    const sortedByR1Realizada = [...allClosers].sort((a, b) => b.r1_realizada - a.r1_realizada);
    const sortedByContratoPago = [...allClosers].sort((a, b) => b.contrato_pago - a.contrato_pago);
    
    const withRates = allClosers.map(c => ({
      ...c,
      taxaConversao: c.r1_realizada > 0 ? (c.contrato_pago / c.r1_realizada) * 100 : 0,
      taxaNoShow: c.r1_agendada > 0 ? (c.noshow / c.r1_agendada) * 100 : 0,
    }));
    
    const sortedByTaxaConversao = [...withRates].sort((a, b) => b.taxaConversao - a.taxaConversao);
    const sortedByTaxaNoShow = [...withRates].sort((a, b) => a.taxaNoShow - b.taxaNoShow);

    return {
      r1Realizada: sortedByR1Realizada.findIndex(c => c.closer_id === closerId) + 1,
      contratoPago: sortedByContratoPago.findIndex(c => c.closer_id === closerId) + 1,
      taxaConversao: sortedByTaxaConversao.findIndex(c => c.closer_id === closerId) + 1,
      taxaNoShow: sortedByTaxaNoShow.findIndex(c => c.closer_id === closerId) + 1,
      total: allClosers.length,
    };
  }, [closerMetrics, allClosers, closerId]);

  // Merge manual sales into leads list
  const leadsWithManual = useMemo(() => {
    const combined = [...leads, ...manualSales];
    return combined.sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
  }, [leads, manualSales]);

  // Combine all leads into a single sorted array
  const allLeads = useMemo(() => {
    const combined = [...leadsWithManual, ...noShowLeads, ...scheduledLeads];
    // Deduplicate by attendee_id
    const seen = new Set<string>();
    const unique = combined.filter(l => {
      if (seen.has(l.attendee_id)) return false;
      seen.add(l.attendee_id);
      return true;
    });
    return unique.sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
  }, [leadsWithManual, noShowLeads, scheduledLeads]);

  const refetch = () => {
    refetchMetrics();
    refetchLeads();
    refetchNoShows();
    refetchScheduled();
    refetchR2();
    refetchManual();
  };

  return {
    closerInfo: closerInfo || null,
    closerMetrics,
    teamAverages,
    ranking,
    leads: leadsWithManual,
    noShowLeads,
    r2Leads,
    allLeads,
    allClosers,
    isLoading: isLoadingMetrics || isLoadingCloser || isLoadingLeads || isLoadingNoShows || isLoadingScheduled || isLoadingR2 || isLoadingManual,
    error: metricsError,
    refetch,
  };
}
