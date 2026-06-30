## Caminho 2 — Cadastro via tela

Você vai cadastrar os códigos MCF Pay na tela `/admin/gerenciamento-usuarios`, no card "Códigos MCF Pay", para cada usuário envolvido na venda do André Stormoski:

1. **Millena Mikelly** (SDR) → preencher `mcf_pay_sdr_code`
2. **Jessica Martins** (Closer R2) → preencher `mcf_pay_closer_code`
3. **William Ferreira** (Closer R1) → opcional, `mcf_pay_closer_code`

### Após o cadastro

Me avise aqui no chat ("códigos cadastrados") e eu vou:

1. Validar via `read_query` se os campos `mcf_pay_sdr_code` / `mcf_pay_closer_code` estão preenchidos nos 3 profiles.
2. Disparar manualmente a Edge Function `notify-mcf-pay` para o deal `16e243e9...` (André Stormoski), forçando o envio mesmo já estando em "Contrato Pago".
3. Conferir em `mcf_pay_dispatch_logs` se o POST saiu com `closer_code` + `sdr_code` no payload e retornou HTTP 200 do MCF Pay.
4. Reportar o resultado (payload enviado + resposta) para você confirmar no MCF Pay que a comissão foi atribuída.

### Observação

Não é necessária nenhuma alteração de código nesta etapa — a infra de envio de `closer_code`/`sdr_code` no payload já foi implementada anteriormente. É só popular os campos e redisparar.
