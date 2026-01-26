
# Plano: Corrigir Classificação de Leads (Query com Chunks)

## Problema Identificado

A query do hook `useBulkA010Check` está **falhando** quando há muitos deals:

```
Erro ao buscar A010 status: TypeError: Failed to fetch
```

**Causa**: Com 5.000+ leads, a cláusula `.in('customer_email', [emails...])` gera uma URL HTTP muito longa, excedendo limites do navegador/servidor.

**Efeito**: Quando a query falha, o hook retorna `false` para todos os emails, fazendo TODOS os leads aparecerem como "LIVE".

---

## Solução

Dividir a busca em **chunks (lotes)** de no máximo 200 emails por vez e combinar os resultados.

### Mudanças no Hook `useBulkA010Check`

**Arquivo**: `src/hooks/useBulkA010Check.ts`

| Antes | Depois |
|-------|--------|
| Query única com todos os emails | Múltiplas queries em chunks de 200 |
| Falha silenciosa com todos = false | Fallback para classificação por tags |
| URL muito longa | URLs menores e dentro do limite |

### Lógica de Chunks

```text
Exemplo com 1000 emails:
- Chunk 1: emails[0..199]   → Query Supabase
- Chunk 2: emails[200..399] → Query Supabase
- Chunk 3: emails[400..599] → Query Supabase
- Chunk 4: emails[600..799] → Query Supabase
- Chunk 5: emails[800..999] → Query Supabase
→ Combinar resultados de todos os chunks
```

### Fallback Melhorado

Se ainda houver falha, usar a lógica de tags como backup:
- Email no resultado A010 → **A010**
- Tag contém "bio/instagram" → **BIO**
- Padrão → **LIVE**

---

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useBulkA010Check.ts` | Implementar chunking na query |

---

## Detalhes Técnicos

### Implementação de Chunking

```typescript
const CHUNK_SIZE = 200;

// Dividir emails em chunks
const chunks: string[][] = [];
for (let i = 0; i < cleanEmails.length; i += CHUNK_SIZE) {
  chunks.push(cleanEmails.slice(i, i + CHUNK_SIZE));
}

// Buscar cada chunk em paralelo
const results = await Promise.allSettled(
  chunks.map(chunk => 
    supabase
      .from('hubla_transactions')
      .select('customer_email')
      .eq('product_category', 'a010')
      .eq('sale_status', 'completed')
      .in('customer_email', chunk)
  )
);

// Combinar resultados
const a010Emails = new Set<string>();
results.forEach(result => {
  if (result.status === 'fulfilled' && result.value.data) {
    result.value.data.forEach(t => {
      if (t.customer_email) {
        a010Emails.add(t.customer_email.toLowerCase());
      }
    });
  }
});
```

### Por que 200?

- Cada email tem em média 25 caracteres
- 200 emails × 25 chars = ~5KB de parâmetros
- Margem segura para URL máxima (~8KB)
- Boa performance com paralelismo

---

## Resultado Esperado

- Queries funcionam mesmo com 10.000+ leads
- Leads A010 aparecem com badge azul
- Leads BIO aparecem com badge verde  
- Leads LIVE aparecem com badge roxo
- Filtros por canal funcionam corretamente
