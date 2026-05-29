
## Diagnóstico — quais são os 2 "Outside" inflando o KPI

Rodei a consulta de detecção de outside do mês corrente. O KPI mostra 13 (= 11 da agenda + 2 outside), mas os 2 outside detectados NÃO deveriam estar contando:

### Caso 1 — Vinicius Barbosa Paiva
- Hubla: `viniciusbarbosapaiva@gmail.com` (sem `.br`)
- CRM: `viniciusbarbosapaiva@gmail.com.br` (com `.br`) — **tem R1 em 17/04**
- O matcher de outside só compara email exato, então não encontra a R1 e classifica como "outside sem reunião".
- **Causa raiz:** typo no email do contato no CRM.

### Caso 2 — Igor Mateus de Morais Pereira (mateusigorlaivi@gmail.com)
- Tem **R2 agendada para 05/05 19:45**, sem R1.
- Contrato pago em 05/05 12:40 (antes da R2).
- A detecção marca como "outside antes da R2" — mas é fluxo legítimo de cliente que pagou antes da R2 (não é outside real).

## Plano de correção

### Parte 1 — Fix pontual do email do Vinicius
- UPDATE em `crm_contacts` para corrigir `viniciusbarbosapaiva@gmail.com.br` → `viniciusbarbosapaiva@gmail.com` (alinha com Hubla).
- Após a correção, a detecção de outside vai casar com a R1 de 17/04 e parar de contar como outside. O contrato vai parar de aparecer no KPI inflado e (se já estiver linkado ao attendee) entra como contrato normal.

### Parte 2 — Ajuste na regra de detecção de Outside
A regra atual em `src/hooks/useR1CloserMetrics.ts` (linhas 430-467) considera outside quando o contrato foi pago antes da primeira reunião — **incluindo R2**. Isso gera falso-positivo no fluxo legítimo "lead pagou antes da R2 marcada" (caso Igor).

**Mudança proposta:** considerar outside **apenas quando NÃO existe R1** OU quando o contrato foi pago antes da R1 específica. Se o lead tem só R2 (sem R1), tratar como contrato normal atribuído ao closer da R2 — não como outside.

Concretamente, no bloco `earliestByEmail`:
- Se existe R1 para o email → outside só se `contractDate < r1.scheduled_at` (já é o comportamento).
- Se NÃO existe R1, mas existe R2 → **não classificar como outside**; o contrato já será capturado pela contagem normal de `contract_paid` no attendee da R2.

## Por que isso resolve

- Vinicius: contagem volta a 11 (era 12 por erro de email).
- Igor: contagem volta a 11 (era 12 por R2-only ser tratada como outside).
- KPI = lista = 11. Caso ainda haja outside legítimo (cliente que comprou direto pelo Hubla sem nenhuma reunião), ele continua contado — mas hoje, no mês corrente, não há nenhum desses entre os 11.

## Arquivos afetados

- Migração SQL: UPDATE pontual no email do contato Vinicius.
- `src/hooks/useR1CloserMetrics.ts` — ajustar bloco de detecção outside (R2-only deixa de contar).

## Fora de escopo

- Não vou mexer na lista do drill-down nem mudar a definição de "outside" exibida em outros relatórios (Closer Performance). Mudança fica isolada ao hook que alimenta o KPI Contratos da Reuniões da Equipe e ao registro do Vinicius.
