import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

function normalizeNumero(raw: string): string | null {
  const digits = (raw || '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.length >= 10 && digits.length <= 11) return `55${digits}`
  if (digits.length === 12 || digits.length === 13) return digits.startsWith('55') ? digits : digits
  return digits.length >= 8 ? digits : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )

  const token = authHeader.replace('Bearer ', '')
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token)
  if (claimsError || !claimsData?.claims) return json({ error: 'unauthorized' }, 401)

  const email = String((claimsData.claims as Record<string, unknown>).email || '').toLowerCase()
  const userId = String((claimsData.claims as Record<string, unknown>).sub || '')
  if (!email) return json({ error: 'email_nao_encontrado' }, 401)

  let body: { numero?: string; deal_id?: string } = {}
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  const numero = normalizeNumero(String(body.numero ?? ''))
  if (!numero) return json({ error: 'numero_invalido' }, 400)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: mapping, error: mappingError } = await admin
    .from('sdr_ramal_mapping')
    .select('ramal, sdr_name')
    .eq('sdr_email', email)
    .eq('active', true)
    .maybeSingle()

  if (mappingError) return json({ error: 'erro_ao_buscar_ramal' }, 500)
  if (!mapping?.ramal) return json({ error: 'ramal_nao_configurado' }, 404)

  const sonaxToken = Deno.env.get('SONAX_TOKEN')
  if (!sonaxToken) return json({ error: 'sonax_token_ausente' }, 500)

  const url = `https://api.sonax.net.br/a2billing_v2/admin/Public/sonax-click2call.php?numero=${encodeURIComponent(numero)}&ramal=${encodeURIComponent(mapping.ramal)}&token=${encodeURIComponent(sonaxToken)}`

  let sonaxStatus = 0
  let sonaxBody = ''
  try {
    const resp = await fetch(url, { method: 'GET' })
    sonaxStatus = resp.status
    sonaxBody = (await resp.text()).slice(0, 500)
  } catch (e) {
    return json({ error: 'falha_sonax', detail: String(e) }, 502)
  }

  const ok = sonaxStatus >= 200 && sonaxStatus < 300

  if (body.deal_id) {
    await admin.from('deal_activities').insert({
      deal_id: body.deal_id,
      activity_type: 'click_to_call',
      description: `Click-to-call para ${numero} pelo ramal ${mapping.ramal}`,
      user_id: userId || null,
      metadata: { numero, ramal: mapping.ramal, sdr_email: email, sonax_status: sonaxStatus, ok },
    })
  }

  if (!ok) return json({ error: 'sonax_erro', status: sonaxStatus, detail: sonaxBody }, 502)

  return json({ success: true, ramal: mapping.ramal, numero })
})
