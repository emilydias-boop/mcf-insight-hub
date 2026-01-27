
Objetivo: fazer as listas voltarem a carregar transações (e não ficar “zerado”), mantendo a inclusão de reembolsos.

Diagnóstico (confirmado pelos logs de rede)
- A chamada do frontend para `rpc/get_all_hubla_transactions` está falhando com HTTP 300 e erro **PGRST203**:
  - “Could not choose the best candidate function…”
- Motivo: existem **duas funções com o mesmo nome** (`get_all_hubla_transactions`) com assinaturas diferentes:
  1) `p_start_date`/`p_end_date` como **text**
  2) `p_start_date`/`p_end_date` como **timestamp with time zone**
- O frontend envia `p_start_date`/`p_end_date` como string tipo `"2026-01-01T00:00:00-03:00"`, que pode ser interpretada tanto como `text` quanto como `timestamptz`. O PostgREST não consegue decidir qual overload usar e retorna PGRST203.  
- Como a query falha, o React Query acaba ficando sem dados e a tela aparece zerada.

Solução proposta (mais segura e rápida)
- Eliminar a ambiguidade removendo o “overload” extra e mantendo apenas 1 assinatura por função.
- Para minimizar risco de regressão, vamos manter a versão que o frontend já usava (parâmetros de data como `text`), que também já estava com a correção do `sale_status IN ('completed','refunded')`.

Plano de implementação (DB + frontend)
1) Banco (migration)
   - Criar uma nova migration SQL para:
     - Dropar as versões `timestamp with time zone`:
       - `DROP FUNCTION IF EXISTS public.get_all_hubla_transactions(text, timestamp with time zone, timestamp with time zone, integer);`
       - `DROP FUNCTION IF EXISTS public.get_hubla_transactions_by_bu(text, text, timestamp with time zone, timestamp with time zone, integer);`
     - Manter as versões `text` (já existentes) como a “fonte única”.
   - Resultado esperado: PostgREST não terá mais 2 candidatos e a RPC voltará a responder 200 com dados.

2) Tipos do Supabase (TypeScript)
   - Regerar/atualizar `src/integrations/supabase/types.ts` para remover as assinaturas duplicadas (overloads) e refletir apenas a função restante.
   - Isso evita inconsistências de tipagem e reduz risco de chamadas incorretas.

3) UX de erro (recomendado, pequena melhoria)
   - Ajustar `useAllHublaTransactions` e/ou a tela `TransacoesIncorp` para:
     - Exibir um toast/estado de erro quando a RPC retornar erro (hoje a tela só mostra “Nenhuma transação encontrada”, o que mascara falhas).
   - Resultado: se acontecer qualquer erro de RPC no futuro, fica explícito para o usuário e facilita suporte.

4) Verificação pós-correção
   - Recarregar `/bu-incorporador/transacoes`.
   - Conferir no Network:
     - `rpc/get_all_hubla_transactions` deve retornar 200.
   - Conferir na UI:
     - Total de transações > 0 (para o período selecionado).
     - Itens `sale_status === 'refunded'` continuam aparecendo com badge “Reembolso” e linha destacada.

Riscos e observações
- Essa correção resolve o “zerado” causado por erro de overload.
- Se após isso ainda vier vazio, aí o problema passa a ser “filtro/join não encontrando dados” (ex.: mapeamento de produtos), mas hoje o erro principal é inequívoco (PGRST203).

Arquivos que serão afetados quando você me colocar em modo de implementação
- Novo migration em `supabase/migrations/...sql`
- `src/integrations/supabase/types.ts`
- (Opcional) `src/hooks/useAllHublaTransactions.ts` para melhorar visibilidade de erro
