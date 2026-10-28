// Dias de calendário no fuso America/Sao_Paulo (não blocos de 24h).
// O banco (filtro "sem atividade há N dias") já conta dias de calendário em SP;
// o front usa a mesma regra aqui.

const FUSO = 'America/Sao_Paulo';
// en-CA em timeZone fixo devolve "yyyy-mm-dd".
const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const dataCalendario = (instante: Date): number => {
  const [y, m, d] = fmt.format(instante).split('-').map(Number);
  // Construído em UTC para subtrair dias inteiros sem interferência de fuso.
  return Date.UTC(y, m - 1, d);
};

/** Diferença em dias de calendário em America/Sao_Paulo (mínimo 0). */
export const diasCalendarioDesde = (iso: string | Date, agora: Date = new Date()): number => {
  const passado = typeof iso === 'string' ? new Date(iso) : iso;
  const tPassado = passado.getTime();
  const tAgora = agora.getTime();
  if (isNaN(tPassado)) return 0;
  if (tPassado > tAgora) return 0;
  return Math.max(0, Math.round((dataCalendario(agora) - dataCalendario(passado)) / 86_400_000));
};

/** Rótulo de último contato: 0 → hoje, 1 → ontem, N → "Nd sem contato". */
export const rotuloContato = (dias: number): string => {
  if (dias <= 0) return 'Contato hoje';
  if (dias === 1) return 'Contato ontem';
  return `${dias}d sem contato`;
};
