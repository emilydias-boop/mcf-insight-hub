# Conciliação: 71/64 vs 91 — agenda BU-Incorporador, R1, setembro/2026

## 1) As duas queries, lado a lado, mesma janela

**Medição 1 reconstruída** (régua da tabela de Closers, lista de status + `HAVING bool_or`):

```sql
with pares as (
  select ms.closer_id, msa.deal_id,
         bool_or(msa.status in ('completed','contract_paid','refunded')) realizada
  from meeting_slots ms
  join meeting_slot_attendees msa on msa.meeting_slot_id = ms.id
  join closers c on c.id = ms.closer_id
  where c.bu='incorporador' and ms.meeting_type='r1'
    and coalesce(msa.is_partner,false)=false
    and coalesce(ms.status,'') not in ('cancelled','canceled','cancelada')
    and msa.status in ('scheduled','invited','completed','no_show',
                       'contract_paid','refunded','rescheduled')
    and (ms.scheduled_at at time zone 'America/Sao_Paulo')::date
        between '2026-09-01' and '2026-09-30'
  group by 1,2
  having bool_or(msa.status in ('completed','contract_paid','refunded'))
)
select count(*) total_pares, ... from pares p left join crm_deals d on d.id = p.deal_id;
```

Resultado: **total 103 pares — A=91, B=11, C=1, sem segmento=0.**

**Medição 2** (filtro de status direto no WHERE, attendee não cancelado, `deal_id not null`, `join crm_deals`): **A = 91 deals e 91 pares**, composição `completed` 61 + `contract_paid` 30 + `refunded` 0.

As duas concordam: 91. O que não se reproduz é o **71 / A=64** relatado na auditoria anterior.

## 2) Qual cláusula faz a diferença

Testei as quatro suspeitas e nenhuma leva a 71:

- (a) lista de status + `HAVING bool_or` vs filtro no WHERE — **não muda nada**: 103 pares dos quais A=91 nas duas formas. O `HAVING` só descarta pares sem nenhuma linha realizada, que já sairiam pelo WHERE.
- (b) deals com múltiplos attendees — **não interfere**: no mês, deals distintos realizados (91) = pares (closer, deal) realizados (91). Nenhum deal com dois closers, nenhum deal contado duas vezes.
- (c) `JOIN` vs `LEFT JOIN` em `crm_deals`/`closers` — **não interfere**: `sem_segmento = 0`, ou seja, todo attendee realizado tem deal com segmento preenchido; nenhuma linha é derrubada nem multiplicada pelo tipo de join.
- (d) filtro de origem ou de booker — a origem não corta nada (100% em PIPELINE INSIDE SALES); o recorte de SDR elegível corta 3 deals (91 → 88). Nada disso chega a 71.

Outras variações que testei e também não produzem 71: closer inativo (`closers.is_active`) → 103/91; eixo de data em UTC em vez de America/Sao_Paulo → 103/91; corte até 03/09 → 103/91 (nada realizado depois de 03/09 ainda).

A única variação que muda o número de forma relevante é **incluir ou não `contract_paid`**: só `completed` dá 66 pares totais e A=61.

Conclusão da conciliação: o **71 / A=64 não é reproduzível** com nenhuma combinação das cláusulas descritas. Ele veio de um recorte adicional que ficou implícito na auditoria anterior — muito provavelmente os filtros próprios da tela de Closers (seleção de closers exibidos, período/eixo da tela, ou exclusão de algum status), não do universo da agenda. Não é uma leitura do mesmo universo, e por isso não deve ser usado como referência.

## 3) Leitura correta e números confiáveis

Correta: **Medição 2**. Universo: `meeting_slots` + `meeting_slot_attendees`, `closers.bu='incorporador'`, `ms.meeting_type='r1'`, `is_partner=false`, `deal_id not null`, slot e attendee fora de cancelled/canceled/cancelada, eixo `(scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date` em 01–30/09/2026.

- (i) só `completed`, Lead A: **61**
- (ii) `completed`+`contract_paid`+`refunded`, Lead A: **91** (61 + 30 + 0)

## 4) Os quatro números

| Régua de segmento | Só `completed` | `completed`+`contract_paid`+`refunded` |
| --- | --- | --- |
| `crm_deals.icp_segment` = 'A' (atual) | 61 | 91 |
| `meeting_slots.lead_type` = 'A' (snapshot) | 66 | 103 |

## 5) `meeting_slots.lead_type` NÃO serve como snapshot de ICP

O trigger é este, e ele só escreve quando o campo chega nulo — nunca reescreve:

```sql
create or replace function public.trg_meeting_slot_herda_segmento()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_seg text;
begin
  if new.lead_type is not null then return new; end if;
  if new.deal_id is not null then
    select icp_segment into v_seg from public.crm_deals where id = new.deal_id;
    if v_seg in ('A','B','C') then new.lead_type := v_seg; end if;
  end if;
  return new;
end; $$
```

Imutável depois de gravado: sim. Mas o dado é inutilizável como segmento, e a evidência é forte:

- Nos 100 slots r1 do BU-Incorporador em setembro: `lead_type` nulo = **0**, e **todos os 100 são 'A'** — nenhum B, nenhum C. Isso não é plausível como distribuição de ICP.
- Na tabela inteira: A = 6.064, nulo = 2.482, B = 86, C = 1.
- Ou seja, o valor 'A' está sendo gravado pelo aplicativo na criação do slot (o trigger só age quando vem nulo), então `lead_type` funciona como um "tipo de lead" default da agenda, não como cópia do ICP.

Consequência prática: os 103 / 66 da linha `lead_type` acima são efetivamente "todos os realizados", não "Lead A". O snapshot de ICP que eu apontei antes como candidato **não existe de fato** — e continua valendo o alerta de que `crm_deals.icp_segment` é mutável (trigger `trg_classify_lead_icp_segment` reclassifica quando renda/finalidade mudam) e sem tabela de histórico, então o KPI hoje não é reprodutível mês a mês. Isso precisa ser resolvido antes de virar remuneração — mas não vou propor implementação agora, como pedido.

## Nada foi alterado

Somente SELECT. Nenhuma escrita, migration ou deploy. Não registrei a tarefa em `roadmap.md` porque em modo plano só edito o arquivo do plano.
