

# Corrigir Automacao "Venda Realizada" - Busca Direta por Email/Telefone

## Problema

A funcao `autoMarkSaleComplete` (presente nos webhooks `webhook-make-parceria` e `asaas-webhook-handler`) nao esta encontrando a maioria dos leads porque:

1. Busca TODOS os attendees R2 aprovados com `.limit(50)`, mas existem **249 aprovados** no banco
2. Itera um por um fazendo query individual ao deal/contact de cada attendee (N+1 queries)
3. Se o lead comprador nao esta nos primeiros 50 retornados, nunca e encontrado

**Resultado real**: De ~20 vendas na semana 31/01-06/02, a maioria ficou com `carrinho_status = null` e o deal permaneceu em "R2 Realizada" ou "Contrato Pago" ao inves de ir para "Venda Realizada".

Exemplos verificados no banco:
- Theidy yoshie gomes Saito: carrinho_status null, deal em "Reuniao 02 Realizada"
- Pedro Henrique Campos dos Santos: carrinho_status null, deal em "Contrato Pago"
- Jose de sa Izaias: carrinho_status null, deal em "Contrato Pago"

## Solucao

Reescrever a funcao `autoMarkSaleComplete` para buscar **diretamente** pelo email/telefone do comprador, ao inves de buscar todos os aprovados e iterar. Isso:

- Elimina o `.limit(50)` que causa o bug
- Reduz de ~50 queries para 3-4 queries
- Garante 100% de match independentemente da quantidade de aprovados

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/webhook-make-parceria/index.ts` | Reescrever autoMarkSaleComplete com busca direta |
| `supabase/functions/asaas-webhook-handler/index.ts` | Mesma correcao (funcao duplicada) |

## Secao Tecnica

### Nova logica da funcao `autoMarkSaleComplete`

Substituir os passos 2 e 3 da funcao atual (buscar todos os 50 attendees e iterar com N+1 queries) por uma busca direta:

```text
ANTES (quebrado):
  1. Buscar ID do status "Aprovado"
  2. Buscar 50 attendees R2 aprovados (SEM filtro de email)   <-- GARGALO
  3. Loop em cada attendee, fazendo query ao deal/contact     <-- N+1 queries
  4. Se encontrar match por email/phone, continua

DEPOIS (corrigido):
  1. Buscar ID do status "Aprovado"
  2. Buscar contact pelo email diretamente na crm_contacts
  3. Se nao encontrar por email, tentar por telefone
  4. Buscar deal do contact com attendee R2 aprovado vinculado
  5. Se encontrar, mover para "Venda Realizada"
```

### Estrategia de busca em 2 fases

**Fase 1 - Busca por email** (mais precisa):
- Query na `crm_contacts` com `email.ilike` para encontrar o contact
- JOIN com `crm_deals` para pegar o deal
- JOIN com `meeting_slot_attendees` filtrando por R2 aprovado e deal_id
- Inclui dados do closer via JOIN com `meeting_slots` e `closers`

**Fase 2 - Fallback por telefone** (se email nao encontrar):
- Normalizar telefone (ultimos 9-11 digitos)
- Mesma query mas filtrando por sufixo do telefone na `crm_contacts` ou `attendee_phone`

### O que nao muda

- Os passos 4 a 8 (mover deal, marcar attendee, logar atividade, notificar closer) permanecem identicos
- A logica de "so mover se for parceria" permanece (ja esta no caller dos webhooks)
- O fluxo geral do webhook permanece igual

### Deploy

Apos a correcao, ambas as edge functions serao redeployadas para aplicar a mudanca imediatamente em novas vendas.

