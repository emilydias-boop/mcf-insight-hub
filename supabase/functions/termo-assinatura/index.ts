import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function onlyDigits(v: string) {
  return (v || '').replace(/\D/g, '');
}

function normalizeNome(v: string) {
  return (v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function maskDocumento(doc: string) {
  const d = onlyDigits(doc);
  if (d.length < 5) return '•••';
  return `${d.slice(0, 3)}${'•'.repeat(Math.max(0, d.length - 5))}${d.slice(-2)}`;
}

function maskNome(nome: string) {
  const partes = (nome || '').trim().split(/\s+/);
  if (!partes[0]) return '—';
  return partes.map((p, i) => (i === 0 || i === partes.length - 1 ? p : `${p[0]}.`)).join(' ');
}

// Somente o necessário para publicPayload() + conferência de assinatura.
// access_token não é lido: ele já vem no request e nunca volta na resposta.
const TERMO_COLS =
  'id, tipo, conteudo_renderizado, conteudo_hash, status, expires_at, assinado_em, assinante_nome, assinante_cpf, assinante_ip, visualizado_em, dados_snapshot';

async function getTermo(token: string) {
  const { data, error } = await supabase
    .from('consorcio_termos')
    .select(TERMO_COLS)
    .eq('access_token', token)
    .maybeSingle();
  if (error) throw error;
  return data as any | null;
}

function isExpired(t: any) {
  // Vale para todos os tipos, inclusive o comprovante (validade de 2 anos).
  return t.status === 'pendente' && new Date(t.expires_at).getTime() < Date.now();
}

/** Resposta pública — nunca expõe token, ids internos ou o snapshot inteiro. */
function publicPayload(t: any) {
  const snap = t.dados_snapshot || {};
  const base = {
    tipo: (t.tipo || 'adesao') as string,
    status: t.status as string,
    expires_at: t.expires_at as string,
  };
  if (t.status === 'cancelado') return { ...base, status: 'cancelado' };
  if (isExpired(t)) return { ...base, status: 'expirado' };
  return {
    ...base,
    conteudo: t.conteudo_renderizado as string,
    nome_mascarado: maskNome(String(snap.cliente_nome || '')),
    documento_mascarado: maskDocumento(String(snap.cliente_documento || '')),
    assinado_em: t.assinado_em,
    visualizado_em: t.visualizado_em,
    certificado:
      t.status === 'assinado'
        ? {
            assinante_nome: t.assinante_nome,
            assinante_cpf: t.assinante_cpf,
            assinado_em: t.assinado_em,
            assinante_ip: t.assinante_ip,
            conteudo_hash: t.conteudo_hash,
          }
        : null,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = new URL(req.url);

    if (req.method === 'GET') {
      const token = url.searchParams.get('token');
      if (!token) return json(400, { error: 'token required' });
      const termo = await getTermo(token);
      if (!termo) return json(404, { error: 'not_found' });
      if (isExpired(termo)) {
        await supabase.from('consorcio_termos').update({ status: 'expirado' }).eq('id', termo.id);
        termo.status = 'expirado';
      } else if (termo.status !== 'cancelado' && !termo.visualizado_em) {
        // Primeira abertura pelo cliente: registra data/IP (não sobrescreve).
        const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || null;
        const nowIso = new Date().toISOString();
        await supabase
          .from('consorcio_termos')
          .update({ visualizado_em: nowIso, visualizado_ip: ip })
          .eq('id', termo.id)
          .is('visualizado_em', null);
        termo.visualizado_em = nowIso;
      }
      return json(200, { termo: publicPayload(termo) });
    }

    if (req.method === 'POST') {
      const body = (await req.json().catch(() => null)) as
        | { token?: string; nome?: string; cpf?: string }
        | null;
      if (!body?.token || !body?.nome?.trim() || !body?.cpf?.trim()) {
        return json(400, { error: 'invalid_input', message: 'Informe nome completo e CPF.' });
      }

      const termo = await getTermo(body.token);
      if (!termo) return json(404, { error: 'not_found' });
      if (termo.tipo === 'comprovante_cadastro') {
        return json(409, {
          error: 'not_signable',
          message: 'Este documento é apenas um comprovante e não requer assinatura.',
        });
      }
      if (termo.status === 'assinado') {
        return json(409, { error: 'already_signed', message: 'Este termo já foi assinado.' });
      }
      if (termo.status === 'cancelado') {
        return json(409, { error: 'cancelled', message: 'Este termo foi cancelado.' });
      }
      if (termo.status !== 'pendente' || isExpired(termo)) {
        await supabase.from('consorcio_termos').update({ status: 'expirado' }).eq('id', termo.id);
        return json(409, { error: 'expired', message: 'O prazo para assinatura deste termo expirou.' });
      }

      const snap = termo.dados_snapshot || {};
      const docEsperado = onlyDigits(String(snap.cliente_documento || ''));
      const nomeEsperado = normalizeNome(String(snap.cliente_nome || ''));
      if (onlyDigits(body.cpf) !== docEsperado) {
        return json(422, {
          error: 'doc_mismatch',
          message: 'O CPF/CNPJ informado não corresponde ao do termo.',
        });
      }
      if (normalizeNome(body.nome) !== nomeEsperado) {
        return json(422, {
          error: 'name_mismatch',
          message: 'O nome informado não corresponde ao do termo.',
        });
      }

      const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || null;
      const nowIso = new Date().toISOString();

      // Atualização condicional: só assina se ainda estiver pendente (nada de gravar duas vezes).
      const { data: updated, error } = await supabase
        .from('consorcio_termos')
        .update({
          status: 'assinado',
          assinado_em: nowIso,
          assinante_nome: body.nome.trim(),
          assinante_cpf: body.cpf.trim(),
          assinante_ip: ip,
          assinante_user_agent: req.headers.get('user-agent'),
        })
        .eq('id', termo.id)
        .eq('status', 'pendente')
        .select(TERMO_COLS)
        .maybeSingle();
      if (error) throw error;
      if (!updated) {
        return json(409, { error: 'already_signed', message: 'Este termo já foi assinado.' });
      }

      return json(200, { termo: publicPayload(updated) });
    }

    return json(404, { error: 'unknown_action' });
  } catch (err) {
    console.error('[termo-assinatura] error', err);
    return json(500, { error: 'internal', message: (err as Error).message });
  }
});
