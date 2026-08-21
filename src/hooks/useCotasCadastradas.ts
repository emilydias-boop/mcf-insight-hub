import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllPages } from '@/lib/supabasePaginacao';
import { toast } from 'sonner';

/**
 * Etapa 5 do funil Consórcio — "Cotas Cadastradas".
 *
 * CONTROLE INTERNO. O marcador de pagamento da parcela inicial vive em duas
 * colunas próprias de `consorcio_pending_registrations`
 * (`parcela_inicial_paga_em` / `parcela_inicial_paga_por`) exatamente para não
 * acordar nada financeiro:
 *  - NÃO usa `consortium_installments` nº 1 pago (alimenta comissão/payout/KPI);
 *  - NÃO grava em `consortium_cards` (o trigger de webhook de saída observa
 *    `status`, `valor_credito`, `parcelas_pagas_empresa`, `grupo`, `cota`, etc.);
 *  - NÃO gera título, boleto, cobrança nem previsão de caixa.
 */
export interface CotaCadastrada {
  id: string;
  nome: string;
  tipo_pessoa: string | null;
  grupo: string | null;
  cota: string | null;
  valor_credito: number | null;
  vendedor_name: string | null;
  parcelas_pagas_empresa: number | null;
  consortium_card_id: string | null;
  /** Âncora dos dias parados: quando a cota foi cadastrada/aberta. */
  cadastrada_em: string | null;
  parcela_inicial_paga_em: string | null;
}

/** Prazo interno para o pagamento da parcela inicial, em dias após o cadastro. */
export const PRAZO_PARCELA_INICIAL_DIAS = 1;

/**
 * "Não paga — prazo expirado" é estado DERIVADO: passou o prazo e não há
 * pagamento registrado. Ninguém marca, nenhum job roda.
 */
export function prazoExpirado(c: CotaCadastrada): boolean {
  if (c.parcela_inicial_paga_em) return false;
  if (!c.cadastrada_em) return false;
  const base = new Date(c.cadastrada_em.length <= 10 ? `${c.cadastrada_em}T00:00:00` : c.cadastrada_em);
  if (Number.isNaN(base.getTime())) return false;
  const dias = Math.floor((Date.now() - base.getTime()) / 86_400_000);
  return dias > PRAZO_PARCELA_INICIAL_DIAS;
}

const iso = (d?: Date) => (d ? d.toISOString() : undefined);

export function useCotasCadastradas(range: { startDate?: Date; endDate?: Date }) {
  return useQuery({
    queryKey: ['consorcio-cotas-cadastradas', iso(range.startDate), iso(range.endDate)],
    queryFn: async (): Promise<CotaCadastrada[]> => {
      const rows = await fetchAllPages<any>((from, to) => {
        let q = supabase
          .from('consorcio_pending_registrations')
          .select(
            'id, nome_completo, razao_social, tipo_pessoa, grupo, cota, valor_credito, vendedor_name, vendedor_name_cota, parcelas_pagas_empresa, consortium_card_id, cota_aberta_at, created_at, parcela_inicial_paga_em',
          )
          .in('status', ['cota_aberta', 'vinculada'])
          .not('consortium_card_id', 'is', null)
          .order('created_at', { ascending: false })
          .order('id', { ascending: true });
        if (range.startDate) q = q.gte('created_at', range.startDate.toISOString());
        if (range.endDate) q = q.lte('created_at', range.endDate.toISOString());
        return q.range(from, to);
      });

      return (rows || [])
        .filter((r) => String(r.grupo || '').trim() && String(r.cota || '').trim())
        .map((r) => ({
          id: r.id,
          nome: r.nome_completo || r.razao_social || 'sem nome',
          tipo_pessoa: r.tipo_pessoa ?? null,
          grupo: r.grupo ?? null,
          cota: r.cota ?? null,
          valor_credito: r.valor_credito ?? null,
          vendedor_name: r.vendedor_name_cota || r.vendedor_name || null,
          parcelas_pagas_empresa: r.parcelas_pagas_empresa ?? null,
          consortium_card_id: r.consortium_card_id ?? null,
          cadastrada_em: r.cota_aberta_at || r.created_at || null,
          parcela_inicial_paga_em: r.parcela_inicial_paga_em ?? null,
        }));
    },
  });
}

/**
 * Marca (ou desmarca) o pagamento da parcela inicial. Grava só nas duas colunas
 * de controle interno — nada mais é tocado.
 */
export function useMarcarParcelaInicial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: string | null }) => {
      const { data: sessao } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('consorcio_pending_registrations')
        .update({
          parcela_inicial_paga_em: data,
          parcela_inicial_paga_por: data ? (sessao?.user?.id ?? null) : null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ['consorcio-cotas-cadastradas'] });
      toast.success(vars.data ? 'Parcela inicial marcada como paga' : 'Marcação de pagamento desfeita');
    },
    onError: (e: any) => toast.error('Não foi possível registrar: ' + (e?.message || 'erro desconhecido')),
  });
}
