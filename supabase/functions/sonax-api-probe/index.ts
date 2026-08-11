import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

// TEMPORÁRIO: sonda somente-leitura da API Sonax para descobrir se existe CDR consultável.
const BASE = 'https://api.sonax.net.br/a2billing_v2/admin/Public/dbdial_webapi.php'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const auth = req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders })
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)
  const { data: c } = await sb.auth.getClaims(auth.replace('Bearer ', ''))
  if (!c?.claims) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders })

  const idCliente = Deno.env.get('SONAX_ID_CLIENTE')!
  const token = Deno.env.get('SONAX_TOKEN')!
  const actions = [
    'lista_tabulacao', 'relatorio_chamadas', 'relatorio', 'detalhe_chamadas', 'detalhes_chamadas',
    'cdr', 'historico_chamadas', 'lista_chamadas', 'status_chamadas', 'consulta_chamada',
    'chamadas_realizadas', 'lista_ramais', 'status_ramais', 'lista_campanhas', 'lista_pausa',
    'relatorio_analitico', 'chamadas_ramal', 'detalhe_chamada',
  ]
  const out: Record<string, unknown> = {}
  for (const a of actions) {
    const u = new URL(BASE)
    u.searchParams.set('action', a)
    u.searchParams.set('id_cliente', idCliente)
    u.searchParams.set('token', token)
    u.searchParams.set('data_inicio', '2026-08-10')
    u.searchParams.set('data_fim', '2026-08-11')
    try {
      const r = await fetch(u.toString(), { method: 'GET' })
      const t = (await r.text()).replaceAll(token, 'REDACTED')
      out[a] = { status: r.status, body: t.slice(0, 400) }
    } catch (e) {
      out[a] = { error: String(e) }
    }
  }
  return new Response(JSON.stringify(out, null, 2), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
