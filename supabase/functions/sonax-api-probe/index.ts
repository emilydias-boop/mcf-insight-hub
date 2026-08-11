import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

// TEMPORÁRIO: sonda somente-leitura da API Sonax para descobrir se existe CDR consultável.
const BASE = 'https://api.sonax.net.br/a2billing_v2/admin/Public/dbdial_webapi.php'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.headers.get('x-probe') !== 'rehcfgqvigfcekiipqkc') {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders })
  }
  const idCliente = Deno.env.get('SONAX_ID_CLIENTE')!
  const token = Deno.env.get('SONAX_TOKEN')!
  const out: Record<string, unknown> = {}
  const D = 'https://api.sonax.net.br/a2billing_v2/admin/Public/'
  const q = `?action=lista_tabulacao&id_cliente=${idCliente}&token=${token}`
  const urls: Record<string, string> = {
    'dir_root': D,
    'dir_root_query': D + q,
    'index.php': D + 'index.php' + q,
    'api.php': D + 'api.php' + q,
    'webapi.php': D + 'webapi.php' + q,
    'dbdial.php': D + 'dbdial.php' + q,
    'dialer_webapi.php': D + 'dialer_webapi.php' + q,
    'vingadora.php': D + 'vingadora.php' + q,
    'vingadora_webapi.php': D + 'vingadora_webapi.php' + q,
    'dir_relatorio': D + '?action=relatorio_chamadas&id_cliente=' + idCliente + '&token=' + token + '&data_inicio=2026-08-10&data_fim=2026-08-11',
    'dir_cdr': D + '?action=cdr&id_cliente=' + idCliente + '&token=' + token,
    'dir_help': D + '?action=help&id_cliente=' + idCliente + '&token=' + token,
  }
  for (const [k, u] of Object.entries(urls)) {
    try {
      const r = await fetch(u, { method: 'GET', signal: AbortSignal.timeout(7000) })
      const t = (await r.text()).replaceAll(token, 'REDACTED')
      out[k] = { status: r.status, body: t.replace(/\s+/g, ' ').slice(0, 300) }
    } catch (e) { out[k] = { error: String(e) } }
  }
  return new Response(JSON.stringify(out, null, 2), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
