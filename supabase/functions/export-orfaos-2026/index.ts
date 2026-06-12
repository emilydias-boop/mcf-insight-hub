import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

const toCsv = (rows: Record<string, unknown>[]) => {
  if (!rows || rows.length === 0) return ''
  const cols = Object.keys(rows[0])
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  const [a, o] = await Promise.all([
    supabase.rpc('orfaos_a010_2026'),
    supabase.rpc('orfaos_outside_2026'),
  ])
  if (a.error || o.error) {
    return new Response(JSON.stringify({ error: a.error?.message ?? o.error?.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
  return new Response(JSON.stringify({
    a010_csv: toCsv(a.data as any[]),
    outside_csv: toCsv(o.data as any[]),
    a010_count: (a.data as any[]).length,
    outside_count: (o.data as any[]).length,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})