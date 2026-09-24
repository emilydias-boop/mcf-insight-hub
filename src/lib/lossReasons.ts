import { supabase } from '@/integrations/supabase/client';

export const SEM_MOTIVO_FILTER_VALUE = '__sem_motivo__';

const normalize = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');

export function isSemInteresseStageName(name?: string | null): boolean {
  if (!name) return false;
  return normalize(name).includes('sem interesse');
}

export async function registrarMotivoSemInteresse(
  dealIds: string[],
  motivo: string,
  justificativa?: string | null,
): Promise<number> {
  const { data, error } = await (supabase as any).rpc('registrar_motivo_sem_interesse', {
    p_deal_ids: dealIds,
    p_motivo: motivo,
    p_justificativa: justificativa?.trim() ? justificativa.trim() : null,
  });
  if (error) throw new Error(error.message);
  return (data as number) ?? 0;
}

export function isMotivoObrigatorioError(err: any): boolean {
  if (!err) return false;
  if (err?.hint === 'MOTIVO_SEM_INTERESSE_OBRIGATORIO') return true;
  const msg = String(err?.message ?? '');
  return msg.includes('Informe o motivo');
}
