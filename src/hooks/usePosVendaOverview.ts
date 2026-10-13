import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllPages, fetchAllByIds } from '@/lib/supabasePaginacao';
import { POS_VENDA_ORIGIN_ID, POS_VENDA_NOVOS_LICENCIADOS_STAGE_ID, POS_VENDA_CONCLUIDA_STAGE_ID } from '@/lib/posVenda';

export const POS_VENDA_VIAB1_STAGE_ID = 'b05a0001-0000-4000-8000-000000000001';
const DAY = 86400000;
const db = supabase as any;

/** Atividades que contam como contato humano com o cliente (automáticas como anamnese/tags ficam de fora). */
export const isContato = (t: string) =>
  t === 'note' || t === 'call' || t === 'click_to_call' || t === 'pos_venda_nota_contato' || t === 'pos_venda_envio' ||
  t.startsWith('ligacao') || t.includes('whatsapp');
const AUTOMATICAS = new Set(['pos_venda_anamnese', 'pos_venda_entrada', 'tags_added', 'tags_changed', 'tags_removed']);

export interface PosVendaMetrics {
  entraram: number; trabalhados: number; semToque: number; avancados: number;
  abertos: number; parados: number; envelhecidos: number; tempoMedioSemMovHoras: number;
  agendadas: number; realizadas: number; noShow: number; reagendamentos: number; concluidas: number;
}
export interface PosVendaGerenteRow extends PosVendaMetrics { email: string; nome: string }
export interface PosVendaOverview { total: PosVendaMetrics; gerentes: PosVendaGerenteRow[]; travadosPorEtapa: { stageName: string; count: number }[] }

const vazio = (): PosVendaMetrics => ({ entraram: 0, trabalhados: 0, semToque: 0, avancados: 0, abertos: 0, parados: 0, envelhecidos: 0, tempoMedioSemMovHoras: 0, agendadas: 0, realizadas: 0, noShow: 0, reagendamentos: 0, concluidas: 0 });

export function usePosVendaOverview(start: Date, end: Date) {
  return useQuery({
    queryKey: ['pos-venda-overview', start.toISOString(), end.toISOString()],
    queryFn: async (): Promise<PosVendaOverview> => {
      const s = start.getTime(), e = end.getTime(), now = Date.now();
      const inP = (iso?: string | null) => { if (!iso) return false; const t = new Date(iso).getTime(); return t >= s && t <= e; };

      const deals = await fetchAllPages<any>((f, t) => db.from('crm_deals')
        .select('id, owner_id, stage_id, created_at, stage_moved_at, custom_fields')
        .eq('origin_id', POS_VENDA_ORIGIN_ID).eq('is_archived', false).order('id').range(f, t));
      const ids = deals.map((d) => d.id);

      const [acts, ents, timeline, calls, reunioes, stages] = await Promise.all([
        fetchAllByIds<any>(ids, (l, f, t) => db.from('deal_activities').select('deal_id, activity_type, created_at, user_id').in('deal_id', l).order('id').range(f, t)),
        fetchAllByIds<any>(ids, (l, f, t) => db.from('crm_deal_entregaveis').select('deal_id').in('deal_id', l).order('id').range(f, t)),
        fetchAllByIds<any>(ids, (l, f, t) => db.from('crm_cliente_timeline').select('deal_id, stage_para, actor_id, created_at')
          .in('deal_id', l).in('stage_para', [POS_VENDA_NOVOS_LICENCIADOS_STAGE_ID, POS_VENDA_CONCLUIDA_STAGE_ID]).order('id').range(f, t)),
        fetchAllPages<any>((f, t) => db.from('calls').select('deal_id, duration_seconds, created_at')
          .eq('origin_id', POS_VENDA_ORIGIN_ID).gt('duration_seconds', 60).order('id').range(f, t)),
        fetchAllPages<any>((f, t) => db.from('pos_venda_reunioes').select('id, deal_id, gerente_id, status, inicio').order('id').range(f, t)),
        db.from('crm_stages').select('id, stage_name').eq('origin_id', POS_VENDA_ORIGIN_ID),
      ]);

      const gerenteIds = [...new Set(reunioes.map((r) => r.gerente_id).filter(Boolean))];
      const owners = [...new Set(deals.map((d) => (d.owner_id || '').toLowerCase()).filter(Boolean))];
      const { data: profs } = await db.from('profiles').select('id, full_name, email')
        .or(`id.in.(${gerenteIds.join(',') || '00000000-0000-0000-0000-000000000000'}),email.in.(${owners.map((o) => `"${o}"`).join(',') || '"-"'})`);
      const emailById = new Map<string, string>(); const nomeByEmail = new Map<string, string>();
      (profs || []).forEach((p: any) => { const em = (p.email || '').toLowerCase(); emailById.set(p.id, em); nomeByEmail.set(em, p.full_name || em); });

      const ultimoContato = new Map<string, number>(); const contatoNoPeriodo = new Set<string>();
      const temManual = new Set<string>(); const temNota = new Set<string>(); const avancados = new Set<string>();
      const marca = (id: string, iso: string) => { const t = new Date(iso).getTime(); if (t > (ultimoContato.get(id) || 0)) ultimoContato.set(id, t); if (t >= s && t <= e) contatoNoPeriodo.add(id); };
      acts.forEach((a) => {
        const t = a.activity_type || '';
        if (!AUTOMATICAS.has(t)) temManual.add(a.deal_id);
        if (t === 'note' || t === 'pos_venda_nota_contato') temNota.add(a.deal_id);
        if (isContato(t)) marca(a.deal_id, a.created_at);
        if (t === 'pos_venda_envio' && inP(a.created_at)) avancados.add(a.deal_id);
      });
      calls.forEach((c) => { if (c.deal_id) { temManual.add(c.deal_id); marca(c.deal_id, c.created_at); } });
      const comEntregavel = new Set(ents.map((x) => x.deal_id));
      const entraram = new Set<string>(); const concluidas = new Map<string, string | null>();
      timeline.forEach((x) => {
        if (!inP(x.created_at)) return;
        if (x.stage_para === POS_VENDA_NOVOS_LICENCIADOS_STAGE_ID) entraram.add(x.deal_id);
        if (x.stage_para === POS_VENDA_CONCLUIDA_STAGE_ID) concluidas.set(x.deal_id, x.actor_id);
      });

      const rows = new Map<string, PosVendaMetrics & { _mov: number[] }>();
      const row = (em: string) => { if (!rows.has(em)) rows.set(em, { ...vazio(), _mov: [] }); return rows.get(em)!; };
      const total = { ...vazio(), _mov: [] as number[] };
      const stageName = new Map<string, string>((stages.data || []).map((x: any) => [x.id, x.stage_name]));
      const travados = new Map<string, number>();
      const add = (r: any, k: keyof PosVendaMetrics) => { r[k]++; total[k]++; };

      deals.forEach((d) => {
        const r = row((d.owner_id || '').toLowerCase() || 'sem dono');
        const destino = d.custom_fields?.pos_venda_destino;
        if (d.stage_id === POS_VENDA_NOVOS_LICENCIADOS_STAGE_ID && inP(d.created_at)) entraram.add(d.id);
        if (entraram.has(d.id)) add(r, 'entraram');
        if (contatoNoPeriodo.has(d.id)) add(r, 'trabalhados');
        if (d.stage_id === POS_VENDA_NOVOS_LICENCIADOS_STAGE_ID && !destino) add(r, 'semToque');
        if (avancados.has(d.id)) add(r, 'avancados');
        if (d.stage_id === POS_VENDA_VIAB1_STAGE_ID && !temNota.has(d.id) && !comEntregavel.has(d.id)) add(r, 'abertos');
        if (!temManual.has(d.id)) add(r, 'parados');
        const ult = ultimoContato.get(d.id) ?? new Date(d.created_at).getTime();
        if (!destino && now - ult > 15 * DAY) add(r, 'envelhecidos');
        if (!destino && d.stage_id !== POS_VENDA_CONCLUIDA_STAGE_ID) {
          const mov = (now - new Date(d.stage_moved_at || d.created_at).getTime()) / 3600000;
          r._mov.push(mov); total._mov.push(mov);
          if (mov >= 72) { const n = stageName.get(d.stage_id) || 'Sem etapa'; travados.set(n, (travados.get(n) || 0) + 1); }
        }
      });
      concluidas.forEach((actor) => add(row(actor ? emailById.get(actor) || 'sem dono' : 'sem dono'), 'concluidas'));

      reunioes.forEach((m) => {
        if (!inP(m.inicio)) return;
        const r = row(emailById.get(m.gerente_id) || 'sem dono');
        if (m.status === 'agendada') add(r, 'agendadas');
        else if (m.status === 'realizada') add(r, 'realizadas');
        else if (m.status === 'no_show') add(r, 'noShow');
        else if (m.status === 'cancelada' && m.deal_id &&
          reunioes.some((o) => o.id !== m.id && o.deal_id === m.deal_id && o.status !== 'cancelada' && new Date(o.inicio) > new Date(m.inicio))) add(r, 'reagendamentos');
      });

      const media = (a: number[]) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0);
      const fim = ({ _mov, ...m }: any) => ({ ...m, tempoMedioSemMovHoras: media(_mov) });
      return {
        total: fim(total),
        gerentes: [...rows.entries()].map(([email, m]) => ({ email, nome: nomeByEmail.get(email) || email, ...fim(m) }))
          .sort((a, b) => a.nome.localeCompare(b.nome)),
        travadosPorEtapa: [...travados.entries()].map(([stageName, count]) => ({ stageName, count })),
      };
    },
  });
}
