# Marcar `contract_paid_at` nos 16 attendees — o que custa

Auditoria somente-leitura. Nada foi editado, nada gravado, nada publicado.

## Resposta curta

**Marcar `contract_paid_at` fura a regra permanente.** O campo tem gatilho de saída para
MCF Pay (`notify-mcf-pay`) e para o dispatcher de automação (WhatsApp de boas-vindas), além
de mover o negócio de etapa no CRM e criar sala de check-in. Não é um marcador inerte.

**Existe caminho aditivo que resolve os 16 sem tocar nele:** `manual_sale_attributions`.
É a alternativa recomendada, com uma ressalva de segmentação descrita no fim.

## 1) O que dispara em `meeting_slot_attendees`

13 gatilhos ativos. Os que reagem a `contract_paid_at` / `status`:

| gatilho | função | efeito |
|---|---|---|
| `trg_notify_mcf_pay_on_contract_paid` | `trigger_notify_mcf_pay_on_contract_paid` | **`net.http_post` para a edge function `notify-mcf-pay`** com `deal_id` e `source='auto_contract_paid'`, sempre que `contract_paid_at` muda e há `deal_id`. Evento de saída para MCF Pay. |
| `trg_notify_attendee_contract_paid` | `trg_notify_attendee_contract_paid` | **`net.http_post` para `automation-event-dispatcher`** com `event='attendee_contract_paid'` — só BU incorporador, ignora sócio, idempotente por `boas_vindas_r2_whatsapp_enviado_em`. É o WhatsApp de boas-vindas R2. |
| `trg_auto_move_contrato_pago` | `trg_auto_move_contrato_pago` | **Move `crm_deals.stage_id`** para o estágio ganho da origem e **insere em `deal_activities`** (`stage_change`). Não regride etapa já igual ou mais avançada. |
| `trg_checkin_autocreate_attendee` | `checkin_autocreate_from_attendee` | **Cria linha em `checkin_rooms`** ("A000 - Contrato") se o contato tem e-mail e não existe sala. |
| `trg_attendee_sync_hubla_buyer` | `trg_attendee_sync_hubla_buyer_fn` → `sync_hubla_buyer_to_crm` | Enriquece nome/e-mail/telefone em `crm_contacts`, `crm_deals.name` e no próprio attendee com os dados da transação. |
| `trg_protect_contract_paid_at` | `protect_contract_paid_at` | Defensivo: impede `status='contract_paid'` com data nula. |

Não encontrei gatilho que escreva em tabela financeira, de comissão, de meta ou de premiação,
nem em `audit_logs`, a partir desse campo. `fechamento_*` e payout leem por consulta, não por
gatilho — mas leem `contract_paid_at` (ex.: `recalculate-sdr-payout`), então marcar a data
**passa a alimentar o cálculo de payout na próxima recalculação**.

**Front-end:** 58 arquivos usam `contract_paid_at` — praticamente todo relatório de contrato,
funil, carrinho R2, gamificação de closer, receita, relatório de lead e o painel. O uso não é
só contagem: `useLinkContractToAttendee.ts` é o fluxo normal da tela e faz exatamente o pacote
completo — vincula a transação, grava `status='contract_paid'` + `contract_paid_at`, move a
etapa do negócio e **chama `notify-mcf-pay` com `force: true`**.

**Veredito sobre a regra permanente:** fura. Há evento de saída para MCF Pay e para automação
de mensagem. Se a regra vale como escrita, **a resposta é não** — e é por isso que a
alternativa da seção 4 importa.

## 2) O que muda nos números

- **Status não muda junto.** Marcar só a data deixa o registro num estado que o uso normal da
  tela nunca produz (o fluxo normal grava data **e** status `contract_paid`). Só o gatilho
  defensivo cobre o inverso; não existe nada que preencha o status a partir da data.
- **Se marcarmos apenas a data:** R1 AGENDADA 519, R1 REALIZADA 299, NO-SHOWS 155, PENDENTES 65
  — **nenhum muda**, porque as três métricas contam `status`, não a data
  (`useR1CloserMetrics.ts:186,195,771`). Só o card CONTRATOS/coluna do closer mudaria.
- **Se marcarmos data + status `contract_paid` (o fluxo normal):** 15 dos 16 já são `completed`,
  que também conta como realizada — sem efeito. O 16º é `no_show`: **NO-SHOWS 155 → 154** e
  **R1 REALIZADA 299 → 300**. R1 AGENDADA segue 519, PENDENTES segue 65.
- **A soma fecha nos dois cenários:** 299+155+65 = 519 e 300+154+65 = 519.

## 3) Os 16, nominalmente

Todos casados a uma R1 existente; 15 com attendee `completed`, 1 com `no_show`.

| cliente | valor | pago em | closer sugerido | reunião | status | critério / força |
|---|---|---|---|---|---|---|
| Ana Inês Varnier | 241,53 | 01/09 | Mayara Souza | 03/09 13:00 | completed | e-mail / forte |
| DANIEL APARECIDO AUGUSTO DE JESUS | 241,53 | 01/09 | João Pedro Martins Vieira | 05/09 14:00 | completed | e-mail / forte |
| Delômines Antônio Santos Souza | 241,53 | 01/09 | Julio | 02/09 12:30 | completed | e-mail / forte |
| DOUGLAS HENRIQUE DE FARIA ALVES | 241,53 | 08/09 | Rodrigo dos Santos Martinho | 10/09 18:00 | completed | telefone / média — 2 candidatos |
| Eduardo Henrique Oliveira | 30,06 | 03/09 | Mateus Macedo | 09/04 16:00 | completed | dois primeiros nomes / fraca |
| Francisco Edivaldo Pereira de Oliveira | 241,53 | 08/09 | Rodrigo dos Santos Martinho | 09/09 15:45 | completed | e-mail / forte |
| Gilson Marcelo Santos | 241,53 | 08/09 | Julio | 09/09 13:30 | completed | e-mail / forte |
| Gustavo Martins da Silva | 241,53 | 01/09 | William Ferreira | 02/09 15:15 | completed | e-mail / forte |
| Kléber Valente de Lima | 241,53 | 01/09 | João Pedro Martins Vieira | 04/09 11:00 | completed | e-mail / forte |
| MARCOS CAGLIARI | 399,86 | 03/09 | Cristiane Gomes | 09/02 15:00 | completed | deal vinculado / forte |
| Márllia Kesia Gonçalves de Souza | 241,53 | 01/09 | Julio | 01/09 17:30 | completed | e-mail / forte |
| OTACILIO GENEROSO DA SILVA JUNIOR | 241,53 | 08/09 | Leticia Faustino C | 17/06 09:15 | completed | e-mail / forte |
| Paulo Henrique Martins Pires | 241,53 | 08/09 | Rodrigo dos Santos Martinho | 09/09 18:00 | completed | e-mail / forte — 11 candidatos |
| Ranye Gomes | 241,53 | 08/09 | Rodrigo dos Santos Martinho | 10/09 15:45 | completed | deal vinculado / forte |
| ROBSON MOTTA DE CARVALHO | 241,53 | 01/09 | Julio | 02/09 12:30 | completed | e-mail / forte |
| **Patrícia Goveia** | 241,53 | 09/09 | Julio | 11/09 16:15 | **no_show** | e-mail / forte |

15 `completed` sem marcação de pagamento — padrão de esquecimento operacional.
1 `no_show` com contrato pago (Patrícia Goveia, pagou 09/09 e a reunião de 11/09 ficou como
falta): caso a olhar separado, porque marcar pagamento aí muda a taxa de no-show do mês.
Casos com reunião muito anterior (Eduardo 09/04, MARCOS 09/02, OTACILIO 17/06) merecem
conferência de identidade antes de qualquer decisão.

## 4) Alternativa sem tocar no campo financeiro

**A — `manual_sale_attributions` (recomendada).** Tabela existente
(`closer_id`, `contact_name`, `contact_email`, `contact_phone`, `contract_paid_at`, `notes`,
`created_by`, `business_unit`), lida em `useR1CloserMetrics.ts:687-698` e somada ao closer em
`contrato_pago`. Resolve os 16: cada linha põe o contrato na coluna do closer sugerido.
É aditiva, reversível (apagar a linha desfaz), não dispara gatilho nenhum, não emite evento
para MCF Pay/FinanceHub/Asaas, não move etapa no CRM e não altera as métricas de reunião.
**Efeito colateral único:** atribuição manual não tem negócio vinculado, então o hook a ignora
quando há filtro de segmento — os 16 aparecem no Total do closer mas caem em **s/ICP** na
quebra A/B/C. O fechamento por linha continua válido (s/ICP é resíduo). Se quiser segmento
correto, seria preciso guardar o `deal_id` na atribuição — mudança de estrutura, decisão à parte.

**B — mudar `caucoes_efetivas` para aceitar transação vinculada a negócio com R1 sem marcação
na agenda.** Resolve os 16 também, mas altera a régua de contagem que você mandou não tocar, e
o efeito extrapola setembro: passaria a valer para todo o histórico e para as outras telas que
usam a mesma RPC (relatório de closer, TV, payout). Não recomendo sem medição mês a mês antes.

**NÃO DETERMINADO:** se o dono considera aceitável que os 16 fiquem em s/ICP na quebra por
segmento, e se `manual_sale_attributions` deve ganhar `deal_id` para resolver isso.

## Nada foi alterado

Este documento é só leitura. Nenhuma escrita, nenhuma migração, nenhum deploy, nada publicado.
