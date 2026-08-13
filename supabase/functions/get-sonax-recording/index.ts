import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const ALLOWED_HOST = 'gravacoes.sonax.cloud'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

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
