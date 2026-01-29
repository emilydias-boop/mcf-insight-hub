

# Plano: Detectar Leads LIVE pelas Tags do Clint

## Contexto

O webhook do Clint envia a tag `Lead-Live` através do campo `contact_tag`. O sistema já processa corretamente essas tags e as salva nos deals via `clint-webhook-handler`. No entanto, o relatório de vendas (`SalesReportPanel`) detecta o canal de vendas **apenas pelo nome do produto**, ignorando as tags.

## Dados Confirmados

Os deals já possuem a tag `Lead-Live` no array `tags`:
```text
tags: [Lead-Live, SDR - VC, A010 - Construa para Vender, ...]
```

O `clint-webhook-handler` já extrai as tags do `contact_tag`:
```typescript
// Linha 380-382 do clint-webhook-handler/index.ts
if (data.contact_tag) {
  return parseClintTags(data.contact_tag);
}
```

---

## Solução Proposta

### Modificação 1: Atualizar função RPC para incluir tags

Criar uma nova versão da função `get_hubla_transactions_by_bu` que retorna também as tags do deal/contato associado à transação.

**Nova coluna retornada:**
- `deal_tags` - Tags do deal associado (via email/telefone)

### Modificação 2: Atualizar detecção de canal no relatório

Modificar a função `detectSalesChannel` em `SalesReportPanel.tsx` para considerar as tags:

**Antes:**
```typescript
const detectSalesChannel = (productName: string | null): 'A010' | 'BIO' | 'LIVE' => {
  const name = (productName || '').toLowerCase();
  if (name.includes('a010')) return 'A010';
  if (name.includes('bio') || name.includes('instagram')) return 'BIO';
  return 'LIVE';
};
```

**Depois:**
```typescript
const detectSalesChannel = (
  productName: string | null, 
  dealTags: string[] = []
): 'A010' | 'BIO' | 'LIVE' => {
  const name = (productName || '').toLowerCase();
  const tagsStr = dealTags.join(' ').toLowerCase();
  
  // 1. Verificar tags primeiro (mais preciso)
  if (tagsStr.includes('lead-live') || tagsStr.includes('live-')) {
    return 'LIVE';
  }
  if (tagsStr.includes('lead-instagram') || tagsStr.includes('bio')) {
    return 'BIO';
  }
  
  // 2. Fallback para nome do produto
  if (name.includes('a010')) return 'A010';
  if (name.includes('bio') || name.includes('instagram')) return 'BIO';
  
  return 'LIVE';
};
```

---

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| Nova migration SQL | Atualizar `get_hubla_transactions_by_bu` para incluir `deal_tags` |
| `src/hooks/useTransactionsByBU.ts` | Adicionar campo `deal_tags` no tipo de retorno |
| `src/components/relatorios/SalesReportPanel.tsx` | Atualizar `detectSalesChannel()` para usar tags |
| `src/hooks/useAllHublaTransactions.ts` | Adicionar `deal_tags` na interface `HublaTransaction` |

---

## Detalhes Técnicos

### Nova RPC (migration)

```sql
CREATE OR REPLACE FUNCTION public.get_hubla_transactions_by_bu(...)
RETURNS TABLE(
  -- campos existentes...
  id uuid,
  product_name text,
  customer_email text,
  -- ...
  -- NOVO campo:
  deal_tags text[]
)
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ht.id,
    ht.product_name,
    -- ...
    -- JOIN para buscar tags do deal
    COALESCE(d.tags, ARRAY[]::text[]) as deal_tags
  FROM hubla_transactions ht
  LEFT JOIN crm_contacts c ON LOWER(c.email) = LOWER(ht.customer_email)
  LEFT JOIN crm_deals d ON d.contact_id = c.id
  WHERE ...
END;
$$
```

### Atualização do tipo TypeScript

```typescript
export interface HublaTransaction {
  // ...campos existentes
  deal_tags?: string[];
}
```

### Lógica de detecção atualizada

```typescript
// Em SalesReportPanel.tsx
const channel = detectSalesChannel(row.product_name, row.deal_tags || []);
```

---

## Resultado Esperado

1. ✅ Transações cujo deal tem tag `Lead-Live` serão identificadas como canal LIVE
2. ✅ Tags `Lead-instagram`, `BIO` serão identificadas como canal BIO  
3. ✅ Fallback para o nome do produto quando não há tags
4. ✅ Compatibilidade retroativa mantida

---

## Alternativa Simplificada

Se preferir não modificar a RPC, podemos fazer um JOIN no frontend usando React Query para enriquecer os dados das transações com as tags dos deals/contatos. Isso seria menos performático mas evitaria migration de banco.

