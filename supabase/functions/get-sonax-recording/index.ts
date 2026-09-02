import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

const ALLOWED_HOST = 'gravacoes.sonax.cloud'
const SONAX_BASE = 'https://api.sonax.net.br/a2billing_v2/admin/Public/dbdial_webapi.php'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  // ---------------------------------------------------------------------------
  // Caminho 2 (POST): busca autenticada do áudio direto na API da Sonax por
  // id_chamada. O id é sequencial e adivinhável, então exige JWT válido — não
  // pode virar URL pública como o proxy de `?url=`.
  // ---------------------------------------------------------------------------
  if (req.method === 'POST') {
    try {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader?.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401)

      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } },
      )
      const jwt = authHeader.replace('Bearer ', '')
      const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(jwt)
      if (claimsError || !claimsData?.claims) return json({ error: 'unauthorized' }, 401)

      let body: { id_chamada?: unknown } = {}
      try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }

      const idChamada = String(body.id_chamada ?? '').trim()
      if (!/^\d{4,}$/.test(idChamada)) return json({ error: 'id_chamada inválido' }, 400)

      const url = new URL(SONAX_BASE)
      url.searchParams.set('acao', 'pega_gravacao')
      url.searchParams.set('id_cliente', Deno.env.get('SONAX_ID_CLIENTE') ?? '')
      url.searchParams.set('token', Deno.env.get('SONAX_TOKEN') ?? '')
      url.searchParams.set('id_chamada', idChamada)

      const upstream = await fetch(url.toString(), { method: 'GET' })
      const buf = await upstream.arrayBuffer()
      const bytes = new Uint8Array(buf)
      // A API responde "404 not found" em texto quando não há gravação; validamos
      // o cabeçalho RIFF do WAV para diferenciar áudio de mensagem de erro.
      const isRiff =
        bytes.length >= 4 &&
        bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46

      if (!upstream.ok || buf.byteLength < 64 || !isRiff) {
        const detail = new TextDecoder().decode(bytes.slice(0, 400)).slice(0, 200)
        return json({ error: 'gravacao_indisponivel', detail }, 404)
      }

      return new Response(buf, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'audio/wav',
          'Content-Length': String(buf.byteLength),
          'Cache-Control': 'private, max-age=3600',
        },
      })
    } catch (e) {
      console.error('get-sonax-recording (id_chamada) error:', e)
      return json({ error: 'Internal server error' }, 500)
    }
  }

  // ---------------------------------------------------------------------------
  // Caminho 1 (GET ?url=): proxy da URL pública da Sonax — inalterado.
  // ---------------------------------------------------------------------------


  try {
    const target = new URL(req.url).searchParams.get('url')
    if (!target) return json({ error: 'Missing url parameter' }, 400)

    let parsed: URL
    try {
      parsed = new URL(target)
    } catch {
      return json({ error: 'Invalid url parameter' }, 400)
    }
    if (parsed.protocol !== 'https:' || parsed.hostname !== ALLOWED_HOST) {
      return json({ error: 'Host not allowed' }, 400)
    }

    const upstream = await fetch(parsed.toString(), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MCFGestao/1.0)' },
    })

    if (!upstream.ok) {
      return json({ error: `Sonax respondeu ${upstream.status}` }, 502)
    }

    const audio = await upstream.arrayBuffer()
    if (audio.byteLength === 0) {
      return json({ error: 'Gravação indisponível (arquivo vazio na Sonax)' }, 404)
    }

    return new Response(audio, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(audio.byteLength),
        'Accept-Ranges': 'none',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (e) {
    console.error('get-sonax-recording error:', e)
    return json({ error: 'Internal server error' }, 500)
  }
})
