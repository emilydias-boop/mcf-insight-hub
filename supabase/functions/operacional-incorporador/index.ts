import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const ACCESS_KEY = '5848e12358ae711ffa06da57cf63eabe6bab75f229f47d9d'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)

  const url = new URL(req.url)
  const key = url.searchParams.get('key') ?? ''
  if (key !== ACCESS_KEY) return json({ error: 'Unauthorized' }, 401)

  const agg = url.searchParams.get('agg')
  if (agg !== null) {
    if (agg === 'semana_resultado') {
      const inicio = url.searchParams.get('inicio') ?? ''
      if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio)) {
        return json({ error: 'Informe "inicio" no formato YYYY-MM-DD (quarta-feira).' }, 400)
      }
      const ms = Date.parse(`${inicio}T12:00:00Z`)
      if (Number.isNaN(ms)) return json({ error: 'Data "inicio" inválida.' }, 400)
      if (new Date(ms).getUTCDay() !== 3) {
        return json({ error: 'A data "inicio" deve ser uma quarta-feira.' }, 400)
      }
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
          { auth: { persistSession: false } },
        )
        const { data, error } = await supabase.rpc('operacional_incorporador_semana_resultado', { p_inicio: inicio })
        if (error) {
          console.error('rpc semana_resultado error', error)
          return json({ error: 'Falha ao gerar semana de resultado', details: error.message }, 500)
        }
        return json(data)
      } catch (e) {
        console.error('unexpected semana_resultado', e)
        return json({ error: 'Erro inesperado', details: String(e) }, 500)
      }
    }
    if (agg !== 'daily') return json({ error: 'Parâmetro "agg" inválido: use agg=daily ou agg=semana_resultado.' }, 400)
    const from = url.searchParams.get('from') ?? ''
    const to = url.searchParams.get('to') ?? ''
    const re = /^\d{4}-\d{2}-\d{2}$/
    if (!re.test(from) || !re.test(to)) {
      return json({ error: 'Informe "from" e "to" no formato YYYY-MM-DD.' }, 400)
    }
    const fromMs = Date.parse(`${from}T00:00:00Z`)
    const toMs = Date.parse(`${to}T00:00:00Z`)
    if (Number.isNaN(fromMs) || Number.isNaN(toMs) || toMs < fromMs) {
      return json({ error: 'Intervalo inválido: "to" deve ser maior ou igual a "from".' }, 400)
    }
    const diffDays = Math.round((toMs - fromMs) / 86400000)
    if (diffDays > 44) {
      return json({ error: 'Intervalo máximo de 45 dias por chamada.' }, 400)
    }
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        { auth: { persistSession: false } },
      )
      const { data, error } = await supabase.rpc('operacional_incorporador_daily', { p_from: from, p_to: to })
      if (error) {
        console.error('rpc daily error', error)
        return json({ error: 'Falha ao gerar agregado diário', details: error.message }, 500)
      }
      return json(data)
    } catch (e) {
      console.error('unexpected daily', e)
      return json({ error: 'Erro inesperado', details: String(e) }, 500)
    }
  }

  const daysRaw = url.searchParams.get('days')
  let days = 60
  if (daysRaw !== null) {
    const parsed = Number(daysRaw)
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 365) {
      return json({ error: 'Parâmetro "days" inválido: informe um inteiro entre 1 e 365.' }, 400)
    }
    days = parsed
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    )

    const { data, error } = await supabase.rpc('operacional_incorporador', { p_days: days })
    if (error) {
      console.error('rpc error', error)
      return json({ error: 'Falha ao gerar relatório', details: error.message }, 500)
    }

    // Reordenar as chaves do objeto raiz para que `resumo_do_dia` venha primeiro,
    // seguido das demais (bu, leads). JSON.stringify respeita a ordem de inserção.
    const payload =
      data && typeof data === 'object' && !Array.isArray(data)
        ? { resumo_do_dia: (data as Record<string, unknown>).resumo_do_dia, ...(data as Record<string, unknown>) }
        : data

    return json(payload)
  } catch (e) {
    console.error('unexpected', e)
    return json({ error: 'Erro inesperado', details: String(e) }, 500)
  }
})
