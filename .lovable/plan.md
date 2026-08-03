# Causa do duplicado "Compra Direta" em Relatórios > Contratos

## O que foi confirmado no banco

Os dois pagamentos citados estão vinculados a deals, mas continuam **sem** `linked_attendee_id`:

| Pagamento | linked_deal_id | linked_attendee_id |
|---|---|---|
| Lucas Gomes (025a16e0…) | 16464855… | null |
| Ruydney Brumana (b0a260fb…) | 868299fe… | null |

Ambos os deals já têm attendee com `status = 'contract_paid'` e `contract_paid_at` de 03/08 — ou seja, a linha "normal" do relatório existe e está correta.

Em agosto: 8 transações `product_category = 'contrato'` sem `linked_attendee_id`, sendo 5 delas já com `linked_deal_id` preenchido.

## Causa exata

A tela é `src/components/relatorios/ContractReportPanel.tsx`, alimentada por `src/hooks/useContractReport.ts`.

Além da consulta principal em `meeting_slot_attendees`, o hook faz uma segunda consulta "solta":

```text
.from('hubla_transactions')
.eq('product_category', 'contrato')
.is('linked_attendee_id', null)     <-- aqui
```

Cada linha retornada vira uma linha com `closerName: 'Compra Direta'`, `originName: 'Compra Direta'`, `currentStage: 'N/A'`, `sdrName: 'N/A'`.

O filtro é por **`linked_attendee_id`**, não por `linked_deal_id`. A correção no banco preencheu apenas `linked_deal_id`, então essas transações continuam sendo tratadas como "não vinculadas" e continuam gerando a segunda linha duplicada. Não é cache do React Query nem range de datas — é o campo errado na condição.

Detalhes secundários:

- A tela chama `useContractReport(filters, allowedCloserIds)` **sem** passar `bu`. Com `bu` preenchido o hook já descartaria as linhas "Compra Direta" (`buOriginIds ? meetingRows : [...]`).
- O outro caminho de duplicidade do painel (`useHublaA000Contracts` → `hublaPending`, closer "Sem atribuição") não afeta estes casos: aquele hook filtra `sale_status = 'paid'` e os registros MCF Pay estão `completed`. Isso também explica por que a coluna **Valor** fica vazia na linha da Agenda (`netValue: null`).
- Há `staleTime` de 10 min + `placeholderData`, mas isso só atrasaria a atualização; não explica o sintoma após reload.

## Correção proposta (para aprovar)

1. Em `useContractReport.ts`, considerar vinculada a transação com **`linked_attendee_id` OU `linked_deal_id`**: exigir ambos nulos (`.is('linked_attendee_id', null).is('linked_deal_id', null)`) na consulta de não vinculadas.
2. Reforço: descartar da lista de não vinculadas qualquer transação cujo `linked_deal_id` já apareça entre os deals das linhas de agenda do período.
3. Passar `bu` para `useContractReport` no `ContractReportPanel`, para o relatório da BU respeitar o escopo de pipelines.
4. Opcional (confirmar): preencher a coluna **Valor** das linhas de agenda com o `net_value` do pagamento vinculado, em vez de deixar vazio.

Nada foi alterado até aqui.