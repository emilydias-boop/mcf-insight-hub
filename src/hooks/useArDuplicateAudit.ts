import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ArDupTitulo {
  id: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  customer_document: string | null;
  product_name: string | null;
  product_code: string | null;
  valor_total: number | null;
  status: string | null;
  sale_date: string | null;
  created_at: string | null;
}

export interface ArDupGroup {
  key: string;
  matchedFields: string[];
  titulos: ArDupTitulo[];
}

const onlyDigits = (v?: string | null) => (v || '').replace(/\D/g, '');
const normEmail = (v?: string | null) => (v || '').trim().toLowerCase();

export const normName = (v?: string | null) =>
  (v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Primeiro + último nome — pega "Noé Thomas Ameli Teixeira dos Santos" vs "Noe thomas ameli" só parcialmente,
 *  por isso usamos também prefixo de 2 tokens. */
const nameTokens = (v?: string | null) => normName(v).split(' ').filter((t) => t.length > 1);
const namePrefix = (v?: string | null) => nameTokens(v).slice(0, 2).join(' ');

/** Union-Find simples para agrupar por qualquer chave em comum. */
function buildGroups(rows: ArDupTitulo[]): ArDupGroup[] {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    const p = parent.get(x);
    if (!p || p === x) { parent.set(x, x); return x; }
    const r = find(p);
    parent.set(x, r);
    return r;
  };
  const union = (a: string, b: string) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  const byKey = new Map<string, { field: string; ids: string[] }>();
  const push = (field: string, raw: string, id: string) => {
    const k = `${field}:${raw}`;
    const cur = byKey.get(k) || { field, ids: [] };
    cur.ids.push(id);
    byKey.set(k, cur);
  };

  for (const r of rows) {
    find(r.id);
    const email = normEmail(r.customer_email);
    if (email && email.includes('@')) push('E-mail', email, r.id);
    const phone = onlyDigits(r.customer_phone).slice(-9);
    if (phone.length === 9) push('Telefone', phone, r.id);
    const doc = onlyDigits(r.customer_document);
    if (doc.length >= 11) push('CPF/CNPJ', doc, r.id);
    const np = namePrefix(r.customer_name);
    if (np && np.split(' ').length >= 2) push('Nome', np, r.id);
  }

  const fieldsById = new Map<string, Set<string>>();
  for (const { field, ids } of byKey.values()) {
    if (ids.length < 2) continue;
    for (let i = 1; i < ids.length; i++) union(ids[0], ids[i]);
    for (const id of ids) {
      const s = fieldsById.get(id) || new Set<string>();
      s.add(field);
      fieldsById.set(id, s);
    }
  }

  const clusters = new Map<string, ArDupTitulo[]>();
  for (const r of rows) {
    if (!fieldsById.has(r.id)) continue;
    const root = find(r.id);
    (clusters.get(root) || clusters.set(root, []).get(root)!).push(r);
  }

  const groups: ArDupGroup[] = [];
  for (const [key, titulos] of clusters.entries()) {
    if (titulos.length < 2) continue;
    // só interessa quando os cadastros divergem em algo (nome/e-mail/telefone/doc)
    const distinctIdentity = new Set(
      titulos.map((t) =>
        [normName(t.customer_name), normEmail(t.customer_email), onlyDigits(t.customer_phone).slice(-9), onlyDigits(t.customer_document)].join('|'),
      ),
    );
    if (distinctIdentity.size < 2) continue;

    const fields = new Set<string>();
    for (const t of titulos) for (const f of fieldsById.get(t.id) || []) fields.add(f);
    groups.push({
      key,
      matchedFields: [...fields],
      titulos: titulos.sort((a, b) => (b.sale_date || '').localeCompare(a.sale_date || '')),
    });
  }
  return groups.sort((a, b) => b.titulos.length - a.titulos.length);
}

export function useArDuplicateAudit(enabled = true) {
  return useQuery({
    queryKey: ['ar-duplicate-audit'],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<ArDupGroup[]> => {
      const { data, error } = await supabase
        .from('ar_titulos' as any)
        .select('id, customer_name, customer_email, customer_phone, customer_document, product_name, product_code, valor_total, status, sale_date, created_at')
        .order('created_at', { ascending: false })
        .limit(3000);
      if (error) throw error;
      return buildGroups((data || []) as unknown as ArDupTitulo[]);
    },
  });
}

export interface UnifyPayload {
  canonical: ArDupTitulo;
  targetIds: string[];
}

/** Unifica os cadastros: aplica os dados do título canônico aos demais títulos do grupo. */
export function useUnifyArCadastros() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ canonical, targetIds }: UnifyPayload) => {
      const ids = targetIds.filter((id) => id !== canonical.id);
      if (ids.length === 0) return 0;

      const patch = {
        customer_name: canonical.customer_name,
        customer_email: canonical.customer_email,
        customer_phone: canonical.customer_phone,
        customer_document: canonical.customer_document,
      };

      const { error } = await supabase
        .from('ar_titulos' as any)
        .update(patch as any)
        .in('id', ids);
      if (error) throw error;

      const { data: userData } = await supabase.auth.getUser();
      await supabase.from('ar_historico' as any).insert(
        ids.map((id) => ({
          titulo_id: id,
          tipo: 'cadastro_unificado',
          descricao: `Cadastro unificado com "${canonical.customer_name}" (título ${canonical.id})`,
          metadata: { canonical_titulo_id: canonical.id, applied: patch } as any,
          created_by: userData?.user?.id ?? null,
        })) as any,
      );

      return ids.length;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ar-duplicate-audit'] });
      qc.invalidateQueries({ queryKey: ['ar-titulos'] });
    },
  });
}
