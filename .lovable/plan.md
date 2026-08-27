# Diagnóstico — Laercio linhares de Albuquerque (termo saiu 1,2,3,4)

## Q1 — estado dos 6 cadastros (cru)

Todos os 6 idênticos, um por carta (ordem 1..6):

```
id                                   | status               | consortium_card_id | parcelas_mcf_numeros | tipo_contrato | parcelas_pagas_empresa | empresa_paga_parcelas | tipo_produto | parcela_1a_12a | parcela_demais | prazo | carta.parcelas_mcf | ordem
40dc62dc-4dd8-416a-9874-31260cdc8878 | aguardando_abertura  | NULL               | NULL                 | normal        | 4                      | sim                   | select       | 3443.75        | 443.75         | 240   | {2,3,5,7}          | 1
1e9596f8-5e28-4397-b85a-8d7da9b25c3a | aguardando_abertura  | NULL               | NULL                 | normal        | 4                      | sim                   | select       | 3443.75        | 443.75         | 240   | {2,3,5,7}          | 2
85faeefa-c7ac-4ae5-934a-455ef1e314b7 | aguardando_abertura  | NULL               | NULL                 | normal        | 4                      | sim                   | select       | 3443.75        | 443.75         | 240   | {2,3,5,7}          | 3
b5be597c-fa23-4c7c-b523-34a829c547f1 | aguardando_abertura  | NULL               | NULL                 | normal        | 4                      | sim                   | select       | 3443.75        | 443.75         | 240   | {2,3,5,7}          | 4
1a110945-7144-49e1-8d38-7ba3025aaf56 | aguardando_abertura  | NULL               | NULL                 | normal        | 4                      | sim                   | select       | 3443.75        | 443.75         | 240   | {2,3,5,7}          | 5
5b8db771-ccf7-4b8c-be18-55408868e481 | aguardando_abertura  | NULL               | NULL                 | normal        | 4                      | sim                   | select       | 3443.75        | 443.75         | 240   | {2,3,5,7}          | 6
```

- `consortium_card_id`: **NULL nos 6** (nenhuma cota aberta).
- `parcelas_mcf_numeros`: **NULL nos 6**. A carta tem `{2,3,5,7}` — a lista morre na carta e não chegou ao cadastro.
- Por isso o termo derivou do par legado (`normal` + `4`) → parcelas 1,2,3,4.

## Q2 — cronograma

```
(0 linhas)
```

Nenhuma cota, nenhuma parcela em `consortium_installments`.

## Q3 — o termo novo

```
id                                   | created_at                     | status    | modelo_versao | tipo   | pending_registration_id              | proposal_id                          | card_id
8ae0bb89-f45a-4067-833f-aa54a0f5001c | 2026-08-27 15:56:45.655815+00  | pendente  | 4             | adesao | 40dc62dc-4dd8-416a-9874-31260cdc8878 | 9d8165a9-32d6-4261-9fcb-650efd8b1097 | NULL
c57bdd1d-8ba5-4d3c-99e7-550bf82778ca | 2026-08-27 15:32:15.846748+00  | cancelado | 4             | adesao | 40dc62dc-4dd8-416a-9874-31260cdc8878 | 9d8165a9-32d6-4261-9fcb-650efd8b1097 | NULL
```

O documento foi alimentado pelo **cadastro pendente** `40dc62dc…` (ordem 1), não pela carta:
`src/lib/consorcioTermo.ts:109` → `parcelas_numeros: reg.parcelas_mcf_numeros ?? null`. Como esse campo está NULL, cai no fallback tipo+quantidade → 1,2,3,4 → R$ 28.650,00.

## Q4 — a trava

`src/hooks/useConsorcioPostMeeting.ts:1337-1340`

```ts
if (reg && (reg as any).consortium_card_id && parcelasMudaram) {
  parcelasBloqueadasPorCotaAberta.push(ordem);
}
if (reg && !(reg as any).consortium_card_id) {
```

A propagação só acontece quando `consortium_card_id` é NULL. Neste caso **é NULL nos 6**, logo a trava **não barra** — o `UPDATE` das linhas 1375-1390 grava `parcelas_mcf_numeros = {2,3,5,7}` e os derivados.

Condição adicional para o loop rodar: `atuais.find(x => x.id === c.id)?.pending_registration_id` (linha 1324-1325) — os 6 cadastros estão vinculados às cartas, então cai dentro. E o `UPDATE` só dispara se houver diff — `parcelasMudaram` é true (`{}` vs `{2,3,5,7}`), então dispara.

## Respostas

(a) **Não** — nenhuma das 6 cotas está aberta (`consortium_card_id` NULL nos 6).
(b) **Não** — zero linhas em `consortium_installments`; nenhum cronograma gerado.
(c) **A edição de proposta resolve.** A trava exige `consortium_card_id` preenchido; aqui é NULL, então a correção publicada propaga `{2,3,5,7}` para os 6 cadastros. Passo prático: abrir o `EditProposalModal` da proposta `9d8165a9…`, salvar sem mudar nada (o diff de parcelas dispara sozinho), conferir que `parcelas_mcf_numeros` ficou `{2,3,5,7}`, cancelar o termo `8ae0bb89…` e gerar de novo.
(d) Caso a edição de proposta falhe, as duas telas que hoje gravam a lista nesses registros são: **OpenCotaModal** (`src/components/consorcio/OpenCotaModal.tsx:78-89` e `638-648`, grava direto no cadastro pendente pela grade de parcelas) e, depois da cota aberta, o **ConsorcioCardForm** em Controle Consórcio (`src/components/consorcio/ConsorcioCardForm.tsx:1122`). Nenhuma delas foi usada aqui — por isso a lista nunca chegou.

## Nada foi alterado
Somente leitura: 3 SELECTs e leitura de código. Sem UPDATE, migration ou backfill.
