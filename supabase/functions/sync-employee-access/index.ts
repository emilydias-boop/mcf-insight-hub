import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const BAN_DURATION = '876000h'; // ~100 anos

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const payload = await req.json().catch(() => ({}));
    const employeeId = typeof payload?.employee_id === 'string' ? payload.employee_id : null;
    if (!employeeId) return json({ error: 'employee_id é obrigatório' }, 400);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );

    // Fonte da verdade: sempre relê o status atual do colaborador (idempotente).
    const { data: employee, error: empErr } = await admin
      .from('employees')
      .select('id, nome_completo, status, user_id, profile_id, email_pessoal')
      .eq('id', employeeId)
      .maybeSingle();

    if (empErr) return json({ error: empErr.message }, 500);
    if (!employee) return json({ error: 'employee não encontrado' }, 404);

    const shouldRevoke = employee.status === 'desligado';
    const shouldRestore = employee.status === 'ativo';

    if (!shouldRevoke && !shouldRestore) {
      return json({ ok: true, skipped: true, status: employee.status });
    }

    // Ids de auth vinculados (user_id / profile_id apontam para auth.users.id)
    const authIds = new Set<string>();
    for (const id of [employee.user_id, employee.profile_id]) {
      if (typeof id === 'string' && id) authIds.add(id);
    }

    // Fallback por email quando não há vínculo salvo
    if (authIds.size === 0 && employee.email_pessoal) {
      const { data: byEmail } = await admin
        .from('profiles')
        .select('id')
        .ilike('email', employee.email_pessoal)
        .maybeSingle();
      if (byEmail?.id) authIds.add(byEmail.id);
    }

    const results: Array<Record<string, unknown>> = [];

    for (const authId of authIds) {
      // Não reativa/desativa quem está bloqueado manualmente pelo admin
      const { data: profile } = await admin
        .from('profiles')
        .select('id, access_status')
        .eq('id', authId)
        .maybeSingle();

      if (profile?.access_status === 'bloqueado') {
        results.push({ user_id: authId, skipped: 'bloqueado manualmente' });
        continue;
      }

      const desired = shouldRevoke ? 'desativado' : 'ativo';
      if (profile && profile.access_status !== desired) {
        await admin.from('profiles').update({ access_status: desired }).eq('id', authId);
      }

      const { error: authErr } = await admin.auth.admin.updateUserById(authId, {
        ban_duration: shouldRevoke ? BAN_DURATION : 'none',
      });

      results.push({
        user_id: authId,
        access_status: desired,
        banned: shouldRevoke,
        auth_error: authErr?.message ?? null,
      });
    }

    console.log('sync-employee-access', {
      employee_id: employeeId,
      nome: employee.nome_completo,
      status: employee.status,
      source: payload?.source ?? 'manual',
      results,
    });

    return json({ ok: true, status: employee.status, action: shouldRevoke ? 'revoked' : 'restored', results });
  } catch (e) {
    console.error('sync-employee-access erro', e);
    return json({ error: e instanceof Error ? e.message : 'erro inesperado' }, 500);
  }
});