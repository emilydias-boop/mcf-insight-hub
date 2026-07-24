import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const cols = [
    'id','clint_id','name','email','phone','origin_id','organization_name','tags','custom_fields',
    'created_at','updated_at','notes','merged_into_contact_id','merged_at','is_archived',
    'origin_name','bu','etapa','etapa_color','deal_id','deal_created_at','deal_stage_moved_at'
  ];

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const esc = (v: unknown) => {
        if (v === null || v === undefined) return '';
        let s = typeof v === 'string' ? v : (typeof v === 'object' ? JSON.stringify(v) : String(v));
        if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
        return s;
      };
      controller.enqueue(enc.encode(cols.join(',') + '\n'));

      const PAGE = 2000;
      let from = 0;
      while (true) {
        const { data, error } = await admin.rpc('export_all_contacts_page', { p_offset: from, p_limit: PAGE });
        if (error) { controller.error(error); return; }
        if (!data || data.length === 0) break;
        for (const r of data as any[]) {
          controller.enqueue(enc.encode(cols.map(c => esc(r[c])).join(',') + '\n'));
        }
        if (data.length < PAGE) break;
        from += PAGE;
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { ...corsHeaders, 'Content-Type': 'text/csv; charset=utf-8' },
  });
});