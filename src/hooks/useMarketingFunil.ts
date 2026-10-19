import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Tipos manuais: as RPCs abaixo ainda não constam nos tipos gerados do Supabase.
// Campos numéricos podem chegar como string (numeric do Postgres) — converter com Number.
// Campos de custo/taxa podem vir null — manter null (não converter para 0).

export interface FunilSafraRow {
  periodo: string;
  investimento: number;
  investimento_awareness: number;
  impressoes: number;
  cliques_link: number;
  lpv: number;
  checkout_iniciado: number;
  compras_pixel: number;
  leads: number;
  entradas: number;
  entradas_a010: number;
  entradas_anamnese: number;
  entradas_outras: number;
  r1_agendadas: number;
  r1_realizadas: number;
  contratos: number;
  r2_realizadas: number;
  parcerias: number;
  liq_entrada: number;
  liq_contrato: number;
  liq_parceria: number;
  liq_total: number;
}

export interface FunilAnuncioRow {
  nivel_id: string;
  nome: string;
  campanha: string | null;
  conjunto: string | null;
  conta: string;
  status: string | null;
  thumbnail_url: string | null;
  ad_preview: string | null;
  tipo_criativo: string | null;
  investimento: number;
  impressoes: number;
  cliques_link: number;
  lpv: number;
  checkout_iniciado: number;
  compras_pixel: number;
  video_3s: number;
  thruplays: number;
  leads: number;
  entradas: number;
  r1_agendadas: number;
  r1_realizadas: number;
  contratos: number;
  r2_realizadas: number;
  parcerias: number;
  liq_total: number;
  liq_parceria: number;
  ctr: number | null;
  cpm: number | null;
  cpc: number | null;
  taxa_lpv_checkout: number | null;
  custo_entrada: number | null;
  custo_r1_realizada: number | null;
  custo_contrato: number | null;
  custo_parceria: number | null;
  roas_liquido: number | null;
}

export interface CanalPeriodoRow {
  canal: string;
  origem: string | null;
  entradas: number;
  r1_realizadas: number;
  contratos: number;
  parcerias: number;
}

export interface FunilContratoRow {
  periodo: string;
  produto: string;
  brutos: number;
  reembolsados: number;
  liquidos: number;
}

export type Grao = 'day' | 'week' | 'month';
export type Nivel = 'criativo' | 'ad' | 'adset' | 'campaign';
export type ModeloData = 'venda' | 'safra';
export type ModeloToque = 'primeiro' | 'ultimo';
export type ModeloOrigem = 'anuncio' | 'todas';

/** Converte numeric/Postgres (que pode chegar como string) para number. */
const toNum = (v: unknown): number => Number(v ?? 0);

/** Converte custo/taxa preservando null (não converte para 0). */
const toNumOrNull = (v: unknown): number | null =>
  v === null || v === undefined ? null : Number(v);

const PERM_ERROR = 'Sem permissão para o painel de marketing';

const mapSafra = (r: any): FunilSafraRow => ({
  periodo: r.periodo,
  investimento: toNum(r.investimento),
  investimento_awareness: toNum(r.investimento_awareness),
  impressoes: toNum(r.impressoes),
  cliques_link: toNum(r.cliques_link),
  lpv: toNum(r.lpv),
  checkout_iniciado: toNum(r.checkout_iniciado),
  compras_pixel: toNum(r.compras_pixel),
  leads: toNum(r.leads),
  entradas: toNum(r.entradas),
  entradas_a010: toNum(r.entradas_a010),
  entradas_anamnese: toNum(r.entradas_anamnese),
  entradas_outras: toNum(r.entradas_outras),
  r1_agendadas: toNum(r.r1_agendadas),
  r1_realizadas: toNum(r.r1_realizadas),
  contratos: toNum(r.contratos),
  r2_realizadas: toNum(r.r2_realizadas),
  parcerias: toNum(r.parcerias),
  liq_entrada: toNum(r.liq_entrada),
  liq_contrato: toNum(r.liq_contrato),
  liq_parceria: toNum(r.liq_parceria),
  liq_total: toNum(r.liq_total),
});

const mapAnuncio = (r: any): FunilAnuncioRow => ({
  nivel_id: r.nivel_id,
  nome: r.nome,
  campanha: r.campanha ?? null,
  conjunto: r.conjunto ?? null,
  conta: r.conta,
  status: r.status ?? null,
  thumbnail_url: r.thumbnail_url ?? null,
  ad_preview: r.ad_preview ?? null,
  tipo_criativo: r.tipo_criativo ?? null,
  investimento: toNum(r.investimento),
  impressoes: toNum(r.impressoes),
  cliques_link: toNum(r.cliques_link),
  lpv: toNum(r.lpv),
  checkout_iniciado: toNum(r.checkout_iniciado),
  compras_pixel: toNum(r.compras_pixel),
  video_3s: toNum(r.video_3s),
  thruplays: toNum(r.thruplays),
  leads: toNum(r.leads),
  entradas: toNum(r.entradas),
  r1_agendadas: toNum(r.r1_agendadas),
  r1_realizadas: toNum(r.r1_realizadas),
  contratos: toNum(r.contratos),
  r2_realizadas: toNum(r.r2_realizadas),
  parcerias: toNum(r.parcerias),
  liq_total: toNum(r.liq_total),
  liq_parceria: toNum(r.liq_parceria),
  ctr: toNumOrNull(r.ctr),
  cpm: toNumOrNull(r.cpm),
  cpc: toNumOrNull(r.cpc),
  taxa_lpv_checkout: toNumOrNull(r.taxa_lpv_checkout),
  custo_entrada: toNumOrNull(r.custo_entrada),
  custo_r1_realizada: toNumOrNull(r.custo_r1_realizada),
  custo_contrato: toNumOrNull(r.custo_contrato),
  custo_parceria: toNumOrNull(r.custo_parceria),
  roas_liquido: toNumOrNull(r.roas_liquido),
});

const mapCanal = (r: any): CanalPeriodoRow => ({
  canal: r.canal,
  origem: r.origem ?? null,
  entradas: toNum(r.entradas),
  r1_realizadas: toNum(r.r1_realizadas),
  contratos: toNum(r.contratos),
  parcerias: toNum(r.parcerias),
});

const mapContrato = (r: any): FunilContratoRow => ({
  periodo: r.periodo,
  produto: r.produto,
  brutos: Number(r.brutos),
  reembolsados: Number(r.reembolsados),
  liquidos: Number(r.liquidos),
});

export const useFunilSafras = ({
  from,
  to,
  grao = 'month',
  data = 'venda',
  toque = 'primeiro',
  origem = 'anuncio',
}: {
  from: string | null;
  to: string | null;
  grao?: Grao;
  data?: ModeloData;
  toque?: ModeloToque;
  origem?: ModeloOrigem;
}) =>
  useQuery<FunilSafraRow[]>({
    queryKey: ['mkt-funil-safras', from, to, grao, data, toque, origem],
    staleTime: 5 * 60 * 1000,
    enabled: !!from && !!to,
    queryFn: async () => {
      const { data: rows, error } = await (supabase.rpc as any)('mkt_funil_v3', {
        p_from: from,
        p_to: to,
        p_grao: grao,
        p_data: data,
        p_toque: toque,
        p_origem: origem,
      });
      if (error) {
        if (error.code === '42501') throw new Error(PERM_ERROR);
        throw error;
      }
      return (rows ?? []).map(mapSafra);
    },
  });

export const useFunilAnuncios = ({
  from,
  to,
  nivel = 'criativo',
  data = 'venda',
  toque = 'primeiro',
}: {
  from: string | null;
  to: string | null;
  nivel?: Nivel;
  data?: ModeloData;
  toque?: ModeloToque;
}) =>
  useQuery<FunilAnuncioRow[]>({
    queryKey: ['mkt-funil-anuncios', from, to, nivel, data, toque],
    staleTime: 5 * 60 * 1000,
    enabled: !!from && !!to,
    queryFn: async () => {
      const { data: rows, error } = await (supabase.rpc as any)('mkt_funil_criativos_v2', {
        p_from: from,
        p_to: to,
        p_nivel: nivel,
        p_data: data,
        p_toque: toque,
      });
      if (error) {
        if (error.code === '42501') throw new Error(PERM_ERROR);
        throw error;
      }
      return (rows ?? []).map(mapAnuncio);
    },
  });

export const useCanaisPeriodo = ({ from, to }: { from: string | null; to: string | null }) =>
  useQuery<CanalPeriodoRow[]>({
    queryKey: ['mkt-canais', from, to],
    staleTime: 5 * 60 * 1000,
    enabled: !!from && !!to,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('mkt_canais_periodo', {
        p_from: from,
        p_to: to,
      });
      if (error) {
        if (error.code === '42501') throw new Error(PERM_ERROR);
        throw error;
      }
      return (data ?? []).map(mapCanal);
    },
  });

export const useFunilContratos = ({
  from,
  to,
  grao = 'month',
  data = 'venda',
  origem = 'anuncio',
}: {
  from: string | null;
  to: string | null;
  grao?: Grao;
  data?: ModeloData;
  origem?: ModeloOrigem;
}) =>
  useQuery<FunilContratoRow[]>({
    queryKey: ['mkt-funil-contratos', from, to, grao, data, origem],
    staleTime: 5 * 60 * 1000,
    enabled: !!from && !!to,
    queryFn: async () => {
      const { data: rows, error } = await (supabase.rpc as any)('mkt_funil_contratos', {
        p_from: from,
        p_to: to,
        p_grao: grao,
        p_data: data,
        p_origem: origem,
      });
      if (error) {
        if (error.code === '42501') throw new Error(PERM_ERROR);
        throw error;
      }
      return (rows ?? []).map(mapContrato);
    },
  });

export const produtoContratoLabel = (produto: string): string => {
  if (produto === 'A000 - Contrato') return 'A000';
  if (produto === 'Contrato MCF') return 'Contrato MCF';
  if (produto === 'Caução - Leopoldo + MCF') return 'Caução Leopoldo';
  return produto;
};

export const CANAL_LABELS: Record<string, string> = {
  paid_meta: 'Anúncio Meta',
  organic_form: 'Formulário orgânico',
  organic_social: 'Instagram/Facebook orgânico',
  manychat: 'ManyChat',
  youtube: 'YouTube',
  google: 'Google',
  direct: 'Direto',
  other: 'Outros',
  unknown: 'Sem origem identificável',
  sem_toque: 'Sem rastro',
};

const brlNoCents = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

const brlWithCents = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatBRL = (n: number): string =>
  Math.abs(n) >= 1000 ? brlNoCents.format(n) : brlWithCents.format(n);

export const formatInt = (n: number): string =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(n);

export type AdPreviewFormato =
  | 'MOBILE_FEED_STANDARD'
  | 'INSTAGRAM_STANDARD'
  | 'INSTAGRAM_REELS'
  | 'INSTAGRAM_STORY'
  | 'FACEBOOK_REELS_MOBILE';

export const useAdPreview = (adId: string | null, formato: AdPreviewFormato) =>
  useQuery<{ src: string; formato: string }>({
    queryKey: ['mkt-ad-preview', adId, formato],
    enabled: !!adId,
    staleTime: 10 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('meta-ad-preview', { body: { ad_id: adId, formato } });
      if (error) {
        let msg = error.message;
        try {
          const ctx = (error as any).context;
          if (ctx && typeof ctx.json === 'function') {
            const b = await ctx.json();
            if (b?.erro) msg = b.erro;
          }
        } catch { /* mantém mensagem original */ }
        throw new Error(msg);
      }
      if (!data?.src) throw new Error(data?.erro ?? 'Prévia indisponível');
      return data;
    },
  });

export interface AdVideoInfo {
  video_src: string | null;
  poster: string | null;
  fb_url: string | null;
  ig_url: string | null;
  aviso: string | null;
}

export const useAdVideo = (adId: string | null) =>
  useQuery<AdVideoInfo>({
    queryKey: ['mkt-ad-video', adId],
    enabled: !!adId,
    staleTime: 30 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('meta-ad-preview', { body: { ad_id: adId, modo: 'video' } });
      if (error) {
        let msg = error.message;
        try {
          const ctx = (error as any).context;
          if (ctx && typeof ctx.json === 'function') {
            const b = await ctx.json();
            if (b?.erro) msg = b.erro;
          }
        } catch { /* mantém mensagem original */ }
        throw new Error(msg);
      }
      return data as AdVideoInfo;
    },
  });
