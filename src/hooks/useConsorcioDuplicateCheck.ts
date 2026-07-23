import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DuplicateMatch {
  source: 'card' | 'pending';
  id: string;
  nome: string | null;
  cpf: string | null;
  cnpj: string | null;
  email: string | null;
  telefone: string | null;
  grupo?: string | null;
  cota?: string | null;
  status?: string | null;
  valor_credito?: number | null;
  created_at?: string | null;
  matchedFields: string[];
}

const onlyDigits = (v?: string | null) => (v || '').replace(/\D/g, '');
const normStr = (v?: string | null) => (v || '').trim().toLowerCase();

interface Params {
  cpf?: string | null;
  cnpj?: string | null;
  email?: string | null;
  telefone?: string | null;
  nome?: string | null;
  excludeRegistrationId?: string | null;
  excludeCardId?: string | null;
  enabled?: boolean;
}

export function useConsorcioDuplicateCheck({
  cpf,
  cnpj,
  email,
  telefone,
  nome,
  excludeRegistrationId,
  excludeCardId,
  enabled = true,
}: Params) {
  const cpfD = onlyDigits(cpf);
  const cnpjD = onlyDigits(cnpj);
  const emailN = normStr(email);
  const phoneD = onlyDigits(telefone);
  const phoneSuffix = phoneD.slice(-9); // last 9 digits (Brazil match)
  const nomeN = normStr(nome);

  const hasAnyKey = !!(cpfD || cnpjD || emailN || (phoneSuffix && phoneSuffix.length >= 8) || (nomeN && nomeN.length >= 4));

  return useQuery({
    queryKey: ['consorcio-duplicate-check', cpfD, cnpjD, emailN, phoneSuffix, nomeN, excludeRegistrationId, excludeCardId],
    enabled: enabled && hasAnyKey,
    staleTime: 30_000,
    queryFn: async (): Promise<DuplicateMatch[]> => {
      const results: DuplicateMatch[] = [];

      // ---- consortium_cards
      const orClausesCards: string[] = [];
      if (cpfD) orClausesCards.push(`cpf.eq.${cpfD}`);
      if (cnpjD) orClausesCards.push(`cnpj.eq.${cnpjD}`);
      if (emailN) orClausesCards.push(`email.ilike.${emailN}`);
      if (phoneSuffix && phoneSuffix.length >= 8) orClausesCards.push(`telefone.ilike.%${phoneSuffix}%`);
      if (nomeN && nomeN.length >= 4) orClausesCards.push(`nome_completo.ilike.%${nomeN}%`);
      if (orClausesCards.length > 0) {
        let q = supabase
          .from('consortium_cards')
          .select('id, nome_completo, razao_social, cpf, cnpj, email, telefone, grupo, cota, status, valor_credito, created_at')
          .or(orClausesCards.join(','))
          .limit(50);
        if (excludeCardId) q = q.neq('id', excludeCardId);
        const { data } = await q;
        for (const c of data || []) {
          const matched: string[] = [];
          if (cpfD && onlyDigits((c as any).cpf) === cpfD) matched.push('CPF');
          if (cnpjD && onlyDigits((c as any).cnpj) === cnpjD) matched.push('CNPJ');
          if (emailN && normStr((c as any).email) === emailN) matched.push('E-mail');
          if (phoneSuffix && onlyDigits((c as any).telefone).endsWith(phoneSuffix)) matched.push('Telefone');
          if (nomeN && normStr((c as any).nome_completo).includes(nomeN)) matched.push('Nome');
          if (matched.length === 0) continue;
          results.push({
            source: 'card',
            id: (c as any).id,
            nome: (c as any).nome_completo || (c as any).razao_social,
            cpf: (c as any).cpf,
            cnpj: (c as any).cnpj,
            email: (c as any).email,
            telefone: (c as any).telefone,
            grupo: (c as any).grupo,
            cota: (c as any).cota,
            status: (c as any).status,
            valor_credito: (c as any).valor_credito,
            created_at: (c as any).created_at,
            matchedFields: matched,
          });
        }
      }

      // ---- consorcio_pending_registrations
      const orClausesPend: string[] = [];
      if (cpfD) orClausesPend.push(`cpf.eq.${cpfD}`);
      if (cnpjD) orClausesPend.push(`cnpj.eq.${cnpjD}`);
      if (emailN) orClausesPend.push(`email.ilike.${emailN}`);
      if (phoneSuffix && phoneSuffix.length >= 8) orClausesPend.push(`telefone.ilike.%${phoneSuffix}%`);
      if (nomeN && nomeN.length >= 4) orClausesPend.push(`nome_completo.ilike.%${nomeN}%`);
      if (orClausesPend.length > 0) {
        let q = supabase
          .from('consorcio_pending_registrations')
          .select('id, nome_completo, razao_social, cpf, cnpj, email, telefone, valor_credito, grupo, cota, status, created_at')
          .or(orClausesPend.join(','))
          .limit(50);
        if (excludeRegistrationId) q = q.neq('id', excludeRegistrationId);
        const { data } = await q;
        for (const c of data || []) {
          const matched: string[] = [];
          if (cpfD && onlyDigits((c as any).cpf) === cpfD) matched.push('CPF');
          if (cnpjD && onlyDigits((c as any).cnpj) === cnpjD) matched.push('CNPJ');
          if (emailN && normStr((c as any).email) === emailN) matched.push('E-mail');
          if (phoneSuffix && onlyDigits((c as any).telefone).endsWith(phoneSuffix)) matched.push('Telefone');
          if (nomeN && normStr((c as any).nome_completo).includes(nomeN)) matched.push('Nome');
          if (matched.length === 0) continue;
          results.push({
            source: 'pending',
            id: (c as any).id,
            nome: (c as any).nome_completo || (c as any).razao_social,
            cpf: (c as any).cpf,
            cnpj: (c as any).cnpj,
            email: (c as any).email,
            telefone: (c as any).telefone,
            grupo: (c as any).grupo,
            cota: (c as any).cota,
            status: (c as any).status,
            valor_credito: (c as any).valor_credito,
            created_at: (c as any).created_at,
            matchedFields: matched,
          });
        }
      }

      // dedupe by (source,id)
      const seen = new Set<string>();
      return results.filter((r) => {
        const k = `${r.source}:${r.id}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    },
  });
}