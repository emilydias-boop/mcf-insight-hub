import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays } from 'date-fns';

export type ThermalStatus = 'quente' | 'morno' | 'frio' | 'perdido' | 'sem_deal';

export interface EnrichedContact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  organization_name: string | null;
  tags: any[];
  created_at: string;
  // Deal info (latest)
  latestDeal: {
    id: string;
    name: string;
    stage_name: string | null;
    stage_color: string | null;
    origin_name: string | null;
    origin_id: string | null;
    original_sdr_email: string | null;
    r1_closer_email: string | null;
    stage_moved_at: string | null;
    last_worked_at: string | null;
    created_at: string | null;
  } | null;
  // Computed fields
  thermalStatus: ThermalStatus;
  daysSinceActivity: number | null;
  isDuplicate: boolean;
  sdrName: string | null;
  closerName: string | null;
  lastActivity: {
    type: string;
    date: string;
  } | null;
}

interface ProfileMap {
  [email: string]: string;
}

const getThermalStatus = (daysSince: number | null): ThermalStatus => {
  if (daysSince === null) return 'sem_deal';
  if (daysSince <= 3) return 'quente';
  if (daysSince <= 7) return 'morno';
  if (daysSince <= 14) return 'frio';
  return 'perdido';
};

export const useContactsEnriched = () => {
  return useQuery({
    queryKey: ['contacts-enriched'],
    queryFn: async () => {
      // 1. Fetch contacts with deals
      const { data: contacts, error: contactsError } = await supabase
        .from('crm_contacts')
        .select(`
          id, name, email, phone, organization_name, tags, created_at,
          crm_deals(
            id, name, stage_id, origin_id, created_at,
            original_sdr_email, r1_closer_email,
            stage_moved_at, last_worked_at,
            crm_stages(stage_name, color),
            crm_origins(name)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(500);

      if (contactsError) throw contactsError;
      if (!contacts) return [];

      // 2. Collect unique emails for SDR/Closer name resolution
      const emailsToResolve = new Set<string>();
      contacts.forEach((c: any) => {
        c.crm_deals?.forEach((d: any) => {
          if (d.original_sdr_email) emailsToResolve.add(d.original_sdr_email.toLowerCase());
          if (d.r1_closer_email) emailsToResolve.add(d.r1_closer_email.toLowerCase());
        });
      });

      // 3. Resolve profile names
      let profileMap: ProfileMap = {};
      if (emailsToResolve.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('email, full_name')
          .in('email', Array.from(emailsToResolve));

        if (profiles) {
          profiles.forEach((p: any) => {
            if (p.email) profileMap[p.email.toLowerCase()] = p.full_name || p.email;
          });
        }
      }

      // 4. Collect deal IDs for latest activity lookup
      const dealIds: string[] = [];
      contacts.forEach((c: any) => {
        c.crm_deals?.forEach((d: any) => dealIds.push(d.id));
      });

      // 5. Fetch latest activity per deal (batch)
      let activityMap: Record<string, { type: string; date: string }> = {};
      if (dealIds.length > 0) {
        // Get latest activity for each deal - fetch in batches of 100
        const batchSize = 100;
        for (let i = 0; i < Math.min(dealIds.length, 500); i += batchSize) {
          const batch = dealIds.slice(i, i + batchSize);
          const { data: activities } = await supabase
            .from('deal_activities')
            .select('deal_id, activity_type, created_at')
            .in('deal_id', batch)
            .order('created_at', { ascending: false });

          if (activities) {
            activities.forEach((a: any) => {
              if (!activityMap[a.deal_id]) {
                activityMap[a.deal_id] = { type: a.activity_type, date: a.created_at };
              }
            });
          }
        }
      }

      // 6. Detect duplicates by email
      const emailCount: Record<string, number> = {};
      contacts.forEach((c: any) => {
        if (c.email) {
          const key = c.email.toLowerCase();
          emailCount[key] = (emailCount[key] || 0) + 1;
        }
      });

      // 7. Build enriched contacts
      const now = new Date();
      const enriched: EnrichedContact[] = contacts.map((contact: any) => {
        const deals = contact.crm_deals || [];
        const latestDeal = deals.length > 0
          ? deals.sort((a: any, b: any) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )[0]
          : null;

        let daysSinceActivity: number | null = null;
        if (latestDeal) {
          const refDate = latestDeal.last_worked_at || latestDeal.stage_moved_at || latestDeal.created_at;
          if (refDate) {
            daysSinceActivity = differenceInDays(now, new Date(refDate));
          }
        }

        const sdrEmail = latestDeal?.original_sdr_email?.toLowerCase();
        const closerEmail = latestDeal?.r1_closer_email?.toLowerCase();

        const lastAct = latestDeal ? activityMap[latestDeal.id] || null : null;

        return {
          id: contact.id,
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          organization_name: contact.organization_name,
          tags: contact.tags || [],
          created_at: contact.created_at,
          latestDeal: latestDeal ? {
            id: latestDeal.id,
            name: latestDeal.name,
            stage_name: latestDeal.crm_stages?.stage_name || null,
            stage_color: latestDeal.crm_stages?.color || null,
            origin_name: latestDeal.crm_origins?.name || null,
            origin_id: latestDeal.origin_id,
            original_sdr_email: latestDeal.original_sdr_email,
            r1_closer_email: latestDeal.r1_closer_email,
            stage_moved_at: latestDeal.stage_moved_at,
            last_worked_at: latestDeal.last_worked_at,
            created_at: latestDeal.created_at,
          } : null,
          thermalStatus: getThermalStatus(daysSinceActivity),
          daysSinceActivity,
          isDuplicate: contact.email ? (emailCount[contact.email.toLowerCase()] || 0) > 1 : false,
          sdrName: sdrEmail ? (profileMap[sdrEmail] || sdrEmail) : null,
          closerName: closerEmail ? (profileMap[closerEmail] || closerEmail) : null,
          lastActivity: lastAct,
        };
      });

      return enriched;
    },
    staleTime: 30000,
  });
};

// Export unique filter options derived from enriched contacts
export const useContactFilterOptions = (contacts: EnrichedContact[]) => {
  const pipelines = Array.from(new Set(
    contacts
      .filter(c => c.latestDeal?.origin_name)
      .map(c => ({ id: c.latestDeal!.origin_id!, name: c.latestDeal!.origin_name! }))
      .map(p => JSON.stringify(p))
  )).map(s => JSON.parse(s));

  const stages = Array.from(new Set(
    contacts
      .filter(c => c.latestDeal?.stage_name)
      .map(c => c.latestDeal!.stage_name!)
  ));

  const sdrs = Array.from(new Set(
    contacts.filter(c => c.sdrName).map(c => c.sdrName!)
  ));

  const closers = Array.from(new Set(
    contacts.filter(c => c.closerName).map(c => c.closerName!)
  ));

  return { pipelines, stages, sdrs, closers };
};
