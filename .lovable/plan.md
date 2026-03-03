

## Diagnóstico

Confirmei no banco de dados: **139 deals** estão com `owner_id` apontando para o closer de R2, quando deveriam estar no nome do closer de R1. Isso acontece porque o código antigo (antes da correção anterior) transferia a propriedade para o closer de R2 ao completar a reunião R2 ou registrar contrato pago/venda.

**Exemplo real do banco**: Deal "Willians Moraes Silva de Oliveira" → `r1_closer_email: thaynar.tavares@...` → `owner_id: jessica.martins@...` (R2 closer) → deveria ser `thaynar.tavares@...`.

A correção de código já foi feita (novos deals não terão esse problema), mas os **139 deals históricos** precisam ser corrigidos via SQL.

## Plano

### 1. Criar Edge Function para corrigir dados históricos

Uma edge function `fix-r2-ownership` que:

1. Busca todos os deals onde `owner_id = r2_closer_email` e `r1_closer_email IS NOT NULL`
2. Atualiza o `owner_id` para `r1_closer_email`
3. Resolve e atualiza `owner_profile_id` correspondente
4. Registra a mudança em `deal_activities` para auditoria
5. Suporta `dryRun` para preview antes de executar

**Exceção**: Deals em estágio "No-Show R2" continuam com o closer R2 (comportamento intencional para gestão de reagendamento).

### 2. Resultado esperado

Após executar a correção:
- Deals em "R2 Agendada", "R2 Realizada", "Contrato Pago" e "Venda Realizada" voltam para o nome do closer R1
- Filtrar por Thaynar no Kanban mostrará seus deals em todos os estágios do funil
- O campo `r2_closer_email` continua preservado para rastreabilidade

