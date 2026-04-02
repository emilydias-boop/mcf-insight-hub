import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { storagePath, uploadedBy } = await req.json();
    if (!storagePath) throw new Error('storagePath is required');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Download PDF from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('consorcio-boletos')
      .download(storagePath);

    if (downloadError || !fileData) {
      console.error('[PARSE-BOLETO] Download error:', downloadError);
      throw new Error('Failed to download PDF from storage');
    }

    // Convert to base64
    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    console.log('[PARSE-BOLETO] PDF downloaded, size:', arrayBuffer.byteLength);

    // Call Lovable AI (Gemini) to extract data from the boleto
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `Você é um especialista em leitura de boletos bancários brasileiros. Extraia os dados do boleto PDF fornecido. Retorne APENAS um JSON válido com os campos abaixo. Se não encontrar algum campo, use null.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analise este boleto PDF e extraia os seguintes dados em JSON:
{
  "nome_pagador": "nome completo do pagador/sacado",
  "grupo": "número do grupo do consórcio (se visível)",
  "cota": "número da cota do consórcio (se visível)",
  "valor": número decimal do valor do boleto,
  "vencimento": "YYYY-MM-DD",
  "linha_digitavel": "sequência numérica da linha digitável (com pontos e espaços como aparecem)",
  "codigo_barras": "código de barras numérico se diferente da linha digitável",
  "numero_parcela": número da parcela se visível
}
Retorne APENAS o JSON, sem markdown, sem explicações.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:application/pdf;base64,${base64}`
                }
              }
            ]
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_boleto_data',
              description: 'Extract structured data from a Brazilian boleto',
              parameters: {
                type: 'object',
                properties: {
                  nome_pagador: { type: 'string', description: 'Nome do pagador/sacado' },
                  grupo: { type: 'string', description: 'Número do grupo do consórcio' },
                  cota: { type: 'string', description: 'Número da cota do consórcio' },
                  valor: { type: 'number', description: 'Valor do boleto' },
                  vencimento: { type: 'string', description: 'Data de vencimento YYYY-MM-DD' },
                  linha_digitavel: { type: 'string', description: 'Linha digitável do boleto' },
                  codigo_barras: { type: 'string', description: 'Código de barras numérico' },
                  numero_parcela: { type: 'number', description: 'Número da parcela' },
                },
                required: ['nome_pagador'],
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'extract_boleto_data' } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('[PARSE-BOLETO] AI error:', aiResponse.status, errText);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded, tente novamente em alguns segundos' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos de IA esgotados' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error('AI gateway error');
    }

    const aiResult = await aiResponse.json();
    let extracted: any;

    // Try tool call response first
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      extracted = JSON.parse(toolCall.function.arguments);
    } else {
      // Fallback: parse content as JSON
      const content = aiResult.choices?.[0]?.message?.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extracted = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not parse AI response');
      }
    }

    console.log('[PARSE-BOLETO] Extracted:', JSON.stringify(extracted));

    // Match with consortium_cards
    let cardId: string | null = null;
    let installmentId: string | null = null;
    let matchConfidence = 'pending_review';

    if (extracted.nome_pagador) {
      // Try exact match by name + grupo + cota
      let query = supabase
        .from('consortium_cards')
        .select('id, nome_completo, razao_social, grupo, cota, telefone');

      const { data: cards } = await query;

      if (cards && cards.length > 0) {
        const nameNorm = (s: string) => s?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() || '';
        const extractedName = nameNorm(extracted.nome_pagador);

        // Score each card
        let bestMatch: any = null;
        let bestScore = 0;

        for (const card of cards) {
          let score = 0;
          const cardName = nameNorm(card.nome_completo || card.razao_social || '');
          
          if (cardName && extractedName && cardName === extractedName) {
            score += 3;
          } else if (cardName && extractedName && (cardName.includes(extractedName) || extractedName.includes(cardName))) {
            score += 2;
          } else if (cardName && extractedName) {
            // Check if first + last name match
            const extractedParts = extractedName.split(' ');
            const cardParts = cardName.split(' ');
            if (extractedParts[0] === cardParts[0] && extractedParts[extractedParts.length - 1] === cardParts[cardParts.length - 1]) {
              score += 1.5;
            }
          }

          if (extracted.grupo && card.grupo === extracted.grupo) score += 2;
          if (extracted.cota && card.cota === extracted.cota) score += 2;

          if (score > bestScore) {
            bestScore = score;
            bestMatch = card;
          }
        }

        if (bestScore >= 5) {
          cardId = bestMatch.id;
          matchConfidence = 'exact';
        } else if (bestScore >= 2) {
          cardId = bestMatch.id;
          matchConfidence = 'partial';
        }

        // If matched, try to find the installment
        if (cardId && extracted.vencimento) {
          const { data: installments } = await supabase
            .from('consortium_installments')
            .select('id, data_vencimento, numero_parcela')
            .eq('card_id', cardId)
            .eq('data_vencimento', extracted.vencimento);

          if (installments && installments.length > 0) {
            installmentId = installments[0].id;
          } else if (extracted.numero_parcela) {
            const { data: instByNum } = await supabase
              .from('consortium_installments')
              .select('id')
              .eq('card_id', cardId)
              .eq('numero_parcela', extracted.numero_parcela);

            if (instByNum && instByNum.length > 0) {
              installmentId = instByNum[0].id;
            }
          }
        }
      }
    }

    // Insert into consorcio_boletos
    const { data: boleto, error: insertError } = await supabase
      .from('consorcio_boletos')
      .insert({
        card_id: cardId,
        installment_id: installmentId,
        nome_extraido: extracted.nome_pagador || null,
        grupo_extraido: extracted.grupo || null,
        cota_extraida: extracted.cota || null,
        valor_extraido: extracted.valor || null,
        vencimento_extraido: extracted.vencimento || null,
        linha_digitavel: extracted.linha_digitavel || null,
        codigo_barras: extracted.codigo_barras || null,
        storage_path: storagePath,
        match_confidence: matchConfidence,
        status: cardId ? 'matched' : 'pending_review',
        uploaded_by: uploadedBy || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[PARSE-BOLETO] Insert error:', insertError);
      throw new Error('Failed to save boleto data');
    }

    console.log('[PARSE-BOLETO] Saved boleto:', boleto.id, 'match:', matchConfidence);

    return new Response(JSON.stringify({
      success: true,
      boleto,
      matchConfidence,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[PARSE-BOLETO] Error:', error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
