import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  A010Sets,
  SimpleChannel,
  classifyR2Lead,
  normalizePhone9,
  parseTagsRaw,
} from '@/lib/r2ChannelClassify';

export interface R2LeadInput {
  /** Identificador estável (attendee.id, slot.id, deal.id…). */
  key: string;
  email?: string | null;
  phone?: string | null;
  /** Tags já carregadas (raw jsonb). Se não vier, o hook tenta buscar via dealId. */
  tags?: any;
  /** Para resolver tags se ausentes. */
  dealId?: string | null;
  /** Data de referência para janela de 30d (geralmente scheduled_at). */
  scheduledAt?: string | null;
}

export interface R2LeadResolved {
  channel: SimpleChannel;
  tags: string[];
}

/**
 * Resolve canal A010/ANAMNESE/Outro para uma lista de leads em batch:
 * - 1 query em hubla_transactions (a010 buyers) por email/telefone
 * - 1 query em crm_deals para resolver tags faltantes
 */
export function useR2LeadsChannelMap(leads: R2LeadInput[]) {
  // Coletar emails / phones9 / dealIds que precisam de tags
  const { emails, phones9, missingTagDealIds } = useMemo(() => {
    const eSet = new Set<string>();
    const pSet = new Set<string>();
    const dSet = new Set<string>();
    for (const l of leads) {
      const e = (l.email || '').toLowerCase().trim();
      if (e) eSet.add(e);
      const p9 = normalizePhone9(l.phone);
      if (p9) pSet.add(p9);
      if (l.tags === undefined && l.dealId) dSet.add(l.dealId);
    }
    return {
      emails: Array.from(eSet),
      phones9: Array.from(pSet),
      missingTagDealIds: Array.from(dSet),
    };
  }, [leads]);

  const { data: a010Sets } = useQuery({
    queryKey: ['r2-a010-buyers', emails, phones9],
    queryFn: async (): Promise<A010Sets> => {
      const emailMap = new Map<string, string>();
      const phoneMap = new Map<string, string>();
      if (emails.length === 0 && phones9.length === 0) return { emailMap, phoneMap };

      if (emails.length > 0) {
        const { data } = await supabase
          .from('hubla_transactions')
          .select('customer_email, sale_date')
          .eq('product_category', 'a010')
          .eq('sale_status', 'completed')
          .in('customer_email', emails);
        (data || []).forEach((r: any) => {
          if (!r.customer_email) return;
          const e = String(r.customer_email).toLowerCase().trim();
          const prev = emailMap.get(e);
          if (!prev || (r.sale_date && r.sale_date > prev)) {
            emailMap.set(e, r.sale_date || prev || '');
          }
        });
      }
      if (phones9.length > 0) {
        const { data } = await supabase
          .from('hubla_transactions')
          .select('customer_phone, sale_date')
          .eq('product_category', 'a010')
          .eq('sale_status', 'completed')
          .not('customer_phone', 'is', null);
        (data || []).forEach((r: any) => {
          const p9 = normalizePhone9(r.customer_phone);
          if (!p9 || !phones9.includes(p9)) return;
          const prev = phoneMap.get(p9);
          if (!prev || (r.sale_date && r.sale_date > prev)) {
            phoneMap.set(p9, r.sale_date || prev || '');
          }
        });
      }
      return { emailMap, phoneMap };
    },
    enabled: emails.length > 0 || phones9.length > 0,
    staleTime: 60_000,
  });

  const { data: dealTags } = useQuery({
    queryKey: ['r2-deal-tags-lookup', missingTagDealIds],
    queryFn: async (): Promise<Map<string, any>> => {
      const map = new Map<string, any>();
      if (missingTagDealIds.length === 0) return map;
      // batch em chunks de 200
      const chunks: string[][] = [];
      for (let i = 0; i < missingTagDealIds.length; i += 200) {
        chunks.push(missingTagDealIds.slice(i, i + 200));
      }
      await Promise.all(
        chunks.map(async (chunk) => {
          const { data } = await supabase.from('crm_deals').select('id, tags').in('id', chunk);
          (data || []).forEach((d: any) => map.set(d.id, d.tags));
        }),
      );
      return map;
    },
    enabled: missingTagDealIds.length > 0,
    staleTime: 60_000,
  });

  const resolved = useMemo(() => {
    const map = new Map<string, R2LeadResolved>();
    for (const l of leads) {
      const tagsRaw = l.tags !== undefined ? l.tags : (l.dealId ? dealTags?.get(l.dealId) : null);
      const tags = parseTagsRaw(tagsRaw);
      const channel = classifyR2Lead({
        sets: a010Sets || null,
        email: l.email,
        phone: l.phone,
        referenceISO: l.scheduledAt || null,
        tags,
      });
      map.set(l.key, { channel, tags });
    }
    return map;
  }, [leads, a010Sets, dealTags]);

  return resolved;
}