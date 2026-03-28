

## Fix: Parceria deveria mover deal para "Venda Realizada" mesmo sem R2 Aprovado

### Problema
O `webhook-make-parceria` exige que exista um attendee R2 com status "Aprovado" para mover o deal para "Venda Realizada". Se o lead comprou Parceria mas não passou por R2 (ou não foi marcado como Aprovado), o deal fica travado em "Contrato Pago".

### Proposta
Adicionar um **fallback** no `webhook-make-parceria`: se não encontrar attendee R2 aprovado, buscar o deal diretamente pelo email/telefone do comprador e mover para "Venda Realizada" mesmo assim (já que a compra de Parceria é prova suficiente de venda).

### Alteração

**`supabase/functions/webhook-make-parceria/index.ts`** — na função `autoMarkSaleComplete`:

1. Manter a lógica atual (busca R2 aprovado por email → telefone)
2. **Adicionar fallback**: se `!matchedAttendee`, buscar deal diretamente:
   - Query `crm_contacts` por email/telefone → `crm_deals` → pegar deal mais avançado
   - Se deal está em "Contrato Pago" ou similar, mover para "Venda Realizada"
   - Registrar `deal_activity` com descrição "Parceria comprada — movido automaticamente (sem R2)"
3. Logar claramente quando o fallback é usado vs quando o fluxo R2 normal funciona

### Resultado
- Mauro e leads similares seriam automaticamente movidos para "Venda Realizada" ao comprar Parceria
- Leads com R2 aprovado continuam usando o fluxo atual (com atualização de `carrinho_status`)
- Leads sem R2 usam o fallback direto

### Arquivos alterados
- `supabase/functions/webhook-make-parceria/index.ts`

