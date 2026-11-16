// Envia ao HARVEY (webhook exclusivo de gerentes) o gerente de relacionamento do cliente Pós-venda.
// Gerente = dono do cartão Pós-venda, se estiver em pos_venda_gerente_contato. Chamado pelo trigger em crm_deals.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';

const ORIGIN_POS_VENDA = 'b05a0000-0000-4000-8000-000000000002';
const Body = z.object({ deal_id: z.string().uuid() });
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

async function assinar(secret: string, body: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ erro: 'metodo' }, 405);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ erro: 'deal_id_invalido' }, 400);
  const { deal_id } = parsed.data;
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: deal } = await sb.from('crm_deals').select('id, origin_id, owner_profile_id, contact_id, cpf').eq('id', deal_id).maybeSingle();
  if (!deal || deal.origin_id !== ORIGIN_POS_VENDA || !deal.owner_profile_id) return json({ ignorado: 'fora_do_escopo' });
  const { data: contato } = await sb.from('pos_venda_gerente_contato').select('telefone').eq('profile_id', deal.owner_profile_id).maybeSingle();
  if (!contato) return json({ ignorado: 'dono_nao_e_gerente' });

  // Não reenviar se o último envio com sucesso já foi para este gerente.
  const { data: ult } = await sb.from('pos_venda_harvey_gerente_envios').select('gerente_id, status')
    .eq('deal_id', deal_id).eq('status', 'enviado').order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (ult?.gerente_id === deal.owner_profile_id) return json({ ignorado: 'ja_enviado' });

  const [{ data: g }, { data: c }] = await Promise.all([
    sb.from('profiles').select('full_name').eq('id', deal.owner_profile_id).maybeSingle(),
    deal.contact_id ? sb.from('crm_contacts').select('name, email, phone').eq('id', deal.contact_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const payload = {
    tipo: 'pos_venda.gerente_relacionamento.v1',
    enviado_em: new Date().toISOString(),
    cliente: { cpf: deal.cpf ?? null, email: c?.email ?? null, telefone: c?.phone ?? null, nome: c?.name ?? null },
    gerente: { nome: g?.full_name ?? null, telefone: contato.telefone },
  };

  const destino = Deno.env.get('HARVEY_GERENTE_WEBHOOK_URL');
  const secret = Deno.env.get('HARVEY_GERENTE_WEBHOOK_SECRET');
  let status = 'erro', http: number | null = null, erro: string | null = null;
  if (!destino || !secret) erro = 'harvey_gerente_nao_configurado';
  else {
    const body = JSON.stringify(payload);
    try {
      const r = await fetch(destino, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-MCF-Signature': await assinar(secret, body) }, body, signal: AbortSignal.timeout(10000) });
      http = r.status; status = r.ok ? 'enviado' : 'erro';
      if (!r.ok) erro = (await r.text()).slice(0, 500);
    } catch (e) { erro = String(e).slice(0, 500); }
  }
  await sb.from('pos_venda_harvey_gerente_envios').insert({ deal_id, gerente_id: deal.owner_profile_id, status, http_status: http, erro, payload });
  return json({ status, ...(erro ? { erro } : {}) });
});
