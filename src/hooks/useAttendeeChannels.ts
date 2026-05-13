import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type AttendeeChannel = 'A010' | 'ANAMNESE' | 'Outro';

export interface AttendeeChannelInput {
  id: string;
  email?: string | null;
  phone?: string | null;
  scheduledAt?: string | null;
  tags?: any[] | null;
}

function normalizePhone9(raw: string | null | undefined): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 9 ? digits.slice(-9) : digits;
}

function parseTags(raw: any[] | null | undefined): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((t: any) => {
    if (typeof t === 'string') {
      if (t.startsWith('{')) {
        try { const p = JSON.parse(t); return p?.name || t; } catch { return t; }
      }
      return t;
    }
    return (t as any)?.name || '';
  });
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function classifyAttendeeChannel(opts: {
  a010AgeMs: number | null;
  tags: string[];
}): AttendeeChannel {
  const isBuyer = opts.a010AgeMs !== null;
  const isStale = opts.a010AgeMs !== null && opts.a010AgeMs > THIRTY_DAYS_MS;
  const norm = opts.tags.map(t => (t || '').trim().toUpperCase());
  const hasAnamnese = norm.some(t => t === 'ANAMNESE');
  if (isBuyer && !isStale) return 'A010';
  if (isBuyer && isStale) return 'ANAMNESE';
  if (hasAnamnese) return 'ANAMNESE';
  return 'Outro';
}

/** Retorna mapa id -> canal classificado, com lookup batch em hubla_transactions. */
export function useAttendeeChannels(inputs: AttendeeChannelInput[]) {
  const { emails, phones9 } = useMemo(() => {
    const eSet = new Set<string>();
    const pSet = new Set<string>();
    for (const it of inputs) {
      const e = (it.email || '').toLowerCase().trim();
      if (e) eSet.add(e);
      const p9 = normalizePhone9(it.phone);
      if (p9) pSet.add(p9);
    }
    return { emails: Array.from(eSet), phones9: Array.from(pSet) };
  }, [inputs]);

  const { data: a010Sets } = useQuery({
    queryKey: ['attendee-channels-a010', emails, phones9],
    queryFn: async () => {
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
          if (!prev || (r.sale_date && r.sale_date > prev)) emailMap.set(e, r.sale_date || prev || '');
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
          if (!prev || (r.sale_date && r.sale_date > prev)) phoneMap.set(p9, r.sale_date || prev || '');
        });
      }
      return { emailMap, phoneMap };
    },
    enabled: emails.length > 0 || phones9.length > 0,
    staleTime: 60_000,
  });

  return useMemo(() => {
    const map = new Map<string, AttendeeChannel>();
    for (const it of inputs) {
      const e = (it.email || '').toLowerCase().trim();
      const p9 = normalizePhone9(it.phone);
      const dates: string[] = [];
      if (a010Sets) {
        if (e && a010Sets.emailMap.has(e)) dates.push(a010Sets.emailMap.get(e)!);
        if (p9 && a010Sets.phoneMap.has(p9)) dates.push(a010Sets.phoneMap.get(p9)!);
      }
      const valid = dates.filter(Boolean).map(d => new Date(d).getTime()).filter(n => !isNaN(n));
      let ageMs: number | null = null;
      if (valid.length > 0) {
        const refMs = it.scheduledAt ? new Date(it.scheduledAt).getTime() : Date.now();
        ageMs = (isNaN(refMs) ? Date.now() : refMs) - Math.max(...valid);
      } else if (a010Sets && ((e && a010Sets.emailMap.has(e)) || (p9 && a010Sets.phoneMap.has(p9)))) {
        ageMs = 0;
      }
      map.set(it.id, classifyAttendeeChannel({ a010AgeMs: ageMs, tags: parseTags(it.tags || null) }));
    }
    return map;
  }, [inputs, a010Sets]);
}

export const CHANNEL_EMOJI: Record<AttendeeChannel, string> = {
  A010: '💻',
  ANAMNESE: '📋',
  Outro: '•',
};

export const CHANNEL_BADGE_CLASS: Record<AttendeeChannel, string> = {
  A010: 'border-blue-400 text-blue-600',
  ANAMNESE: 'border-purple-400 text-purple-600',
  Outro: 'text-muted-foreground',
};