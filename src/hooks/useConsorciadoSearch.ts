import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type ConsorciadoMatchSource = 'consortium' | 'crm' | 'hubla';

export interface ConsorciadoMatch {
  source: ConsorciadoMatchSource;
  id: string;
  nome: string | null;
  cpf_cnpj: string | null;
  telefone: string | null;
  email: string | null;
  // extras (vary by source)
  tipo_pessoa?: 'pf' | 'pj';
  razao_social?: string | null;
  // crm
  stage_id?: string | null;
  product_name?: string | null;
  // hubla
  product_code?: string | null;
  sale_date?: string | null;
  net_value?: number | null;
  // consortium
  grupo?: string | null;
  cota?: string | null;
  status?: string | null;
  // full record (preenchido sob demanda para autofill completo)
  full?: any;
}

const onlyDigits = (s: string) => s.replace(/\D/g, '');

function normalizeForLike(q: string): { text: string; digits: string; isDoc: boolean } {
  const text = q.trim();
  const digits = onlyDigits(text);
  // CPF (11) ou CNPJ (14)
  const isDoc = digits.length >= 6 && digits.length <= 14 && digits.length === text.replace(/\D/g, '').length && /\d/.test(text);
  return { text, digits, isDoc };
}

export function useConsorciadoSearch(query: string, enabled = true) {
  const trimmed = (query || '').trim();
  return useQuery({
    queryKey: ['consorciado-search', trimmed.toLowerCase()],
    enabled: enabled && trimmed.length >= 3,
    staleTime: 30_000,
    queryFn: async (): Promise<ConsorciadoMatch[]> => {
      const { text, digits, isDoc } = normalizeForLike(trimmed);
      const like = `%${text}%`;
      const digitsLike = digits ? `%${digits}%` : null;

      // 1) consortium_cards
      const ccPromise = (async () => {
        let q = supabase
          .from('consortium_cards')
          .select('id, tipo_pessoa, nome_completo, razao_social, cpf, cnpj, telefone, email, telefone_comercial, email_comercial, grupo, cota, status')
          .limit(15);
        if (isDoc && digitsLike) {
          q = q.or(`cpf.ilike.${digitsLike},cnpj.ilike.${digitsLike}`);
        } else if (digits.length >= 6) {
          q = q.or(
            `nome_completo.ilike.${like},razao_social.ilike.${like},email.ilike.${like},email_comercial.ilike.${like},telefone.ilike.${`%${digits}%`},telefone_comercial.ilike.${`%${digits}%`}`
          );
        } else {
          q = q.or(`nome_completo.ilike.${like},razao_social.ilike.${like},email.ilike.${like},email_comercial.ilike.${like}`);
        }
        const { data } = await q;
        return (data || []).map<ConsorciadoMatch>((r: any) => ({
          source: 'consortium',
          id: r.id,
          tipo_pessoa: r.tipo_pessoa,
          nome: r.nome_completo || r.razao_social || null,
          razao_social: r.razao_social,
          cpf_cnpj: r.cpf || r.cnpj || null,
          telefone: r.telefone || r.telefone_comercial || null,
          email: r.email || r.email_comercial || null,
          grupo: r.grupo,
          cota: r.cota,
          status: r.status,
        }));
      })();

      // 2) crm_contacts (+ último deal)
      const crmPromise = (async () => {
        let q = supabase
          .from('crm_contacts')
          .select('id, name, email, phone')
          .eq('is_archived', false)
          .limit(15);
        if (digits.length >= 6) {
          q = q.or(`name.ilike.${like},email.ilike.${like},phone.ilike.${`%${digits}%`}`);
        } else {
          q = q.or(`name.ilike.${like},email.ilike.${like}`);
        }
        const { data } = await q;
        return (data || []).map<ConsorciadoMatch>((r: any) => ({
          source: 'crm',
          id: r.id,
          nome: r.name,
          cpf_cnpj: null,
          telefone: r.phone,
          email: r.email,
        }));
      })();

      // 3) hubla_transactions
      const hubPromise = (async () => {
        let q = supabase
          .from('hubla_transactions')
          .select('id, customer_name, customer_email, customer_phone, customer_document, product_name, product_code, sale_date, net_value')
          .order('sale_date', { ascending: false })
          .limit(15);
        if (isDoc && digitsLike) {
          q = q.ilike('customer_document', digitsLike);
        } else if (digits.length >= 6) {
          q = q.or(`customer_name.ilike.${like},customer_email.ilike.${like},customer_phone.ilike.${`%${digits}%`}`);
        } else {
          q = q.or(`customer_name.ilike.${like},customer_email.ilike.${like}`);
        }
        const { data } = await q;
        // dedupe por (email|doc|phone)
        const seen = new Set<string>();
        const out: ConsorciadoMatch[] = [];
        for (const r of data || []) {
          const key = `${(r.customer_email || '').toLowerCase()}|${onlyDigits(r.customer_document || '')}|${onlyDigits(r.customer_phone || '')}`;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({
            source: 'hubla',
            id: r.id,
            nome: r.customer_name,
            cpf_cnpj: r.customer_document,
            telefone: r.customer_phone,
            email: r.customer_email,
            product_name: r.product_name,
            product_code: r.product_code,
            sale_date: r.sale_date,
            net_value: r.net_value,
          });
        }
        return out;
      })();

      const [cc, crm, hub] = await Promise.all([ccPromise, crmPromise, hubPromise]);
      return [...cc, ...crm, ...hub];
    },
  });
}

export interface ConsorciadoHistory {
  cards: Array<{ id: string; grupo: string; cota: string; status: string; valor_credito: number; data_contratacao: string | null; data_reserva: string | null; tipo_produto: string }>;
  deals: Array<{ id: string; name: string; product_name: string | null; stage_id: string | null; created_at: string; value: number | null; origin_id: string | null }>;
  hubla: Array<{ id: string; product_name: string | null; product_code: string | null; sale_date: string | null; net_value: number | null; sale_status: string | null }>;
}

export function useConsorciadoHistory(match: ConsorciadoMatch | null) {
  return useQuery({
    queryKey: ['consorciado-history', match?.source, match?.id, match?.email, match?.cpf_cnpj, match?.telefone],
    enabled: !!match,
    staleTime: 30_000,
    queryFn: async (): Promise<ConsorciadoHistory> => {
      const email = (match!.email || '').toLowerCase().trim() || null;
      const doc = onlyDigits(match!.cpf_cnpj || '') || null;
      const phoneDigits = onlyDigits(match!.telefone || '');
      const phoneSuffix = phoneDigits ? phoneDigits.slice(-9) : null;

      // Cards (cotas anteriores)
      const cardsPromise = (async () => {
        const orParts: string[] = [];
        if (email) orParts.push(`email.eq.${email},email_comercial.eq.${email}`);
        if (doc) {
          orParts.push(`cpf.eq.${doc}`);
          orParts.push(`cnpj.eq.${doc}`);
        }
        if (phoneSuffix) orParts.push(`telefone.ilike.%${phoneSuffix}`);
        if (!orParts.length) return [];
        const { data } = await supabase
          .from('consortium_cards')
          .select('id, grupo, cota, status, valor_credito, data_contratacao, data_reserva, tipo_produto')
          .or(orParts.join(','))
          .order('created_at', { ascending: false })
          .limit(20);
        return (data || []) as any;
      })();

      // CRM deals
      const dealsPromise = (async () => {
        if (!email && !phoneSuffix) return [];
        const conds: string[] = [];
        if (email) conds.push(`email.eq.${email}`);
        if (phoneSuffix) conds.push(`phone.ilike.%${phoneSuffix}`);
        const { data: contacts } = await supabase
          .from('crm_contacts')
          .select('id')
          .or(conds.join(','))
          .limit(20);
        const ids = (contacts || []).map((c: any) => c.id);
        if (!ids.length) return [];
        const { data } = await supabase
          .from('crm_deals')
          .select('id, name, product_name, stage_id, created_at, value, origin_id')
          .in('contact_id', ids)
          .eq('is_archived', false)
          .order('created_at', { ascending: false })
          .limit(20);
        return (data || []) as any;
      })();

      // Hubla
      const hublaPromise = (async () => {
        const orParts: string[] = [];
        if (email) orParts.push(`customer_email.eq.${email}`);
        if (doc) orParts.push(`customer_document.ilike.%${doc}%`);
        if (phoneSuffix) orParts.push(`customer_phone.ilike.%${phoneSuffix}`);
        if (!orParts.length) return [];
        const { data } = await supabase
          .from('hubla_transactions')
          .select('id, product_name, product_code, sale_date, net_value, sale_status')
          .or(orParts.join(','))
          .order('sale_date', { ascending: false })
          .limit(20);
        return (data || []) as any;
      })();

      const [cards, deals, hubla] = await Promise.all([cardsPromise, dealsPromise, hublaPromise]);
      return { cards, deals, hubla };
    },
  });
}