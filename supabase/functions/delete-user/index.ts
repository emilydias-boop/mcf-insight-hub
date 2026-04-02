import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify caller is admin
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callingUser }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !callingUser) {
      return new Response(
        JSON.stringify({ error: "Usuário não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: isAdmin } = await supabaseUser.rpc("has_role", {
      _user_id: callingUser.id,
      _role: "admin",
    });

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Apenas administradores podem excluir usuários" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { user_id } = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "user_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prevent self-deletion
    if (user_id === callingUser.id) {
      return new Response(
        JSON.stringify({ error: "Você não pode excluir sua própria conta" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Deleting user: ${user_id}`);

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // === Step 1: Unlink employees (don't delete, just remove profile/user references) ===
    const { error: empProfileErr } = await supabaseAdmin
      .from("employees")
      .update({ profile_id: null, user_id: null })
      .eq("profile_id", user_id);
    if (empProfileErr) {
      console.warn("Warning: could not unlink employees by profile_id:", empProfileErr.message);
    }
    // Also try by user_id column in case profile_id differs
    const { error: empUserErr } = await supabaseAdmin
      .from("employees")
      .update({ profile_id: null, user_id: null })
      .eq("user_id", user_id);
    if (empUserErr) {
      console.warn("Warning: could not unlink employees by user_id:", empUserErr.message);
    }

    // === Step 2: SET NULL on historical tables (preserve records) ===
    const nullifyTables = [
      { table: "calls", column: "user_id" },
      { table: "deal_activities", column: "user_id" },
      { table: "meeting_slots", column: "booked_by" },
      { table: "playbook_docs", column: "criado_por" },
      { table: "audit_logs", column: "user_id" },
      { table: "alerts", column: "resolved_by" },
      { table: "bu_strategic_documents", column: "uploaded_by" },
      { table: "attendee_movement_logs", column: "moved_by" },
      { table: "crm_deals", column: "owner_profile_id" },
    ];

    for (const { table, column } of nullifyTables) {
      const { error } = await supabaseAdmin
        .from(table)
        .update({ [column]: null })
        .eq(column, user_id);
      if (error) {
        console.warn(`Warning: could not nullify ${table}.${column}:`, error.message);
      }
    }

    // === Step 3: Delete from tables with user_id (direct ownership) ===
    const deleteTables = [
      "user_roles",
      "user_employment_data",
      "user_integrations",
      "user_permissions",
      "user_targets",
      "user_flags",
      "user_observations",
      "dashboard_preferences",
      "sdr",
      "playbook_reads",
      "sdr_review_requests",
      "user_files",
      "alertas",
    ];

    for (const table of deleteTables) {
      const { error } = await supabaseAdmin.from(table).delete().eq("user_id", user_id);
      if (error) {
        console.warn(`Warning: could not clean ${table}:`, error.message);
      }
    }

    // === Step 4: Delete profile ===
    const { error: profileError } = await supabaseAdmin.from("profiles").delete().eq("id", user_id);
    if (profileError) {
      console.warn("Warning: could not delete profile:", profileError.message);
    }

    // === Step 5: Delete from auth ===
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id);
    if (deleteError) {
      console.error("Error deleting auth user:", deleteError);
      return new Response(
        JSON.stringify({ error: deleteError.message || "Erro ao excluir usuário" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`User ${user_id} deleted successfully`);

    return new Response(
      JSON.stringify({ success: true, message: "Usuário excluído com sucesso" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
