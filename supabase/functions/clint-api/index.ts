import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CLINT_BASE_URL = 'https://api.clint.digital/v1';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { resource, method = 'GET', data, params } = await req.json();
    const apiKey = Deno.env.get('CLINT_API_KEY');

    if (!apiKey) {
      throw new Error('CLINT_API_KEY não configurada');
    }

    let url = `${CLINT_BASE_URL}/${resource}`;
    
    // Add query parameters if provided
    if (params) {
      const queryString = new URLSearchParams(params).toString();
      url = `${url}?${queryString}`;
    }

    console.log('Clint API Request:', { method, url, resource });

    const response = await fetch(url, {
      method,
      headers: {
        'api-token': apiKey,
        'Content-Type': 'application/json',
      },
      ...(data && method !== 'GET' ? { body: JSON.stringify(data) } : {}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Clint API Error:', response.status, errorText);
      throw new Error(`API Clint retornou erro: ${response.status} - ${errorText}`);
    }

    const responseData = await response.json();
    console.log('Clint API Success:', { resource, status: response.status });

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erro na função clint-api:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        details: error 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
