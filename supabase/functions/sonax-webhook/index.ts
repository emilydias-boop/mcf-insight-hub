import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const FIELDS = [
  'ID_CHAMADA', 'ID_CHAMADA_ORIGINADOR', 'RAMAL', 'ALIASRAMAL', 'NUMERO',
  'NUMERO_REC', 'DATA_INICIO', 'DATA_FIM', 'STATUS_CHAMADA',
  'STATUS_ATENDIMENTO', 'DURACAO_CHAMADA', 'URL_GRAVACAO',
] as const

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const pick = (raw: Record<string, unknown>, key: string): string | null => {
  const hit = Object.keys(raw).find((k) => k.toUpperCase() === key)
  const v = hit ? raw[hit] : null
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

const digits = (v: string | null) => (v ? v.replace(/\D/g, '') : '')

function formatDuration(raw: string | null): string | null {
  if (!raw) return null
  if (raw.includes(':')) return raw
  const total = Number(digits(raw))
  if (!Number.isFinite(total) || total <= 0) return null
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const url = new URL(req.url)

  // raw payload: query string + (optional) POST body
  const raw: Record<string, unknown> = {}
  for (const [k, v] of url.searchParams.entries()) raw[k] = v
  if (req.method === 'POST') {
    try {
      const ct = req.headers.get('content-type') || ''
      if (ct.includes('application/json')) {
        const body = await req.json()
        if (body && typeof body === 'object') Object.assign(raw, body)
      } else {
        const form = await req.formData()
        for (const [k, v] of form.entries()) raw[k] = typeof v === 'string' ? v : String(v)
      }
    } catch (_) { /* body opcional */ }
  }

  // evento: ?evento=atendimento|desligamento (ou path suffix), default por STATUS_ATENDIMENTO
  const eventoParam = (url.searchParams.get('evento') || url.pathname.split('/').pop() || '').toLowerCase()
  const statusAtend = (pick(raw, 'STATUS_ATENDIMENTO') || '').toUpperCase()
  const evento = eventoParam.includes('atendimento') && !eventoParam.includes('desligamento')
    ? 'atendimento'
    : eventoParam.includes('desligamento')
      ? 'desligamento'
      : (pick(raw, 'DATA_FIM') || statusAtend === 'N' ? 'desligamento' : 'atendimento')

  const f: Record<string, string | null> = {}
  for (const key of FIELDS) f[key] = pick(raw, key)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  let sdr_email: string | null = null
  let sdr_name: string | null = null
  let contact_id: string | null = null
  let deal_id: string | null = null
  let deal_activity_id: string | null = null
  let match_error: string | null = null

  try {
    // Match do SDR: o Sonax pode enviar RAMAL completo (ex: 10700011149) e
    // ALIASRAMAL curto (ex: 107). sdr_ramal_mapping guarda o código curto,
    // então tentamos: ramal completo -> alias -> prefixo/sufixo numérico do ramal.
    const ramal = digits(f.RAMAL)
    const alias = digits(f.ALIASRAMAL)

    const candidates: string[] = []
    const push = (v: string) => {
      if (v && v.length >= 2 && !candidates.includes(v)) candidates.push(v)
    }

    push(ramal)
    push(alias)
    for (const len of [3, 4, 5]) {
      if (ramal.length > len) {
        push(ramal.slice(0, len))   // prefixo (10700011149 -> 107)
        push(ramal.slice(-len))     // sufixo  (…11149 -> 1149)
      }
    }

    if (candidates.length) {
      const { data: mappings } = await supabase
        .from('sdr_ramal_mapping')
        .select('sdr_email, sdr_name, ramal')
        .in('ramal', candidates)

      // respeita a ordem de prioridade dos candidatos
      for (const cand of candidates) {
        const hit = (mappings || []).find((m) => digits(String(m.ramal)) === cand)
        if (hit) {
          sdr_email = hit.sdr_email
          sdr_name = hit.sdr_name
          break
        }
      }
    }

    // número do cliente: NUMERO_REC preferencial, fallback NUMERO
    const clientPhone = digits(f.NUMERO_REC).length >= 9 ? f.NUMERO_REC : f.NUMERO
    if (digits(clientPhone).length >= 9) {
      const { data: match, error } = await supabase
        .rpc('sonax_match_lead_by_phone', { p_phone: clientPhone })
      if (error) throw error
      const row = Array.isArray(match) ? match[0] : match
      if (row) {
        contact_id = row.contact_id ?? null
        deal_id = row.deal_id ?? null
      }
    }
  } catch (e) {
    match_error = e instanceof Error ? e.message : String(e)
    console.error('sonax-webhook match error:', match_error)
  }

  const durationLabel = formatDuration(f.DURACAO_CHAMADA)
  const ramalLabel = f.RAMAL ? `ramal ${f.RAMAL}` : 'ramal desconhecido'
  const notAnswered = statusAtend === 'N'
  const description = evento === 'atendimento'
    ? `Ligação Sonax atendida — ${ramalLabel}${durationLabel ? `, ${durationLabel}` : ''}`
    : `Ligação Sonax finalizada — ${ramalLabel}, ${notAnswered ? 'não atendida' : durationLabel ? durationLabel : 'duração não informada'}`

  const metadata = {
    source: 'sonax',
    evento,
    ...f,
    sdr_email,
    sdr_name,
    contact_id,
    deal_id,
    received_at: new Date().toISOString(),
    raw_payload: raw,
  }

  const activity_type = evento === 'atendimento'
    ? 'ligacao_sonax_atendimento'
    : 'ligacao_sonax_desligamento'

  try {
    if (deal_id) {
      const { data: activity, error } = await supabase
        .from('deal_activities')
        .insert({ deal_id, activity_type, description, user_id: null, metadata })
        .select('id')
        .single()
      if (error) throw error
      deal_activity_id = activity?.id ?? null
    }
  } catch (e) {
    match_error = [match_error, e instanceof Error ? e.message : String(e)].filter(Boolean).join(' | ')
    console.error('sonax-webhook activity insert error:', match_error)
  }

  // nunca descartar o evento
  try {
    const { error } = await supabase.from('sonax_call_events').insert({
      evento,
      id_chamada: f.ID_CHAMADA,
      id_chamada_originador: f.ID_CHAMADA_ORIGINADOR,
      ramal: f.RAMAL,
      aliasramal: f.ALIASRAMAL,
      numero: f.NUMERO,
      numero_rec: f.NUMERO_REC,
      data_inicio: f.DATA_INICIO,
      data_fim: f.DATA_FIM,
      status_chamada: f.STATUS_CHAMADA,
      status_atendimento: f.STATUS_ATENDIMENTO,
      duracao_chamada: f.DURACAO_CHAMADA,
      url_gravacao: f.URL_GRAVACAO,
      sdr_email,
      sdr_name,
      contact_id,
      deal_id,
      deal_activity_id,
      match_error,
      raw_payload: metadata,
    })
    if (error) console.error('sonax-webhook log insert error:', error.message)
  } catch (e) {
    console.error('sonax-webhook log insert exception:', e)
  }

  // sempre 200 para o Sonax não re-tentar
  return json({ ok: true, evento, matched: { sdr_email, contact_id, deal_id }, deal_activity_id })
})
