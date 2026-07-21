## Objetivo
Disparar webhook para Make (`https://hook.us1.make.com/pk492b4dfi83s1u4k566i98mg34k8xto`) sempre que uma carta de consórcio for cadastrada e migrada para o painel **Concluídas - Operacional** (ou seja, quando `useOpenCota` conclui com sucesso e o status do pending vai para `cota_aberta`).

## Onde disparar
No fluxo `useOpenCota` (`src/hooks/useConsorcioPendingRegistrations.ts`), logo após o passo 7 (proposta atualizada com `consortium_card_id`) e antes do `return card`. Esse é o exato ponto em que a carta aparece em "Concluídas - Operacional".

## Como disparar
Criar edge function `consorcio-carta-cadastrada-webhook` (fire-and-forget, sem `verify_jwt`) que:
1. Recebe `{ card_id, registration_id, proposal_id }`.
2. Busca dados agregados no Supabase (card + registration + proposal).
3. Faz `POST` ao Make com o payload abaixo.
4. Retorna 200 rápido; erros são logados mas não bloqueiam o UI.

A chamada do frontend usa `supabase.functions.invoke(...)` dentro de `try/catch` silencioso para não travar o toast de sucesso.

## Payload enviado ao Make
```json
{
  "event": "consorcio.carta.cadastrada",
  "occurred_at": "2026-07-21T...Z",
  "lead": {
    "nome_completo": "...",
    "email": "...",
    "telefone": "...",
    "cpf": "...",
    "tipo_pessoa": "pf|pj",
    "razao_social": "...",
    "cnpj": "..."
  },
  "carta": {
    "card_id": "...",
    "valor_credito": 150000,
    "tipo_produto": "imovel|auto|servico|...",
    "produto_codigo": "...",
    "categoria": "...",
    "grupo": "...",
    "cota": "...",
    "prazo_meses": 200,
    "data_contratacao": "YYYY-MM-DD",
    "dia_vencimento": 10,
    "condicao_pagamento": "...",
    "inclui_seguro": true,
    "vendedor_name": "...",
    "origem": "...",
    "e_transferencia": false
  },
  "proposta": {
    "proposal_id": "...",
    "valor_proposto": 0,
    "observacoes": "...",
    "created_at": "..."
    /* + demais campos relevantes de consorcio_proposals */
  }
}
```

## Passos técnicos
1. Criar `supabase/functions/consorcio-carta-cadastrada-webhook/index.ts` com CORS, validação Zod do body, busca dos 3 registros e `fetch` para o Make (timeout 10s). Registra em `console.log` em caso de falha.
2. Editar `useOpenCota` para invocar a função após sucesso, sem `await` bloqueante do toast (usando `.catch` silencioso).
3. Testar via `curl_edge_functions` chamando com um `registration_id` real recém-cadastrado para confirmar chegada no Make.

## Fora de escopo
- Não altero a UI, o botão, nem o fluxo de abertura de cota.
- Não crio tabela de logs dedicada (uso apenas `console.log` da edge function — logs ficam no Supabase). Se quiser rastreio persistente depois, dá para reaproveitar `outbound_webhook_logs`.
