const SUPABASE_URL = 'https://rehcfgqvigfcekiipqkc.supabase.co';

export const OUTCOME_LABELS: Record<string, { label: string; color: string }> = {
  sem_contato: { label: 'Sem contato', color: 'bg-gray-100 text-gray-700' },
  ocupado: { label: 'Ocupado', color: 'bg-yellow-100 text-yellow-700' },
  caixa_postal: { label: 'Caixa postal', color: 'bg-gray-100 text-gray-700' },
  numero_errado: { label: 'Número errado', color: 'bg-red-100 text-red-700' },
  interessado: { label: 'Interessado', color: 'bg-green-100 text-green-700' },
  nao_interessado: { label: 'Não interessado', color: 'bg-red-100 text-red-700' },
  agendou_r1: { label: 'Agendou R1', color: 'bg-blue-100 text-blue-700' },
  agendou_r2: { label: 'Agendou R2', color: 'bg-blue-100 text-blue-700' },
  follow_up: { label: 'Follow-up', color: 'bg-orange-100 text-orange-700' },
  outro: { label: 'Outro', color: 'bg-gray-100 text-gray-700' },
};

export const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  initiated: { label: 'Iniciada', color: 'bg-gray-100 text-gray-700' },
  ringing: { label: 'Chamando', color: 'bg-yellow-100 text-yellow-700' },
  'in-progress': { label: 'Em andamento', color: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Completada', color: 'bg-green-100 text-green-700' },
  failed: { label: 'Falhou', color: 'bg-red-100 text-red-700' },
  busy: { label: 'Ocupado', color: 'bg-yellow-100 text-yellow-700' },
  'no-answer': { label: 'Não atendeu', color: 'bg-orange-100 text-orange-700' },
  canceled: { label: 'Cancelada', color: 'bg-gray-100 text-gray-700' },
};

export function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '0s';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

// Calculate duration from timestamps if duration_seconds is 0
export function getCallDuration(call: { duration_seconds: number | null; started_at: string | null; ended_at: string | null }): number {
  if (call.duration_seconds && call.duration_seconds > 0) {
    return call.duration_seconds;
  }
  if (call.started_at && call.ended_at) {
    return Math.floor((new Date(call.ended_at).getTime() - new Date(call.started_at).getTime()) / 1000);
  }
  return 0;
}

// Get proxy URL for recording playback
export function getRecordingProxyUrl(recordingUrl: string): string {
  // Extract RecordingSid from URL like: https://api.twilio.com/.../Recordings/RE123.mp3
  const match = recordingUrl.match(/Recordings\/([^.\/]+)/);
  if (match && match[1]) {
    return `${SUPABASE_URL}/functions/v1/get-recording?recordingSid=${match[1]}`;
  }
  return recordingUrl;
}

