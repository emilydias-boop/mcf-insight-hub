
# Plano: Corrigir Erro "Cannot read properties of null (reading 'length')"

## Diagnóstico

O erro ocorre no arquivo `src/components/crm/webhooks/IncomingWebhookEditor.tsx` na linha **160**:

```typescript
{endpoint.auto_tags.length > 0 && (
```

### Causa Raiz
O campo `auto_tags` no banco de dados pode ser `null` quando não há tags configuradas. O código assume que sempre será um array (mesmo que vazio), mas dados existentes no banco podem ter `null`.

---

## Solução

Adicionar verificação de nulidade antes de acessar `.length`:

```typescript
// ANTES:
{endpoint.auto_tags.length > 0 && (

// DEPOIS:
{endpoint.auto_tags && endpoint.auto_tags.length > 0 && (

// OU (mais conciso):
{(endpoint.auto_tags?.length ?? 0) > 0 && (
```

---

## Arquivo a Modificar

| Arquivo | Linha | Alteração |
|---------|-------|-----------|
| `src/components/crm/webhooks/IncomingWebhookEditor.tsx` | 160 | Usar optional chaining para verificar nulidade |

---

## Código Corrigido

```typescript
// Linha 160
<div className="flex items-center gap-4 text-xs text-muted-foreground">
  {endpoint.auto_tags?.length > 0 && (
    <span>
      Tags: {endpoint.auto_tags.join(', ')}
    </span>
  )}
  <span>{endpoint.leads_received} leads recebidos</span>
```

---

## Impacto da Correção

| Situação | Antes | Depois |
|----------|-------|--------|
| `auto_tags = null` | ❌ Erro: Cannot read 'length' of null | ✅ Tags não são exibidas |
| `auto_tags = []` | ✅ Tags não são exibidas | ✅ Tags não são exibidas |
| `auto_tags = ['tag1']` | ✅ Tags são exibidas | ✅ Tags são exibidas |

---

## Correção Adicional Recomendada

Também atualizar a interface no hook para refletir que `auto_tags` pode ser `null`:

```typescript
// src/hooks/useWebhookEndpoints.ts
export interface WebhookEndpoint {
  // ...
  auto_tags: string[] | null;  // Corrigir tipo
  // ...
}
```

Isso evitará erros semelhantes no futuro.
