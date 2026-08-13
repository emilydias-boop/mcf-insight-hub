import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data, error } = await supabase.storage
    .from("bu-strategic-documents")
    .createSignedUrl("projetos/2026/2/semana-1/1770755620682_Performance_de_Marketing_-_Janeiro_2026-2.pdf", 60 * 60 * 24 * 7);
  return new Response(JSON.stringify({ url: data?.signedUrl ?? null, error: error?.message ?? null }), {
    headers: { "Content-Type": "application/json" },
  });
});
