export const WA_STATUS_OPTIONS = [
  { value: 'aberta', label: 'Aberta' },
  { value: 'aguardando_cliente', label: 'Aguardando cliente' },
  // Conversa que só recebeu automático (disparo, lembrete, automação): ninguém do time atendeu.
  { value: 'sem_contato', label: 'Sem contato' },
  { value: 'resolvida', label: 'Resolvida' },
] as const;

export const WA_STATUS_COLOR: Record<string, string> = {
  aberta: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  aguardando_cliente: 'bg-purple-500/15 text-purple-700 dark:text-purple-300',
  // Tom neutro e apagado: representa ausência de trabalho, não estado ativo.
  sem_contato: 'bg-muted text-muted-foreground',
  resolvida: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
};


const WINDOW_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MIN_MS = 60 * 1000;

export interface Wa24hWindow {
  open: boolean;
  /** horas cheias restantes (floor) */
  hoursLeft: number;
  /** minutos cheios restantes (floor) */
  minutesLeft: number;
  /** faltando menos de 5 minutos */
  critical: boolean;
  label: string;
  lastInboundAt: Date | null;
}

/**
 * Janela de 24h da Meta calculada a partir de last_inbound_at (fonte do backend).
 * `now` deve vir de um tick (useNow) para a UI reavaliar com o passar do tempo.
 */
export function get24hWindow(
  lastInboundAt: string | null | undefined,
  now: number = Date.now(),
): Wa24hWindow {
  if (!lastInboundAt) {
    return {
      open: false,
      hoursLeft: 0,
      minutesLeft: 0,
      critical: false,
      label: 'janela fechada',
      lastInboundAt: null,
    };
  }
  const last = new Date(lastInboundAt);
  const remaining = WINDOW_MS - (now - last.getTime());
  if (remaining <= 0) {
    return {
      open: false,
      hoursLeft: 0,
      minutesLeft: 0,
      critical: false,
      label: 'janela fechada',
      lastInboundAt: last,
    };
  }
  const hoursLeft = Math.floor(remaining / HOUR_MS);
  const minutesLeft = Math.floor(remaining / MIN_MS);
  const label =
    hoursLeft >= 1
      ? `janela ${hoursLeft}h`
      : minutesLeft >= 1
        ? `janela ${minutesLeft}min`
        : 'janela expirando';
  return {
    open: true,
    hoursLeft,
    minutesLeft,
    critical: remaining < 5 * MIN_MS,
    label,
    lastInboundAt: last,
  };
}

/** +5511987654321 → +55 (11) 98765-4321 (fallback: devolve como veio) */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith('55')) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 12 && digits.startsWith('55')) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  return phone;
}