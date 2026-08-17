import { useCallback, useEffect, useState } from 'react';
import { SUPABASE_PROJECT_URL, SUPABASE_PUBLISHABLE_KEY } from '@/integrations/supabase/client';

export interface TermoPublicoCertificado {
  assinante_nome: string | null;
  assinante_cpf: string | null;
  assinado_em: string | null;
  assinante_ip: string | null;
  conteudo_hash: string | null;
}

export interface TermoPublico {
  tipo: 'adesao' | 'comprovante_cadastro';
  status: 'pendente' | 'assinado' | 'expirado' | 'cancelado';
  expires_at: string;
  conteudo?: string;
  nome_mascarado?: string;
  documento_mascarado?: string;
  assinado_em?: string | null;
  visualizado_em?: string | null;
  certificado?: TermoPublicoCertificado | null;
}

const FN_URL = `${SUPABASE_PROJECT_URL}/functions/v1/termo-assinatura`;

async function callFn(init?: RequestInit, query = '') {
  const res = await fetch(`${FN_URL}${query}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      ...(init?.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body?.message || body?.error || `HTTP ${res.status}`);
    (err as any).code = body?.error;
    throw err;
  }
  return body;
}

export function useTermoPublico(token: string | null) {
  const [termo, setTermo] = useState<TermoPublico | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await callFn(undefined, `?token=${encodeURIComponent(token)}`);
      setTermo(data.termo);
      setNotFound(false);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const assinar = useCallback(
    async (nome: string, cpf: string) => {
      const data = await callFn({
        method: 'POST',
        body: JSON.stringify({ token, nome, cpf }),
      });
      setTermo(data.termo);
      return data.termo as TermoPublico;
    },
    [token],
  );

  return { termo, loading, notFound, assinar, reload: load };
}
