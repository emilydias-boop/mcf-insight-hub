/**
 * Equipe fixa da Agenda R1 do Consórcio.
 *
 * Regra de negócio (09/11/2026): na escolha de closer da Agenda R1 do Consórcio
 * só entram Cleiton Lima e Bruno de Souza Albuquerque; na escolha de SDR
 * Responsável só entram Ithaline Clara e Mylena Ribeiro.
 *
 * O filtro é só da lista de opções do agendamento: buscas de leads, nomes de
 * closer em reuniões já existentes, indicadores e a agenda R2 continuam
 * usando a lista completa.
 */

/** Closers de R1 permitidos no Consórcio (e-mail do cadastro em `closers`). */
export const CONSORCIO_CLOSER_R1_PERMITIDOS = [
  'cleiton.lima@minhacasafinanciada.com',
  'bruno.albuquerque@minhacasafinanciada.com',
] as const;

/** SDRs permitidos no Consórcio (e-mail do cadastro em `sdr`). */
export const CONSORCIO_SDR_PERMITIDOS = [
  'ithaline.clara@minhacasafinanciada.com',
  'mylena.ribeiro@minhacasafinanciada.com',
] as const;

const CONSORCIO = 'consorcio';

type ComEmail = { email?: string | null };

/**
 * Restringe a lista às pessoas permitidas quando a BU é o Consórcio.
 * Nas outras BUs a lista volta intacta.
 *
 * Se o filtro não casar com ninguém (e-mail mudou no cadastro, por exemplo),
 * a lista original volta em vez de deixar o usuário sem opção de agendar.
 */
export function filtrarEquipeConsorcio<T extends ComEmail>(
  bu: string | null | undefined,
  lista: readonly T[],
  permitidos: readonly string[],
): T[] {
  if (bu !== CONSORCIO || lista.length === 0) return [...lista];
  const liberados = new Set(permitidos.map((e) => e.toLowerCase()));
  const filtrada = lista.filter((item) => (item.email ?? '').toLowerCase().trim() !== '' &&
    liberados.has((item.email ?? '').toLowerCase().trim()));
  return filtrada.length > 0 ? filtrada : [...lista];
}

/** Closers de R1 disponíveis para agendar na BU ativa. */
export function filtrarClosersConsorcio<T extends ComEmail>(
  bu: string | null | undefined,
  closers: readonly T[],
): T[] {
  return filtrarEquipeConsorcio(bu, closers, CONSORCIO_CLOSER_R1_PERMITIDOS);
}

/** SDRs responsáveis disponíveis para atribuição na BU ativa. */
export function filtrarSdrsConsorcio<T extends ComEmail>(
  bu: string | null | undefined,
  sdrs: readonly T[],
): T[] {
  return filtrarEquipeConsorcio(bu, sdrs, CONSORCIO_SDR_PERMITIDOS);
}
