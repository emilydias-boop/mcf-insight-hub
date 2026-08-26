import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type Granularidade = 'day' | 'week' | 'month';
export type SegmentoFiltro = 'todos' | 'A' | 'B' | 'C';

const TZ = 'America/Sao_Paulo';

export function toIsoStart(de: string) {
  return `${de}T00:00:00-03:00`;
}
export function toIsoEnd(ate: string) {
  return `${ate}T23:59:59-03:00`;
}

/** Retorna YYYY-MM-DD no fuso de São Paulo */
export function spDate(iso: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
  return parts; // en-CA => YYYY-MM-DD
}

/** Agrupa uma data YYYY-MM-DD conforme granularidade */
export function bucketDate(ymd: string, gran: Granularidade): string {
  const [y, m, d] = ymd.split('-').map(Number);
  if (gran === 'month') return `${ymd.slice(0, 7)}-01`;
  if (gran === 'week') {
    const dt = new Date(Date.UTC(y, m - 1, d));
    const dow = dt.getUTCDay(); // 0=dom
    const diff = dow === 0 ? 6 : dow - 1; // semana começa na segunda
    dt.setUTCDate(dt.getUTCDate() - diff);
    return dt.toISOString().slice(0, 10);
  }
  return ymd;
}

export interface SerieRow {
  periodo: string;
  closer_id: string;
  closer_email: string;
  bu: string | null;
  icp_segment: string | null;
  reunioes: number;
  nota_media: number | null;
  aderencia_media: number | null;
  vendas: number;
  taxa_conversao: number | null;
}

export interface SlotRow {
  id: string;
  ymd: string;
  closer_email: string;
  closer_name: string | null;
  closer_bu: string | null;
  closer_ativo: boolean;
  icp_segment: string | null;
  contratos: number;
  participantes: number;
  teveContrato: boolean;
}

export interface EtapaRow {
  closer_id: string;
  closer_email: string;
  ordem: number;
  etapa: string;
  avaliacoes: number;
  cumpriu: number;
  falhou: number;
  pct_falha: number;
  nota_media_etapa: number | null;
}

export interface DiferencaEtapa {
  etapa: string;
  ordem: number;
  pctVendeu: number;
  pctNaoVendeu: number;
  diferenca: number;
  nVendeu: number;
  nNaoVendeu: number;
}

/** RPC 1 — série (somente reuniões com gravação avaliada) */
export function useRelatorioClosersSerie(
  de: string,
  ate: string,
  gran: Granularidade,
  segmento: SegmentoFiltro,
) {
  return useQuery({
    queryKey: ['relatorio-closer-serie', de, ate, gran, segmento],
    queryFn: async (): Promise<SerieRow[]> => {
      const { data, error } = await supabase.rpc('relatorio_closer_serie', {
        _de: de,
        _ate: ate,
        _gran: gran,
        _meeting_type: 'r1',
        _bu: 'incorporador',
        _icp_segment: segmento === 'todos' ? undefined : segmento,
      } as never);
      if (error) throw error;
      return ((data ?? []) as unknown as SerieRow[]).map((r) => ({
        ...r,
        reunioes: Number(r.reunioes ?? 0),
        vendas: Number(r.vendas ?? 0),
        nota_media: r.nota_media === null ? null : Number(r.nota_media),
        aderencia_media: r.aderencia_media === null ? null : Number(r.aderencia_media),
      }));
    },
  });
}

/** Reuniões e vendas TOTAIS (fonte da verdade) direto de meeting_slots */
export function useClosersSlots(de: string, ate: string, segmento: SegmentoFiltro) {
  return useQuery({
    queryKey: ['relatorio-closer-slots', de, ate, segmento],
    queryFn: async (): Promise<SlotRow[]> => {
      const { data, error } = await supabase
        .from('meeting_slots')
        .select(
          'id, scheduled_at, closers!inner(email, name, bu, is_active), crm_deals(icp_segment), meeting_slot_attendees(contract_paid_at, is_partner)',
        )
        .eq('meeting_type', 'r1')
        .eq('closers.bu', 'incorporador')
        .gte('scheduled_at', toIsoStart(de))
        .lte('scheduled_at', toIsoEnd(ate));
      if (error) throw error;

      const rows: SlotRow[] = (data ?? []).map((s: any) => {
        const attendees = Array.isArray(s.meeting_slot_attendees) ? s.meeting_slot_attendees : [];
        const naoSocios = attendees.filter((a: any) => !a.is_partner);
        const contratos = naoSocios.filter((a: any) => !!a.contract_paid_at).length;
        const closer = Array.isArray(s.closers) ? s.closers[0] : s.closers;
        const deal = Array.isArray(s.crm_deals) ? s.crm_deals[0] : s.crm_deals;
        return {
          id: s.id,
          ymd: spDate(s.scheduled_at),
          closer_email: closer?.email ?? '—',
          closer_name: closer?.name ?? null,
          closer_bu: closer?.bu ?? null,
          closer_ativo: closer?.is_active !== false,
          icp_segment: deal?.icp_segment ?? null,
          contratos,
          participantes: naoSocios.length,
          teveContrato: contratos > 0,
        };
      });

      return segmento === 'todos' ? rows : rows.filter((r) => r.icp_segment === segmento);
    },
  });
}

/** RPC 2 — etapas de um closer */
export function useRelatorioCloserEtapas(
  closerId: string | null,
  de: string,
  ate: string,
  segmento: SegmentoFiltro,
) {
  return useQuery({
    queryKey: ['relatorio-closer-etapas', closerId, de, ate, segmento],
    enabled: !!closerId,
    queryFn: async (): Promise<EtapaRow[]> => {
      const { data, error } = await supabase.rpc('relatorio_closer_etapas', {
        _de: de,
        _ate: ate,
        _closer_id: closerId,
        _meeting_type: 'r1',
        _bu: 'incorporador',
        _icp_segment: segmento === 'todos' ? undefined : segmento,
      } as never);
      if (error) throw error;
      return ((data ?? []) as unknown as EtapaRow[]).map((e) => ({
        ...e,
        avaliacoes: Number(e.avaliacoes ?? 0),
        cumpriu: Number(e.cumpriu ?? 0),
        falhou: Number(e.falhou ?? 0),
        pct_falha: Number(e.pct_falha ?? 0),
        nota_media_etapa: e.nota_media_etapa === null ? null : Number(e.nota_media_etapa),
      }));
    },
  });
}

/**
 * "O que separou as reuniões com contrato": cruza as etapas avaliadas (meeting_ai_reviews)
 * com o resultado de contrato do slot (teveContrato = ao menos 1 participante não-sócio pagante).
 */
export function useEtapasVendaVsNaoVenda(
  de: string,
  ate: string,
  segmento: SegmentoFiltro,
  vendasPorSlot: Map<string, boolean> | undefined,
  closerEmail?: string | null,
) {
  return useQuery({
    queryKey: ['relatorio-closer-etapas-venda', de, ate, segmento, closerEmail, !!vendasPorSlot],
    enabled: !!vendasPorSlot && vendasPorSlot.size > 0,
    queryFn: async (): Promise<DiferencaEtapa[]> => {
      const { data, error } = await supabase
        .from('meeting_ai_reviews')
        .select(
          'meeting_slot_id, etapas, meeting_slots!inner(id, scheduled_at, meeting_type, closers!inner(email, bu))',
        )
        .eq('meeting_slots.meeting_type', 'r1')
        .eq('meeting_slots.closers.bu', 'incorporador')
        .gte('meeting_slots.scheduled_at', toIsoStart(de))
        .lte('meeting_slots.scheduled_at', toIsoEnd(ate));
      if (error) throw error;

      const acc = new Map<
        string,
        { ordem: number; vendeuOk: number; vendeuTot: number; naoOk: number; naoTot: number }
      >();

      for (const r of (data ?? []) as any[]) {
        const slotId = r.meeting_slot_id;
        if (!slotId || !vendasPorSlot!.has(slotId)) continue; // respeita filtro de segmento/período
        const slot = Array.isArray(r.meeting_slots) ? r.meeting_slots[0] : r.meeting_slots;
        const email = (Array.isArray(slot?.closers) ? slot.closers[0] : slot?.closers)?.email;
        if (closerEmail && email !== closerEmail) continue;
        const venda = vendasPorSlot!.get(slotId) === true;
        const etapas = Array.isArray(r.etapas) ? r.etapas : [];
        for (const e of etapas) {
          const nome = String(e?.etapa ?? '').trim();
          if (!nome) continue;
          const cur =
            acc.get(nome) ?? {
              ordem: Number(e?.ordem ?? 99),
              vendeuOk: 0,
              vendeuTot: 0,
              naoOk: 0,
              naoTot: 0,
            };
          const cumpriu = String(e?.cumpriu ?? '').toLowerCase() === 'sim';
          if (venda) {
            cur.vendeuTot += 1;
            if (cumpriu) cur.vendeuOk += 1;
          } else {
            cur.naoTot += 1;
            if (cumpriu) cur.naoOk += 1;
          }
          acc.set(nome, cur);
        }
      }

      const out: DiferencaEtapa[] = [];
      acc.forEach((v, etapa) => {
        if (v.vendeuTot === 0 && v.naoTot === 0) return;
        const pctVendeu = v.vendeuTot ? (v.vendeuOk / v.vendeuTot) * 100 : 0;
        const pctNaoVendeu = v.naoTot ? (v.naoOk / v.naoTot) * 100 : 0;
        out.push({
          etapa,
          ordem: v.ordem,
          pctVendeu,
          pctNaoVendeu,
          diferenca: pctVendeu - pctNaoVendeu,
          nVendeu: v.vendeuTot,
          nNaoVendeu: v.naoTot,
        });
      });
      return out.sort((a, b) => b.diferenca - a.diferenca);
    },
  });
}

export interface CloserResumoRow {
  closer_id: string;
  closer_email: string;
  reunioes_avaliadas: number;
  nota_media: number | null;
  aderencia_media: number | null;
  pior_etapa: string | null;
  pior_etapa_pct: number | null;
  segunda_pior_etapa: string | null;
  segunda_pior_pct: number | null;
  melhor_etapa: string | null;
  melhor_etapa_pct: number | null;
  pontos_fortes: string[] | null;
  pontos_melhoria: string[] | null;
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

/** RPC 3 — resumo textual do motivo da nota por closer */
export function useRelatorioCloserResumo(de: string, ate: string, segmento: SegmentoFiltro) {
  return useQuery({
    queryKey: ['relatorio-closer-resumo', de, ate, segmento],
    queryFn: async (): Promise<CloserResumoRow[]> => {
      const { data, error } = await supabase.rpc('relatorio_closer_resumo', {
        _de: de,
        _ate: ate,
        _meeting_type: 'r1',
        _bu: 'incorporador',
        _icp_segment: segmento === 'todos' ? undefined : segmento,
      } as never);
      if (error) throw error;
      return ((data ?? []) as unknown as CloserResumoRow[]).map((r) => ({
        ...r,
        reunioes_avaliadas: Number(r.reunioes_avaliadas ?? 0),
        nota_media: num(r.nota_media),
        aderencia_media: num(r.aderencia_media),
        pior_etapa_pct: num(r.pior_etapa_pct),
        segunda_pior_pct: num(r.segunda_pior_pct),
        melhor_etapa_pct: num(r.melhor_etapa_pct),
        pontos_fortes: Array.isArray(r.pontos_fortes) ? r.pontos_fortes : [],
        pontos_melhoria: Array.isArray(r.pontos_melhoria) ? r.pontos_melhoria : [],
      }));
    },
  });
}

export interface TemaIA {
  tema: string;
  reunioes: number;
  total_reunioes: number;
  pct: number;
}

export interface ResumoIAResposta {
  ok?: boolean;
  vazio?: boolean;
  do_cache?: boolean;
  resumo: string | null;
  reunioes: number;
  reunioes_usadas: number;
  temas_melhoria: TemaIA[];
  temas_fortes: TemaIA[];
  frases_total?: number;
  frases_usadas: number;
  frases_sem_tema?: number;
  gerado_em?: string;
}

/** Edge function — agrupa as observações da IA em temas recorrentes por closer */
export function useResumoIA(
  closerId: string | null | undefined,
  de: string,
  ate: string,
  segmento: SegmentoFiltro,
) {
  return useQuery({
    queryKey: ['relatorio-resumo-ia', closerId, de, ate, segmento],
    enabled: !!closerId,
    staleTime: 12 * 60 * 60 * 1000,
    retry: false,
    queryFn: async (): Promise<ResumoIAResposta> => {
      const { data, error } = await supabase.functions.invoke('relatorio-resumo-ia', {
        body: {
          closer_id: closerId,
          de,
          ate,
          meeting_type: 'r1',
          icp_segment: segmento === 'todos' ? null : segmento,
        },
      });
      if (error) throw error;
      const r = (data ?? {}) as Partial<ResumoIAResposta> & { erro?: string };
      if (r.erro) throw new Error(r.erro);
      return {
        ok: r.ok,
        vazio: r.vazio,
        do_cache: r.do_cache,
        resumo: typeof r.resumo === 'string' && r.resumo.trim() ? r.resumo : null,
        reunioes: Number(r.reunioes ?? 0),
        reunioes_usadas: Number(r.reunioes_usadas ?? 0),
        temas_melhoria: Array.isArray(r.temas_melhoria) ? r.temas_melhoria : [],
        temas_fortes: Array.isArray(r.temas_fortes) ? r.temas_fortes : [],
        frases_total: Number(r.frases_total ?? 0),
        frases_usadas: Number(r.frases_usadas ?? 0),
        frases_sem_tema: Number(r.frases_sem_tema ?? 0),
        gerado_em: r.gerado_em,
      };
    },
  });
}
