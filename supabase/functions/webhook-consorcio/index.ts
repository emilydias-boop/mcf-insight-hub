/**
 * webhook-consorcio — entrada de cotas de consórcio.
 *
 * AUTENTICAÇÃO (modo estrito): todo integrador DEVE enviar o header
 * `x-webhook-secret` com o valor do segredo `CONSORCIO_WEBHOOK_SECRET`
 * (Project Settings → Secrets). Sem header, header errado, ou segredo
 * não configurado no ambiente → 401, sem nenhuma escrita de negócio.
 * Toda tentativa rejeitada é auditada em `bu_webhook_logs`.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Origens permitidas por CORS. Integração máquina-a-máquina NÃO usa CORS,
 * então fechar aqui não afeta o emissor do webhook — só impede que um site
 * de terceiros chame esta função pelo navegador de um usuário logado.
 */
const ALLOWED_ORIGINS = [
  'https://mcfgestao.com',
  'https://www.mcfgestao.com',
  'https://mcf-insight-hub.lovable.app',
  'https://id-preview--34c6432e-9b01-4946-b0e7-fde5393c994f.lovable.app',
];

function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin);
  return {
    // Sem origem (server-to-server) ou origem não listada: não libera navegador.
    'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

/** Comparação de tempo constante — não vaza o segredo por timing. */
function timingSafeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  // Compara sempre o mesmo número de bytes; diferença de tamanho entra no diff.
  const len = Math.max(ea.length, eb.length);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < len; i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

type AuthOutcome = 'ok' | 'missing_header' | 'bad_secret' | 'secret_not_configured';

/**
 * FASE 2 — modo ESTRITO: qualquer resultado diferente de 'ok' devolve 401.
 * Porta fechada por padrão: segredo ausente no ambiente também bloqueia.
 */
function checkWebhookSecret(req: Request): AuthOutcome {
  const expected = Deno.env.get('CONSORCIO_WEBHOOK_SECRET');
  if (!expected) return 'secret_not_configured';
  const received = req.headers.get('x-webhook-secret');
  if (!received) return 'missing_header';
  return timingSafeEqual(received, expected) ? 'ok' : 'bad_secret';
}

/** Tudo que dá para identificar do emissor, para o dono saber quem reconfigurar. */
function describeCaller(req: Request) {
  const h = req.headers;
  return {
    ip: h.get('x-forwarded-for') || h.get('x-real-ip') || null,
    user_agent: h.get('user-agent') || null,
    origin: h.get('origin') || null,
    referer: h.get('referer') || null,
    content_type: h.get('content-type') || null,
    // Pistas de quem chamou, quando o emissor se identifica.
    via: h.get('via') || null,
    country: h.get('cf-ipcountry') || h.get('x-vercel-ip-country') || null,
    apikey_present: !!h.get('apikey'),
    authorization_present: !!h.get('authorization'),
    header_names: [...h.keys()].sort(),
  };
}


type TipoRegistro = 'reserva' | 'contratacao';
type Categoria = 'inside' | 'life';
type TipoContrato = 'normal' | 'intercalado' | 'intercalado_impar';
type TipoProduto = 'select' | 'parcelinha';
type InicioSegunda = 'proximo_mes' | 'pular_mes' | 'automatico';

interface ConsorcioPayload {
  // Dados da cota
  grupo: string;
  cota: string;
  valor_credito: number | string;
  prazo_meses?: number;
  tipo_produto?: TipoProduto;
  tipo_contrato?: TipoContrato;
  parcelas_pagas_empresa?: number;

  // Datas e tipo de registro
  tipo_registro?: TipoRegistro;       // 'reserva' | 'contratacao'
  data_reserva?: string;
  data_contratacao?: string;
  dia_vencimento?: number;
  inicio_segunda_parcela?: InicioSegunda;

  // Categoria/origem
  categoria?: Categoria;              // 'inside' | 'life'
  origem?: string;
  origem_detalhe?: string;

  // Composição da parcela
  produto_embracon?: string;
  condicao_pagamento?: string;
  inclui_seguro_vida?: boolean;
  parcela_1a_12a?: number | string;
  parcela_demais?: number | string;

  // Dados do cliente
  tipo_pessoa: 'pf' | 'pj';
  nome_completo?: string;
  cpf?: string;
  email?: string;
  telefone?: string;
  razao_social?: string;
  cnpj?: string;

  // Vendedor
  vendedor_email?: string;
  vendedor_name?: string;

  // Observações
  observacoes?: string;
}

// ============ Helpers ============

const FERIADOS_FIXOS = ['01-01','04-21','05-01','09-07','10-12','11-02','11-15','12-25'];

function isWeekend(d: Date) {
  const day = d.getDay();
  return day === 0 || day === 6;
}
function fmtMMDD(d: Date) {
  return `${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function isFeriado(d: Date) {
  return FERIADOS_FIXOS.includes(fmtMMDD(d));
}
function proximoDiaUtil(d: Date): Date {
  const r = new Date(d);
  while (isWeekend(r) || isFeriado(r)) r.setDate(r.getDate() + 1);
  return r;
}
function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function parseBrazilianDate(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return null;
}

function parseMonetaryValue(value: any): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const str = String(value).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  return parseFloat(str) || 0;
}

function calcularComissao(valorCredito: number, tipoProduto: TipoProduto, numeroParcela: number): number {
  // Tabela oficial — espelho de src/lib/commissionCalculator.ts
  let percentual = 0;
  if (tipoProduto === 'select') {
    const tabela: Record<number, number> = {
      1: 1.20, 2: 1.12, 3: 1.12, 4: 0.62,
      5: 0.11, 6: 0.11, 7: 0.11, 8: 1.11,
    };
    percentual = tabela[numeroParcela] || 0;
  } else if (tipoProduto === 'parcelinha') {
    if (numeroParcela === 1) percentual = 0.53;
    else if (numeroParcela >= 2 && numeroParcela <= 4) percentual = 0.43;
    else if (numeroParcela >= 5 && numeroParcela <= 12) percentual = 0.33;
  }
  return (valorCredito * percentual) / 100;
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const startTime = Date.now();

  try {
    if (req.method !== 'POST') {
      return json({ success: false, error: 'Method not allowed' }, 405);
    }

    // ===== Autenticação (FASE 2: ESTRITA — 401 sem escrever nada de negócio) =====
    const authOutcome = checkWebhookSecret(req);
    const caller = describeCaller(req);
    if (authOutcome !== 'ok') {
      console.error(
        `[webhook-consorcio][AUTH ${authOutcome}] requisição REJEITADA (401). Emissor: ${JSON.stringify(caller)}`,
      );
      // Auditoria da tentativa rejeitada — para saber quem tentou, quando e sem qual segredo.
      try {
        const auditClient = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        );
        await auditClient.from('bu_webhook_logs').insert({
          bu_type: 'consorcio',
          event_type: `new_card.auth_${authOutcome}`,
          payload: { fase: 2, modo: 'estrito', auth: authOutcome, caller, rejected: true },
          status: 'error',
          error_message: `401 unauthorized: ${authOutcome}`,
        });
      } catch (auditErr) {
        console.error('[webhook-consorcio] falha ao auditar tentativa rejeitada:', auditErr);
      }
      return json({ success: false, error: 'unauthorized' }, 401);
    }


    // ===== Payload: rejeita malformado ANTES de qualquer escrita =====
    let payload: ConsorcioPayload;
    try {
      payload = await req.json();
    } catch {
      console.warn('[webhook-consorcio] corpo não é JSON válido. Emissor:', JSON.stringify(caller));
      return json({ success: false, error: 'Corpo da requisição não é um JSON válido' }, 400);
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return json({ success: false, error: 'Corpo da requisição deve ser um objeto JSON' }, 400);
    }
    console.log('Webhook Consórcio - Payload recebido:', JSON.stringify(payload));

    // ===== Validação =====
    if (!payload.grupo || !payload.cota || !payload.valor_credito || !payload.tipo_pessoa) {
      return json({
        success: false,
        error: 'Campos obrigatórios: grupo, cota, valor_credito, tipo_pessoa',
      }, 400);
    }
    if (payload.tipo_pessoa !== 'pf' && payload.tipo_pessoa !== 'pj') {
      return json({ success: false, error: "tipo_pessoa deve ser 'pf' ou 'pj'" }, 400);
    }
    if (payload.tipo_pessoa === 'pf' && !payload.nome_completo) {
      return json({ success: false, error: 'Campo nome_completo é obrigatório para PF' }, 400);
    }
    if (payload.tipo_pessoa === 'pj' && !payload.razao_social) {
      return json({ success: false, error: 'Campo razao_social é obrigatório para PJ' }, 400);
    }

    const tipoRegistro: TipoRegistro = payload.tipo_registro === 'reserva' ? 'reserva' : 'contratacao';
    const dataReserva = parseBrazilianDate(payload.data_reserva);
    const dataContratacao = parseBrazilianDate(payload.data_contratacao);

    // Regra: reserva exige data_reserva; contratação exige data_contratacao
    if (tipoRegistro === 'reserva' && !dataReserva) {
      return json({ success: false, error: 'tipo_registro=reserva exige data_reserva' }, 400);
    }
    if (tipoRegistro === 'contratacao' && !dataContratacao) {
      return json({ success: false, error: 'tipo_registro=contratacao exige data_contratacao' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Contador auditável de requisições sem o segredo (base da decisão da Fase 2).
    if (authOutcome !== 'ok') {
      await supabase.from('bu_webhook_logs').insert({
        bu_type: 'consorcio',
        event_type: `new_card.auth_${authOutcome}`,
        payload: { fase: 1, modo: 'permissivo', auth: authOutcome, caller },
        status: 'warning',
      });
    }

    const { data: logEntry } = await supabase
      .from('bu_webhook_logs')
      .insert({ bu_type: 'consorcio', event_type: 'new_card', payload, status: 'processing' })

      .select('id').single();

    const valorCredito = parseMonetaryValue(payload.valor_credito);

    // Origem: valida contra o catálogo (`name`) — se não bater, cai em 'outros'.
    // Gravar valor livre/UUID deixava a cota invisível ao filtro de Origem.
    let origemNormalizada = 'outros';
    const origemBruta = (payload.origem || '').trim();
    if (origemBruta) {
      const { data: origens } = await supabase
        .from('consorcio_origem_options')
        .select('name');
      const nomes = new Set((origens || []).map((o: any) => String(o.name)));
      if (nomes.has(origemBruta)) {
        origemNormalizada = origemBruta;
      } else {
        console.warn('[webhook-consorcio] origem fora do catálogo, usando "outros":', origemBruta);
      }
    }
    const prazoMeses = payload.prazo_meses || 180;
    const tipoProduto: TipoProduto = payload.tipo_produto || 'select';
    const tipoContrato: TipoContrato = payload.tipo_contrato || 'normal';
    const parcelasPagasEmpresa = payload.parcelas_pagas_empresa || 0;
    const diaVencimento = payload.dia_vencimento || 10;

    const cardData: Record<string, any> = {
      grupo: payload.grupo,
      cota: payload.cota,
      valor_credito: valorCredito,
      prazo_meses: prazoMeses,
      tipo_produto: tipoProduto,
      tipo_contrato: tipoContrato,
      parcelas_pagas_empresa: parcelasPagasEmpresa,
      tipo_registro: tipoRegistro,
      data_reserva: dataReserva,
      data_contratacao: dataContratacao,
      dia_vencimento: diaVencimento,
      categoria: payload.categoria || 'inside',
      origem: origemNormalizada,
      origem_detalhe: payload.origem_detalhe,
      tipo_pessoa: payload.tipo_pessoa,
      nome_completo: payload.nome_completo,
      cpf: payload.cpf,
      email: payload.email,
      telefone: payload.telefone,
      razao_social: payload.razao_social,
      cnpj: payload.cnpj,
      vendedor_name: payload.vendedor_name,
      produto_embracon: payload.produto_embracon,
      condicao_pagamento: payload.condicao_pagamento,
      inclui_seguro_vida: payload.inclui_seguro_vida ?? false,
      parcela_1a_12a: payload.parcela_1a_12a != null ? parseMonetaryValue(payload.parcela_1a_12a) : null,
      parcela_demais: payload.parcela_demais != null ? parseMonetaryValue(payload.parcela_demais) : null,
      observacoes: payload.observacoes,
      status: 'ativo',
    };
    // Remove undefined/null vazios para evitar problemas com defaults
    for (const k of Object.keys(cardData)) {
      if (cardData[k] === undefined) delete cardData[k];
    }

    const { data: card, error: insertError } = await supabase
      .from('consortium_cards')
      .insert(cardData)
      .select('id')
      .single();

    if (insertError) {
      console.error('Erro ao inserir carta:', insertError);
      if (logEntry?.id) {
        await supabase.from('bu_webhook_logs')
          .update({ status: 'error', error_message: insertError.message, processed_at: new Date().toISOString() })
          .eq('id', logEntry.id);
      }
      return new Response(JSON.stringify({ success: false, error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ===== Geração de parcelas (espelho de useCreateConsorcioCard) =====
    const isReserva = tipoRegistro === 'reserva';
    const dataBaseStr = isReserva ? (dataReserva || dataContratacao!) : (dataContratacao || dataReserva!);
    const [by, bm, bd] = dataBaseStr.split('-').map(Number);
    const dataBase = new Date(by, bm - 1, bd);

    const inicioSegunda = payload.inicio_segunda_parcela || 'automatico';
    let offsetSegunda: number;
    if (inicioSegunda === 'proximo_mes') offsetSegunda = 1;
    else if (inicioSegunda === 'pular_mes') offsetSegunda = 2;
    else offsetSegunda = dataBase.getDate() > 16 ? 2 : 1;

    const installments: Record<string, any>[] = [];
    for (let i = 1; i <= prazoMeses; i++) {
      let dataVenc: Date;
      if (i === 1) {
        dataVenc = dataBase;
      } else {
        const monthOffset = offsetSegunda + (i - 2);
        const mesAlvo = dataBase.getMonth() + monthOffset;
        const anoAlvo = dataBase.getFullYear() + Math.floor(mesAlvo / 12);
        const mesNorm = ((mesAlvo % 12) + 12) % 12;
        const ultimoDia = new Date(anoAlvo, mesNorm + 1, 0).getDate();
        const diaAj = Math.min(diaVencimento, ultimoDia);
        dataVenc = proximoDiaUtil(new Date(anoAlvo, mesNorm, diaAj));
      }
      const valorComissao = calcularComissao(valorCredito, tipoProduto, i);

      let tipo: 'cliente' | 'empresa';
      if (tipoContrato === 'intercalado') {
        const ehPar = i % 2 === 0;
        tipo = (ehPar && (i / 2) <= parcelasPagasEmpresa) ? 'empresa' : 'cliente';
      } else if (tipoContrato === 'intercalado_impar') {
        const ehImpar = i % 2 === 1;
        tipo = (ehImpar && Math.ceil(i / 2) <= parcelasPagasEmpresa) ? 'empresa' : 'cliente';
      } else {
        tipo = i <= parcelasPagasEmpresa ? 'empresa' : 'cliente';
      }

      installments.push({
        card_id: card.id,
        numero_parcela: i,
        tipo,
        valor_parcela: valorCredito / prazoMeses,
        valor_comissao: valorComissao,
        data_vencimento: toISODate(dataVenc),
        status: isReserva ? 'previsto' : 'pendente',
      });
    }

    const CHUNK_SIZE = 8;
    for (let i = 0; i < installments.length; i += CHUNK_SIZE) {
      const chunk = installments.slice(i, i + CHUNK_SIZE);
      const { error: instErr } = await supabase.from('consortium_installments').insert(chunk);
      if (instErr) {
        console.error('Erro ao inserir parcelas:', instErr);
        // não falha a request: card já criado
        break;
      }
    }

    if (logEntry?.id) {
      await supabase.from('bu_webhook_logs')
        .update({ status: 'processed', record_id: card.id, processed_at: new Date().toISOString() })
        .eq('id', logEntry.id);
    }

    const processingTime = Date.now() - startTime;
    console.log(`Webhook Consórcio processado em ${processingTime}ms - Card ID: ${card.id} (${tipoRegistro}, ${installments.length} parcelas)`);

    return new Response(JSON.stringify({
      success: true,
      id: card.id,
      tipo_registro: tipoRegistro,
      parcelas_geradas: installments.length,
      message: `Carta de consórcio criada como ${tipoRegistro}`,
      processing_time_ms: processingTime,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Erro no webhook consórcio:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
