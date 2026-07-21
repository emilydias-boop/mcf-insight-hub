import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ArReembolso, ArReembolsoStatus } from '@/types/aReceber';

export interface ArReembolsoWithTitulo extends ArReembolso {
  titulo?: {
    id: string;
    customer_name: string;
    customer_email: string | null;
    customer_document: string | null;
    product_code: string | null;
    product_name: string;
    valor_total: number;
  } | null;
}

export function useArReembolsos(filters?: { status?: ArReembolsoStatus | 'todos' }) {
  return useQuery({
    queryKey: ['ar-reembolsos', filters],
    queryFn: async () => {
      let q = supabase
        .from('ar_reembolsos' as any)
        .select('*')
        .order('data_pedido', { ascending: false });
      if (filters?.status && filters.status !== 'todos') {
        q = q.eq('status', filters.status);
      }
      const { data, error } = await q;
      if (error) throw error;
      const list = (data || []) as unknown as ArReembolso[];
      if (list.length === 0) return [] as ArReembolsoWithTitulo[];
      const titIds = Array.from(new Set(list.map((r) => r.titulo_id)));
      const { data: tits } = await supabase
        .from('ar_titulos' as any)
        .select('id, customer_name, customer_email, customer_document, product_code, product_name, valor_total')
        .in('id', titIds);
      const map = new Map<string, any>();
      (tits || []).forEach((t: any) => map.set(t.id, t));
      return list.map((r) => ({ ...r, titulo: map.get(r.titulo_id) ?? null })) as ArReembolsoWithTitulo[];
    },
  });
}

/**
 * Cria reembolso total (baixa sem numerário):
 *  - registra o reembolso com status pendente
 *  - estorna todas as parcelas pagas do título (valor_pago=0, status=pendente)
 *  - marca o título como "reembolsado"
 *  - grava histórico
 */
export function useCriarReembolso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      titulo_id: string;
      valor: number;
      motivo?: string;
      data_pedido: string;
      data_prevista_pagamento?: string | null;
    }) => {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id ?? null;

      // 1) cria o reembolso
      const { data: reemb, error: er } = await supabase
        .from('ar_reembolsos' as any)
        .insert({
          titulo_id: input.titulo_id,
          valor: input.valor,
          motivo: input.motivo || null,
          data_pedido: input.data_pedido,
          data_prevista_pagamento: input.data_prevista_pagamento || null,
          status: 'pendente',
          created_by: userId,
        } as any)
        .select()
        .single();
      if (er) throw er;

      // 2) estorna parcelas pagas -> voltam para pendente
      const { data: parcelas, error: ep } = await supabase
        .from('ar_parcelas' as any)
        .select('id, valor, valor_pago, status')
        .eq('titulo_id', input.titulo_id)
        .eq('status', 'pago');
      if (ep) throw ep;

      for (const p of (parcelas || []) as any[]) {
        await supabase
          .from('ar_parcelas' as any)
          .update({
            status: 'pendente',
            valor_pago: 0,
            data_pagamento: null,
            forma_pagamento: null,
          } as any)
          .eq('id', p.id);
      }

      // 3) marca título como reembolsado
      await supabase
        .from('ar_titulos' as any)
        .update({ status: 'reembolsado' } as any)
        .eq('id', input.titulo_id);

      // 4) histórico
      await supabase.from('ar_historico' as any).insert({
        titulo_id: input.titulo_id,
        tipo: 'reembolso_solicitado',
        descricao: `Reembolso solicitado (baixa sem numerário) — ${input.motivo || 'sem motivo'}`,
        valor: input.valor,
        metadata: { reembolso_id: (reemb as any)?.id, data_prevista: input.data_prevista_pagamento || null },
      } as any);

      return reemb as unknown as ArReembolso;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ar-reembolsos'] });
      qc.invalidateQueries({ queryKey: ['ar-titulos'] });
      qc.invalidateQueries({ queryKey: ['ar-parcelas'] });
      qc.invalidateQueries({ queryKey: ['ar-historico'] });
    },
  });
}

export function useMarcarReembolsoPago() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data_pagamento }: { id: string; data_pagamento: string }) => {
      const { data: reemb, error } = await supabase
        .from('ar_reembolsos' as any)
        .update({ status: 'pago', data_pagamento } as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      const r = reemb as any;
      await supabase.from('ar_historico' as any).insert({
        titulo_id: r.titulo_id,
        tipo: 'reembolso_pago',
        descricao: `Reembolso pago em ${data_pagamento}`,
        valor: Number(r.valor || 0),
        metadata: { reembolso_id: r.id },
      } as any);
      return r;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ar-reembolsos'] });
      qc.invalidateQueries({ queryKey: ['ar-historico'] });
    },
  });
}

export function useCancelarReembolso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { data: reemb, error } = await supabase
        .from('ar_reembolsos' as any)
        .update({ status: 'cancelado' } as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      const r = reemb as any;
      await supabase.from('ar_historico' as any).insert({
        titulo_id: r.titulo_id,
        tipo: 'reembolso_cancelado',
        descricao: 'Reembolso cancelado',
        valor: Number(r.valor || 0),
        metadata: { reembolso_id: r.id },
      } as any);
      return r;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ar-reembolsos'] });
      qc.invalidateQueries({ queryKey: ['ar-historico'] });
    },
  });
}

/** Totais do mês corrente para os cards no topo da listagem. */
export function useReembolsoTotais() {
  return useQuery({
    queryKey: ['ar-reembolsos-totais'],
    queryFn: async () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const iso = (d: Date) => d.toISOString().slice(0, 10);

      const [pend, pagos] = await Promise.all([
        supabase
          .from('ar_reembolsos' as any)
          .select('valor,data_pedido')
          .eq('status', 'pendente'),
        supabase
          .from('ar_reembolsos' as any)
          .select('valor,data_pagamento')
          .eq('status', 'pago')
          .gte('data_pagamento', iso(start))
          .lt('data_pagamento', iso(end)),
      ]);

      const somaPendentes = ((pend.data || []) as any[]).reduce(
        (s, r) => s + Number(r.valor || 0),
        0,
      );
      const qtdPendentes = ((pend.data || []) as any[]).length;
      const somaPagos = ((pagos.data || []) as any[]).reduce(
        (s, r) => s + Number(r.valor || 0),
        0,
      );
      const qtdPagos = ((pagos.data || []) as any[]).length;

      return { somaPendentes, qtdPendentes, somaPagos, qtdPagos };
    },
  });
}