# Diagnóstico — por que o deal `5d988c40` não aparece em "Trocar o lead desta cota"

Só leitura. Nada foi alterado.

## 1) Onde o modal vive

`src/components/consorcio/CorrigirVinculoCotaModal.tsx`
- título "Trocar o lead desta cota" — linha 131 (aparece quando `trocandoLead = !!item?.dealId`, linha 123)
- rótulo "Leads compatíveis com o titular da cota" — linha 194
- interruptor "Buscar qualquer lead" — linhas 196-205

Hooks: `src/hooks/useCorrigirVinculoCota.ts` (`useCotaTitular`, `useLeadsParaVinculo`, `useR1ConsorcioPorDeal`), chamados nas linhas 53-56 do modal.

## 2) Como a lista é montada

`useLeadsParaVinculo` — `src/hooks/useCorrigirVinculoCota.ts:161-281`.

Modo padrão (interruptor desligado), linhas 196-205:

```ts
if (email)                     orsContato.push(`email.ilike.${email}`);          // e-mail exato do titular
if (telSuffix.length >= 8)     orsContato.push(`phone.ilike.%${telSuffix}%`);    // 9 últimos dígitos
if (nomeTitular) { orsContato.push(`name.ilike.%${t}%`);                          // nome COMPLETO do titular
                   orsDealNome.push(`name.ilike.%${t}%`); }                       // idem contra crm_deals.name
```

Depois:
- busca em `crm_contacts` com `is_archived = false` e `.limit(40)` (linhas 208-213);
- deals desses contatos: `.limit(60)` (linhas 219-225);
- deals cujo **nome do deal** casa: `.limit(60)` (linhas 228-234);
- reforço por CPF/CNPJ (linhas 252-276): só pega deals já vinculados em `consorcio_pending_registrations` com o mesmo CPF/CNPJ, `.limit(20)`. Não busca CPF em `crm_contacts` — a tabela `crm_contacts` **não tem coluna cpf** (confirmado no banco).
- ordenação: `casaTitular` primeiro (linha 278). Sem paginação.

O selo "bate com o titular" (`casaCom`, linhas 242-244) só é verdadeiro por **e-mail exato** ou **telefone (9 dígitos finais)** — nome não conta.

## 3) Por que `5d988c40` fica fora — sua hipótese está correta

Dados reais do deal (SELECT):

| campo | valor |
|---|---|
| deal | `5d988c40…` · nome `"Consórcio "` · `is_archived = false` |
| contato | `06d12b2e…` · nome `"Rodrigo Moreira "` · phone `null` · email `null` · `is_archived = false` |

Confrontando com os três critérios do modo padrão:

- **e-mail**: `email.ilike.rodrigomoreira@harplapecas.com` (o do cadastro, com o domínio digitado errado) — o contato não tem e-mail nenhum. Não casa. E, mesmo se o cadastro tivesse o e-mail certo (`@harpiapecas.com.br`), o contato deste deal continua sem e-mail.
- **telefone**: `phone.ilike.%983647601%` — contato sem telefone. Não casa.
- **nome**: o filtro usa o nome **completo** do titular, `%RODRIGO MOREIRA ROBERTO%`. O contato se chama `"Rodrigo Moreira"` (mais curto) e o deal se chama `"Consórcio"`. `ilike '%RODRIGO MOREIRA ROBERTO%'` não casa com string mais curta. Não casa em nenhuma das duas pontas.
- **CPF**: o reforço só varre `consorcio_pending_registrations` com o mesmo CPF e `deal_id` preenchido — todos os cadastros deste CPF apontam para `a28592fa…`, então esse caminho devolve exatamente o deal errado, nunca o certo.

Ou seja: nada a ver com limite (`limit(40)/(60)`) e nada a ver com arquivamento. O deal é invisível porque o **critério de nome exige o nome completo** e o contato do deal certo é um nome truncado sem telefone/e-mail. É o mesmo motivo pelo qual a varredura por dados do cliente também não o encontrou antes.

Como o único candidato que sobra é `a28592fa…`, ele aparece com "bate com o titular" (casa por telefone `11983647601`) e "sem R1 de consórcio" — exatamente o que você viu.

## 4) O que o "Buscar qualquer lead" faz — e sim, resolve

Ligando o interruptor (`buscaAmpla`, linhas 197-205 do modal): libera o campo livre com placeholder "Nome, e-mail ou telefone (mín. 3 caracteres)" (linhas 210-218) e troca os critérios (hook, linhas 189-195):

```ts
orsContato.push(`name.ilike.%${t}%`, `email.ilike.%${t}%`);  // nome/e-mail do CONTATO
orsDealNome.push(`name.ilike.%${t}%`);                       // nome do DEAL
if (d.length >= 4) orsContato.push(`phone.ilike.%${d}%`);    // telefone, se o termo tiver dígitos
```

A busca casa contra nome do contato, e-mail do contato, telefone do contato **e** nome do deal. A query só roda com termo de 3+ caracteres (linha 175).

**Sim** — digitando `Rodrigo Moreira`, o contato `06d12b2e…` casa por `name ilike '%Rodrigo Moreira%'`, entra no `contactIds` e o deal `5d988c40…` vem pelo caminho "deals desses contatos". Texto a digitar: **`Rodrigo Moreira`** (sem o "Roberto"). `Rodrigo` sozinho também traz, mas com mais ruído. Hoje existem 4 contatos ativos casando com "Rodrigo Moreira", bem abaixo do `limit(40)` — sem risco de o certo ser cortado.

Atenção: na busca ampla, `casaTitular` continua falso para esse deal (contato sem telefone/e-mail), então ele aparecerá **sem** o selo "bate com o titular" — e, por causa do `sort` da linha 278, abaixo do `a28592fa…`. O selo que importa aqui é o de R1.

## 5) O selo "tem R1 de consórcio"

`useR1ConsorcioPorDeal` — `src/hooks/useCorrigirVinculoCota.ts:68-129`. Regra:
- closers com `bu = 'consorcio'` (linhas 78-81);
- attendees dos deals listados, descartando `status` `cancelled` e `invited` e linhas sem `meeting_slot_id` (linhas 86-93);
- slots desses attendees, exige que o `closer_id` pertença à lista de consórcio (linha 109);
- guarda a reunião mais recente e `temAgendador = !!booked_by` (linhas 107-125).

**Sem janela de data e sem LIMIT explícito** — só o teto padrão de 1000 linhas do PostgREST, irrelevante aqui porque o `.in('deal_id', ids)` tem no máximo algumas dezenas de ids. O único filtro que poderia excluir é status `cancelled`/`invited`.

## 6) Conferência no banco (SELECT)

O attendee do deal `5d988c40…`:

- attendee `42391f63-417f-4063-ab8c-fa2390af8798`, `status = completed`
- `booked_by = 411e4b5d-8183-4d6a-b841-88c71d50955f` (Ithaline Clara dos Santos)
- slot em `2026-08-20 16:00:00+00`
- closer `Andre dos Santos Duarte`, `bu = consorcio`

Passa em todos os testes do hook: status não é cancelled/invited, tem `meeting_slot_id`, o closer é da BU Consórcio. Portanto, quando ele aparecer na lista, receberá **"tem R1 de consórcio · 20/08 · Andre dos Santos Duarte"** e **não** cairá no aviso de "reunião sem agendador" (linhas 310-316 do modal), porque `booked_by` está preenchido.

## Resumo em uma linha

O modal está funcionando conforme escrito; o critério padrão de nome é exigente demais (nome completo do titular contra nome do contato/deal), e o lead certo tem contato "esqueleto" — sem telefone, e-mail ou nome completo. O caminho hoje disponível é ligar "Buscar qualquer lead" e digitar `Rodrigo Moreira`.
