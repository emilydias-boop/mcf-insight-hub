# A reunião do Rodrigo existe. O dono está certo.

Só SELECT. Nada alterado.

## Achado central

Existe uma R1 de consórcio do Rodrigo, conduzida pelo André, e ela está presa a **outro negócio**:

| campo | valor |
|---|---|
| data | 2026-08-20 16:00 UTC |
| closer | Andre dos Santos Duarte (`closers.id` 1472d772…, bu `consorcio`, ativo, `meeting_type` r1) |
| attendee | "Rodrigo Moreira " — status `completed` |
| agendado por (`booked_by`) | ithaline clara dos santos (411e4b5d…), `booked_at` 2026-08-20 13:02 |
| observação do agendamento | "Led parceiro antigo / Disparo recente" |
| deal do attendee | `5d988c40-a6a0-41b4-93f3-8878d5a8f9e6`, nome "Consórcio ", origem Efeito Alavanca + Clube, dono andre.duarte, estágio **R1 Realizada** |
| contato do attendee | `06d12b2e…` "Rodrigo Moreira " — **sem telefone e sem e-mail** |

Foi por isso que a busca anterior não achou: o contato da reunião é um registro genérico ("Consórcio "), criado no disparo, sem telefone, sem e-mail e sem CPF, e com o sobrenome cortado ("Rodrigo Moreira", não "Rodrigo Moreira Roberto"). Nenhum critério de identidade tinha como casar.

Cronologia que fecha o caso: reunião marcada 20/08 13:02, realizada 20/08 16:00, e as **7 cotas nasceram 20/08 19:11** (origem `reverter`), no mesmo dia, poucas horas depois.

## 1) Negócios do Rodrigo

Existem exatamente dois negócios que casam por identidade — e o certo é um terceiro, que só casa por nome parcial:

| deal | nome | origem | estágio hoje | dono | attendees | contato (tel / e-mail) |
|---|---|---|---|---|---|---|
| `a28592fa…` | Rodrigo Moreira Roberto | 00 - GERENTES DE RELACIONAMENTO | **Em contato** | william.ferreira | **0** | 11983647601 / rodrigomoreira@**harpiapecas.com.br** |
| `5d988c40…` | Consórcio | Efeito Alavanca + Clube | **R1 Realizada** | andre.duarte | **1 (completed, com André)** | sem telefone / sem e-mail |
| `6c55d1a4…` | Rodrigo Cézare Moreira Araujo | Inside Sales Viver de Aluguel | CONTRATO PAGO | thayna.tavares | 0 | outra pessoa |

Correção de um dado da rodada anterior: o e-mail é `@harpiapecas.com.br` (harpia), não `@harplapecas.com`. Buscar por "Harpla" não retorna nada por isso.

As 9 linhas de `consorcio_pending_registrations` do Rodrigo (8 cotas de R$ 120.000 + 1 sem deal) estão todas apontando para `a28592fa…` — o negócio **sem reunião**. Nenhuma aponta para `5d988c40…`, o negócio **com a R1**.

## 2) O estágio conta uma história — mas não a que se esperava

`a28592fa…` está em **"Em contato"** hoje, com 0 attendees. Não é estágio pós-reunião, então esse negócio isolado não prova reunião nenhuma.

A única trilha de estágio existente (`deal_activities`, 1 linha) é de 2026-03-16 14:24: automação `move-partners-to-venda-realizada` moveu de "Em contato" para "Venda Realizada" por detectar parceiro. Hoje está de volta em "Em contato" e **não há registro de quem trouxe de volta** — não existe tabela de histórico de estágio completa nesta base (só `deal_activities`, `attendee_movement_logs`, `audit_logs`). Não determinei quem fez o retorno.

A prova da reunião não vem do estágio de `a28592fa…`; vem do attendee `completed` em `5d988c40…`.

## 3) O lado do André

Andre dos Santos Duarte existe em `closers`: `1472d772-a48b-4c88-ba07-398898532df4`, bu `consorcio`, ativo, r1. Em julho e agosto de 2026 tem **275 attendees**, todos com `booked_by` preenchido (zero nulos).

Com "Rodrigo" no nome, nesse período, aparecem três:

| data | attendee | status | agendado por | deal |
|---|---|---|---|---|
| 2026-07-03 18:00 | Rodrigo Costa | completed | ithaline clara | Rodrigo Costa (outra pessoa) |
| **2026-08-20 16:00** | **Rodrigo Moreira** | **completed** | **ithaline clara** | **Consórcio (`5d988c40…`)** |
| 2026-08-27 16:00 | Evandro Rodrigo da Silva Gomes | invited | Cleiton Anacleto | outra pessoa |

Ninguém com e-mail contendo "harp" — coerente com o contato da reunião não ter e-mail.

## 4) Quando o closer marca a própria reunião, o que fica em `booked_by`

Fica o **perfil de quem está logado**, sempre. Dois pontos gravam:

- `src/hooks/useCloserScheduling.ts:200` — cria o `meeting_slot` com `booked_by: user.id`.
- `src/hooks/useAgendaData.ts:1741` — insere attendee com `booked_by: currentUserId` (usuário logado).

Nunca é nulo por esse caminho. Logo, se um closer agenda para si, ele aparece como agendador. Isso acontece na prática: João Pedro Martins Vieira tem 14 reuniões entre julho e agosto em que é simultaneamente closer e `booked_by`.

## 5) Contraprova

**Zero.** Não existe nenhum attendee em agosto/2026 com `booked_by` = perfil do André (`1cb9287f…`). O padrão "closer agenda para si" existe na base, mas o André não o usa. As reuniões dele vêm de SDR — Ithaline, Cleiton, Ygor.

## Conclusão

Não é caso de "reconhecer fora do funil". A R1 existe, é de consórcio, é do André, e o agendador é a **Ithaline Clara dos Santos**. O que está errado é o vínculo: as 8 cotas estão penduradas no deal de Gerente de Relacionamento (`a28592fa…`, sem reunião) em vez do deal da reunião (`5d988c40…`).

Desfecho correto, quando o dono autorizar: trocar o vínculo das cotas do Rodrigo para `5d988c40-a6a0-41b4-93f3-8878d5a8f9e6`, o que credita a Ithaline como agendadora e tira as 8 cotas (R$ 960.000) do alerta. As 2 cotas da Rosangela continuam em aberto — nada novo nesta rodada sobre elas.

Efeito colateral a decidir junto: o deal da reunião é um "Consórcio " genérico, com contato sem telefone/e-mail. Vale renomear o contato para o nome completo e preencher telefone/e-mail para que buscas futuras encontrem — mas isso é UPDATE e não foi feito.
