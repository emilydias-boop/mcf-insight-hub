import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const FINANCEHUB_URL = 'https://ruupfbtqmgsynurdoomu.supabase.co/functions/v1/caucoes-asaas'
const FINANCEHUB_KEY = 'ddd237fa2361278e1afb8cc2c97e5d1ceaa66fdcbc51b9afe0edf00e0842a359'
const ACCESS_KEY = '5848e12358ae711ffa06da57cf63eabe6bab75f229f47d9d'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)
const ymd = (d: Date) => d.toISOString().slice(0, 10)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const url = new URL(req.url)
  const key = url.searchParams.get('key') ?? ''
  const isCron = req.headers.get('x-cron-secret') === ACCESS_KEY
  if (key !== ACCESS_KEY && !isCron) return json({ error: 'Unauthorized' }, 401)

  // Janela: default = últimos 10 dias
  let from = url.searchParams.get('from') ?? ''
  let to = url.searchParams.get('to') ?? ''
  if (!from || !to) {
    const today = new Date()
    to = ymd(today)
    from = ymd(new Date(today.getTime() - 9 * 86400000))
  }
  if (!isDate(from) || !isDate(to)) return json({ error: 'Informe "from" e "to" no formato YYYY-MM-DD.' }, 400)
  const fMs = Date.parse(`${from}T00:00:00Z`)
  const tMs = Date.parse(`${to}T00:00:00Z`)
  if (Number.isNaN(fMs) || Number.isNaN(tMs) || tMs < fMs) return json({ error: 'Intervalo inválido.' }, 400)
  if (Math.round((tMs - fMs) / 86400000) > 30) return json({ error: 'Intervalo máximo de 31 dias por chamada.' }, 400)

  try {
    const res = await fetch(`${FINANCEHUB_URL}?key=${FINANCEHUB_KEY}&from=${from}&to=${to}`)
    if (!res.ok) {
      const txt = await res.text()
      return json({ error: 'Falha ao consultar FinanceHub', status: res.status, details: txt.slice(0, 500) }, 502)
    }
    const payload = await res.json()
    const cobrancas = Array.isArray(payload?.cobrancas) ? payload.cobrancas : []

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    )

    const { data, error } = await supabase.rpc('asaas_caucao_recon', { p_cobrancas: cobrancas })
    if (error) {
      console.error('rpc asaas_caucao_recon error', error)
      return json({ error: 'Falha na reconciliação', details: error.message }, 500)
    }

    return json({
      periodo: { from, to },
      total_cobrancas: payload?.total_cobrancas ?? cobrancas.length,
      total_valor: payload?.total_valor ?? null,
      ...(data as Record<string, unknown>),
    })
  } catch (e) {
    console.error('unexpected', e)
    return json({ error: 'Erro inesperado', details: String(e) }, 500)
  }
})
