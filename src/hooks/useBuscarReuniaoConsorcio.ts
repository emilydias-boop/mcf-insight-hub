/**
 * Verificação anti-órbita do "Adicionar Carta": antes de gravar uma venda num
 * lead SEM R1 de consórcio, procura deals que já tenham R1 conduzida por
 * closer da BU Consórcio e que provavelmente são o mesmo cliente.
 *
 * Faixa 1 (identidade — forte): casa o titular por CPF/CNPJ, telefone (9
 * dígitos finais), e-mail exato, nome completo e dois primeiros nomes, contra
 * contatos, nome do deal e cadastros de consórcio — e exige R1 elegível.
 *
 * Faixa 2 (closer + janela — rede de segurança, só se a Faixa 1 vier vazia):
 * reuniões de consórcio do MESMO closer selecionado como vendedor (casamento
 * por nameKey, que normaliza "André Duarte" ↔ "Andre dos Santos Duarte")
 * dentro de ±15 dias da data de aceite.
 */
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchR1ConsorcioDetalhePorDeal } from '@/hooks/useCorrigirVinculoCota';
import { nameKey } from '@/hooks/useConsorcioCotasContratadas';

export interface BuscaReuniaoInput {
  nome?: string | null;
  cpf?: string | null;
  cnpj?: string | null;
  telefone?: string | null;
  email?: string | null;
  /** Nome do vendedor/closer selecionado no modal (base da Faixa 2). */
  closerNome?: string | null;
  /** Data de aceite — âncora da janela da Faixa 2 (ISO yyyy-MM-dd). */
  dataReferencia?: string | null;
  /** Lead já vinculado no modal — nunca é candidato de si mesmo. */
  excluirDealId?: string | null;
}

export interface ReuniaoConsorcioCandidato {
  dealId: string;
  originId: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  dia: string | null;
  closerName: string | null;
  agendadoPor: string | null;
  faixa: 1 | 2;
}

const JANELA_DIAS = 15;

function digits(v?: string | null): string {
  return (v || '').replace(/\D/g, '');
}

function semAcento(v: string): string {
  return v.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** "RODRIGO MOREIRA ROBERTO" → "Rodrigo Moreira" — o casamento que faltava. */
function doisPrimeirosNomes(nome: string): string | null {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length < 2) return null;
  return partes.slice(0, 2).join(' ');
}

async function nomesDeProfiles(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unicos = [...new Set(ids.filter(Boolean))];
  if (!unicos.length) return out;
  const { data } = await supabase.from('profiles').select('id, full_name').in('id', unicos);
  (data || []).forEach((p: any) => out.set(String(p.id), p.full_name || ''));
  return out;
}

async function montarCandidatos(
  dealIds: string[],
  faixa: 1 | 2,
  r1PorDeal: Map<string, { dia: string | null; closerName: string | null; bookedBy: string | null }>,
  agendadorPorDeal?: Map<string, string | null>,
): Promise<ReuniaoConsorcioCandidato[]> {
  const ids = [...new Set(dealIds)].filter((id) => r1PorDeal.has(id));
  if (!ids.length) return [];
  const { data: deals, error } = await supabase
    .from('crm_deals')
    .select('id, name, origin_id, is_archived, crm_contacts(name, email, phone)')
    .in('id', ids);
  if (error) throw error;
  const bookedIds = ids
    .map((id) => agendadorPorDeal?.get(id) ?? r1PorDeal.get(id)?.bookedBy ?? null)
    .filter(Boolean) as string[];
  const nomes = await nomesDeProfiles(bookedIds);
  const out: ReuniaoConsorcioCandidato[] = [];
  for (const d of (deals || []) as any[]) {
    if (d.is_archived) continue;
    const r1 = r1PorDeal.get(String(d.id));
    if (!r1) continue;
    const bookedBy = agendadorPorDeal?.get(String(d.id)) ?? r1.bookedBy ?? null;
    out.push({
      dealId: String(d.id),
      originId: d.origin_id ? String(d.origin_id) : null,
      contactName: d.crm_contacts?.name || d.name || null,
      contactEmail: d.crm_contacts?.email || null,
      contactPhone: d.crm_contacts?.phone || null,
      dia: r1.dia,
      closerName: r1.closerName,
      agendadoPor: bookedBy ? nomes.get(bookedBy) || null : null,
      faixa,
    });
  }
  return out;
}

/** Faixa 1 — identidade do titular + R1 de consórcio elegível. */
async function faixaIdentidade(
  input: BuscaReuniaoInput,
): Promise<ReuniaoConsorcioCandidato[]> {
  const email = (input.email || '').trim().toLowerCase();
  const telSuffix = digits(input.telefone).slice(-9);
  const nome = (input.nome || '').trim();
  const doisNomes = nome ? doisPrimeirosNomes(nome) : null;

  const orsContato: string[] = [];
  const orsDealNome: string[] = [];
  if (email) orsContato.push(`email.ilike.${email}`);
  if (telSuffix.length >= 8) orsContato.push(`phone.ilike.%${telSuffix}%`);
  for (const base of [nome, doisNomes || '']) {
    if (!base) continue;
    for (const t of new Set([base, semAcento(base)])) {
      orsContato.push(`name.ilike.%${t}%`);
      orsDealNome.push(`name.ilike.%${t}%`);
    }
  }

  const dealIds = new Set<string>();

  if (orsContato.length > 0) {
    const { data: contacts, error } = await supabase
      .from('crm_contacts')
      .select('id')
      .eq('is_archived', false)
      .or(orsContato.join(','))
      .limit(40);
    if (error) throw error;
    const contactIds = (contacts || []).map((c: any) => c.id);
    if (contactIds.length) {
      const { data: deals, error: dErr } = await supabase
        .from('crm_deals')
        .select('id')
        .eq('is_archived', false)
        .in('contact_id', contactIds)
        .limit(60);
      if (dErr) throw dErr;
      (deals || []).forEach((d: any) => dealIds.add(String(d.id)));
    }
  }

  if (orsDealNome.length > 0) {
    const { data: deals, error } = await supabase
      .from('crm_deals')
      .select('id')
      .eq('is_archived', false)
      .or(orsDealNome.join(','))
      .limit(60);
    if (error) throw error;
    (deals || []).forEach((d: any) => dealIds.add(String(d.id)));
  }

  // Reforço por CPF/CNPJ via cadastros de consórcio do mesmo documento.
  const doc = digits(input.cpf).length >= 11 ? digits(input.cpf) : digits(input.cnpj);
  if (doc.length >= 11) {
    const col = digits(input.cpf).length >= 11 ? 'cpf' : 'cnpj';
    const valor = col === 'cpf' ? (input.cpf || '').trim() : (input.cnpj || '').trim();
    if (valor) {
      const { data: regs, error } = await supabase
        .from('consorcio_pending_registrations')
        .select('deal_id')
        .eq(col, valor)
        .not('deal_id', 'is', null)
        .limit(20);
      if (error) throw error;
      (regs || []).forEach((r: any) => r.deal_id && dealIds.add(String(r.deal_id)));
    }
  }

  if (input.excluirDealId) dealIds.delete(input.excluirDealId);
  if (dealIds.size === 0) return [];

  const r1 = await fetchR1ConsorcioDetalhePorDeal([...dealIds]);
  return montarCandidatos([...dealIds], 1, r1);
}

/** Faixa 2 — mesmo closer (nameKey) com R1 de consórcio em ±15 dias do aceite. */
async function faixaCloserJanela(
  input: BuscaReuniaoInput,
): Promise<ReuniaoConsorcioCandidato[]> {
  const closerKey = nameKey(input.closerNome);
  if (!closerKey || !input.dataReferencia) return [];

  const { data: closers, error: cErr } = await supabase
    .from('closers')
    .select('id, name')
    .eq('bu', 'consorcio');
  if (cErr) throw cErr;
  const closerIds = (closers || [])
    .filter((c: any) => nameKey(c.name) === closerKey)
    .map((c: any) => String(c.id));
  if (!closerIds.length) return [];

  const ref = new Date(`${input.dataReferencia}T12:00:00`);
  if (isNaN(ref.getTime())) return [];
  const ini = new Date(ref);
  ini.setDate(ini.getDate() - JANELA_DIAS);
  const fim = new Date(ref);
  fim.setDate(fim.getDate() + JANELA_DIAS);

  const { data: slots, error: sErr } = await supabase
    .from('meeting_slots')
    .select('id, closer_id, scheduled_at')
    .in('closer_id', closerIds)
    .gte('scheduled_at', ini.toISOString())
    .lte('scheduled_at', fim.toISOString());
  if (sErr) throw sErr;
  const slotIds = (slots || []).map((s: any) => String(s.id));
  if (!slotIds.length) return [];
  const slotPorId = new Map<string, any>((slots || []).map((s: any) => [String(s.id), s]));

  const { data: attendees, error: aErr } = await supabase
    .from('meeting_slot_attendees')
    .select('deal_id, status, booked_by, meeting_slot_id')
    .in('meeting_slot_id', slotIds)
    .not('deal_id', 'is', null);
  if (aErr) throw aErr;

  const r1PorDeal = new Map<string, { dia: string | null; closerName: string | null; bookedBy: string | null }>();
  const closerNomePorId = new Map<string, string>(
    (closers || []).map((c: any) => [String(c.id), c.name || '']),
  );
  for (const a of (attendees || []) as any[]) {
    if (a.status === 'cancelled' || a.status === 'invited') continue;
    const slot = slotPorId.get(String(a.meeting_slot_id));
    if (!slot) continue;
    const dealId = String(a.deal_id);
    if (input.excluirDealId && dealId === input.excluirDealId) continue;
    const atual = r1PorDeal.get(dealId);
    const dia = slot.scheduled_at ?? null;
    if (!atual || String(dia || '').localeCompare(String(atual.dia || '')) > 0) {
      r1PorDeal.set(dealId, {
        dia,
        closerName: closerNomePorId.get(String(slot.closer_id)) || null,
        bookedBy: a.booked_by ? String(a.booked_by) : atual?.bookedBy ?? null,
      });
    }
  }
  if (r1PorDeal.size === 0) return [];

  const candidatos = await montarCandidatos([...r1PorDeal.keys()], 2, r1PorDeal);

  // Ordena: proximidade da data de aceite; desempate por semelhança do nome digitado.
  const refMs = ref.getTime();
  const nomeBusca = semAcento((input.nome || '').trim()).toLowerCase();
  const dois = doisPrimeirosNomes(nomeBusca) || nomeBusca;
  const scoreNome = (c: ReuniaoConsorcioCandidato) => {
    const alvo = semAcento(c.contactName || '').toLowerCase();
    if (!alvo || !dois) return 0;
    if (alvo === nomeBusca) return 2;
    if (alvo.includes(dois) || dois.includes(alvo)) return 1;
    return 0;
  };
  candidatos.sort((a, b) => {
    const da = a.dia ? Math.abs(new Date(a.dia).getTime() - refMs) : Number.MAX_SAFE_INTEGER;
    const db = b.dia ? Math.abs(new Date(b.dia).getTime() - refMs) : Number.MAX_SAFE_INTEGER;
    if (da !== db) return da - db;
    return scoreNome(b) - scoreNome(a);
  });
  return candidatos;
}

export async function buscarReunioesConsorcio(
  input: BuscaReuniaoInput,
): Promise<ReuniaoConsorcioCandidato[]> {
  const faixa1 = await faixaIdentidade(input);
  if (faixa1.length > 0) return faixa1;
  return faixaCloserJanela(input);
}

/** Versão imperativa para uso no submit — não é query de tela, é verificação sob demanda. */
export function useBuscarReuniaoConsorcio() {
  return useMutation({
    mutationFn: (input: BuscaReuniaoInput) => buscarReunioesConsorcio(input),
  });
}
