import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export type ProductCategory = 'entry' | 'contract' | 'final';

export interface ClientTransaction {
  id: string;
  productName: string;
  productCode: string; // A010, A000, A001, A003, A009
  category: ProductCategory;
  saleDate: string;
  netValue: number;
  source: string | null;
}

export interface MeetingInfo {
  id: string;
  scheduledAt: string;
  status: string;
  meetingType: 'r1' | 'r2';
  closerName: string | null;
}

export interface ClientRow {
  key: string; // normalized email or phone suffix
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  entryPurchases: ClientTransaction[]; // A010 + configured entry
  contractPurchases: ClientTransaction[]; // A000
  finalPurchases: ClientTransaction[]; // A001/A003/A009
  dealId: string | null;
  dealStageName: string | null;
  r1: MeetingInfo | null;
  r2: MeetingInfo | null;
  firstEntryDate: string | null;
  hasR1: boolean;
  hasR2: boolean;
  hasFinal: boolean;
}

export interface FunilCicloFilters {
  startDate: Date;
  endDate: Date;
  entryProducts: string[]; // e.g. ['a010']
  onlyWithEntry: boolean;
}

const FINAL_PATTERNS = ['a001', 'a003', 'a009'];
const CONTRACT_PATTERNS = ['a000', 'contrato'];

function detectCode(name: string, entryProducts: string[]): { code: string; category: ProductCategory } | null {
  const n = (name || '').toLowerCase();
  for (const p of entryProducts) {
    if (n.includes(p.toLowerCase())) return { code: p.toUpperCase(), category: 'entry' };
  }
  for (const p of CONTRACT_PATTERNS) {
    if (n.includes(p)) return { code: 'A000', category: 'contract' };
  }
  for (const p of FINAL_PATTERNS) {
    if (n.includes(p)) return { code: p.toUpperCase(), category: 'final' };
  }
  return null;
}

function normEmail(e: string | null): string {
  return (e || '').toLowerCase().trim();
}
function phoneSuffix(p: string | null): string {
  return (p || '').replace(/\D/g, '').slice(-9);
}

export function useFunilCicloVendas(filters: FunilCicloFilters) {
  return useQuery({
    queryKey: ['funil-ciclo-vendas', filters],
    queryFn: async (): Promise<ClientRow[]> => {
      const startISO = format(filters.startDate, 'yyyy-MM-dd');
      const endISO = format(filters.endDate, 'yyyy-MM-dd');

      const patterns = [
        ...filters.entryProducts.map((p) => p.toLowerCase()),
        ...CONTRACT_PATTERNS,
        ...FINAL_PATTERNS,
      ];
      const orFilter = patterns.map((p) => `product_name.ilike.%${p}%`).join(',');

      const { data: tx, error } = await supabase
        .from('hubla_transactions')
        .select('id, product_name, sale_date, net_value, customer_name, customer_email, customer_phone, source, sale_status')
        .gte('sale_date', startISO)
        .lte('sale_date', `${endISO}T23:59:59`)
        .in('sale_status', ['completed', 'paid'])
        .or(orFilter)
        .limit(5000);

      if (error) throw error;

      // Group by normalized key
      const map = new Map<string, ClientRow>();
      for (const row of tx || []) {
        const detected = detectCode(row.product_name || '', filters.entryProducts);
        if (!detected) continue;

        const email = normEmail(row.customer_email);
        const phone = phoneSuffix(row.customer_phone);
        const key = email || `phone:${phone}` || `id:${row.id}`;

        let entry = map.get(key);
        if (!entry) {
          entry = {
            key,
            customerName: row.customer_name || email || phone || 'Sem nome',
            customerEmail: row.customer_email,
            customerPhone: row.customer_phone,
            entryPurchases: [],
            contractPurchases: [],
            finalPurchases: [],
            dealId: null,
            dealStageName: null,
            r1: null,
            r2: null,
            firstEntryDate: null,
            hasR1: false,
            hasR2: false,
            hasFinal: false,
          };
          map.set(key, entry);
        }

        const item: ClientTransaction = {
          id: row.id,
          productName: row.product_name || '',
          productCode: detected.code,
          category: detected.category,
          saleDate: row.sale_date,
          netValue: Number(row.net_value) || 0,
          source: row.source,
        };

        if (detected.category === 'entry') entry.entryPurchases.push(item);
        else if (detected.category === 'contract') entry.contractPurchases.push(item);
        else entry.finalPurchases.push(item);
      }

      // Sort purchases + compute derived flags
      for (const c of map.values()) {
        c.entryPurchases.sort((a, b) => a.saleDate.localeCompare(b.saleDate));
        c.contractPurchases.sort((a, b) => a.saleDate.localeCompare(b.saleDate));
        c.finalPurchases.sort((a, b) => a.saleDate.localeCompare(b.saleDate));
        c.firstEntryDate = c.entryPurchases[0]?.saleDate || null;
        c.hasFinal = c.finalPurchases.length > 0;
      }

      let rows = Array.from(map.values());
      if (filters.onlyWithEntry) {
        rows = rows.filter((r) => r.entryPurchases.length > 0);
      }

      // Enrich with CRM deal + meetings by email
      const emails = rows.map((r) => r.customerEmail).filter(Boolean) as string[];
      if (emails.length > 0) {
        const emailsLower = Array.from(new Set(emails.map((e) => e.toLowerCase())));
        // Batch queries for CRM contacts by email
        const { data: contacts } = await supabase
          .from('crm_contacts')
          .select('id, email')
          .in('email', emailsLower);

        const contactByEmail = new Map<string, string>();
        (contacts || []).forEach((c: any) => {
          if (c.email) contactByEmail.set(c.email.toLowerCase(), c.id);
        });

        const contactIds = Array.from(contactByEmail.values());
        if (contactIds.length > 0) {
          const { data: deals } = await supabase
            .from('crm_deals')
            .select('id, contact_id, stage_id, created_at, deal_stages:stage_id(stage_name, stage_order)')
            .in('contact_id', contactIds)
            .order('created_at', { ascending: false });

          const dealByContact = new Map<string, any>();
          (deals || []).forEach((d: any) => {
            if (!dealByContact.has(d.contact_id)) dealByContact.set(d.contact_id, d);
          });

          const dealIds = Array.from(dealByContact.values()).map((d) => d.id);
          let attendeesByDeal = new Map<string, any[]>();
          if (dealIds.length > 0) {
            const { data: attendees } = await supabase
              .from('meeting_slot_attendees')
              .select(`
                id, deal_id, status,
                meeting_slots!inner(id, scheduled_at, status, meeting_type, closer:closers(name))
              `)
              .in('deal_id', dealIds);

            (attendees || []).forEach((a: any) => {
              const list = attendeesByDeal.get(a.deal_id) || [];
              list.push(a);
              attendeesByDeal.set(a.deal_id, list);
            });
          }

          for (const row of rows) {
            const email = row.customerEmail?.toLowerCase();
            if (!email) continue;
            const contactId = contactByEmail.get(email);
            if (!contactId) continue;
            const deal = dealByContact.get(contactId);
            if (!deal) continue;
            row.dealId = deal.id;
            row.dealStageName = deal.deal_stages?.stage_name || null;

            const atts = attendeesByDeal.get(deal.id) || [];
            const r1s = atts.filter((a: any) => a.meeting_slots?.meeting_type === 'r1');
            const r2s = atts.filter((a: any) => a.meeting_slots?.meeting_type === 'r2');
            const pick = (a: any, type: 'r1' | 'r2'): MeetingInfo => ({
              id: a.meeting_slots.id,
              scheduledAt: a.meeting_slots.scheduled_at,
              status: a.status || a.meeting_slots.status,
              meetingType: type,
              closerName: a.meeting_slots?.closer?.name || null,
            });
            if (r1s.length > 0) {
              row.r1 = pick(r1s.sort((a: any, b: any) => (b.meeting_slots.scheduled_at || '').localeCompare(a.meeting_slots.scheduled_at || ''))[0], 'r1');
              row.hasR1 = true;
            }
            if (r2s.length > 0) {
              row.r2 = pick(r2s.sort((a: any, b: any) => (b.meeting_slots.scheduled_at || '').localeCompare(a.meeting_slots.scheduled_at || ''))[0], 'r2');
              row.hasR2 = true;
            }
          }
        }
      }

      // Sort: entries first, then most recent
      rows.sort((a, b) => (b.firstEntryDate || '').localeCompare(a.firstEntryDate || ''));
      return rows;
    },
    staleTime: 5 * 60 * 1000,
  });
}
