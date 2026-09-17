import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Leitura pura das views `vw_cliente_consolidado` e `vw_venda_por_produto`.
 * Nada aqui escreve no banco. Paginação server-side via `.range()` — a base tem
 * ~21.800 clientes e nunca deve ser carregada inteira.
 */

export const CLIENTES_PAGE_SIZE = 50;

export type ClienteOrdem = 'ultima_compra' | 'total_liquido_pago';

export interface HistoricoCompraItem {
  produto: string | null;
  gateway: string | null;
  bruto: number | null;
  liquido: number | null;
  pagamentos: number | null;
  pedidos: number | null;
  primeiro: string | null;
  ultimo: string | null;
  dias: number | null;
}

export interface ClienteConsolidado {
  cliente_email: string;
  cliente_nome: string | null;
  cliente_telefone: string | null;
  cliente_cpf: string | null;
  qtd_produtos: number | null;
  total_pagamentos: number | null;
  primeira_compra: string | null;
  ultima_compra: string | null;
  total_liquido_pago: number | null;
  total_bruto_produtos: number | null;
  tem_reembolso: boolean | null;
  gateways: string[] | null;
  qtd_gateways: number | null;
  historico_compras: HistoricoCompraItem[] | null;
}

export interface VendaPorProduto {
  cliente_email: string;
  produto: string | null;
  gateway: string | null;
  pagamentos: number | null;
  parcelas_contratadas: number | null;
  bruto_produto: number | null;
  liquido_pago: number | null;
  primeiro_pagamento: string | null;
  ultimo_pagamento: string | null;
  dias_entre_pagamentos: number | null;
  qtd_pedidos_no_gateway: number | null;
  tem_reembolso: boolean | null;
}

const COLUNAS_LISTA =
  'cliente_email,cliente_nome,cliente_telefone,cliente_cpf,qtd_produtos,total_pagamentos,primeira_compra,ultima_compra,total_liquido_pago,total_bruto_produtos,tem_reembolso,gateways,historico_compras';

/** Escapa o termo para uso dentro de `or(...)` do PostgREST. */
const sanitizar = (termo: string) => termo.replace(/[,()%]/g, ' ').trim();

export function useClientesLista(opts: {
  busca: string;
  multiGateway: boolean;
  semCpf: boolean;
  ordem: ClienteOrdem;
}) {
  const { busca, multiGateway, semCpf, ordem } = opts;

  return useInfiniteQuery({
    queryKey: ['clientes-lista', busca, multiGateway, semCpf, ordem],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const from = (pageParam as number) * CLIENTES_PAGE_SIZE;
      let query = supabase
        .from('vw_cliente_consolidado')
        .select(COLUNAS_LISTA)
        .order(ordem, { ascending: false, nullsFirst: false })
        .range(from, from + CLIENTES_PAGE_SIZE - 1);

      const termo = sanitizar(busca);
      if (termo) {
        const digitos = termo.replace(/\D/g, '');
        const partes = [
          `cliente_nome.ilike.%${termo}%`,
          `cliente_email.ilike.%${termo}%`,
          `cliente_cpf.ilike.%${termo}%`,
        ];
        // CPF/CNPJ pode estar gravado com ou sem pontuação — compara os dois.
        if (digitos.length >= 3) partes.push(`cliente_cpf.ilike.%${digitos}%`);
        query = query.or(partes.join(','));
      }
      if (semCpf) query = query.is('cliente_cpf', null);

      const { data, error } = await query;
      if (error) throw error;

      let rows = (data || []) as unknown as ClienteConsolidado[];
      // `array_length(gateways,1) > 1` não é expressável no PostgREST: filtra o
      // recorte já paginado (o filtro é auxiliar, não altera a contagem oficial).
      if (multiGateway) rows = rows.filter((r) => (r.gateways?.length ?? 0) > 1);

      return { rows, recebidas: (data || []).length, pagina: pageParam as number };
    },
    getNextPageParam: (last) =>
      last.recebidas === CLIENTES_PAGE_SIZE ? last.pagina + 1 : undefined,
    staleTime: 60_000,
  });
}

/** Itens por produto do cliente selecionado — traz `parcelas_contratadas`. */
export function useClienteProdutos(email?: string | null) {
  return useQuery({
    queryKey: ['cliente-produtos', email],
    enabled: !!email,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vw_venda_por_produto')
        .select('*')
        .eq('cliente_email', email!)
        .order('ultimo_pagamento', { ascending: false, nullsFirst: false })
        .range(0, 499);
      if (error) throw error;
      return (data || []) as unknown as VendaPorProduto[];
    },
  });
}
