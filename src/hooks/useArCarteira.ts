import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ParcelaCalc } from '@/lib/arCobrancaCalc';

export interface TituloCarteira {
  id: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  customer_document: string | null;
  product_code: string | null;
  product_name: string;
  valor_total: number;
  payment_method: string | null;
  status: string;
  cobranca_stage: string | null;
  cobranca_responsavel_id: string | null;
  sale_date: string | null;
}

async function fetchAll<T>(table: string, cols: string): Promise<T[]> {
  const out: T[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
      .from(table as any)
      .select(cols)
      .order('id')
      .range(from, from + page - 1);
    if (error) throw error;
    out.push(...((data ?? []) as unknown as T[]));
    if (!data || data.length < page) break;
  }
  return out;
}

/** Carteira completa (todos os títulos e parcelas) — fonte única das abas de gestão de cobrança. */
export function useArCarteira() {
  return useQuery({
    queryKey: ['ar-titulos', 'carteira'],
    staleTime: 60_000,
    queryFn: async () => {
      const [titulos, parcelas] = await Promise.all([
        fetchAll<TituloCarteira>(
          'ar_titulos',
          'id,customer_name,customer_email,customer_phone,customer_document,product_code,product_name,valor_total,payment_method,status,cobranca_stage,cobranca_responsavel_id,sale_date',
        ),
        fetchAll<ParcelaCalc>(
          'ar_parcelas',
          'id,titulo_id,numero,valor,valor_pago,status,data_vencimento,data_pagamento',
        ),
      ]);
      const porTitulo = new Map<string, ParcelaCalc[]>();
      for (const p of parcelas) {
        const l = porTitulo.get(p.titulo_id) ?? [];
        l.push(p);
        porTitulo.set(p.titulo_id, l);
      }
      porTitulo.forEach((l) => l.sort((a, b) => a.numero - b.numero));
      const tituloMap = new Map(titulos.map((t) => [t.id, t]));
      return { titulos, parcelas, porTitulo, tituloMap };
    },
  });
}
