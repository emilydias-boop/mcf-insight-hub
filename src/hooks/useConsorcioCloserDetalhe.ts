import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { nameKey } from "@/hooks/useConsorcioCotasContratadas";
import { useConsorcioAgendaFatos, type ConsorcioFatoRow } from "@/hooks/useConsorcioAgendaFatos";

/**
 * Detalhe do closer de Consórcio: as MESMAS fontes do Painel Comercial,
 * abertas em lista para auditoria.
 *
 *  - Reuniões (agendadas/realizadas/no-show/contrato pago): `get_agenda_fatos_consorcio`,
 *    filtrada pelo `closer_id` — é a mesma RPC que alimenta as colunas do painel.
 *  - Vendas Realizadas: `consortium_cards` com `tipo_registro = 'contratacao'`,
 *    âncora `data_contratacao`, vendedor casado pelo mesmo `nameKey` da coluna
 *    Cotas Contratadas. A unidade de VENDA é a pessoa (documento; sem documento,
 *    nome normalizado), exatamente como no painel.
 *
 * 100% leitura.
 */

export interface ReuniaoDetalheItem {
  key: string;
  dealId: string | null;
  nome: string | null;
  dia: string;
  origem: string | null;
  sdrNome: string | null;
  status: string | null;
}

export interface CotaDetalheItem {
  cardId: string;
  cliente: string | null;
  pessoaKey: string;
  dataContratacao: string | null;
  grupo: string | null;
  cota: string | null;
  credito: number;
  vendedorName: string | null;
}

export interface ConsorcioCloserDetalhe {
  agendadas: ReuniaoDetalheItem[];
  realizadas: ReuniaoDetalheItem[];
  noShows: ReuniaoDetalheItem[];
  contratoPago: ReuniaoDetalheItem[];
}

/** Identidade da pessoa titular — mesma regra da coluna Vendas Realizadas. */
function pessoaKey(card: { id: string; cpf?: string | null; cnpj?: string | null; nome_completo?: string | null }): string {
  const doc = String(card.cpf || "").replace(/\D/g, "") || String(card.cnpj || "").replace(/\D/g, "");
  if (doc) return `doc:${doc}`;
  const nome = String(card.nome_completo || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
  return nome ? `nome:${nome}` : `card:${card.id}`;
}

function chunk<T>(arr: T[], size = 200): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Nome do lead por deal_id, para as listas de reunião. */
function useDealNomes(dealIds: string[]) {
  const chave = useMemo(() => [...new Set(dealIds)].sort(), [dealIds]);
  return useQuery({
    queryKey: ["consorcio-closer-detalhe-deal-nomes", chave],
    enabled: chave.length > 0,
    staleTime: 60000,
    queryFn: async (): Promise<Map<string, string>> => {
      const out = new Map<string, string>();
      for (const parte of chunk(chave)) {
        const { data, error } = await supabase.from("crm_deals").select("id, name").in("id", parte);
        if (error) throw error;
        (data || []).forEach((d) => {
          if (d.name) out.set(d.id, d.name);
        });
      }
      return out;
    },
  });
}

/** Listas de reunião do closer, na mesma base de fatos do painel. */
export function useConsorcioCloserReunioes(
  closerId: string | undefined,
  startDate: Date | null,
  endDate: Date | null,
) {
  const { data: fatos, isLoading, refetch } = useConsorcioAgendaFatos(startDate, endDate);

  const doCloser = useMemo(
    () => (fatos || []).filter((f: ConsorcioFatoRow) => !!closerId && f.closer_id === closerId),
    [fatos, closerId],
  );

  const dealIds = useMemo(
    () => doCloser.map((f) => f.deal_id).filter(Boolean) as string[],
    [doCloser],
  );
  const { data: nomes } = useDealNomes(dealIds);

  const listas = useMemo<ConsorcioCloserDetalhe>(() => {
    const mapear = (f: ConsorcioFatoRow, i: number): ReuniaoDetalheItem => ({
      key: `${f.fato}:${f.deal_id || "sem-deal"}:${f.meeting_day}:${i}`,
      dealId: f.deal_id,
      nome: (f.deal_id ? nomes?.get(f.deal_id) : null) || null,
      dia: f.meeting_day,
      origem: f.origin_name,
      sdrNome: f.sdr_name,
      status: f.attendee_status,
    });
    const filtrar = (fato: ConsorcioFatoRow["fato"]) =>
      doCloser
        .filter((f) => f.fato === fato)
        .map(mapear)
        .sort((a, b) => String(b.dia).localeCompare(String(a.dia)));
    return {
      agendadas: filtrar("agendada"),
      realizadas: filtrar("realizada"),
      noShows: filtrar("no_show"),
      contratoPago: filtrar("fechada_agenda"),
    };
  }, [doCloser, nomes]);

  return { ...listas, isLoading, refetch };
}

/** Cotas contratadas do closer no período, com contagem de vendas por pessoa. */
export function useConsorcioCloserCotas(
  closerId: string | undefined,
  startDate: Date | null,
  endDate: Date | null,
) {
  return useQuery({
    queryKey: [
      "consorcio-closer-cotas",
      closerId,
      startDate ? format(startDate, "yyyy-MM-dd") : null,
      endDate ? format(endDate, "yyyy-MM-dd") : null,
    ],
    enabled: !!closerId && !!startDate && !!endDate,
    staleTime: 30000,
    queryFn: async () => {
      const ini = format(startDate!, "yyyy-MM-dd");
      const fim = format(endDate!, "yyyy-MM-dd");

      const { data: closer, error: closerError } = await supabase
        .from("closers")
        .select("id, name, email, color, bu")
        .eq("id", closerId!)
        .maybeSingle();
      if (closerError) throw closerError;
      const chaveCloser = nameKey(closer?.name);

      const { data: cards, error } = await supabase
        .from("consortium_cards")
        .select("id, nome_completo, cpf, cnpj, grupo, cota, valor_credito, vendedor_name, data_contratacao")
        .eq("tipo_registro", "contratacao")
        .gte("data_contratacao", ini)
        .lte("data_contratacao", fim);
      if (error) throw error;

      const meus = (cards || []).filter(
        (c) => !!chaveCloser && nameKey(c.vendedor_name) === chaveCloser,
      );

      const pessoas = new Set<string>();
      let credito = 0;
      const itens: CotaDetalheItem[] = meus.map((c) => {
        const pk = pessoaKey(c);
        pessoas.add(pk);
        credito += Number(c.valor_credito || 0);
        return {
          cardId: c.id,
          cliente: c.nome_completo || null,
          pessoaKey: pk,
          dataContratacao: c.data_contratacao ? String(c.data_contratacao).slice(0, 10) : null,
          grupo: c.grupo ?? null,
          cota: c.cota ?? null,
          credito: Number(c.valor_credito || 0),
          vendedorName: c.vendedor_name ?? null,
        };
      });
      itens.sort((a, b) =>
        String(b.dataContratacao || "").localeCompare(String(a.dataContratacao || "")),
      );

      return {
        closer: closer
          ? { id: closer.id, name: closer.name, email: closer.email, color: closer.color, bu: closer.bu }
          : null,
        itens,
        cotas: itens.length,
        vendas: pessoas.size,
        credito,
      };
    },
  });
}
