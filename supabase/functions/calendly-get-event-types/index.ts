import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const calendlyToken = Deno.env.get('CALENDLY_PERSONAL_ACCESS_TOKEN');
    
    if (!calendlyToken) {
      console.error('CALENDLY_PERSONAL_ACCESS_TOKEN not configured');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Calendly API token não configurado. Configure CALENDLY_PERSONAL_ACCESS_TOKEN nos secrets.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching Calendly user info...');
    
    // First, get the current user to get their URI
    const userResponse = await fetch('https://api.calendly.com/users/me', {
      headers: {
        'Authorization': `Bearer ${calendlyToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      console.error('Calendly user fetch failed:', userResponse.status, errorText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Erro ao autenticar com Calendly: ${userResponse.status}` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userData = await userResponse.json();
    const userUri = userData.resource?.uri;
    const organizationUri = userData.resource?.current_organization;

    console.log('User URI:', userUri);
    console.log('Organization URI:', organizationUri);

    if (!userUri) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Não foi possível obter URI do usuário Calendly' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch event types for the user
    const eventTypesUrl = new URL('https://api.calendly.com/event_types');
    eventTypesUrl.searchParams.append('user', userUri);
    eventTypesUrl.searchParams.append('active', 'true');

    console.log('Fetching event types from:', eventTypesUrl.toString());

    const eventTypesResponse = await fetch(eventTypesUrl.toString(), {
      headers: {
        'Authorization': `Bearer ${calendlyToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!eventTypesResponse.ok) {
      const errorText = await eventTypesResponse.text();
      console.error('Calendly event types fetch failed:', eventTypesResponse.status, errorText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Erro ao buscar Event Types: ${eventTypesResponse.status}` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const eventTypesData = await eventTypesResponse.json();
    console.log('Event types fetched:', eventTypesData.collection?.length || 0);

    // Map event types to a simpler format
    const eventTypes = (eventTypesData.collection || []).map((et: any) => ({
      uri: et.uri,
      name: et.name,
      slug: et.slug,
      duration_minutes: et.duration,
      scheduling_url: et.scheduling_url,
      active: et.active,
      description_plain: et.description_plain || '',
      color: et.color
    }));

    console.log('Returning event types:', eventTypes.length);

    return new Response(
      JSON.stringify({ 
        success: true, 
        eventTypes,
        user: {
          name: userData.resource?.name,
          email: userData.resource?.email,
          uri: userUri
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro interno ao buscar Event Types';
    console.error('Error in calendly-get-event-types:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
