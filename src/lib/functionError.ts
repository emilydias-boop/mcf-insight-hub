/**
 * `supabase.functions.invoke` devolve um FunctionsHttpError genérico
 * ("Edge Function returned a non-2xx status code") quando a função responde
 * não-2xx, e o corpo com a mensagem real é descartado. Isso escondia erros
 * úteis como "Este email já está cadastrado" ou "Formato de email inválido".
 * Este helper lê o corpo da resposta e devolve a mensagem real.
 */
export async function extractFunctionErrorMessage(
  error: unknown,
  fallback = "Erro inesperado"
): Promise<string> {
  const anyErr = error as any;
  const ctx = anyErr?.context;

  // FunctionsHttpError guarda a Response original em `context`
  if (ctx && typeof ctx.text === "function") {
    try {
      const raw = await ctx.text();
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          const msg = parsed?.error || parsed?.message;
          if (msg) return String(msg);
        } catch {
          return raw;
        }
      }
    } catch {
      // corpo já consumido ou indisponível — cai no fallback
    }
  }

  return anyErr?.message || fallback;
}
