## Contexto

Lead `joraju2004@yahoo.com.br` (Josias Rabelo Junior) comprou um Contrato CLS pelo **link pessoal do William** (oferta `Contrato CLS - WF Caução 497`), mas o linker automático do Hubla vinculou o pagamento ao R1 do **Julio** (slot 06/05 13:30 UTC), pois esse era o R1 ativo mais próximo no calendário.

Como o pagamento (06:06 UTC) é anterior ao R1 do Julio (13:30 UTC), a regra Outside descarta a venda do card "Contratos" do Julio, e ela também não aparece para o William (que não tem R1 com o lead).

Resultado: a venda existe no Hubla mas some de todos os painéis de Closer.

## Decisão

Correção pontual via SQL, sem mexer na regra geral de Outside nem criar mapeamento automático de iniciais agora.

## O que fazer

**Passo único — reatribuir o pagamento do Julio para o William:**

Criar/usar um R1 do William para o lead Josias e mover o `contract_paid_at` para esse atendente, deixando o atendente do Julio limpo (status volta para `scheduled` ou `no_show`, sem `contract_paid_at`).

Como o William não tem R1 agendado com esse lead, o caminho mais limpo é:

1. Criar um `meeting_slot` "sintético" para o William na data/hora do pagamento (06/05 06:06 UTC), com `meeting_type='r1'` e `status='completed'`, marcado como origem manual de reconciliação.
2. Criar um `meeting_slot_attendees` ligando o `deal_id` do Josias a esse novo slot, com `status='contract_paid'`, `contract_paid_at='2026-05-06 06:06:08.794+00'`, `is_partner=false`.
3. Limpar o atendente do Julio: `contract_paid_at=NULL`, `status='no_show'` (ou `scheduled` se preferir não penalizar o Julio com no-show indevido — recomendo **`no_show`** porque o lead realmente não compareceu ao R1 dele já que tinha comprado de manhã).
4. Atualizar a `hubla_transactions` linkada (`linked_attendee_id`) para apontar ao novo atendente do William.

Após isso, o card "Contratos" do William passa de 2 → 3 e o total da equipe vai para 4 (David, Raul, Josias do William + Marcão da Thayná).

## Detalhes técnicos

**Tabelas tocadas (apenas dados, sem schema):**
- `meeting_slots`: INSERT de 1 slot para William (`closer_id='0d4a5264-258f-4ba4-bef1-afea307eed2b'`, `scheduled_at='2026-05-06 06:06:08+00'`, `meeting_type='r1'`, `status='completed'`, observação interna "Reconciliação manual — venda via link pessoal WF").
- `meeting_slot_attendees`: INSERT do attendee William (status `contract_paid`, com `contract_paid_at`).
- `meeting_slot_attendees`: UPDATE no attendee `4c77deba-0312-438d-9eb8-468184450980` (Julio) → `contract_paid_at=NULL`, `status='no_show'`.
- `hubla_transactions`: UPDATE em `e54c677c-cfa6-4a22-ad44-e3b455fcfd9c` → `linked_attendee_id` apontando ao novo attendee, `linked_method='manual'`, `linked_by_user_id` do admin que rodar.

**Validação pós-execução:**
- Conferir que `useR1CloserMetrics` no `/crm/reunioes-equipe` mostra William=3, Thayná=1, Julio=0 (na fatia dele), total Contratos=4.
- Conferir que o KPI "Outside" não dobra (a Hubla transaction continua com 1 linked_attendee_id, só mudou para qual).
- Conferir que o card de "No-Show" do Julio sobe em 1 (efeito esperado, já que ele tinha um R1 agendado que não foi convertido).

## O que NÃO está no escopo

- Não vou alterar a regra `paid < scheduled = Outside` (você pediu só correção pontual).
- Não vou criar tabela de mapeamento iniciais→Closer agora (fica para uma tarefa futura quando você quiser automatizar).
- Não vou mexer no linker automático do Hubla (`auto-link-hubla-transactions` ou similar).

## Risco

Baixo. São 4 operações de dados sobre 1 lead específico, todas reversíveis. Vou registrar os IDs antes/depois na resposta para você poder auditar.