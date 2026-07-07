import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ArTitulo, ArParcela, ArHistorico, ArTituloStatus, ArParcelaStatus } from '@/types/aReceber';

// ============ TÍTULOS ============
export interface ArTitulosFilters {
  status?: ArTituloStatus | 'todos';
  tipo?: string;
  product_code?: string;
  search?: string;
  responsavel_id?: string;
}

export function useArTitulos(filters: ArTitulosFilters = {}) {
  return useQuery({
    queryKey: ['ar-titulos', filters],
    queryFn: async () => {
      let query = supabase
        .from('ar_titulos' as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (filters.status && filters.status !== 'todos') query = query.eq('status', filters.status);
      if (filters.tipo && filters.tipo !== 'todos') query = query.eq('tipo', filters.tipo);
      if (filters.product_code && filters.product_code !== 'todos') query = query.eq('product_code', filters.product_code);
      if (filters.responsavel_id) query = query.eq('responsavel_id', filters.responsavel_id);
      if (filters.search) {
        const s = filters.search.trim();
        query = query.or(`customer_name.ilike.%${s}%,customer_email.ilike.%${s}%,customer_document.ilike.%${s}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      const titulos = (data || []) as unknown as ArTitulo[];

      if (titulos.length === 0) return titulos;

      // Enrich com parcelas
      const ids = titulos.map(t => t.id);
      const { data: parcelas } = await supabase
        .from('ar_parcelas' as any)
        .select('titulo_id,valor,valor_pago,status')
        .in('titulo_id', ids);

      const map = new Map<string, { pago: number; pendente: number; qtdPagas: number; qtdTotal: number }>();
      (parcelas as any[] | null)?.forEach(p => {
        const cur = map.get(p.titulo_id) || { pago: 0, pendente: 0, qtdPagas: 0, qtdTotal: 0 };
        cur.qtdTotal += 1;
        if (p.status === 'pago') {
          cur.pago += Number(p.valor_pago ?? p.valor ?? 0);
          cur.qtdPagas += 1;
        } else if (p.status !== 'cancelado') {
          cur.pendente += Number(p.valor ?? 0);
        }
        map.set(p.titulo_id, cur);
      });

      return titulos.map(t => {
        const m = map.get(t.id);
        return {
          ...t,
          valor_pago: m?.pago ?? 0,
          valor_pendente: m?.pendente ?? Number(t.valor_total),
          parcelas_pagas: m?.qtdPagas ?? 0,
          parcelas_total: m?.qtdTotal ?? 0,
        };
      });
    },
  });
}

export function useArTitulo(id: string | null) {
  return useQuery({
    queryKey: ['ar-titulo', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase.from('ar_titulos' as any).select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data as unknown as ArTitulo | null;
    },
    enabled: !!id,
  });
}

export function useUpdateArTitulo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<ArTitulo> & { id: string }) => {
      const { error } = await supabase.from('ar_titulos' as any).update(patch as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['ar-titulos'] });
      qc.invalidateQueries({ queryKey: ['ar-titulo', vars.id] });
    },
  });
}

export function useCreateArTitulo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<ArTitulo>) => {
      const { data, error } = await supabase.from('ar_titulos' as any).insert(payload as any).select().single();
      if (error) throw error;
      return data as unknown as ArTitulo;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ar-titulos'] }),
  });
}

// ============ PARCELAS ============
export function useArParcelas(tituloId: string | null) {
  return useQuery({
    queryKey: ['ar-parcelas', tituloId],
    queryFn: async () => {
      if (!tituloId) return [];
      const { data, error } = await supabase
        .from('ar_parcelas' as any)
        .select('*')
        .eq('titulo_id', tituloId)
        .order('numero', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as ArParcela[];
    },
    enabled: !!tituloId,
  });
}

export function useCreateArParcelas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tituloId, parcelas }: { tituloId: string; parcelas: Partial<ArParcela>[] }) => {
      const payload = parcelas.map(p => ({ ...p, titulo_id: tituloId }));
      const { error } = await supabase.from('ar_parcelas' as any).insert(payload as any);
      if (error) throw error;
      // log
      await supabase.from('ar_historico' as any).insert({
        titulo_id: tituloId,
        tipo: 'lancamento_parcelas',
        descricao: `Lançamento de ${parcelas.length} parcela(s)`,
      } as any);
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['ar-parcelas', vars.tituloId] });
      qc.invalidateQueries({ queryKey: ['ar-titulos'] });
      qc.invalidateQueries({ queryKey: ['ar-historico', vars.tituloId] });
    },
  });
}

export function useUpdateArParcela() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, tituloId, ...patch }: Partial<ArParcela> & { id: string; tituloId: string }) => {
      const { error } = await supabase.from('ar_parcelas' as any).update(patch as any).eq('id', id);
      if (error) throw error;
      return tituloId;
    },
    onSuccess: (tituloId) => {
      qc.invalidateQueries({ queryKey: ['ar-parcelas', tituloId] });
      qc.invalidateQueries({ queryKey: ['ar-titulos'] });
    },
  });
}

export function useMarkArParcelaPaga() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, tituloId, valor_pago, data_pagamento, forma_pagamento }: {
      id: string; tituloId: string; valor_pago: number; data_pagamento: string; forma_pagamento?: string;
    }) => {
      const { error } = await supabase
        .from('ar_parcelas' as any)
        .update({ status: 'pago', valor_pago, data_pagamento, forma_pagamento: forma_pagamento || null } as any)
        .eq('id', id);
      if (error) throw error;
      await supabase.from('ar_historico' as any).insert({
        titulo_id: tituloId,
        parcela_id: id,
        tipo: 'baixa_parcela',
        descricao: `Parcela baixada (${forma_pagamento || 'sem forma'})`,
        valor: valor_pago,
      } as any);
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['ar-parcelas', vars.tituloId] });
      qc.invalidateQueries({ queryKey: ['ar-titulos'] });
      qc.invalidateQueries({ queryKey: ['ar-titulo', vars.tituloId] });
      qc.invalidateQueries({ queryKey: ['ar-historico', vars.tituloId] });
    },
  });
}

export function useDeleteArParcela() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, tituloId }: { id: string; tituloId: string }) => {
      const { error } = await supabase.from('ar_parcelas' as any).delete().eq('id', id);
      if (error) throw error;
      return tituloId;
    },
    onSuccess: (tituloId) => {
      qc.invalidateQueries({ queryKey: ['ar-parcelas', tituloId] });
      qc.invalidateQueries({ queryKey: ['ar-titulos'] });
    },
  });
}

// ============ HISTÓRICO ============
export function useArHistorico(tituloId: string | null) {
  return useQuery({
    queryKey: ['ar-historico', tituloId],
    queryFn: async () => {
      if (!tituloId) return [];
      const { data, error } = await supabase
        .from('ar_historico' as any)
        .select('*')
        .eq('titulo_id', tituloId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ArHistorico[];
    },
    enabled: !!tituloId,
  });
}

// ============ RESPONSÁVEIS (financeiro/admin) ============
export function useFinanceiroUsers() {
  return useQuery({
    queryKey: ['financeiro-users'],
    queryFn: async () => {
      const { data: roles, error: e1 } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['financeiro', 'admin'] as any);
      if (e1) throw e1;
      const ids = Array.from(new Set((roles ?? []).map(r => r.user_id).filter(Boolean)));
      if (ids.length === 0) return [];
      const { data: profs, error: e2 } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', ids);
      if (e2) throw e2;
      return (profs ?? [])
        .map(p => ({ id: p.id, full_name: p.full_name || p.email || '(sem nome)', email: p.email || '' }))
        .sort((a, b) => a.full_name.localeCompare(b.full_name));
    },
  });
}