import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllPages, fetchAllByIds } from '@/lib/supabasePaginacao';

/**
 * Cotas que nasceram DENTRO do funil: existe um `consorcio_pending_registrations`
 * apontando para o card (`consortium_card_id`). As demais são "externas" —
 * criadas direto pelo botão "+ Adicionar Cota", sem passar por reunião/proposta.
 *
 * Retorna um Map cardId -> nome do lead do cadastro vinculado (para a coluna
 * "Origem no funil" da lista de Cotas).
 */
export function useConsorcioCotasOrigem() {
  return useQuery({
    queryKey: ['consorcio-cotas-origem-funil'],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Map<string, string>> => {
      // Paginado: passando de 1000 vínculos, cotas do funil seriam classificadas
      // como "externas" em silêncio (contadores e filtros da timeline errados).
      const data = await fetchAllPages<any>((from, to) =>
        supabase
          .from('consorcio_pending_registrations')
          .select('consortium_card_id, nome_completo, razao_social')
          .not('consortium_card_id', 'is', null)
          .order('id', { ascending: true })
          .range(from, to),
      );
      const map = new Map<string, string>();
      (data || []).forEach((r: any) => {
        if (!r.consortium_card_id) return;
        const nome = r.nome_completo || r.razao_social || '—';
        if (!map.has(r.consortium_card_id)) map.set(r.consortium_card_id, nome);
      });
      return map;
    },
  });
}

/**
 * "Criada por" das cotas. `consortium_cards` NÃO tem coluna de autoria
 * (nem created_by/user_id/criado_por), então usamos o `actor_name` do PRIMEIRO
 * evento registrado em `consortium_card_activity_log` para cada cota.
 */
export function useConsorcioCardCreators(cardIds: string[]) {
  const key = cardIds.slice().sort().join(',');
  return useQuery({
    queryKey: ['consorcio-card-creators', key],
    enabled: cardIds.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Map<string, string>> => {
      const map = new Map<string, string>();
      // Log de atividade é 1-para-N: pagina dentro de cada lote de ids.
      const rows = await fetchAllByIds<any>(cardIds, (lote, from, to) =>
        supabase
          .from('consortium_card_activity_log')
          .select('card_id, actor_name, created_at')
          .in('card_id', lote)
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to),
      );
      rows.forEach((l: any) => {
        if (l.card_id && l.actor_name && !map.has(l.card_id)) map.set(l.card_id, l.actor_name);
      });
      return map;
    },
  });
}

export interface CotaReservada {
  id: string;
  nome: string;
  grupo: string;
  cota: string;
  valor_credito: number;
  data_reserva: string;
  data_contratacao: string | null;
  dias: number | null;
  vendedor_name: string | null;
  tipo_registro: 'reserva' | 'contratacao' | null;
  contrato_embracon: string | null;
  /** Nulo = "A definir" (a Embracon informa na confirmação). */
  dia_vencimento: number | null;
  /** A cota nasceu dentro do funil (cadastro pendente vinculado)? */
  origemFunil: boolean;
}

const CARD_RESERVA_SELECT =
  'id, nome_completo, razao_social, tipo_pessoa, grupo, cota, valor_credito, data_reserva, data_contratacao, vendedor_name, tipo_registro, contrato_embracon, dia_vencimento';

/** Dias corridos entre duas datas YYYY-MM-DD (null quando falta alguma). */
function diasEntre(de?: string | null, ate?: string | null): number | null {
  if (!de || !ate) return null;
  return Math.round(
    (new Date(`${ate}T00:00:00`).getTime() - new Date(`${de}T00:00:00`).getTime()) / 86400000,
  );
}

function mapCard(c: any, origemFunil = true): CotaReservada {
  return {
    id: c.id,
    nome: (c.tipo_pessoa === 'pj' ? c.razao_social : c.nome_completo) || '—',
    grupo: c.grupo,
    cota: c.cota,
    valor_credito: Number(c.valor_credito) || 0,
    data_reserva: c.data_reserva,
    data_contratacao: c.data_contratacao,
    dias: diasEntre(c.data_reserva, c.data_contratacao),
    vendedor_name: c.vendedor_name || null,
    tipo_registro: c.tipo_registro ?? null,
    contrato_embracon: c.contrato_embracon ?? null,
    dia_vencimento: c.dia_vencimento ?? null,

    origemFunil,
  };
}

/**
 * Etapa 5 do Funil Consórcio — "Cadastradas" (reservadas na Embracon).
 *
 * Fonte: `consortium_cards.data_reserva` dentro do período, restrito às cotas
 * com ORIGEM NO FUNIL (cadastro pendente vinculado). O recorte de origem é
 * obrigatório: sem ele a etapa incluiria cotas externas e inverteria contra a etapa 4.
 *
 * ATENÇÃO (limitação do processo, não do código): esta etapa só descreve o
 * processo real de cadastramento/pagamento na Embracon se a equipe ABRIR a cota
 * como RESERVA e só converter em contratação quando a Embracon confirmar.
 * Se `data_reserva` e `data_contratacao` forem gravadas no mesmo instante,
 * a etapa 5 vira um espelho da etapa 6 e perde poder de diagnóstico.
 */
export function useConsorcioCotasReservadas(range: { startDate?: Date; endDate?: Date }) {
  const toIso = (d?: Date) =>
    d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : null;
  const start = toIso(range.startDate);
  const end = toIso(range.endDate);

  // Reaproveita o Map de vínculos já carregado por useConsorcioCotasOrigem
  // (mesma queryKey no React Query) — evita repetir a consulta de vínculos.
  const { data: funnelLinks } = useConsorcioCotasOrigem();

  return useQuery({
    queryKey: ['consorcio-cotas-reservadas', start, end, funnelLinks?.size ?? 0],
    enabled: !!funnelLinks,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<CotaReservada[]> => {
      const funnelIds = funnelLinks ?? new Map<string, string>();
      if (funnelIds.size === 0) return [];

      const data = await fetchAllPages<any>((from, to) => {
        let q = supabase
          .from('consortium_cards')
          .select(CARD_RESERVA_SELECT)
          .not('data_reserva', 'is', null);
        if (start) q = q.gte('data_reserva', start);
        if (end) q = q.lte('data_reserva', end);
        return q
          .order('data_reserva', { ascending: false })
          .order('id', { ascending: true })
          .range(from, to);
      });

      return (data || []).filter((c: any) => funnelIds.has(c.id)).map((c: any) => mapCard(c, true));
    },
  });
}

/**
 * Fila de trabalho da etapa 5: TODAS as cotas abertas como RESERVA e ainda sem
 * confirmação da Embracon (`data_contratacao` nula) — inclusive as criadas por
 * fora do funil ("+ Adicionar Cota"), marcadas com `origemFunil = false`.
 *
 * As externas entram só para não ficarem órfãs (sem tela para confirmar); elas
 * NÃO contam no número da etapa 5, que segue restrita à origem no funil.
 *
 * IGNORA o filtro de período de propósito — uma reserva parada há 40 dias precisa
 * aparecer mesmo com o filtro no mês corrente.
 */
export function useConsorcioReservasAguardando() {
  const { data: funnelLinks } = useConsorcioCotasOrigem();

  return useQuery({
    queryKey: ['consorcio-reservas-aguardando', funnelLinks?.size ?? 0],
    enabled: !!funnelLinks,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<CotaReservada[]> => {
      const funnelIds = funnelLinks ?? new Map<string, string>();

      // Paginação explícita: sem .range() o PostgREST corta no teto de linhas
      // em silêncio e o contador da fila ficaria errado sem ninguém notar.
      const PAGE = 1000;
      const all: any[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from('consortium_cards')
          .select(CARD_RESERVA_SELECT)
          .eq('tipo_registro', 'reserva')
          .is('data_contratacao', null)
          .not('data_reserva', 'is', null)
          .order('data_reserva', { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < PAGE) break;
      }
      return all.map((c: any) => mapCard(c, funnelIds.has(c.id)));
    },
  });
}

/**
 * Corte de entrada da rotina de confirmação com comprovante (etapa 5).
 * Cotas confirmadas ANTES desta data nasceram sem o fluxo novo — marcá-las como
 * "sem comprovante" faria a métrica nascer 100% falsa.
 */
export const CONFIRMACAO_EMBRACON_DESDE = '2026-08-18';

/** A cota passou pelo fluxo novo? (só essas podem receber o selo âmbar) */
export function elegivelSeloComprovante(cota: CotaReservada): boolean {
  return !!cota.data_contratacao && cota.data_contratacao >= CONFIRMACAO_EMBRACON_DESDE;
}

/** Dias parados desde a reserva (hoje − data_reserva). */
export function diasParados(dataReserva?: string | null): number | null {
  if (!dataReserva) return null;
  const hoje = new Date();
  const hojeIso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
  return diasEntre(dataReserva, hojeIso);
}

/**
 * Cotas confirmadas que têm o documento "Confirmação Embracon" anexado.
 * Serve para o selo âmbar "sem comprovante" na seção de confirmadas.
 */
export function useCotasComConfirmacaoEmbracon(cardIds: string[]) {
  const key = cardIds.slice().sort().join(',');
  return useQuery({
    queryKey: ['cotas-confirmacao-embracon', key],
    enabled: cardIds.length > 0,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<Set<string>> => {
      const set = new Set<string>();
      const rows = await fetchAllByIds<any>(cardIds, (lote, from, to) =>
        supabase
          .from('consortium_documents')
          .select('card_id')
          .eq('tipo', 'confirmacao_embracon')
          .in('card_id', lote)
          .order('id', { ascending: true })
          .range(from, to),
      );
      rows.forEach((d: any) => d.card_id && set.add(d.card_id));
      return set;
    },
  });
}

/**
 * Mediana de dias entre reserva e contratação.
 *
 * Só entram cotas que REALMENTE passaram por reserva → confirmação (datas em dias
 * diferentes). Cotas com as duas datas no mesmo instante puxavam a mediana para 0
 * e enganavam a leitura.
 */
export function medianDias(items: CotaReservada[]): number | null {
  const vals = medianDiasBase(items).map((i) => i.dias as number).sort((a, b) => a - b);
  if (vals.length === 0) return null;
  const mid = Math.floor(vals.length / 2);
  return vals.length % 2 ? vals[mid] : Math.round((vals[mid - 1] + vals[mid]) / 2);
}

/** Cotas elegíveis ao cálculo da mediana (expostas para exibir "N no cálculo"). */
export function medianDiasBase(items: CotaReservada[]): CotaReservada[] {
  return items.filter((i) => i.dias != null && i.dias > 0);
}
