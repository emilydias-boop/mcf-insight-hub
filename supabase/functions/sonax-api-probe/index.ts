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
  const urls: Record<string, string> = {
    'dbdial_root_noparams': 'https://api.sonax.net.br/a2billing_v2/admin/Public/dbdial_webapi.php',
    'dbdial_dir': 'https://api.sonax.net.br/a2billing_v2/admin/Public/',
    'c2c_api_host_noparams': 'https://api.sonax.net.br/sonax-click2call.php',
    'c2c_official_host_noparams': 'https://click2call.sonax.net.br/sonax-click2call.php',
    'webapi_alt1': `https://api.sonax.net.br/a2billing/admin/Public/dbdial_webapi.php?action=lista_tabulacao&id_cliente=${idCliente}&token=${token}`,
    'webapi_alt2': `https://pabxcloud.sonax.net.br/a2billing_v2/admin/Public/dbdial_webapi.php?action=lista_tabulacao&id_cliente=${idCliente}&token=${token}`,
    'webapi_alt3': `https://api.sonax.net.br/dbdial_webapi.php?action=lista_tabulacao&id_cliente=${idCliente}&token=${token}`,
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
