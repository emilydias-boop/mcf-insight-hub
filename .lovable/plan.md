

## Diagnóstico

**Jessé De Sousa Pires** (`jesse.piresjr@gmail.com`) tem:
- **4 contatos duplicados** no sistema (mesmo email/telefone)
- **2 deals na Pipeline Inside Sales**: um em "Venda Realizada" (correto, Jan 31) e outro em "Contrato Pago" (duplicado, Feb 21)
- Ela comprou **A009** em 25/02 (é parceira), mas o deal duplicado foi criado em 21/02, antes de virar parceira — por isso o `checkIfPartner` não bloqueou

**Causa raiz**: Em 21/02, o Clint enviou webhooks com um `deal_id` diferente do original. Dois webhooks chegaram com 4 segundos de diferença, causando uma **race condition** na deduplicação de contatos — ambos criaram contatos novos em vez de encontrar o existente.

## Plano de Correção

### 1. Limpeza de dados da Jessé (imediata)
- Mover os deals do contato duplicado (`0412cb88`) para o contato principal (`af97f5e6`)
- Deletar o deal duplicado em "Contrato Pago" (`d7ad3ea4`) — a jornada real já está no deal original em "Venda Realizada"
- Deletar os 3 contatos duplicados, mantendo apenas o original (`af97f5e6`)

### 2. Proteção contra race condition no webhook (preventivo)
No `clint-webhook-handler`, na busca de contato por email (seção 2.1), adicionar um **`SELECT ... FOR UPDATE`** ou usar **upsert com `ON CONFLICT`** ao criar contatos para evitar que dois webhooks simultâneos criem contatos duplicados para o mesmo email.

Mudança no `clint-webhook-handler/index.ts` (linhas ~1076-1090):
- Antes de criar um contato novo, fazer uma segunda verificação por email (double-check)
- Usar `upsert` com `onConflict: 'email'` em vez de `insert` puro

### 3. Resultado
- Jessé aparecerá apenas uma vez no Kanban, com o deal correto em "Venda Realizada"
- Futuros webhooks simultâneos não criarão contatos duplicados

