

## Diagnóstico: Lead duplicado "Figia"

### O que aconteceu

A mesma pessoa se cadastrou **duas vezes com dados diferentes**:

| | Deal 1 (Clint) | Deal 2 (Importação) |
|---|---|---|
| Nome | Figia Griebler Giacomel | Figia Vetta |
| Email | figiagrieblergiacomel@gmail.com | figiaengcvill@gmail.com |
| Telefone | 47997050504 (11 dígitos) | 47 97050504 (10 dígitos) |
| Owner | mayara.souza@ | juliana.rodrigues@ |
| clint_id | 55f5af4c... (Clint) | local-177... (planilha) |

**Por que o sistema não detectou?**
- Emails diferentes → match por email falhou
- O telefone do Deal 2 tem **10 dígitos** (`4797050504`) em vez de 11 (`47997050504`) — falta o dígito `9` do celular
- O sistema usa os **últimos 9 dígitos**: `997050504` vs `797050504` → **não batem**

### Problema raiz

A deduplicação por telefone usa `slice(-9)` assumindo formato `DDD + 9 dígitos`. Mas quando o telefone chega com formato incorreto (faltando o `9` do celular), os sufixos divergem e o match falha.

### Solução: Deduplicação por 8 dígitos (fallback)

Usar os **últimos 8 dígitos** como fallback quando os últimos 9 não encontram match. Isso ignora o dígito `9` variável e compara apenas o número fixo do assinante.

**Arquivos afetados:**

1. **`supabase/functions/import-spreadsheet-leads/index.ts`** (linhas 93-100)
   - Após falha no match por 9 dígitos, tentar com últimos 8

2. **`supabase/functions/clint-webhook-handler/index.ts`** (linhas 630-649)
   - Mesmo fallback de 8 dígitos no handler de criação de deal

3. **`supabase/functions/webhook-lead-receiver/index.ts`** e **`webhook-live-leads/index.ts`**
   - Aplicar mesma lógica de fallback para consistência

**Lógica:**

```typescript
// Busca padrão: últimos 9 dígitos
const phoneSuffix9 = phoneClean.slice(-9);
let existingContact = await findByPhone(phoneSuffix9);

// Fallback: últimos 8 dígitos (ignora dígito 9 variável)
if (!existingContact) {
  const phoneSuffix8 = phoneClean.slice(-8);
  existingContact = await findByPhone(phoneSuffix8);
}
```

4. **Correção de dados**: Unificar os 4 contatos duplicados de "Figia" e manter apenas 1 deal na pipeline.

