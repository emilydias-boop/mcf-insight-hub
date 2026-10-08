import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// Provisionamento pontual dos Gerentes de Relacionamento da BU Pós Venda.
// Lista fixa (não aceita e-mails do corpo) e só admin pode executar.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const TEMP_PASSWORD = "PosVenda@2026";
const USERS = [
  { email: "william.rangel@minhacasafinanciada.com", full_name: "William Rangel de Barros Silva" },
  { email: "rebeca.saar@minhacasafinanciada.com", full_name: "Rebeca Carlos de Aguiar Saar" },
  { email: "kalyanne.pereira@minhacasafinanciada.com", full_name: "Kalyanne Pereira" },
  { email: "vitor.ferreira@minhacasafinanciada.com", full_name: "Vitor Ferreira" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Não autorizado" }, 401);
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Não autenticado" }, 401);
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data: isAdmin } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin");
    if (!isAdmin?.length) return json({ error: "Apenas admins" }, 403);

    const results: unknown[] = [];
    for (const u of USERS) {
      const r: Record<string, unknown> = { email: u.email };
      try {
        const { data: prof } = await admin.from("profiles").select("id, squad").ilike("email", u.email).maybeSingle();
        let id = prof?.id as string | undefined;
        if (!id) {
          // Usuário novo: senha provisória + troca obrigatória no primeiro acesso
          const { data, error } = await admin.auth.admin.createUser({
            email: u.email,
            password: TEMP_PASSWORD,
            email_confirm: true,
            user_metadata: { full_name: u.full_name, must_change_password: true },
          });
          if (error) throw error;
          id = data.user!.id;
          r.criado = true;
          r.senha_provisoria = TEMP_PASSWORD;
          // aguarda trigger de profile
          for (let i = 0; i < 10; i++) {
            const { data: p } = await admin.from("profiles").select("id").eq("id", id).maybeSingle();
            if (p) break;
            await new Promise((res) => setTimeout(res, 300));
          }
        } else {
          r.criado = false;
          r.senha = "mantida (não alterada)";
        }
        const { data: cur } = await admin.from("profiles").select("squad").eq("id", id).maybeSingle();
        const squad = Array.from(new Set([...((cur?.squad as string[]) || []), "pos_venda"]));
        const { error: pe } = await admin.from("profiles").upsert({ id, email: u.email, full_name: u.full_name, squad }, { onConflict: "id" });
        if (pe) throw pe;
        const { error: re } = await admin.from("user_roles")
          .upsert({ user_id: id, role: "gerente_relacionamento" }, { onConflict: "user_id,role", ignoreDuplicates: true });
        if (re) throw re;
        const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", id);
        r.id = id;
        r.squad = squad;
        r.roles = roles?.map((x) => x.role);
        r.ok = true;
      } catch (e) {
        r.ok = false;
        r.error = e instanceof Error ? e.message : String(e);
      }
      results.push(r);
    }
    return json({ results });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erro" }, 500);
  }
});
