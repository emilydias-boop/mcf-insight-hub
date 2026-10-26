// Regras puras do rodapé "Registrar contato". Todas as datas em America/Sao_Paulo (UTC-03:00, sem horário de verão).
export type ResultadoContato = 'atendeu' | 'nao_atendeu' | 'caixa_postal' | 'primeira_mensagem' | 'respondeu_whatsapp' | 'numero_errado';
export type ProximaTipo = 'ligar' | 'whatsapp' | 'email' | 'reuniao';

export const RESULTADOS: { value: ResultadoContato; label: string }[] = [
  { value: 'atendeu', label: 'Atendeu' },
  { value: 'nao_atendeu', label: 'Não atendeu' },
  { value: 'caixa_postal', label: 'Caixa postal' },
  { value: 'primeira_mensagem', label: 'Primeira mensagem enviada' },
  { value: 'respondeu_whatsapp', label: 'Respondeu no WhatsApp' },
  { value: 'numero_errado', label: 'Número errado' },
];

export const TIPO_LABEL: Record<string, string> = { ligar: 'Ligar', whatsapp: 'WhatsApp', email: 'E-mail', reuniao: 'Reunião' };

const TZ = 'America/Sao_Paulo';
const OFFSET = '-03:00';
const DIAS_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DIAS_LONGO = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/** Data (yyyy-MM-dd) e hora (HH:mm) de um instante em São Paulo. */
export function spParts(date: Date): { ymd: string; hm: string; minutes: number } {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map(x => [x.type, x.value]));
  const hm = `${p.hour}:${p.minute}`;
  return { ymd: `${p.year}-${p.month}-${p.day}`, hm, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

export const spIso = (ymd: string, hm: string) => `${ymd}T${hm}:00${OFFSET}`;

export function addDaysYmd(ymd: string, n: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const weekdayYmd = (ymd: string) => new Date(`${ymd}T12:00:00Z`).getUTCDay();

export interface Preset { key: 'hoje' | 'amanha' | '3dias'; label: string; iso: string }

export function presets(now: Date): Preset[] {
  const { ymd, minutes } = spParts(now);
  let hoje: Preset;
  if (minutes < 16 * 60 + 45) {
    hoje = { key: 'hoje', label: 'Hoje 17h', iso: spIso(ymd, '17:00') };
  } else {
    const t = Math.ceil((now.getTime() + 3_600_000) / 900_000) * 900_000;
    const p = spParts(new Date(t));
    hoje = { key: 'hoje', label: 'Hoje +1h', iso: spIso(p.ymd, p.hm) };
  }
  let tres = addDaysYmd(ymd, 3);
  const wd = weekdayYmd(tres);
  if (wd === 6) tres = addDaysYmd(tres, 2);
  if (wd === 0) tres = addDaysYmd(tres, 1);
  return [
    hoje,
    { key: 'amanha', label: 'Amanhã 10h', iso: spIso(addDaysYmd(ymd, 1), '10:00') },
    { key: '3dias', label: 'Em 3 dias', iso: spIso(tres, '10:00') },
  ];
}

const dm = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;

/** "Qui 29/10 · 14:30" */
export function rotuloCurto(iso: string): string {
  const { ymd, hm } = spParts(new Date(iso));
  return `${DIAS_CURTO[weekdayYmd(ymd)]} ${dm(ymd)} · ${hm}`;
}

/** "quinta, 29/10 às 14:30" */
export function rotuloLongo(iso: string): string {
  const { ymd, hm } = spParts(new Date(iso));
  return `${DIAS_LONGO[weekdayYmd(ymd)]}, ${dm(ymd)} às ${hm}`;
}

/** "qui 29/10 às 14:30" */
export function rotuloToast(iso: string): string {
  const { ymd, hm } = spParts(new Date(iso));
  return `${DIAS_CURTO[weekdayYmd(ymd)].toLowerCase()} ${dm(ymd)} às ${hm}`;
}

export const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const podeRegistrar = (resultado: ResultadoContato | null, proximaEm: string | null) => !!resultado || !!proximaEm;
