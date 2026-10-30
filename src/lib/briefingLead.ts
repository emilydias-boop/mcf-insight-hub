// Apresentação do briefing do lead (IA). Só rótulos e formatação — sem regra de negócio.

export type BriefingFonte =
  | 'anamnese' | 'qualificacao' | 'agendamento' | 'nota_closer' | 'nota_equipe'
  | 'contato' | 'ligacao' | 'r1' | 'r2' | 'pagamento' | 'agenda';

export type AtencaoTipo = 'risco' | 'divergencia' | 'lacuna';

export interface BriefingItem { texto: string; fontes: BriefingFonte[] }
export interface BriefingConteudo {
  resumo_curto: string;
  alerta_curto: string;
  quem_e: (BriefingItem & { rotulo: string })[];
  como_chegou: BriefingItem[];
  ja_falado: BriefingItem[];
  combinado: BriefingItem[];
  atencao: (BriefingItem & { tipo: AtencaoTipo })[];
  perguntas: string[];
}

const ROTULOS: Record<BriefingFonte, string> = {
  anamnese: 'anamnese', qualificacao: 'SDR', agendamento: 'agendamento', nota_closer: 'closer',
  nota_equipe: 'equipe', contato: 'contato', ligacao: 'ligação', r1: 'R1', r2: 'R2',
  pagamento: 'pagamento', agenda: 'agenda',
};

export function rotuloFonte(f: string): string {
  return (ROTULOS as Record<string, string>)[f] ?? f;
}

export function estiloAtencao(tipo: string): { icone: string; tom: 'vermelho' | 'ambar' } {
  if (tipo === 'risco') return { icone: '!', tom: 'vermelho' };
  if (tipo === 'divergencia') return { icone: '≠', tom: 'ambar' };
  return { icone: '?', tom: 'ambar' };
}

/** União das fontes citadas em todo o briefing, na ordem em que aparecem. */
export function fontesUsadas(c: BriefingConteudo | null | undefined): BriefingFonte[] {
  if (!c) return [];
  const set = new Set<BriefingFonte>();
  for (const lista of [c.quem_e, c.como_chegou, c.ja_falado, c.combinado, c.atencao]) {
    for (const it of lista ?? []) for (const f of it.fontes ?? []) set.add(f);
  }
  return [...set];
}

export function geradoHa(iso: string | null | undefined, agora: Date = new Date()): string {
  if (!iso) return '';
  const min = Math.floor((agora.getTime() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? '1 dia' : `${d} dias`;
}

export type BriefingMomento = 'R1' | 'R2' | 'POS_R1' | 'COMPLETO';

export function tituloMomento(m: string | null | undefined): string {
  if (m === 'R2') return 'BRIEFING PARA A R2';
  if (m === 'POS_R1') return 'DEPOIS DA R1';
  if (m === 'COMPLETO') return 'RESUMO COMPLETO';
  return 'BRIEFING PARA A R1';
}

export function tituloPerguntas(m: string | null | undefined): string {
  return m === 'POS_R1' || m === 'COMPLETO' ? 'Próximos passos' : 'Para a reunião';
}
