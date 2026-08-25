import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useConsorcioAgendaFatos, type ConsorcioFatoRow } from "@/hooks/useConsorcioAgendaFatos";

/**
 * Detalhe do SDR de Consórcio: as MESMAS fontes do Painel Comercial, abertas em
 * lista para auditoria. Espelha `useConsorcioCloserDetalhe`, trocando o eixo de
 * atribuição: aqui o filtro é o AGENDADOR (`sdr_email` dos fatos), que é
 * exatamente a chave usada por `useConsorcioAgendaDerived` para montar a linha
 * do SDR na tabela do painel.
 *
 * 100% leitura.
 */

export interface SdrReuniaoDetalheItem {
  key: string;
  dealId: string | null;
  nome: string | null;
  dia: string;
  origem: string | null;
  closerNome: string | null;
  status: string | null;
}

export interface ConsorcioSdrReunioes {
  agendamentos: SdrReuniaoDetalheItem[];
  agendadas: SdrReuniaoDetalheItem[];
  realizadas: SdrReuniaoDetalheItem[];
  noShows: SdrReuniaoDetalheItem[];
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
    queryKey: ["consorcio-sdr-detalhe-deal-nomes", chave],
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

/** Listas de reunião do SDR (agendador), na mesma base de fatos do painel. */
export function useConsorcioSdrReunioes(
  sdrEmail: string | undefined,
  startDate: Date | null,
  endDate: Date | null,
  /** Nomes de origem permitidos (funil selecionado). null = sem filtro. */
  allowedOriginNames: Set<string> | null = null,
) {
  const { data: fatos, isLoading, refetch } = useConsorcioAgendaFatos(startDate, endDate);

  const doSdr = useMemo(() => {
    const alvo = (sdrEmail || "").trim().toLowerCase();
    if (!alvo) return [] as ConsorcioFatoRow[];
    return (fatos || []).filter((f: ConsorcioFatoRow) => {
      if ((f.sdr_email || "").trim().toLowerCase() !== alvo) return false;
      if (allowedOriginNames && !allowedOriginNames.has((f.origin_name || "").toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [fatos, sdrEmail, allowedOriginNames]);

  const dealIds = useMemo(
    () => doSdr.map((f) => f.deal_id).filter(Boolean) as string[],
    [doSdr],
  );
  const { data: nomes } = useDealNomes(dealIds);

  const listas = useMemo<ConsorcioSdrReunioes>(() => {
    const mapear = (f: ConsorcioFatoRow, i: number): SdrReuniaoDetalheItem => ({
      key: `${f.fato}:${f.deal_id || "sem-deal"}:${f.meeting_day}:${i}`,
      dealId: f.deal_id,
      nome: (f.deal_id ? nomes?.get(f.deal_id) : null) || null,
      dia: f.meeting_day,
      origem: f.origin_name,
      closerNome: f.closer_name,
      status: f.attendee_status,
    });
    const filtrar = (fato: ConsorcioFatoRow["fato"]) =>
      doSdr
        .filter((f) => f.fato === fato)
        .map(mapear)
        .sort((a, b) => String(b.dia).localeCompare(String(a.dia)));
    return {
      agendamentos: filtrar("agendamento"),
      agendadas: filtrar("agendada"),
      realizadas: filtrar("realizada"),
      noShows: filtrar("no_show"),
    };
  }, [doSdr, nomes]);

  return { ...listas, isLoading, refetch };
}
