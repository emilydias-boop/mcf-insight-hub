## Decisão final

- **Não reatribuir** os 318 deals da Juliana — ficam com ela mesmo.
- **Apenas cancelar** os itens da fila ligados a ela para não acumular.
- Tratar o caso geral de "owner desligado" para o futuro.

## O que eu vou executar (uma migração só)

1. **Cancelar itens pendentes da Juliana** — `UPDATE automation_queue SET status='skipped', error_message='Owner desligado'` onde o deal pertence a `juliana.rodrigues@…`.

2. **Releasar a fila dos demais** — `UPDATE automation_queue SET scheduled_at = now() WHERE status='pending'`. Processor envia os ~16 restantes em ≤ 5 min.

3. **Remover o trigger duplicado** `trg_automation_enqueue_on_deal` em `crm_deals` (evita 2 itens iguais por movimentação).

4. **Cleanup defensivo permanente** (cron diário) — marca como `skipped` itens pendentes há > 24h cujo owner não tem telefone resolvível ou está desligado.

## Na edge function `automation-processor`

5. **Pular owners desligados** — se `employees.status <> 'ativo'`, marca o item como `skipped` com motivo "Owner desligado". Isso resolve o caso Juliana e qualquer futuro desligamento automaticamente.

6. **Cancelar itens cujo deal saiu do stage-alvo** antes do `scheduled_at` (evita reenvio fora de contexto, como aconteceu com o caso Antonio Matheus).

## Validação

- Confirmo no `automation_logs` que os ~16 itens dos SDRs ativos viraram `sent` em ≤ 5 min.
- Confirmo que os 2 itens da Juliana ficaram `skipped` com motivo correto.
- Teste: mover 1 lead novo para ANAMNESE INCOMPLETA → **1** item na fila (não 2) + WhatsApp em ≤ 5 min, qualquer horário.

Posso aprovar e rodar?
