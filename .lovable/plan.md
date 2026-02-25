
Objetivo
Corrigir o caso do A009 que continuou com bruto de R$ 19.500,00 mesmo após mudança para R$ 24.500,00, e eliminar o comportamento silencioso quando a vigência não é aplicada.

Diagnóstico confirmado
1) O cálculo está passando pelo histórico corretamente, mas a vigência do A009 ficou no horário da alteração (não no início do dia).
- Para A009, os registros de mudança ficaram com `effective_from` em `2026-02-25 21:33:xx+00`.
- As vendas do Willians estão em `2026-02-25 16:17:34+00`.
- Resultado: `sale_date < effective_from` ⇒ função `get_effective_price` retorna preço antigo (R$ 19.500,00).

2) A001 funcionou porque a vigência foi corrigida para início do dia.
- A001 está com `effective_from = 2026-02-25 03:00:00+00` (equivale a 00:00 BRT).
- Por isso A001 passou a respeitar o novo valor no mesmo dia.

3) O problema atual do A009 é de dado de vigência (backfill), não da fórmula de bruto.

Plano de implementação (correção)
Fase 1 — Correção imediata dos dados (A009)
- Executar UPDATE pontual nos registros de histórico do A009 (mudança 19500 → 24500) para `effective_from = 2026-02-25T00:00:00-03:00`.
- Aplicar para todas as variantes A009 alteradas no mesmo evento (inclusive “- 1 de 12”) para evitar inconsistência entre aliases do mesmo produto.

Fase 2 — Blindagem no frontend para não falhar silenciosamente
- Em `useUpdateProductConfiguration`:
  - Validar erro no `select` do histórico recém-criado.
  - Validar erro no `update` de `effective_from`.
  - Se falhar, disparar toast explícito: “Preço salvo, mas vigência não foi aplicada” (com motivo técnico).
- Melhorar seleção do histórico mais recente:
  - além de `product_config_id`, filtrar também por `new_price = updates.reference_price` para reduzir risco de pegar linha errada em edições rápidas.

Fase 3 — Padronização de timezone (evitar edge cases)
- Converter a data escolhida no drawer para “início do dia em São Paulo” de forma determinística (não dependente do timezone do navegador).
- Persistir sempre como `YYYY-MM-DDT00:00:00-03:00` (ou equivalente UTC) para manter regra de negócio consistente.

Fase 4 — Ajuste de UX para reduzir confusão operacional
- No drawer, mostrar texto de confirmação da vigência no formato:
  - “Aplicar a partir de 25/02/2026 00:00 (São Paulo)”.
- Opcional: aviso quando existem múltiplas configurações com o mesmo `product_code` (A009), para orientar atualização de aliases.

Validação (obrigatória, ponta a ponta)
1) Alterar A009 no `/admin/produtos` com vigência “hoje”.
2) Ir para `/bu-incorporador/.../vendas`, clicar “Atualizar”.
3) Confirmar que as vendas de 25/02 passam a bruto R$ 24.500,00.
4) Conferir no histórico do produto se a linha ficou com vigência no início do dia.
5) Repetir com data futura para garantir agendamento correto.

Seção técnica (detalhes)
Arquivos/tabelas impactados:
- Dados Supabase:
  - `product_price_history` (UPDATE corretivo de `effective_from` para A009).
- Frontend:
  - `src/hooks/useProductConfigurations.ts` (tratamento de erro + seleção robusta do registro de histórico).
  - `src/components/admin/ProductConfigDrawer.tsx` (mensagem de vigência explícita em timezone SP).

SQL de correção de dados (direção):
- Atualizar linhas de `product_price_history` onde:
  - `old_price = 19500`
  - `new_price = 24500`
  - produto pertence ao código A009 (join com `product_configurations`)
  - data da alteração = 25/02/2026
- Definir `effective_from` para `2026-02-25T00:00:00-03:00`.

Risco e mitigação
- Risco: corrigir vigência de linhas erradas.
- Mitigação: filtrar por `product_code = 'A009'`, par de preços exato (19500→24500), e data da alteração; validar com SELECT antes/depois.

Resultado esperado
- O A009 passa a refletir o novo bruto no dia correto.
- O sistema deixa de “falhar silenciosamente” quando não consegue aplicar vigência.
- Operação fica previsível para qualquer próximo ajuste de preço.
