# Auditoria (somente leitura): contrato pago → R2 do Incorporador, jul–set/2026

Nada foi alterado. Só rodei consultas de leitura (SELECT). Não há nada para aprovar e construir: este documento traz só os resultados.

## Critérios usados
- **Contrato:** `hubla_transactions.product_name = 'A000 - Contrato'` com `sale_status = 'completed'`, data do pagamento no mês (horário de Brasília). Entram Hubla (57) e MCF Pay (643). Fica de fora "Contrato MCF" (R$ 249, 115 vendas), porque é outro produto.
- **Cliente:** e-mail em minúsculas. Quando não há e-mail, o telefone (últimos 11 dígitos). A data de pagamento é a do primeiro contrato do cliente no mês. Quem pagou em dois meses conta nos dois.
- **R2:** `meeting_slots.meeting_type = 'r2'`, com o participante em `meeting_slot_attendees`, marcada a partir do horário do pagamento e sem limite de dias.
- **Status da R2 mais recente:** completed/contract_paid = realizada; no_show; invited/scheduled no futuro = agendada no futuro; cancelled/canceled = cancelada; rescheduled = reagendada; o resto entra em "outro".

## 1–4. Clientes e R2 por forma de casamento

| Mês | Casamento | Clientes | Com R2 | Sem R2 | Realizada | No-show | Agendada no futuro | Cancelada | Reagendada | Outro |
|---|---|---|---|---|---|---|---|---|---|---|
| jul | (a) mesmo negócio | 262 | 192 | 70 | 168 | 11 | 0 | 0 | 1 | 12 |
| jul | (b) mesmo contato | 262 | 210 | 52 | 183 | 10 | 0 | 0 | 1 | 16 |
| jul | (c) e-mail ou telefone | 262 | 214 | 48 | 188 | 10 | 0 | 0 | 1 | 15 |
| ago | (a) | 232 | 131 | 101 | 110 | 11 | 0 | 0 | 0 | 10 |
| ago | (b) | 232 | 186 | 46 | 161 | 11 | 0 | 0 | 0 | 14 |
| ago | (c) | 232 | 188 | 44 | 163 | 11 | 0 | 0 | 0 | 14 |
| set | (a) | 237 | 169 | 68 | 143 | 19 | 0 | 0 | 0 | 7 |
| set | (b) | 237 | 197 | 40 | 168 | 20 | 1 | 0 | 0 | 8 |
| set | (c) | 237 | 197 | 40 | 168 | 20 | 1 | 0 | 0 | 8 |

**Taxa "contrato pago → R2 realizada" pela chave (c):** jul 71,8% (188/262), ago 70,3% (163/232), set 70,9% (168/237).

**A chave muda o número, sim.** Casar só pelo mesmo negócio perde muita R2, porque ela costuma ficar em outro negócio do mesmo cliente. Em agosto foram 101 clientes "sem R2" pelo negócio, contra 44 por e-mail ou telefone. Pelo contato e por e-mail ou telefone, os números ficam quase iguais.

**O que entra em "outro"** (chave c):
- jul: 8 desistências, 6 agendadas que já passaram sem marcação, 1 "scheduled" que já passou
- ago: 11 desistências, 2 agendadas que já passaram, 1 pré-agendada
- set: 7 desistências, 1 agendada que já passou, 1 "invited" ainda no futuro

Nenhuma R2 aparece como cancelada: nas R2 desde julho não existe nenhum participante com status cancelled ou canceled.

## 5. Dias entre o pagamento e a primeira R2 realizada (chave c)

| Mês | Até 7 | 8–15 | 16–30 | Mais de 30 | Total |
|---|---|---|---|---|---|
| jul | 168 | 14 | 4 | 2 | 188 |
| ago | 154 | 9 | 0 | 0 | 163 |
| set | 159 | 9 | 0 | 0 | 168 |

## 6. Clientes sem nenhuma R2 (chave c)

| Mês | Sem R2 | Compraram o produto principal | Reembolso do contrato (vendas) | Reembolso marcado na agenda | Reembolso (qualquer um dos dois) | Nenhum dos dois |
|---|---|---|---|---|---|---|
| jul | 48 | 3 | 4 | 6 | 9 | 36 |
| ago | 44 | 4 | 1 | 8 | 9 | 31 |
| set | 40 | 2 | 2 | 8 | 9 | 29 |

- **Produto principal:** venda concluída depois do contrato, de um produto que começa com A001, A009, R001 ou R009, ou de outro produto do Incorporador acima de R$ 1.000 (sem A000 e sem "contrato").
- **Reembolso nas vendas:** existe um A000 com `sale_status = 'refunded'` para o mesmo e-mail ou telefone.
- **Reembolso na agenda:** `meeting_slot_attendees.refunded_at` preenchido.

## 7. Como o sistema identifica uma R2
- O campo que decide é `meeting_slots.meeting_type = 'r2'`. A agenda do closer (`closers.meeting_type`, `closers.bu`) só define onde a reunião é marcada.
- R2 do Incorporador em set/26:

| Agenda | Reuniões | Participantes |
|---|---|---|
| Jessica Martins | 220 | 220 |
| Claudia Carielo | 56 | 56 |
| Jessica Bellini (agenda R2 do Incorporador) | 14 | 14 |
| Jessica Bellini (agenda R2 do Solar) | 1 | 1 |

- **Diego e Bruna:** não existe nenhum closer cadastrado com esses nomes. Também não há reunião deles.
- **Jessica Bellini:** tem 3 agendas de R1 (Incorporador com 8 reuniões em setembro, Solar com 6, Consórcio com 2) e 2 de R2. Há ainda 1 reunião numa agenda de R2 dela no Solar que está marcada como R1.
- **Possível R2 em outra agenda:** em setembro, os clientes do contrato tiveram reuniões R1 depois de pagar. Todas foram em agendas de outras BUs: Consórcio (Bruno 31, Cleiton 24, André 15, João Pedro 3) e Solar (Giulio 7, Elnathan 5, Jessica Bellini 3). No Incorporador, só 1 (Rodrigo). Isso parece venda cruzada para outra BU, não R2 com a classificação errada.

## SQL

Base comum (contratos e R2):
```sql
with k as (
 select h.*, coalesce(nullif(lower(trim(h.customer_email)),''),
   'tel:'||right(regexp_replace(coalesce(h.customer_phone,''),'\D','','g'),11)) ck
 from hubla_transactions h
 where h.product_name='A000 - Contrato' and h.sale_status='completed'
   and h.sale_date >= '2026-07-01 03:00' and h.sale_date < '2026-10-01 03:00'),
c as (
 select to_char(k.sale_date at time zone 'America/Sao_Paulo','YYYY-MM') mes, ck, min(sale_date) paid_at,
  array_remove(array_agg(distinct lower(trim(customer_email))),null) emails,
  array_remove(array_agg(distinct nullif(right(regexp_replace(coalesce(customer_phone,''),'\D','','g'),11),'')),null) phones,
  array_remove(array_agg(distinct coalesce(k.linked_deal_id, la.deal_id)),null) deals,
  array_remove(array_agg(distinct coalesce(la.contact_id, d.contact_id)),null)
   || array_remove(array_agg(distinct d2.contact_id),null) contacts
 from k left join meeting_slot_attendees la on la.id=k.linked_attendee_id
 left join crm_deals d on d.id=la.deal_id
 left join crm_deals d2 on d2.id=k.linked_deal_id
 group by 1,2),
r2 as (
 select a.id, s.scheduled_at, a.status, a.deal_id, coalesce(a.contact_id, d.contact_id) contact_id,
  lower(trim(ct.email)) email,
  nullif(right(regexp_replace(coalesce(a.attendee_phone,''),'\D','','g'),11),'') ph1,
  nullif(right(regexp_replace(coalesce(ct.phone,''),'\D','','g'),11),'') ph2
 from meeting_slots s join meeting_slot_attendees a on a.meeting_slot_id=s.id
 left join crm_deals d on d.id=a.deal_id
 left join crm_contacts ct on ct.id=coalesce(a.contact_id,d.contact_id)
 where s.meeting_type='r2' and s.scheduled_at >= '2026-06-15')
```

Casamento (itens 1–4):
```sql
m as (
 select c.mes, c.ck, c.paid_at, 'a_deal' metodo, r.* from c join r2 r
   on r.deal_id = any(c.deals) and r.scheduled_at>=c.paid_at
 union all
 select c.mes, c.ck, c.paid_at, 'b_contato', r.* from c join r2 r
   on r.contact_id = any(c.contacts) and r.scheduled_at>=c.paid_at
 union all
 select c.mes, c.ck, c.paid_at, 'c_email_tel', r.* from c join r2 r
   on (r.email = any(c.emails) or r.ph1 = any(c.phones) or r.ph2 = any(c.phones))
  and r.scheduled_at>=c.paid_at),
last as (select distinct on (mes, ck, metodo) mes, ck, metodo, status, scheduled_at
         from m order by mes, ck, metodo, scheduled_at desc)
-- classificação por status + contagem por mês e por forma de casamento
```

Dias (item 5): `min(scheduled_at - paid_at)` em `m` (chave c), filtrando status in ('completed','contract_paid'), agrupado em até 7, 8–15, 16–30 e mais de 30 dias.

Sem R2 (item 6): `not exists` em `r2` pela chave c. Depois, `exists` em `hubla_transactions` para o produto principal (regex `^(A001|A009|R001|R009)` ou produto do Incorporador acima de R$ 1.000), para A000 `refunded` e para `meeting_slot_attendees.refunded_at is not null`.

Agendas (item 7):
```sql
select coalesce(s.meeting_type,'null'), c.name, c.meeting_type, c.bu, count(*)
from meeting_slots s left join closers c on c.id=s.closer_id
where s.scheduled_at >= '2026-09-01 03:00' and s.scheduled_at < '2026-10-01 03:00'
group by 1,2,3,4;
```

## Pontos de atenção
- "Produto principal acima de R$ 1.000" foi identificado pelo nome (incorporador, anticrise, construtor ou código A0). Pode deixar de fora algum produto com outro nome.
- O reembolso pelas vendas só procura A000 com status `refunded`. Reembolsos feitos fora desse registro só aparecem se estiverem marcados na agenda.
