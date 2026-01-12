import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LeilaoPayload {
  // Tipo do evento
  event_type: 'new_auction' | 'new_bid' | 'auction_update';
  
  // Dados do leilão (new_auction ou auction_update)
  property_name?: string;
  address?: string;
  initial_value?: number;
  current_bid?: number;
  status?: 'active' | 'completed' | 'cancelled';
  start_date?: string;
  end_date?: string;
  image_url?: string;
  
  // Dados do lance (new_bid)
  auction_id?: string;
  bidder_name?: string;
  bidder_email?: string;
  bid_amount?: number;
  
  // Origem
  origem?: string;
}

function parseBrazilianDate(dateStr?: string): string | null {
  if (!dateStr) return null;
  
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  // Try ISO format
  if (dateStr.includes('T')) {
    return dateStr.split('T')[0];
  }
  
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
  
  const str = String(value)
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  
  return parseFloat(str) || 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload: LeilaoPayload = await req.json();
    console.log('Webhook Leilão - Payload recebido:', JSON.stringify(payload));

    // Validação do tipo de evento
    if (!payload.event_type) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Campo obrigatório: event_type (new_auction, new_bid, auction_update)' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Log do webhook
    const { data: logEntry } = await supabase
      .from('bu_webhook_logs')
      .insert({
        bu_type: 'leilao',
        event_type: payload.event_type,
        payload: payload,
        status: 'processing'
      })
      .select('id')
      .single();

    let resultId: string | null = null;
    let message = '';

    switch (payload.event_type) {
      case 'new_auction': {
        // Validação para novo leilão
        if (!payload.property_name || !payload.address || !payload.initial_value) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Campos obrigatórios para new_auction: property_name, address, initial_value' 
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const auctionData = {
          property_name: payload.property_name,
          address: payload.address,
          initial_value: parseMonetaryValue(payload.initial_value),
          current_bid: parseMonetaryValue(payload.current_bid || payload.initial_value),
          status: payload.status || 'active',
          start_date: parseBrazilianDate(payload.start_date) || new Date().toISOString().split('T')[0],
          end_date: parseBrazilianDate(payload.end_date),
          image_url: payload.image_url
        };

        const { data: auction, error } = await supabase
          .from('auctions')
          .insert(auctionData)
          .select('id')
          .single();

        if (error) throw error;
        resultId = auction.id;
        message = 'Leilão criado com sucesso';
        break;
      }

      case 'new_bid': {
        // Validação para novo lance
        if (!payload.auction_id || !payload.bidder_name || !payload.bid_amount) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Campos obrigatórios para new_bid: auction_id, bidder_name, bid_amount' 
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const bidData = {
          auction_id: payload.auction_id,
          bidder_name: payload.bidder_name,
          bid_amount: parseMonetaryValue(payload.bid_amount)
        };

        const { data: bid, error } = await supabase
          .from('auction_bids')
          .insert(bidData)
          .select('id')
          .single();

        if (error) throw error;

        // Atualizar current_bid no leilão
        await supabase
          .from('auctions')
          .update({ 
            current_bid: parseMonetaryValue(payload.bid_amount),
            updated_at: new Date().toISOString()
          })
          .eq('id', payload.auction_id);

        resultId = bid.id;
        message = 'Lance registrado com sucesso';
        break;
      }

      case 'auction_update': {
        // Validação para atualização
        if (!payload.auction_id) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Campo obrigatório para auction_update: auction_id' 
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const updateData: Record<string, any> = {
          updated_at: new Date().toISOString()
        };

        if (payload.status) updateData.status = payload.status;
        if (payload.current_bid) updateData.current_bid = parseMonetaryValue(payload.current_bid);
        if (payload.end_date) updateData.end_date = parseBrazilianDate(payload.end_date);
        if (payload.image_url) updateData.image_url = payload.image_url;

        const { error } = await supabase
          .from('auctions')
          .update(updateData)
          .eq('id', payload.auction_id);

        if (error) throw error;
        resultId = payload.auction_id;
        message = 'Leilão atualizado com sucesso';
        break;
      }

      default:
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Tipo de evento inválido' 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // Atualizar log com sucesso
    if (logEntry?.id) {
      await supabase
        .from('bu_webhook_logs')
        .update({ 
          status: 'processed', 
          record_id: resultId,
          processed_at: new Date().toISOString()
        })
        .eq('id', logEntry.id);
    }

    const processingTime = Date.now() - startTime;
    console.log(`Webhook Leilão processado em ${processingTime}ms - ID: ${resultId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        id: resultId,
        message,
        processing_time_ms: processingTime
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro no webhook leilão:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
