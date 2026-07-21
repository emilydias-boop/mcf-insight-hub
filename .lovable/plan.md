# Webhook "Carta Cadastrada" — cobertura completa

## Problema
A carta chega em **Concluídas - Operacional** por 2 caminhos, mas o webhook Make (`consorcio-carta-cadastrada-webhook`) só é disparado em um deles:

- ✅ `useOpenCota` (Abrir Cota no modal de Cadastros Pendentes) → dispara
- ❌ `useLinkPendingToCard` (vincular pendente a card existente) → não dispara
- ❌ `useMarkPendingAsCadastrada` / transição derivada `cadastro_completo` → não dispara

Resultado: cartas que chegam por caminhos alternativos aparecem na aba **Concluídas - Operacional** sem que o Make receba os dados.

## Mudanças

### 1. Idempotência no banco
Migration adicionando coluna em `consorcio_pending_registrations`:
- `webhook_carta_cadastrada_enviado_em timestamptz` (null = ainda não enviado)

Evita disparo duplicado quando a mesma carta passa por mais de um caminho.

### 2. Helper compartilhado
Novo `src/lib/consorcioCartaWebhook.ts` com `dispatchCartaCadastradaWebhook(cardId, pendingId)`:
- Verifica se `webhook_carta_cadastrada_enviado_em` está nulo
- Invoca a edge function `consorcio-carta-cadastrada-webhook`
- Em sucesso, marca `webhook_carta_cadastrada_enviado_em = now()`
- Sempre em background (não bloqueia a UI, não quebra o fluxo em caso de erro)

### 3. Integrar helper nos 3 caminhos
Em `src/hooks/useConsorcioPendingRegistrations.ts`:
- `useOpenCota` — substituir invocação atual pelo helper
- `useLinkPendingToCard` — adicionar chamada após vincular com sucesso
- `useMarkPendingAsCadastrada` — adicionar chamada após marcar como cadastrada

### 4. Botão "Reenviar webhook" (backfill manual)
Em `src/components/consorcio/PendingRegistrationsList.tsx`, aba **Concluídas - Operacional**:
- Botão discreto por linha "Reenviar webhook" (ícone Send)
- Chama o helper ignorando a flag de idempotência (parâmetro `force: true`)
- Toast indicando sucesso/erro
- Permite recuperar as cartas que já passaram sem disparar

## Detalhes técnicos

- A edge function existente não muda — continua recebendo `cardId` e montando o payload (lead, valor da carta, tipo de produto, detalhes da proposta).
- `force: true` no helper pula apenas a checagem da flag, mas ainda atualiza o timestamp após envio bem-sucedido.
- Nenhuma mudança na UI da aba de Cadastros Pendentes (fluxo permanece igual do lado do operacional).
