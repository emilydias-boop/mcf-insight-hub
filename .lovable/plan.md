
Objetivo
- Resolver definitivamente o erro “Could not choose the best candidate function…” que está impedindo a tela /bu-incorporador/transacoes de carregar e (segundo você) está bloqueando o fluxo de venda.
- Garantir que a lista traga apenas transações com source = “hubla” e “manual”.

O que eu verifiquei (logs + banco)
1) Logs de rede do navegador mostram que o frontend está chamando:
   POST /rest/v1/rpc/get_all_hubla_transactions
   Body: {"p_search":null,"p_start_date":"2026-01-01T00:00:00-03:00","p_end_date":"2026-01-30T23:59:59-03:00","p_limit":5000}
   Resposta: PGRST203 com a mensagem de ambiguidade entre duas funções.

2) No Postgres existem duas funções públicas com o mesmo nome e mesmos tipos, porém com a ordem de parâmetros diferente:
- public.get_all_hubla_transactions(p_search text, p_start_date timestamptz, p_end_date timestamptz, p_limit integer)
  • Esta é a versão “pesada” (inclui source ‘make’ e lógica de deduplicação/NOT EXISTS).
- public.get_all_hubla_transactions(p_start_date timestamptz, p_end_date timestamptz, p_search text, p_limit integer)
  • Esta é a versão “leve” e já filtrando apenas ‘hubla’ e ‘manual’.

Por que o erro acontece
- O PostgREST/Supabase RPC não consegue decidir qual versão chamar quando existem funções sobrecarregadas (mesmo nome) e o payload pode ser mapeado para ambas (apenas com ordem de parâmetros diferente). Isso gera o PGRST203 e a chamada falha.

Estratégia de correção (sem mexer no frontend)
- Manter apenas 1 função com o nome get_all_hubla_transactions.
- Como você quer apenas “hubla” e “manual”, vamos manter a versão leve e remover a versão pesada.
- Resultado: acaba a ambiguidade e a RPC volta a responder.

Mudança necessária no banco (migração SQL)
1) Dropar somente a assinatura “pesada” (a que começa com p_search):
   DROP FUNCTION IF EXISTS public.get_all_hubla_transactions(text, timestamp with time zone, timestamp with time zone, integer);

2) Validar que sobrou apenas 1 função:
   - Conferir em pg_proc que existe somente:
     get_all_hubla_transactions(timestamp with time zone, timestamp with time zone, text, integer)

Validação pós-correção (checklist)
1) Recarregar a rota /bu-incorporador/transacoes.
2) Confirmar que:
   - Não aparece mais o toast “Erro ao carregar transações”.
   - A lista carrega transações (quando existirem no período) e a coluna “Fonte” mostra apenas “hubla” e “manual”.
3) Confirmar no Network do browser que:
   - A chamada /rpc/get_all_hubla_transactions retorna HTTP 200 e um array de resultados.
4) (Opcional) Rodar um teste rápido no SQL Editor:
   select count(*) from public.get_all_hubla_transactions(null, '2026-01-01T00:00:00-03:00'::timestamptz, '2026-01-30T23:59:59-03:00'::timestamptz, 10);

Riscos / Observações
- Essa correção não altera dados; apenas remove uma versão duplicada da função.
- Se alguma outra parte do sistema dependia de “make”, ela deixará de ver esses registros via essa RPC (mas isso está alinhado ao seu pedido atual: mostrar só hubla e manual).
- O arquivo src/integrations/supabase/types.ts provavelmente continuará mostrando “overload/union” até uma futura regeneração de tipos; isso não impede o funcionamento em runtime, mas pode confundir o TypeScript (não é a causa do erro atual).

Próximo passo
- Executar a migração acima (DROP da assinatura com p_search primeiro) para eliminar a sobrecarga e destravar a chamada RPC.
