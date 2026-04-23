

## Ajuste: criar lead no CRM apenas no `invoice.payment_succeeded`

### Por que isso resolve a duplicação

Hoje a Hubla dispara dois eventos para cada venda:

| Evento | O que significa | Hoje cria lead no CRM? |
|---|---|---|
| `NewSale` | Pedido criado (PIX/boleto gerado, intenção de pagamento) | ✅ Sim |
| `invoice.payment_succeeded` | Pagamento confirmado | ✅ Sim |

Os dois chegam quase ao mesmo tempo no caso de PIX/cartão à vista (A010). Como `crm_contacts` não tem trava de identidade, as duas execuções rodam em paralelo, cada uma cria um contato e um deal — exatamente o que aconteceu com a Stéphanne.

**Sua proposta está certa**: como o que importa para o CRM é a venda confirmada, basta que apenas `invoice.payment_succeeded` crie o lead. `NewSale` continua existindo, mas só atualiza `hubla_transactions` (para billing/dashboard ainda enxergarem a tentativa).

### Pequena ressalva sobre semântica

`NewSale` na Hubla não é estritamente "intenção" — é "venda registrada" (boleto/PIX gerado). Para A010 isso vira pagamento confirmado em segundos, então o impacto de esperar o `invoice.payment_succeeded` é mínimo. Para boletos, isso pode atrasar a entrada do lead no CRM em horas/dias, mas ganhamos:

- Zero leads-fantasma de boletos não pagos
- Zero duplicação por race condition
- Source of truth única: lead no CRM = pagamento confirmado

### Mudanças

**1. `supabase/functions/hubla-webhook-handler/index.ts` — bloco `NewSale`**

Manter:
- Upsert em `hubla_transactions` (linha 1911-1913)
- `syncBillingFromTransaction` (linha 1918) — billing precisa enxergar a venda mesmo sem pagamento confirmado

Remover do bloco `NewSale`:
- `a010_sales` upsert (linhas 1934-1944)
- `createOrUpdateCRMContact` para A010 (linhas 1947-1954)
- `createDealForConsorcioProduct` para Consórcio (linhas 1958-1969)

**2. Bloco `invoice.payment_succeeded`**

Continua igual — já é onde se cria contato/deal A010 e Consórcio. Nenhuma mudança.

**3. Logs**

Adicionar log claro em `NewSale`:
```
[CRM] NewSale recebido — lead será criado quando invoice.payment_succeeded chegar
```

### Comportamento resultante

| Cenário | Antes | Depois |
|---|---|---|
| PIX A010 pago | 2 contatos + 2 deals (race) | 1 contato + 1 deal |
| Boleto A010 não pago | 1 lead "fantasma" no CRM | Nenhum lead até pagar |
| Boleto A010 pago em 3 dias | Lead criado no dia da emissão, depois redundante | Lead criado no dia do pagamento |
| Refund antes de pagar | Lead órfão | Nenhum lead criado |

### Pergunta antes de implementar

Para boletos não pagos, hoje você quer enxergar esses leads no CRM (mesmo sem pagamento) para alguém da operação fazer cobrança? Se sim, manter `NewSale` criando lead com tag `aguardando_pagamento` é uma alternativa — mas aí precisa adicionar a constraint única em `crm_contacts` (do plano anterior) para não duplicar quando o `invoice.payment_succeeded` chegar.

Se a resposta for "não preciso ver boletos não pagos no CRM", a mudança proposta acima já resolve a duplicação sem precisar mexer em constraints de banco.

### Validação

1. Simular `NewSale` A010 da Stéphanne sem `invoice.payment_succeeded` → nenhum lead criado, transação registrada.
2. Simular `NewSale` + `invoice.payment_succeeded` em sequência → 1 lead, 1 deal.
3. Refund após `NewSale` (sem pagamento) → nenhum lead órfão para limpar.
4. Consórcio com 12 parcelas: `invoice.payment_succeeded` da parcela 1 cria deal; demais parcelas só atualizam billing (já é o comportamento atual).

### Arquivos afetados

- `supabase/functions/hubla-webhook-handler/index.ts` — remover criação de contato/deal/a010_sales do bloco `NewSale`.

