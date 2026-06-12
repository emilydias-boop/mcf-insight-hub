import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const toCsv = (rows: Record<string, unknown>[]) => {
    if (rows.length === 0) return ''
    const cols = Object.keys(rows[0])
    const esc = (v: unknown) => {
      const s = v === null || v === undefined ? '' : String(v)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    return [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n')
  }

  const { data: a010, error: e1 } = await supabase.rpc('exec_sql_json', { q: `
    WITH inside_emails AS (
      SELECT DISTINCT lower(c.email) AS email
      FROM crm_deals d JOIN crm_contacts c ON c.id=d.contact_id
      JOIN crm_origins o ON o.id=d.origin_id
      WHERE o.name ILIKE '%inside sales%' AND c.email IS NOT NULL
    ), a010 AS (
      SELECT lower(t.customer_email) AS email,
             min(t.customer_name) AS nome,
             min(t.customer_phone) AS telefone,
             min(t.offer_name) AS oferta,
             min(t.sale_date)::text AS primeira_compra
      FROM hubla_transactions t
      WHERE t.sale_date >= '2026-01-01' AND t.sale_date < '2027-01-01'
        AND coalesce(t.installment_number,1) = 1
        AND t.offer_name ILIKE 'PRINCIPAL - A010%'
        AND t.customer_email IS NOT NULL
      GROUP BY lower(t.customer_email)
    )
    SELECT a.email,a.nome,a.telefone,a.oferta,a.primeira_compra
    FROM a010 a LEFT JOIN inside_emails i ON i.email=a.email
    WHERE i.email IS NULL ORDER BY a.primeira_compra
  `})

  // Fallback: run via direct select if RPC doesn't exist
  let a010Rows: any[] = []
  let outsideRows: any[] = []

  // Build via two-step approach with .from() + filter is hard; use RPC we create
  if (e1) {
    return new Response(JSON.stringify({ error: e1.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
  a010Rows = a010 as any[]

  const { data: outside, error: e2 } = await supabase.rpc('exec_sql_json', { q: `
    WITH inside_emails AS (
      SELECT DISTINCT lower(c.email) AS email
      FROM crm_deals d JOIN crm_contacts c ON c.id=d.contact_id
      JOIN crm_origins o ON o.id=d.origin_id
      WHERE o.name ILIKE '%inside sales%' AND c.email IS NOT NULL
    ), outside AS (
      SELECT lower(t.customer_email) AS email,
             min(t.customer_name) AS nome,
             min(t.customer_phone) AS telefone,
             string_agg(DISTINCT t.offer_name, ' | ') AS ofertas,
             min(t.sale_date)::text AS primeira_compra
      FROM hubla_transactions t
      WHERE t.sale_date >= '2026-01-01' AND t.sale_date < '2027-01-01'
        AND t.offer_name IN ('Contrato - Curso R$ 97,00','Contrato Perfil A - Vitrine A010')
        AND t.customer_email IS NOT NULL
      GROUP BY lower(t.customer_email)
    )
    SELECT o.email,o.nome,o.telefone,o.ofertas,o.primeira_compra
    FROM outside o LEFT JOIN inside_emails i ON i.email=o.email
    WHERE i.email IS NULL ORDER BY o.primeira_compra
  `})
  if (e2) {
    return new Response(JSON.stringify({ error: e2.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
  outsideRows = outside as any[]

  return new Response(JSON.stringify({
    a010_csv: toCsv(a010Rows),
    outside_csv: toCsv(outsideRows),
    a010_count: a010Rows.length,
    outside_count: outsideRows.length,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})