
## Diagnóstico

Vasculhei o banco pelo dia 02/07/2026 (janela BRT) e encontrei o seguinte:

**Existem sim 18 contratos pagos no dia** para BU Incorporador (`meeting_slot_attendees.contract_paid_at` dentro do dia, `is_partner=false`, R1). O Jardel **está entre eles** — o que confunde é que ele aparece com outro nome no painel/lista.

### Registro do "Jardel" no banco

- `meeting_slot_attendees.id = 83920180-5019-462a-bc6f-9b029b1f062e`
- `attendee_name = "Francisco Pereira Alves "` (sem "Jardel", com espaço no fim)
- `attendee_phone = +5588994278311`
- `status = contract_paid`, `is_partner = false`
- `contract_paid_at = 2026-07-02 21:10:40 UTC` (18:10 BRT — depois da R1 das 17h, portanto **não é outside**)
- Slot R1 do closer **Julio** (`697b1c04-…`), booked_by **Elienai Damasceno** (SDR válido do squad incorporador)
- `deal_id = 8506677a-…` → contato `Francisco Pereira Alves` com e-mail `j2rconstrucaobs@gmail.com`
- Transação Hubla correspondente (mcfpay, `A000 - Contrato`, R$ 497) tem `customer_name = "jardel francisco pereira alves"` e `customer_email = jardel23jj@gmail.com` — outro e-mail

Ou seja: **o lead que você chama de "Jardel" é o que aparece na lista como "Francisco Pereira Alves"**. Ele conta como 1 contrato do Julio, mas o nome exibido não bate com o do cliente porque:

1. O `attendee_name` gravado no agendamento (Calendly/importação) veio como "Francisco Pereira Alves" (nome do contato do CRM), sem o "Jardel".
2. Na Hubla o cliente pagou com o nome completo "Jardel Francisco Pereira Alves" e um e-mail diferente (`jardel23jj@…` vs `j2rconstrucaobs@…`), por isso o link Hubla ↔ attendee foi feito por vínculo de `deal_id` / telefone, mas o **nome exibido** vem do attendee, não da Hubla.

### Sobre "17 vs 18"

A RPC/consulta do painel (`useR1CloserMetrics`) conta todos os 18 attendees — Jardel incluso — e agrupa por closer:

- William 8, Julio 6 (incluindo Jardel), Leticia 3, Jessica 1 → total 18

Portanto o painel deveria estar mostrando **18**, não 17. Preciso confirmar em runtime se realmente está em 17 (pode ser cache de 30s do React Query ou o painel estar somando apenas 5 contratos do Julio por algum filtro na tela específica). O dado bruto no banco está correto e completo.

## Proposta

1. **Corrigir o nome exibido do lead**
   - Atualizar `meeting_slot_attendees.attendee_name` do id `83920180-…` para `"Jardel Francisco Pereira Alves"`.
   - Opcional (recomendo perguntar antes): atualizar também o `crm_contacts.name` e o `crm_deals.name` do deal `8506677a-…` para o nome completo, para não voltar a divergir em novas reuniões.

2. **Revalidar a contagem 17 vs 18 no painel em runtime**
   - Abrir `/crm/reunioes-equipe?preset=today`, forçar refresh (invalidar React Query) e conferir se o total de contratos passou a marcar 18.
   - Se **ainda** aparecer 17 depois do refresh, investigar dois pontos específicos onde o Jardel pode estar sendo silenciosamente excluído no cliente:
     - `useR1CloserMetrics` → bloco de outside detection: como o `deal.contact.email` (`j2rconstrucaobs@…`) é diferente do `customer_email` da Hubla (`jardel23jj@…`), o join por e-mail não casa e ele não deveria ser marcado como outside — confirmar via log.
     - Bloco de dedup (`closerDealMap`): dois attendees pagos no mesmo slot/deal — no caso do Jardel o `deal_id` é diferente do outro attendee do mesmo slot (Antonio Augusto), então também não deveria ser dedupado. Confirmar.

3. **Melhoria opcional para o futuro** (deixo para outra rodada, só sinalizo aqui)
   - Quando um pagamento Hubla é vinculado a um attendee, sincronizar o `attendee_name` com o `customer_name` completo da Hubla (evita esse tipo de divergência de identificação em vendas onde o pagador tem nome mais completo que o contato do CRM).

## Detalhes técnicos

- Migration curta com dois `UPDATE` (attendee_name e, se aprovado, contact/deal name).
- Nenhuma mudança de RPC ou de lógica de contagem é necessária para resolver o sintoma reportado.
- Depois do UPDATE, o painel/lista passa a exibir "Jardel Francisco Pereira Alves" e a confusão some.

## Confirmação que preciso antes de implementar

Só quero validar: além do `attendee_name` do agendamento, você quer que eu **também** atualize o nome do contato e do deal no CRM para "Jardel Francisco Pereira Alves"? (Recomendo sim, mas prefiro perguntar porque mexe em outros lugares do sistema onde esse deal aparece.)
