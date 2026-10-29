/** Regras puras do Relatório da Cota (prévia interna do que vai ao HARVEY). */
export type LanceMes = { data: string; tipo: string | null; percentual: number; valor: number; chance: string; posicao_estimada: number | null };
export type MesRelatorio = {
  mes: string; // YYYY-MM
  assembleia: { numero: number; data: string; sorteio: string | null } | null;
  loteria: { numero: string; aplicado: string | null; consultado_em: string } | null;
  lances: LanceMes[];
  resultados: { modalidade: string | null; percentual: number | null; data: string | null }[];
};
export type RelatorioCota = {
  cota: { id: string; cliente: string | null; cpf: string | null; cnpj: string | null; email: string | null; grupo: string | null; cota: string | null; valor_credito: number; tipo_produto: string | null; data_contratacao: string | null; data_contemplacao: string | null; motivo_contemplacao: string | null };
  meses: MesRelatorio[];
};

export const TIPO_LANCE_LABEL: Record<string, string> = { embutido: 'Lance embutido', livre: 'Lance livre', fixo: 'Lance fixo' };
export const rotuloTipoLance = (t: string | null) => (t && TIPO_LANCE_LABEL[t]) || 'Tipo não informado';

/** Mês atual em São Paulo, formato YYYY-MM. */
export const mesAtualSP = (agora = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).format(agora).slice(0, 7);

/** Mantém só meses até o atual; futuros não entram no histórico. */
export const mesesHistoricos = (meses: MesRelatorio[], mesAtual: string) => meses.filter((m) => m.mes <= mesAtual);

export const mesSemRegistro = (m: MesRelatorio) => !m.loteria && m.lances.length === 0 && m.resultados.length === 0;

export const rotuloMes = (mes: string) => {
  const [a, m] = mes.split('-').map(Number);
  return new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};
