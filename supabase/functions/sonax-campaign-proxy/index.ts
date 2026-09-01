import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const SONAX_BASE = 'https://api.sonax.net.br/a2billing_v2/admin/Public/dbdial_webapi.php'
// Fallback legado: fila do incorporador. Usado apenas quando a campanha é criada
// sem informar a BU (chamadores antigos). Quando a BU vem no payload, o id_fila
// é resolvido dinamicamente em sonax_bu_filas.
const ID_FILA_FALLBACK = '992972'

// Pausas já cadastradas no painel Sonax
const PAUSAS = ['134769', '134759', '134619']

// Padrão de campanha (doc oficial Sonax). Ajuste aqui, não no meio da função.
const CAMPANHA_PADRAO: Record<string, string> = {
  descarte_caixa_postal: 'S',
  qtd_simultanea: '1',
  auto_concluir: 'N',
  dia_semana_ini: '1',
  dia_semana_fim: '6',
  hora_ini: '08:00:00',
  hora_fim: '20:00:00',
  tentativas: '3',
}


// Tradução dos nomes internos para os nomes reais da API Sonax.
// Mantemos os nomes internos (usados pelo front e pelo ALLOWED_ACTIONS) intactos.
const ACAO_SONAX: Record<string, string> = { criar_campanha: 'cria_campanha' }

const ALLOWED_ACTIONS = new Set([
  'criar_campanha',
  'chamada',
  'play_campanha',
  'stop_campanha',
  'status_chamadas_na_fila',
  'status_chamadas_andamento',
  'lista_tabulacao',
  'lista_campanha',
  'diagnostico',

])

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

function normalizeNumero(raw: string): string | null {
  const digits = (raw || '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.length >= 10 && digits.length <= 11) return `55${digits}`
  if (digits.length === 12 || digits.length === 13) return digits
  return digits.length >= 8 ? digits : null
}

function norm(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim()
}

// A API Sonax responde texto: registros separados por <br> e campos por "|".
function parsePipe(data: unknown): string[][] {
  if (typeof data !== 'string') return []
  return data
    .split(/<br\s*\/?>/i)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split('|').map((c) => c.trim()))
}


async function callSonax(action: string, params: Record<string, string | string[]>) {
  const idCliente = Deno.env.get('SONAX_ID_CLIENTE')
  const token = Deno.env.get('SONAX_TOKEN')
  if (!idCliente || !token) throw new Error('sonax_credenciais_ausentes')

  const url = new URL(SONAX_BASE)
  url.searchParams.set('acao', ACAO_SONAX[action] ?? action)
  url.searchParams.set('id_cliente', idCliente)
  url.searchParams.set('token', token)
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) {
      for (const item of v) url.searchParams.append(`${k}[]`, item)
    } else if (v !== undefined && v !== null && v !== '') {
      url.searchParams.set(k, v)
    }
  }

  const resp = await fetch(url.toString(), { method: 'GET' })
  const text = await resp.text()
  let parsed: unknown = null
  try { parsed = JSON.parse(text) } catch { parsed = text }
  return { ok: resp.status >= 200 && resp.status < 300, status: resp.status, data: parsed }
}

function extractTabulacoes(data: unknown): Array<{ id: string; nome: string; grupo: string }> {
  const out: Array<{ id: string; nome: string; grupo: string }> = []
  const walk = (node: unknown) => {
    if (Array.isArray(node)) { node.forEach(walk); return }
    if (node && typeof node === 'object') {
      const o = node as Record<string, unknown>
      const id = o.id ?? o.id_tabulacao ?? o.idTabulacao
      const nome = o.nome ?? o.descricao ?? o.tabulacao ?? o.name
      if (id != null && nome != null) {
        out.push({
          id: String(id),
          nome: String(nome),
          grupo: String(o.grupo ?? o.nome_grupo ?? o.grupo_tabulacao ?? ''),
        })
      }
      Object.values(o).forEach(walk)
    }
  }
  walk(data)
  // dedup por id
  const seen = new Set<string>()
  return out.filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)))
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
  const jwt = authHeader.replace('Bearer ', '')
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(jwt)
  if (claimsError || !claimsData?.claims) return json({ error: 'unauthorized' }, 401)

  const claims = claimsData.claims as Record<string, unknown>
  const userId = String(claims.sub || '')
  const email = String(claims.email || '').toLowerCase()

  let body: { action?: string; payload?: Record<string, unknown> } = {}
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }

  const action = String(body.action ?? '')
  const payload = (body.payload ?? {}) as Record<string, unknown>
  if (!ALLOWED_ACTIONS.has(action)) return json({ error: 'action_nao_permitida' }, 400)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    if (action === 'diagnostico') {
      const { data: roles, error: rolesError } = await admin
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
      if (rolesError) return json({ error: 'erro_consulta_roles', detail: rolesError.message }, 500)
      const isAdmin = (roles ?? []).some((r) => String((r as { role: unknown }).role) === 'admin')
      if (!isAdmin) return json({ error: 'forbidden' }, 403)

      const filas = await callSonax('lista_filas', {})
      const pausas = await callSonax('lista_pausas', {})
      const tabulacoes = await callSonax('lista_tabulacao', {})
      const campanhas = await callSonax('lista_campanha', { id_campanha: 'todas' })

      return json({
        filas: { status: filas.status, raw: filas.data },
        pausas: { status: pausas.status, raw: pausas.data },
        tabulacoes: { status: tabulacoes.status, raw: tabulacoes.data },
        campanhas: { status: campanhas.status, raw: campanhas.data },
      })

    }

    if (action === 'lista_tabulacao') {
      const r = await callSonax('lista_tabulacao', {})
      if (!r.ok) return json({ error: 'sonax_erro', status: r.status, detail: r.data }, 502)
      const linhas = parsePipe(r.data)
      const tabulacoes = linhas.length
        ? linhas.map(([id, nome, tipo]) => ({ id, nome, grupo: '', tipo: tipo ?? '' }))
        : extractTabulacoes(r.data)
      return json({ success: true, raw: r.data, tabulacoes })
    }


    if (action === 'criar_campanha') {
      const descricao = String(payload.descricao ?? `Discador SDR - ${new Date().toISOString().slice(0, 10)}`)

      // 0) resolver id_fila por BU (sonax_bu_filas). Sem BU => fallback legado.
      const bu = payload.bu ? String(payload.bu).trim().toLowerCase() : ''
      let idFila = ID_FILA_FALLBACK
      if (bu) {
        const { data: filaRow, error: filaError } = await admin
          .from('sonax_bu_filas')
          .select('id_fila')
          .ilike('bu', bu)
          .eq('ativo', true)
          .maybeSingle()
        if (filaError) return json({ error: 'erro_consulta_filas', detail: filaError.message }, 500)
        if (!filaRow?.id_fila) {
          // BU informada mas sem fila ativa: falhar em vez de cair em fila errada.
          return json({ error: 'fila_nao_configurada', bu }, 400)
        }
        idFila = String(filaRow.id_fila)
      }

      // 1) tabulações: a própria API informa P/N na 3ª coluna. Parser de pipe
      // primeiro; fallback para extractTabulacoes se algum dia voltar JSON.
      const listagem = await callSonax('lista_tabulacao', {})
      const linhasTab = parsePipe(listagem.data)
      const tabs = linhasTab.length
        ? linhasTab.map(([id, nome, tipo]) => ({ id, nome, tipo: (tipo ?? '').toUpperCase() }))
        : extractTabulacoes(listagem.data).map((t) => ({ id: t.id, nome: t.nome, tipo: '' }))
      const positivas = tabs.filter((t) => t.tipo === 'P').map((t) => t.nome)
      const negativas = tabs.filter((t) => t.tipo === 'N').map((t) => t.nome)

      // 1.1) pausas: doc pede nomes separados por vírgula, não ids.
      const listaPausas = await callSonax('lista_pausas', {})
      const linhasPausas = parsePipe(listaPausas.data)
      const pausasNomes = linhasPausas
        .filter(([id]) => PAUSAS.includes(id))
        .map(([, nome]) => nome)
        .filter(Boolean)

      // 2) criar campanha no Sonax
      const r = await callSonax('criar_campanha', {
        descricao_campanha: descricao,
        id_fila: idFila,
        tabulacoes_positivas: positivas.join(','),
        tabulacoes_negativas: negativas.join(','),
        pausas: pausasNomes.join(','),
        ...CAMPANHA_PADRAO,
      })

      // 3) extrair id da campanha. A API responde o id cru (ex.: 2814002), que
      // o JSON.parse transforma em number — por isso number é tratado primeiro.
      let sonaxCampaignId: string | null = null
      const d = r.data as unknown
      if (typeof d === 'number' && Number.isFinite(d)) {
        sonaxCampaignId = String(d)
      } else if (typeof d === 'string') {
        // pode vir "2814002" puro ou no formato pipe "id|algo"
        const bruto = d.trim()
        sonaxCampaignId = /^\d+$/.test(bruto) ? bruto : (parsePipe(d)[0]?.[0] ?? null)
      } else if (d && typeof d === 'object') {
        const cand = (d as Record<string, unknown>).id_campanha
          ?? (d as Record<string, unknown>).id
          ?? ((d as Record<string, unknown>).data as Record<string, unknown> | undefined)?.id_campanha
        if (cand != null) sonaxCampaignId = String(cand)
      }


      // 3.1) validar: id real da Sonax é numérico com 4+ dígitos (ex.: 604803).
      // Sem id válido a campanha não serve para nada — não gravamos nada.
      if (!sonaxCampaignId || !/^\d{4,}$/.test(sonaxCampaignId)) {
        return json({
          error: 'id_campanha_invalido',
          status: r.status,
          id_extraido: sonaxCampaignId,
          detail: r.data,
        }, 502)
      }

      const { data: saved, error: saveError } = await admin
        .from('sonax_campaigns')
        .insert({
          sonax_campaign_id: sonaxCampaignId,
          descricao,
          status: 'ativa',
          created_by: userId || null,
          // fila efetivamente usada nesta campanha (para o polling da fila)
          id_fila: idFila,

        })
        .select()
        .single()

      if (saveError) return json({ error: 'erro_ao_salvar_campanha', detail: saveError.message }, 500)

      return json({
        success: r.ok,
        campanha: saved,
        id_fila_usada: idFila,
        tabulacoes: { positivas, negativas },
        raw: r.data,
      })
    }

    if (action === 'chamada') {
      const campaignId = String(payload.campaign_id ?? '')
      const dealId = payload.deal_id ? String(payload.deal_id) : null
      if (!campaignId) return json({ error: 'campaign_id_obrigatorio' }, 400)

      const { data: campanha } = await admin
        .from('sonax_campaigns')
        .select('id, sonax_campaign_id')
        .eq('id', campaignId)
        .maybeSingle()
      if (!campanha?.sonax_campaign_id) return json({ error: 'campanha_sem_id_sonax' }, 400)

      // telefone: do payload ou buscado pelo deal
      let numeroRaw = String(payload.numero ?? '')
      let nome = String(payload.nome ?? '')
      if (!numeroRaw && dealId) {
        const { data: deal } = await admin
          .from('crm_deals')
          .select('id, name, custom_fields, contact_id, crm_contacts(name, phone)')
          .eq('id', dealId)
          .maybeSingle()
        const contact = (deal as Record<string, unknown> | null)?.crm_contacts as Record<string, unknown> | null
        const cf = ((deal as Record<string, unknown> | null)?.custom_fields ?? {}) as Record<string, unknown>
        numeroRaw = String(
          contact?.phone ?? cf.telefone ?? cf.phone ?? cf.complete_phone ?? cf.celular ?? cf.whatsapp ?? '',
        )
        nome = nome || String(contact?.name ?? (deal as Record<string, unknown> | null)?.name ?? '')
      }

      const numero = normalizeNumero(numeroRaw)
      if (!numero) return json({ error: 'numero_invalido' }, 400)

      const r = await callSonax('chamada', {
        id_campanha: String(campanha.sonax_campaign_id),
        numero,
        nome: nome.slice(0, 80),
      })

      // id_contato_campanha pode vir como número cru (ex.: 6011875473),
      // string pura de dígitos ou no formato pipe "id|algo".
      let idContato: string | null = null
      const d = r.data as unknown
      if (typeof d === 'number' && Number.isFinite(d)) {
        idContato = String(d)
      } else if (typeof d === 'string') {
        const bruto = d.trim()
        idContato = /^\d+$/.test(bruto) ? bruto : (parsePipe(d)[0]?.[0] ?? null)
      } else if (d && typeof d === 'object') {
        const cand = (d as Record<string, unknown>).id_contato_campanha
          ?? (d as Record<string, unknown>).id_contato
          ?? (d as Record<string, unknown>).id
        if (cand != null) idContato = String(cand)
      }

      const { data: saved } = await admin
        .from('sonax_campaign_contacts')
        .insert({
          campaign_id: campanha.id,
          deal_id: dealId,
          contact_phone: numero,
          sonax_id_contato_campanha: idContato,
          status: 'pendente',
          added_by: userId || null,
        })
        .select()
        .single()

      if (!r.ok) return json({ error: 'sonax_erro', status: r.status, detail: r.data, contato: saved }, 502)
      return json({ success: true, contato: saved, raw: r.data })
    }

    if (action === 'play_campanha' || action === 'stop_campanha') {
      const campaignId = String(payload.campaign_id ?? '')
      if (!campaignId) return json({ error: 'campaign_id_obrigatorio' }, 400)
      const { data: campanha } = await admin
        .from('sonax_campaigns')
        .select('id, sonax_campaign_id')
        .eq('id', campaignId)
        .maybeSingle()
      if (!campanha?.sonax_campaign_id) return json({ error: 'campanha_sem_id_sonax' }, 400)

      const r = await callSonax(action, { id_campanha: String(campanha.sonax_campaign_id) })
      if (r.ok) {
        await admin
          .from('sonax_campaigns')
          .update({ status: action === 'play_campanha' ? 'ativa' : 'pausada' })
          .eq('id', campanha.id)
      }
      if (!r.ok) return json({ error: 'sonax_erro', status: r.status, detail: r.data }, 502)
      return json({ success: true, raw: r.data })
    }

    // status_chamadas_na_fila | status_chamadas_andamento
    const params: Record<string, string> = {}
    if (action === 'status_chamadas_na_fila') {
      // Doc oficial: esta ação recebe id_fila, não id_campanha.
      params.id_fila = payload.id_fila ? String(payload.id_fila) : ID_FILA_FALLBACK
    } else {
      if (payload.campaign_id) {
        const { data: campanha } = await admin
          .from('sonax_campaigns')
          .select('sonax_campaign_id')
          .eq('id', String(payload.campaign_id))
          .maybeSingle()
        if (campanha?.sonax_campaign_id) params.id_campanha = String(campanha.sonax_campaign_id)
      }
      if (payload.sonax_campaign_id) params.id_campanha = String(payload.sonax_campaign_id)
    }
    const r = await callSonax(action, params)
    if (!r.ok) return json({ error: 'sonax_erro', status: r.status, detail: r.data }, 502)
    return json({ success: true, raw: r.data, requested_by: email })
  } catch (e) {
    return json({ error: 'falha_sonax', detail: String(e) }, 502)
  }
})
