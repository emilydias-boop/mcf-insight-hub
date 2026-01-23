import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateManualLeadRequest {
  transactionId: string;
  closerId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  scheduledAt?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user token
    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: { user }, error: userError } = await anonClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User authenticated:', user.id);

    const body: CreateManualLeadRequest = await req.json();
    const { transactionId, closerId, customerName, customerEmail, customerPhone, scheduledAt } = body;

    console.log('Request body:', { transactionId, closerId, customerName, customerEmail, customerPhone, scheduledAt });

    // Validate required fields
    if (!transactionId || !closerId || !customerName) {
      return new Response(
        JSON.stringify({ error: 'transactionId, closerId and customerName are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Verify transaction exists and is parceria
    const { data: transaction, error: txError } = await supabase
      .from('hubla_transactions')
      .select('id, sale_date, customer_name, customer_email, customer_phone, product_category')
      .eq('id', transactionId)
      .single();

    if (txError || !transaction) {
      console.error('Transaction not found:', txError);
      return new Response(
        JSON.stringify({ error: 'Transaction not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (transaction.product_category !== 'parceria') {
      return new Response(
        JSON.stringify({ error: 'Transaction is not a partnership sale' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Verify closer exists
    const { data: closer, error: closerError } = await supabase
      .from('closers')
      .select('id, name')
      .eq('id', closerId)
      .single();

    if (closerError || !closer) {
      console.error('Closer not found:', closerError);
      return new Response(
        JSON.stringify({ error: 'Closer not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Get "Aprovado" status ID
    const { data: statusOptions, error: statusError } = await supabase
      .from('r2_status_options')
      .select('id, name')
      .eq('is_active', true);

    if (statusError) {
      console.error('Error fetching status options:', statusError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch status options' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aprovadoStatus = statusOptions?.find(s => 
      s.name.toLowerCase().includes('aprovado')
    );

    if (!aprovadoStatus) {
      return new Response(
        JSON.stringify({ error: 'Aprovado status not found in r2_status_options' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Aprovado status ID:', aprovadoStatus.id);

    // 4. Create meeting_slot (R2 manual)
    const meetingScheduledAt = scheduledAt || transaction.sale_date || new Date().toISOString();
    
    const { data: meetingSlot, error: meetingError } = await supabase
      .from('meeting_slots')
      .insert({
        meeting_type: 'r2',
        status: 'completed',
        scheduled_at: meetingScheduledAt,
        closer_id: closerId,
        notes: `Lead manual criado para vincular venda: ${customerName}`,
      })
      .select('id')
      .single();

    if (meetingError || !meetingSlot) {
      console.error('Error creating meeting slot:', meetingError);
      return new Response(
        JSON.stringify({ error: 'Failed to create meeting slot', details: meetingError?.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Created meeting slot:', meetingSlot.id);

    // 5. Create meeting_slot_attendee with Aprovado status
    const { data: attendee, error: attendeeError } = await supabase
      .from('meeting_slot_attendees')
      .insert({
        meeting_slot_id: meetingSlot.id,
        attendee_name: customerName,
        attendee_phone: customerPhone || transaction.customer_phone,
        r2_status_id: aprovadoStatus.id,
        status: 'completed',
        carrinho_status: 'aprovado',
        carrinho_updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (attendeeError || !attendee) {
      console.error('Error creating attendee:', attendeeError);
      // Rollback: delete the meeting slot
      await supabase.from('meeting_slots').delete().eq('id', meetingSlot.id);
      return new Response(
        JSON.stringify({ error: 'Failed to create attendee', details: attendeeError?.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Created attendee:', attendee.id);

    // 6. Link transaction to the new attendee
    const { error: linkError } = await supabase
      .from('hubla_transactions')
      .update({ linked_attendee_id: attendee.id })
      .eq('id', transactionId);

    if (linkError) {
      console.error('Error linking transaction:', linkError);
      // Rollback
      await supabase.from('meeting_slot_attendees').delete().eq('id', attendee.id);
      await supabase.from('meeting_slots').delete().eq('id', meetingSlot.id);
      return new Response(
        JSON.stringify({ error: 'Failed to link transaction', details: linkError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Successfully linked transaction to attendee');

    return new Response(
      JSON.stringify({
        success: true,
        attendeeId: attendee.id,
        meetingSlotId: meetingSlot.id,
        message: `Lead "${customerName}" criado e vinculado com sucesso`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
