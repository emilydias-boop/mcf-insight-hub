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

    return json(data)
  } catch (e) {
    console.error('unexpected', e)
    return json({ error: 'Erro inesperado', details: String(e) }, 500)
  }
})
