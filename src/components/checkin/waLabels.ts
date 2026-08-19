export const WA_STATUS_OPTIONS = [
  { value: 'aberta', label: 'Aberta' },
  { value: 'aguardando_cliente', label: 'Aguardando cliente' },
  { value: 'resolvida', label: 'Resolvida' },
] as const;

export const WA_STATUS_COLOR: Record<string, string> = {
  aberta: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  aguardando_cliente: 'bg-purple-500/15 text-purple-700 dark:text-purple-300',
  resolvida: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
};

const WINDOW_MS = 24 * 60 * 60 * 1000;

/** Janela de 24h da Meta calculada a partir de last_inbound_at (fonte do backend). */
export function get24hWindow(lastInboundAt: string | null | undefined) {
  if (!lastInboundAt) return { open: false, hoursLeft: 0, lastInboundAt: null as Date | null };
  const last = new Date(lastInboundAt);
  const elapsed = Date.now() - last.getTime();
  const remaining = WINDOW_MS - elapsed;
  return {
    open: remaining > 0,
    hoursLeft: remaining > 0 ? Math.max(1, Math.ceil(remaining / (60 * 60 * 1000))) : 0,
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