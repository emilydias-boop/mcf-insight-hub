import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateUserRequest {
  email: string;
  full_name: string;
  role: string;
  squad?: string | null;
  cargo_id?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      console.error("Missing authorization header");
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with user's token to verify they're an admin
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the calling user
    const { data: { user: callingUser }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !callingUser) {
      console.error("Error getting calling user:", userError);
      return new Response(
        JSON.stringify({ error: "Usuário não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if calling user is admin using the has_role function
    const { data: isAdmin, error: roleError } = await supabaseUser.rpc("has_role", {
      _user_id: callingUser.id,
      _role: "admin",
    });

    if (roleError || !isAdmin) {
      console.error("User is not admin:", roleError);
      return new Response(
        JSON.stringify({ error: "Apenas administradores podem criar usuários" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { email, full_name, role, squad, cargo_id }: CreateUserRequest = await req.json();

    // Validate required fields
    if (!email || !full_name || !role) {
      return new Response(
        JSON.stringify({ error: "Email, nome completo e role são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: "Formato de email inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Creating user: ${email} with role: ${role}`);

    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Create the user with admin API
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true, // Auto-confirm email so user can set password
      user_metadata: {
        full_name,
      },
    });

    if (createError) {
      console.error("Error creating user:", createError);
      
      // Check for duplicate email
      if (createError.message?.includes("already been registered") || createError.message?.includes("already exists")) {
        return new Response(
          JSON.stringify({ error: "Este email já está cadastrado no sistema" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: createError.message || "Erro ao criar usuário" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!newUser.user) {
      return new Response(
        JSON.stringify({ error: "Usuário não foi criado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`User created with ID: ${newUser.user.id}`);

    // Insert role into user_roles table
    const { error: roleInsertError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUser.user.id, role });

    if (roleInsertError) {
      console.error("Error inserting role:", roleInsertError);
      // Don't fail the whole operation, role can be set later
    }

    // Update profile with squad if provided
    if (squad) {
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({ squad })
        .eq("id", newUser.user.id);

      if (profileError) {
        console.error("Error updating profile squad:", profileError);
        // Don't fail the whole operation
      }
    }

    // Link employee to cargo if cargo_id provided
    if (cargo_id) {
      // First check if employee exists, if not create one
      const { data: existingEmployee } = await supabaseAdmin
        .from("employees")
        .select("id")
        .eq("user_id", newUser.user.id)
        .maybeSingle();

      if (existingEmployee) {
        const { error: empUpdateError } = await supabaseAdmin
          .from("employees")
          .update({ cargo_catalogo_id: cargo_id })
          .eq("id", existingEmployee.id);
        
        if (empUpdateError) {
          console.error("Error updating employee cargo:", empUpdateError);
        }
      } else {
        // Create employee record linked to cargo
        const { error: empCreateError } = await supabaseAdmin
          .from("employees")
          .insert({
            user_id: newUser.user.id,
            nome: full_name,
            email: email,
            cargo_catalogo_id: cargo_id,
            ativo: true,
          });
        
        if (empCreateError) {
          console.error("Error creating employee:", empCreateError);
        }
      }
    }

    // Auto-create SDR record for the new user
    // Check if SDR already exists by email
    const { data: existingSdr } = await supabaseAdmin
      .from("sdr")
      .select("id")
      .ilike("email", email)
      .maybeSingle();

    if (!existingSdr) {
      // Determine squad from cargo department
      let sdrSquad = "credito";
      let sdrRoleType = "sdr";

      if (cargo_id) {
        const { data: cargoData } = await supabaseAdmin
          .from("cargos_catalogo")
          .select("area, role_sistema")
          .eq("id", cargo_id)
          .maybeSingle();

        if (cargoData) {
          const area = (cargoData.area || "").toLowerCase();
          if (area.includes("incorporador") || area.includes("50k")) sdrSquad = "incorporador";
          else if (area.includes("consorcio") || area.includes("consórcio")) sdrSquad = "consorcio";
          else if (area.includes("credito") || area.includes("crédito")) sdrSquad = "credito";
          else if (area.includes("leilao") || area.includes("leilão")) sdrSquad = "leilao";

          if (cargoData.role_sistema && cargoData.role_sistema.toLowerCase().includes("closer")) {
            sdrRoleType = "closer";
          }
        }
      }

      const { data: newSdr, error: sdrError } = await supabaseAdmin
        .from("sdr")
        .insert({
          name: full_name,
          email: email,
          squad: sdrSquad,
          role_type: sdrRoleType,
          active: true,
          meta_diaria: 7,
          user_id: newUser.user.id,
        })
        .select("id")
        .single();

      if (sdrError) {
        console.error("Error creating SDR record:", sdrError);
      } else if (newSdr) {
        console.log(`SDR record created with ID: ${newSdr.id}`);
        // Link employee to SDR if employee exists
        const { error: linkError } = await supabaseAdmin
          .from("employees")
          .update({ sdr_id: newSdr.id })
          .eq("user_id", newUser.user.id);
        
        if (linkError) {
          console.error("Error linking employee to SDR:", linkError);
        }
      }
    } else {
      console.log(`SDR record already exists for email: ${email}`);
      // Link existing SDR to employee if not linked
      const { error: linkError } = await supabaseAdmin
        .from("employees")
        .update({ sdr_id: existingSdr.id })
        .eq("user_id", newUser.user.id);
      
      if (linkError) {
        console.error("Error linking existing SDR to employee:", linkError);
      }
    }

    // Update profile with full_name (trigger might not catch it from metadata)
    const { error: nameUpdateError } = await supabaseAdmin
      .from("profiles")
      .update({ full_name })
      .eq("id", newUser.user.id);

    if (nameUpdateError) {
      console.error("Error updating profile name:", nameUpdateError);
    }

    // Generate password reset link so user can set their password
    const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: `${req.headers.get("origin") || "https://mcf-insight-hub.lovable.app"}/auth?mode=reset`,
      },
    });

    if (resetError) {
      console.error("Error generating reset link:", resetError);
      // User is created, but we couldn't send the reset link
      // They can use "Forgot Password" later
    }

    console.log(`User ${email} created successfully`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        user_id: newUser.user.id,
        message: "Usuário criado com sucesso. Um email foi enviado para definir a senha.",
        reset_link_sent: !resetError,
      }),
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
