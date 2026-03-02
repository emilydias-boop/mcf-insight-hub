import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Verify caller is admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check admin role
    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
    
    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: 'Apenas administradores podem gerenciar cargos' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { action } = body

    if (action === 'create') {
      const { role_key, label, color, description } = body
      
      if (!role_key || !label) {
        return new Response(JSON.stringify({ error: 'role_key e label são obrigatórios' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Validate slug format
      const slugRegex = /^[a-z][a-z0-9_]*$/
      if (!slugRegex.test(role_key)) {
        return new Response(JSON.stringify({ error: 'role_key deve ser lowercase, sem espaços ou acentos (ex: meu_cargo)' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Add value to enum via raw SQL
      const { error: enumError } = await supabaseAdmin.rpc('exec_sql', {
        sql: `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = '${role_key}' AND enumtypid = 'app_role'::regtype) THEN ALTER TYPE app_role ADD VALUE '${role_key}'; END IF; END $$;`
      }).single()

      // If exec_sql doesn't exist, try direct approach
      if (enumError) {
        console.log('exec_sql not available, inserting to roles_config only:', enumError.message)
      }

      // Insert into roles_config
      const { data, error } = await supabaseAdmin
        .from('roles_config')
        .insert({
          role_key,
          label,
          color: color || 'bg-muted text-muted-foreground border-border',
          description: description || null,
          is_system: false,
        })
        .select()
        .single()

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'update') {
      const { id, label, color, description, is_active } = body

      if (!id) {
        return new Response(JSON.stringify({ error: 'id é obrigatório' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Check if system role
      const { data: existing } = await supabaseAdmin
        .from('roles_config')
        .select('is_system')
        .eq('id', id)
        .single()

      if (existing?.is_system && is_active === false) {
        return new Response(JSON.stringify({ error: 'Roles de sistema não podem ser desativados' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const updateData: Record<string, unknown> = {}
      if (label !== undefined) updateData.label = label
      if (color !== undefined) updateData.color = color
      if (description !== undefined) updateData.description = description
      if (is_active !== undefined) updateData.is_active = is_active

      const { data, error } = await supabaseAdmin
        .from('roles_config')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Ação inválida' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Error:', err)
    return new Response(JSON.stringify({ error: 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
