import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
// Temporary read-only export. Delete after use.
Deno.serve(async (req) => {
  if (req.headers.get("x-export-token") !== "9a6998fcacf4739f77fcfeb1c769ca920fe62c8ac4dfe078") return new Response("no", { status: 401 });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { offset = 0 } = await req.json().catch(() => ({}));
  const { data: rs, error } = await sb.from("pos_venda_reunioes").select("id,tipo,status,inicio,duracao_min,deal_id,gerente_id").gte("inicio","2026-11-01T03:00:00Z").lt("inicio","2026-12-01T03:00:00Z").order("inicio");
  if (error) return Response.json({ error });
  const deals = [...new Set(rs!.map(r=>r.deal_id).filter(Boolean))];
  const gers = [...new Set(rs!.map(r=>r.gerente_id).filter(Boolean))];
  const { data: d } = await sb.from("crm_deals").select("id,name").in("id", deals);
  const { data: p } = await sb.from("profiles").select("id,full_name,email").in("id", gers);
  const out:any[] = [];
  const slice = rs!.slice(offset, offset + 15);
  for (const r of slice) {
    const g = p?.find(x=>x.id===r.gerente_id); const row:any = { ...r, cliente: d?.find(x=>x.id===r.deal_id)?.name, gerente: g?.full_name ?? g?.email, grav: [] };
    if (g?.email) {
      const ini = new Date(r.inicio).getTime();
      const { data: mr } = await sb.from("meeting_recordings").select("title,started_at,duration_minutes,summary,highlights,transcript,host_email,participant_emails")
        .gte("started_at", new Date(ini-3600e3).toISOString()).lte("started_at", new Date(ini+(r.duracao_min+120)*60e3).toISOString()).order("started_at");
      const e = g.email.toLowerCase();
      row.grav = (mr??[]).filter((m:any)=> (m.host_email??"").toLowerCase()===e || (m.participant_emails??[]).some((x:string)=>x.toLowerCase()===e));
    }
    out.push(row);
  }
  return Response.json({ total: rs!.length, rows: out });
});
