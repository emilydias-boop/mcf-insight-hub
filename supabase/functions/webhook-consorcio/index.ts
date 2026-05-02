import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  // Aproximação: 1.5% select / 1.0% parcelinha distribuído nas 24 primeiras parcelas
  const pct = tipoProduto === 'parcelinha' ? 0.01 : 0.015;
  const total = valorCredito * pct;
  return numeroParcela <= 24 ? total / 24 : 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const startTime = Date.now();

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const payload: ConsorcioPayload = await req.json();
    console.log('Webhook Consórcio - Payload recebido:', JSON.stringify(payload));

    // ===== Validação =====
    if (!payload.grupo || !payload.cota || !payload.valor_credito || !payload.tipo_pessoa) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Campos obrigatórios: grupo, cota, valor_credito, tipo_pessoa',
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (payload.tipo_pessoa === 'pf' && !payload.nome_completo) {
      return new Response(JSON.stringify({ success: false, error: 'Campo nome_completo é obrigatório para PF' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (payload.tipo_pessoa === 'pj' && !payload.razao_social) {
      return new Response(JSON.stringify({ success: false, error: 'Campo razao_social é obrigatório para PJ' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const tipoRegistro: TipoRegistro = payload.tipo_registro === 'reserva' ? 'reserva' : 'contratacao';
    const dataReserva = parseBrazilianDate(payload.data_reserva);
    const dataContratacao = parseBrazilianDate(payload.data_contratacao);

    // Regra: reserva exige data_reserva; contratação exige data_contratacao
    if (tipoRegistro === 'reserva' && !dataReserva) {
      return new Response(JSON.stringify({ success: false, error: 'tipo_registro=reserva exige data_reserva' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (tipoRegistro === 'contratacao' && !dataContratacao) {
      return new Response(JSON.stringify({ success: false, error: 'tipo_registro=contratacao exige data_contratacao' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: logEntry } = await supabase
      .from('bu_webhook_logs')
      .insert({ bu_type: 'consorcio', event_type: 'new_card', payload, status: 'processing' })
      .select('id').single();

    const valorCredito = parseMonetaryValue(payload.valor_credito);
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
      origem: payload.origem || 'outros',
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
