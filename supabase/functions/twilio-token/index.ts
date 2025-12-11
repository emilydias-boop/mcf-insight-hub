import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { identity } = await req.json();
    
    if (!identity) {
      return new Response(
        JSON.stringify({ error: 'Identity is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twimlAppSid = Deno.env.get('TWILIO_TWIML_APP_SID');
    const apiKeySid = Deno.env.get('TWILIO_API_KEY_SID');
    const apiKeySecret = Deno.env.get('TWILIO_API_KEY_SECRET');

    if (!accountSid || !authToken || !twimlAppSid) {
      console.error('Missing Twilio credentials');
      return new Response(
        JSON.stringify({ error: 'Twilio not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate Access Token using Twilio's JWT
    // For Voice SDK, we need to create an Access Token with Voice Grant
    const now = Math.floor(Date.now() / 1000);
    const ttl = 3600; // 1 hour

    // Create JWT header
    const header = {
      typ: 'JWT',
      alg: 'HS256',
      cty: 'twilio-fpa;v=1'
    };

    // Create JWT payload with Voice grant
    const payload = {
      jti: `${apiKeySid || accountSid}-${now}`,
      iss: apiKeySid || accountSid,
      sub: accountSid,
      exp: now + ttl,
      grants: {
        identity: identity,
        voice: {
          incoming: { allow: false },
          outgoing: {
            application_sid: twimlAppSid
          }
        }
      }
    };

    // Base64url encode
    const base64UrlEncode = (str: string) => {
      return btoa(str)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    };

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    
    // Sign with API Key Secret or Auth Token
    const signingKey = apiKeySecret || authToken;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(signingKey),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signatureData = encoder.encode(`${encodedHeader}.${encodedPayload}`);
    const signature = await crypto.subtle.sign('HMAC', key, signatureData);
    const encodedSignature = base64UrlEncode(
      String.fromCharCode(...new Uint8Array(signature))
    );

    const token = `${encodedHeader}.${encodedPayload}.${encodedSignature}`;

    console.log(`Token generated for identity: ${identity}`);

    return new Response(
      JSON.stringify({ token, identity }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating token:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
