/** Regras de apresentação da Presença do dia (as contas oficiais ficam em capacidade_dia, no banco). */

export type PresencaBU = 'incorporador' | 'consorcio';

export type PessoaPresenca = {
  tipo: 'closer' | 'sdr';
  pessoa_id: string;
  profile_id: string | null;
  nome: string;
  papel: string;
  meta: number | null;
  primeiro_acesso: string | null;
  presente_login: boolean;
  presente: boolean;
  origem: 'login' | 'corrigido_lider';
  motivo: string | null;
  conta: boolean;
  regra: string | null;
};

export const ROTULO_BU: Record<PresencaBU, string> = { incorporador: 'Incorporador', consorcio: 'Consórcio' };

/** Data de hoje em São Paulo (AAAA-MM-DD). */
export function hojeSP(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
}

/** Minutos desde 00:00 em São Paulo. */
export function minutosSP(agora: Date = new Date()): number {
  const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false })
    .format(agora).split(':').map(Number);
  return (h % 24) * 60 + m;
}

/** O aviso aparece a partir de "HH:MM" (São Paulo), enquanto o dia não estiver confirmado. */
export function deveMostrarAviso(agora: Date, horarioAviso: string, confirmado: boolean): boolean {
  if (confirmado) return false;
  const [h, m] = horarioAviso.split(':').map(Number);
  return minutosSP(agora) >= h * 60 + m;
}

/** Prévia local da capacidade (mesma regra da função do banco). */
export function previaCapacidade(pessoas: PessoaPresenca[], reunioesPorCloser: number, leadsPorReuniao: number) {
  const contam = pessoas.filter((p) => p.conta && p.presente);
  const closers = contam.filter((p) => p.tipo === 'closer').length;
  const reunioes = closers * reunioesPorCloser;
  return {
    closers,
    sdrs: contam.filter((p) => p.tipo === 'sdr').length,
    reunioes,
    leads: reunioes * leadsPorReuniao,
    agendamentos: contam.filter((p) => p.tipo === 'sdr').reduce((s, p) => s + (p.meta ?? 0), 0),
  };
}
