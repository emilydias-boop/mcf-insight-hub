import { supabase } from '@/integrations/supabase/client';

// Cache compartilhado de get_first_transaction_ids (consulta pesada usada em várias telas).
// Mesmo resultado da RPC; apenas evita recalcular dentro de 5 minutos e junta chamadas simultâneas.
const TTL_MS = 5 * 60 * 1000;
type Result = { data: { id: string }[] | null; error: any };
let cache: { at: number; value: Result } | null = null;
let inflight: Promise<Result> | null = null;

export async function getFirstTransactionIdsCached(): Promise<Result> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  if (inflight) return inflight;
  inflight = (async () => {
    const { data, error } = await supabase.rpc('get_first_transaction_ids' as any);
    const value: Result = { data: (data as any) ?? null, error };
    if (!error) cache = { at: Date.now(), value };
    return value;
  })().finally(() => { inflight = null; });
  return inflight;
}
