import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { calcularComissao } from '@/lib/commissionCalculator';
import { TipoProduto } from '@/types/consorcio';

export interface PrevisaoMensalRow {
  ym: string;                // 'YYYY-MM' (mês de vencimento)
  comissaoPaga: number;      // parcelas com status='pago'
  comissaoAVencer: number;   // parcelas pendentes com vencimento >= hoje
  comissaoAtrasada: number;  // parcelas pendentes/atrasado com vencimento < hoje
  parcelasPagas: number;
  parcelasAVencer: number;
  parcelasAtrasadas: number;
  cotasSet: Set<string>;
}

export interface PrevisaoMensalResult {
  rows: PrevisaoMensalRow[];           // ordenado por ym asc
  totalRealizado: number;              // soma das pagas no range
  totalPrevisto: number;               // soma a vencer no range
  totalAtrasado: number;
}

const PAGE = 1000;

export function useConsorcioPrevisaoMensal(
  rangeStart = '2026-01-01',
  rangeEnd = '2026-12-31',
) {
  return useQuery({
    queryKey: ['consorcio-previsao-mensal', rangeStart, rangeEnd],
    queryFn: async (): Promise<PrevisaoMensalResult> => {
      // Busca paginada — só parcelas dentro da janela de comissão (<=12) de cotas ativas/contempladas
      let from = 0;
      const all: any[] = [];
      for (;;) {
        const { data, error } = await supabase
          .from('consortium_installments')
          .select(`
            id,
            card_id,
            numero_parcela,
            data_vencimento,
            status,
            consortium_cards!inner ( valor_credito, tipo_produto, status )
          `)
          .lte('numero_parcela', 12)
          .in('consortium_cards.status', ['ativo', 'contemplado'])
          .gte('data_vencimento', rangeStart)
          .lte('data_vencimento', rangeEnd)
          .range(from, from + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < PAGE) break;
        from += PAGE;
      }

      const hoje = new Date().toISOString().slice(0, 10);
      const map = new Map<string, PrevisaoMensalRow>();

      for (const inst of all) {
        const card = (inst as any).consortium_cards;
        if (!card) continue;
        const venc = inst.data_vencimento as string;
        const ym = venc.slice(0, 7);
        if (!map.has(ym)) {
          map.set(ym, {
            ym,
            comissaoPaga: 0,
            comissaoAVencer: 0,
            comissaoAtrasada: 0,
            parcelasPagas: 0,
            parcelasAVencer: 0,
            parcelasAtrasadas: 0,
            cotasSet: new Set(),
          });
        }
        const b = map.get(ym)!;
        const valor = Number(card.valor_credito) || 0;
        const tipo = (card.tipo_produto || 'select') as TipoProduto;
        const com = calcularComissao(valor, tipo, inst.numero_parcela);
        b.cotasSet.add(inst.card_id);
        if (inst.status === 'pago') {
          b.comissaoPaga += com;
          b.parcelasPagas += 1;
        } else if (venc < hoje) {
          b.comissaoAtrasada += com;
          b.parcelasAtrasadas += 1;
        } else {
          b.comissaoAVencer += com;
          b.parcelasAVencer += 1;
        }
      }

      const rows = Array.from(map.values()).sort((a, b) => a.ym.localeCompare(b.ym));
      const totalRealizado = rows.reduce((s, r) => s + r.comissaoPaga, 0);
      const totalPrevisto = rows.reduce((s, r) => s + r.comissaoAVencer, 0);
      const totalAtrasado = rows.reduce((s, r) => s + r.comissaoAtrasada, 0);

      return { rows, totalRealizado, totalPrevisto, totalAtrasado };
    },
    staleTime: 1000 * 60 * 2,
  });
}