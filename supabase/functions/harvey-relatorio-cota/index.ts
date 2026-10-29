// Envio do Relatório da Cota (Consórcio) ao HARVEY. Só admin. Um registro por cota+mês.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';

const Body = z.object({ card_ids: z.array(z.string().uuid()).min(1).max(500), mes_referencia: z.string().regex(/^\d{4}-\d{2}$/) });
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

async function assinar(secret: string, body: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return json({ erro: 'nao_autenticado' }, 401);
  const { data: u } = await admin.auth.getUser(token);
  if (!u?.user) return json({ erro: 'nao_autenticado' }, 401);
  const { data: isAdmin } = await admin.rpc('has_role', { _user_id: u.user.id, _role: 'admin' });
  if (!isAdmin) return json({ erro: 'apenas_admin' }, 403);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ erro: parsed.error.flatten().fieldErrors }, 400);
  const destino = Deno.env.get('HARVEY_WEBHOOK_URL');
  const secret = Deno.env.get('HARVEY_WEBHOOK_SECRET');
  if (!destino || !secret) return json({ erro: 'harvey_nao_configurado' }, 412);

  const { mes_referencia } = parsed.data;
  const resultados: { card_id: string; status: string; erro?: string }[] = [];
  for (const card_id of parsed.data.card_ids) {
    const { data: rel, error } = await admin.rpc('consorcio_relatorio_cota', { p_card_id: card_id });
    if (error || !rel) { resultados.push({ card_id, status: 'erro', erro: error?.message ?? 'cota_nao_encontrada' }); continue; }
    const meses = (rel.meses ?? []).filter((m: { mes: string }) => m.mes <= mes_referencia);
    const payload = { tipo: 'consorcio.relatorio_cota.v1', mes_referencia, cota: rel.cota, meses };
    const body = JSON.stringify(payload);
    let status = 'erro', http: number | null = null, erro: string | null = null;
    try {
      const r = await fetch(destino, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-MCF-Signature': await assinar(secret, body) }, body });
      http = r.status;
      status = r.ok ? 'enviado' : 'erro';
      if (!r.ok) erro = (await r.text()).slice(0, 500);
    } catch (e) { erro = String(e).slice(0, 500); }
    await admin.from('consorcio_harvey_envios').upsert({ card_id, mes_referencia, status, http_status: http, erro, payload, enviado_por: u.user.id, updated_at: new Date().toISOString() }, { onConflict: 'card_id,mes_referencia' });
    resultados.push({ card_id, status, ...(erro ? { erro } : {}) });
  }
  return json({ resultados });
});
