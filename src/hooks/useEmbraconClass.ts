import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllPages } from '@/lib/supabasePaginacao';
import { toast } from 'sonner';

/**
 * Painel "Índices Class" (Embracon 12-6 e 8-2).
 * Espec de referência: docs/embracon-class-indices.md
 *
 * LEITURA E CÁLCULO. Nada aqui gera cobrança, lançamento financeiro, mensagem a
 * cliente ou evento externo. O simulador vive só no estado da tela.
 */

const db = supabase as any;

export type IndiceClass = '12-6' | '8-2';

export interface BreakdownMes {
  mes: string;
  producao: number;
  qtd_canceladas: number;
  credito_canceladas: number;
  qtd_inadimplentes: number;
  credito_inadimplentes: number;
}

export interface IndiceClassRow {
  mes_apuracao: string;
  indice: IndiceClass;
  janela_inicio: string;
  janela_fim: string;
  denominador: number;
  denominador_mcf: number;
  numerador: number;
  numerador_canceladas: number;
  numerador_inadimplentes: number;
  indice_valor: number | null;
  qtd_cotas: number;
  meta: number;
  falta_para_meta: number;
  cotas_para_meta: number;
  tem_importacao: boolean;
  breakdown: BreakdownMes[];
}

/** Chave de cruzamento com o FinanceHub: `007272-4634`. */
export function normalizarGrupoCota(grupo: string, cota: string): string {
  const g = String(grupo ?? '').replace(/\D/g, '').padStart(6, '0');
  const c = String(cota ?? '').replace(/\D/g, '').padStart(4, '0');
  return `${g}-${c}`;
}

export function useEmbraconIndices(mes: string) {
  return useQuery({
    queryKey: ['embracon-indices', mes],
    queryFn: async (): Promise<IndiceClassRow[]> => {
      const { data, error } = await db.rpc('embracon_indices_class', { p_mes: mes });
      if (error) throw error;
      return (data || []).map((r: any) => ({
        ...r,
        denominador: Number(r.denominador) || 0,
        denominador_mcf: Number(r.denominador_mcf) || 0,
        numerador: Number(r.numerador) || 0,
        numerador_canceladas: Number(r.numerador_canceladas) || 0,
        numerador_inadimplentes: Number(r.numerador_inadimplentes) || 0,
        indice_valor: r.indice_valor === null ? null : Number(r.indice_valor),
        meta: Number(r.meta) || 0,
        falta_para_meta: Number(r.falta_para_meta) || 0,
        breakdown: (r.breakdown || []) as BreakdownMes[],
      }));
    },
    staleTime: 60_000,
  });
}

export interface ProducaoMes {
  mes: string;
  valor: number;
  fonte: string;
  atualizado_em: string;
}

export function useEmbraconProducao() {
  return useQuery({
    queryKey: ['embracon-producao'],
    queryFn: async (): Promise<ProducaoMes[]> => {
      const { data, error } = await db
        .from('embracon_producao_mensal')
        .select('mes, valor, fonte, atualizado_em')
        .order('mes', { ascending: true });
      if (error) throw error;
      return (data || []).map((r: any) => ({ ...r, valor: Number(r.valor) || 0 }));
    },
  });
}

export function useSalvarProducao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ mes, valor }: { mes: string; valor: number }) => {
      const { error } = await db
        .from('embracon_producao_mensal')
        .upsert({ mes, valor, fonte: 'lancamento_manual', atualizado_em: new Date().toISOString() }, { onConflict: 'mes' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['embracon-producao'] });
      qc.invalidateQueries({ queryKey: ['embracon-indices'] });
      toast.success('Produção do mês registrada');
    },
    onError: (e: any) => toast.error('Não foi possível salvar: ' + (e?.message || 'erro desconhecido')),
  });
}

export interface ClassConfig {
  meta: number;
  bonus_pct: number;
  janela_126_inicio: number;
  janela_126_fim: number;
  janela_82_inicio: number;
  janela_82_fim: number;
}

export function useEmbraconConfig() {
  return useQuery({
    queryKey: ['embracon-class-config'],
    queryFn: async (): Promise<ClassConfig | null> => {
      const { data, error } = await db.from('embracon_class_config').select('*').maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        meta: Number(data.meta) || 0.25,
        bonus_pct: Number(data.bonus_pct) || 0.006,
        janela_126_inicio: data.janela_126_inicio,
        janela_126_fim: data.janela_126_fim,
        janela_82_inicio: data.janela_82_inicio,
        janela_82_fim: data.janela_82_fim,
      };
    },
  });
}

export interface CotaImportada {
  id: string;
  data_referencia: string;
  grupo: string;
  cota: string;
  contrato: string | null;
  valor_bem: number;
  mes_producao: string | null;
  status: 'ativa_em_dia' | 'inadimplente' | 'cancelada' | 'reativada';
  parcelas_vencidas: number | null;
  plano: string | null;
  fonte: string;
}

/** Última importação de cada cota com mês de produção dentro da janela. */
export function useCotasImportadasJanela(inicio?: string, fim?: string, status?: CotaImportada['status'][]) {
  return useQuery({
    queryKey: ['embracon-cotas-janela', inicio, fim, status?.join(',')],
    enabled: !!inicio && !!fim,
    queryFn: async (): Promise<CotaImportada[]> => {
      const rows = await fetchAllPages<any>((from, to) => {
        let q = db
          .from('embracon_cota_status_import')
          .select('id, data_referencia, grupo, cota, contrato, valor_bem, mes_producao, status, parcelas_vencidas, plano, fonte')
          .gte('mes_producao', inicio!)
          .lte('mes_producao', fim!)
          .order('data_referencia', { ascending: false })
          .order('importado_em', { ascending: false });
        if (status?.length) q = q.in('status', status);
        return q.range(from, to);
      });

      // Dedupe: vale a importação mais recente de cada grupo-cota.
      const vistos = new Set<string>();
      const out: CotaImportada[] = [];
      for (const r of rows || []) {
        const chave = normalizarGrupoCota(r.grupo, r.cota);
        if (vistos.has(chave)) continue;
        vistos.add(chave);
        out.push({ ...r, valor_bem: Number(r.valor_bem) || 0 });
      }
      return out.sort((a, b) => b.valor_bem - a.valor_bem);
    },
  });
}

export interface LinhaImportacao {
  data_referencia: string;
  grupo: string;
  cota: string;
  contrato: string | null;
  valor_bem: number | null;
  mes_producao: string | null;
  status: CotaImportada['status'];
  parcelas_vencidas: number | null;
  plano: string | null;
  fonte: string;
}

export function useImportarCotaStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (linhas: LinhaImportacao[]) => {
      const { data: sessao } = await supabase.auth.getUser();
      const payload = linhas.map((l) => ({ ...l, importado_por: sessao?.user?.id ?? null }));
      // Lotes de 500 para não estourar o payload.
      for (let i = 0; i < payload.length; i += 500) {
        const { error } = await db.from('embracon_cota_status_import').insert(payload.slice(i, i + 500));
        if (error) throw error;
      }
      return payload.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ['embracon-indices'] });
      qc.invalidateQueries({ queryKey: ['embracon-cotas-janela'] });
      toast.success(`${n} cota(s) importada(s)`);
    },
    onError: (e: any) => toast.error('Importação não concluída: ' + (e?.message || 'erro desconhecido')),
  });
}

export interface SnapshotIndice {
  id: string;
  mes_apuracao: string;
  indice: IndiceClass;
  numerador: number | null;
  denominador: number | null;
  valor: number | null;
  qtd_cotas: number | null;
  fonte: 'calculado' | 'power_bi';
  registrado_em: string;
}

export function useEmbraconSnapshots(mes: string) {
  return useQuery({
    queryKey: ['embracon-snapshots', mes],
    queryFn: async (): Promise<SnapshotIndice[]> => {
      const { data, error } = await db
        .from('embracon_indices_snapshot')
        .select('*')
        .eq('mes_apuracao', mes)
        .order('registrado_em', { ascending: false });
      if (error) throw error;
      return (data || []) as SnapshotIndice[];
    },
  });
}

export function useRegistrarSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: Omit<SnapshotIndice, 'id' | 'registrado_em'>) => {
      const { data: sessao } = await supabase.auth.getUser();
      const { error } = await db
        .from('embracon_indices_snapshot')
        .insert({ ...s, registrado_por: sessao?.user?.id ?? null });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['embracon-snapshots'] });
      toast.success('Snapshot registrado');
    },
    onError: (e: any) => toast.error('Não foi possível registrar: ' + (e?.message || 'erro desconhecido')),
  });
}

export interface CotaRiscoMcf {
  card_id: string;
  nome: string;
  grupo: string | null;
  cota: string | null;
  valor_credito: number;
  mes_producao: string;
  parcelas_vencidas: number;
  valor_boleto: number;
}

/**
 * Cotas em risco pelos dados do PRÓPRIO MCF Gestão (parcelas vencidas e não
 * pagas), com o mês de produção derivado da data de contratação/reserva.
 */
export function useCotasRiscoMcf() {
  return useQuery({
    queryKey: ['embracon-cotas-risco-mcf'],
    queryFn: async (): Promise<CotaRiscoMcf[]> => {
      const hoje = new Date().toISOString().slice(0, 10);
      const parcelas = await fetchAllPages<any>((from, to) =>
        db
          .from('consortium_installments')
          .select('card_id, valor_parcela, data_vencimento, status')
          .neq('status', 'pago')
          .lt('data_vencimento', hoje)
          .order('data_vencimento', { ascending: true })
          .range(from, to),
      );

      const porCard = new Map<string, { qtd: number; boleto: number }>();
      for (const p of parcelas || []) {
        const atual = porCard.get(p.card_id) || { qtd: 0, boleto: 0 };
        atual.qtd += 1;
        if (!atual.boleto) atual.boleto = Number(p.valor_parcela) || 0;
        porCard.set(p.card_id, atual);
      }
      const ids = Array.from(porCard.keys());
      if (!ids.length) return [];

      const cards: any[] = [];
      for (let i = 0; i < ids.length; i += 200) {
        const { data, error } = await db
          .from('consortium_cards')
          .select('id, nome_completo, razao_social, grupo, cota, valor_credito, status, data_contratacao, data_reserva, created_at')
          .in('id', ids.slice(i, i + 200));
        if (error) throw error;
        cards.push(...(data || []));
      }

      return cards
        .filter((c) => c.status !== 'cancelado')
        .map((c) => {
          const base = c.data_contratacao || c.data_reserva || String(c.created_at).slice(0, 10);
          const info = porCard.get(c.id)!;
          return {
            card_id: c.id,
            nome: c.nome_completo || c.razao_social || 'sem nome',
            grupo: c.grupo ?? null,
            cota: c.cota ?? null,
            valor_credito: Number(c.valor_credito) || 0,
            mes_producao: `${String(base).slice(0, 7)}-01`,
            parcelas_vencidas: info.qtd,
            valor_boleto: info.boleto,
          };
        })
        .sort((a, b) => b.valor_credito - a.valor_credito);
    },
    staleTime: 60_000,
  });
}
