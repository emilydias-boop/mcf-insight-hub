import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ArTitulo, ArParcela, ArHistorico, ArTituloStatus, ArParcelaStatus, ArCobrancaStage } from '@/types/aReceber';

// ============ TÍTULOS ============
export interface ArTitulosFilters {
  status?: ArTituloStatus | 'todos';
  tipo?: string;
  product_code?: string;
  search?: string;
  responsavel_id?: string;
  cobranca_stage?: ArCobrancaStage | 'todos';
}

export function useArTitulos(filters: ArTitulosFilters = {}) {
  return useQuery({
    queryKey: ['ar-titulos', filters],
    queryFn: async () => {
      let query = supabase
        .from('ar_titulos' as any)
        .select('*')
        .order('sale_date', { ascending: false });

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
        .select('titulo_id,valor,valor_pago,status,data_vencimento')
        .in('titulo_id', ids);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const monthKey = `${today.getFullYear()}-${today.getMonth()}`;

      type Agg = {
        pago: number; pendente: number; qtdPagas: number; qtdTotal: number;
        hasAtraso: boolean; hasMes: boolean;
        proxima: string | null; diasAtraso: number;
      };
      const map = new Map<string, Agg>();
      (parcelas as any[] | null)?.forEach(p => {
        const cur = map.get(p.titulo_id) || {
          pago: 0, pendente: 0, qtdPagas: 0, qtdTotal: 0,
          hasAtraso: false, hasMes: false, proxima: null, diasAtraso: 0,
        };
        cur.qtdTotal += 1;
        if (p.status === 'pago') {
          cur.pago += Number(p.valor_pago ?? p.valor ?? 0);
          cur.qtdPagas += 1;
        } else if (p.status !== 'cancelado') {
          cur.pendente += Number(p.valor ?? 0);
          const dv = p.data_vencimento ? new Date(p.data_vencimento + 'T00:00:00') : null;
          if (dv) {
            const dvMonthKey = `${dv.getFullYear()}-${dv.getMonth()}`;
            if (dv < today) {
              cur.hasAtraso = true;
              const dias = Math.floor((today.getTime() - dv.getTime()) / 86400000);
              if (dias > cur.diasAtraso) cur.diasAtraso = dias;
            } else if (dvMonthKey === monthKey) {
              cur.hasMes = true;
            }
            if (!cur.proxima || dv < new Date(cur.proxima + 'T00:00:00')) {
              cur.proxima = p.data_vencimento;
            }
          }
        }
        map.set(p.titulo_id, cur);
      });

      const enriched: ArTitulo[] = titulos.map(t => {
        const m = map.get(t.id);
        // Credit card via Hubla é pago 100% no ato pela adquirente,
        // independente do número de parcelas cobradas do cliente.
        // Consideramos o título totalmente recebido nesses casos.
        const isCreditCardHubla = (t.payment_method || '').toLowerCase() === 'credit_card';
        let stageEffective: ArCobrancaStage;
        if (t.cobranca_stage && t.cobranca_stage_manual) {
          stageEffective = t.cobranca_stage;
        } else if (t.cobranca_stage === 'judicial') {
          stageEffective = 'judicial';
        } else if (!isCreditCardHubla && m?.hasAtraso) {
          stageEffective = 'atraso';
        } else {
          stageEffective = 'mes';
        }
        const valorTotal = Number(t.valor_total) || 0;
        const pagoCalc = isCreditCardHubla ? valorTotal : (m?.pago ?? 0);
        const pendenteCalc = isCreditCardHubla ? 0 : (m?.pendente ?? valorTotal);
        return {
          ...t,
          valor_pago: pagoCalc,
          valor_pendente: pendenteCalc,
          parcelas_pagas: isCreditCardHubla ? (m?.qtdTotal ?? 0) : (m?.qtdPagas ?? 0),
          parcelas_total: m?.qtdTotal ?? 0,
          proxima_parcela: isCreditCardHubla ? null : (m?.proxima ?? null),
          dias_atraso: isCreditCardHubla ? 0 : (m?.diasAtraso ?? 0),
          stage_effective: stageEffective,
        };
      });

      if (filters.cobranca_stage && filters.cobranca_stage !== 'todos') {
        return enriched.filter(t => t.stage_effective === filters.cobranca_stage);
      }
      return enriched;
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

// ============ BAIXA EM LOTE ============
export function useBaixarTitulosLote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      tituloIds,
      data_pagamento,
      forma_pagamento,
    }: {
      tituloIds: string[];
      data_pagamento: string;
      forma_pagamento?: string;
    }) => {
      if (!tituloIds.length) return { titulos: 0, parcelas: 0 };

      // 1) Buscar títulos alvo
      const { data: titulos, error: e1 } = await supabase
        .from('ar_titulos' as any)
        .select('id, valor_total, status')
        .in('id', tituloIds);
      if (e1) throw e1;

      // 2) Buscar parcelas em aberto desses títulos
      const { data: parcelas, error: e2 } = await supabase
        .from('ar_parcelas' as any)
        .select('id, titulo_id, valor, status')
        .in('titulo_id', tituloIds)
        .not('status', 'in', '("pago","cancelado")');
      if (e2) throw e2;

      const parcelasList = (parcelas ?? []) as any[];
      const parcelasByTitulo = new Map<string, any[]>();
      parcelasList.forEach((p) => {
        const arr = parcelasByTitulo.get(p.titulo_id) ?? [];
        arr.push(p);
        parcelasByTitulo.set(p.titulo_id, arr);
      });

      let totalParcelasBaixadas = 0;

      for (const t of (titulos ?? []) as any[]) {
        const lista = parcelasByTitulo.get(t.id) ?? [];
        if (lista.length > 0) {
          // Baixar todas as parcelas em aberto do título
          for (const p of lista) {
            const valor = Number(p.valor ?? 0);
            const { error: eu } = await supabase
              .from('ar_parcelas' as any)
              .update({
                status: 'pago',
                valor_pago: valor,
                data_pagamento,
                forma_pagamento: forma_pagamento || null,
              } as any)
              .eq('id', p.id);
            if (eu) throw eu;
            await supabase.from('ar_historico' as any).insert({
              titulo_id: t.id,
              parcela_id: p.id,
              tipo: 'baixa_lote',
              descricao: `Baixa em lote (${forma_pagamento || 'sem forma'})`,
              valor,
            } as any);
            totalParcelasBaixadas += 1;
          }
        } else {
          // Sem parcelas: criar entrada integral quitando o título
          const valor = Number(t.valor_total ?? 0);
          if (valor > 0) {
            const { data: novaParc, error: ei } = await supabase
              .from('ar_parcelas' as any)
              .insert({
                titulo_id: t.id,
                numero: 0,
                tipo_parcela: 'entrada',
                valor,
                valor_pago: valor,
                data_vencimento: data_pagamento,
                data_pagamento,
                forma_pagamento: forma_pagamento || null,
                status: 'pago',
              } as any)
              .select()
              .single();
            if (ei) throw ei;
            await supabase.from('ar_historico' as any).insert({
              titulo_id: t.id,
              parcela_id: (novaParc as any)?.id ?? null,
              tipo: 'baixa_lote',
              descricao: `Baixa integral em lote (${forma_pagamento || 'sem forma'})`,
              valor,
            } as any);
            totalParcelasBaixadas += 1;
          }
        }

        // Marcar título como quitado / integral
        const { error: eut } = await supabase
          .from('ar_titulos' as any)
          .update({ status: 'quitado', tipo: 'integral' } as any)
          .eq('id', t.id);
        if (eut) throw eut;
      }

      return { titulos: (titulos ?? []).length, parcelas: totalParcelasBaixadas };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ar-titulos'] });
      qc.invalidateQueries({ queryKey: ['ar-parcelas'] });
      qc.invalidateQueries({ queryKey: ['ar-titulo'] });
      qc.invalidateQueries({ queryKey: ['ar-historico'] });
    },
  });
}

// ============ COBRANÇA STAGE ============
export function useUpdateCobrancaStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tituloId, stage, motivo }: { tituloId: string; stage: ArCobrancaStage; motivo?: string }) => {
      const { error } = await supabase
        .from('ar_titulos' as any)
        .update({
          cobranca_stage: stage,
          cobranca_stage_manual: true,
          cobranca_stage_updated_at: new Date().toISOString(),
        } as any)
        .eq('id', tituloId);
      if (error) throw error;
      await supabase.from('ar_historico' as any).insert({
        titulo_id: tituloId,
        tipo: 'mudanca_stage',
        descricao: motivo || `Stage alterado para ${stage}`,
        metadata: { stage },
      } as any);
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['ar-titulos'] });
      qc.invalidateQueries({ queryKey: ['ar-historico', vars.tituloId] });
    },
  });
}

export function useRegistrarCobrancaContato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tituloId, descricao }: { tituloId: string; descricao: string }) => {
      const { error } = await supabase.from('ar_historico' as any).insert({
        titulo_id: tituloId,
        tipo: 'contato_cobranca',
        descricao,
      } as any);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['ar-historico', vars.tituloId] });
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