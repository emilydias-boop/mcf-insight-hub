
## Causa do Erro

Nas linhas 407, 422, 437, 452, 467 e 482 do `Importar.tsx`, os itens "Não mapear" usam `value=""`:

```tsx
<SelectItem value="">Não mapear</SelectItem>
```

O Radix UI (biblioteca dos componentes Select) proíbe `value=""` em `SelectItem` — string vazia é reservada internamente para limpar a seleção/placeholder, causando o crash ao tentar avançar o step.

---

## Correção

**Arquivo:** `src/pages/bu-consorcio/Importar.tsx`

**Duas mudanças:**

1. **Handler `handleMappingChange` (linha 155):** converter o valor sentinela de volta para string vazia no estado interno:
   ```ts
   const handleMappingChange = (field: keyof ColumnMapping, value: string) => {
     setMapping(prev => ({ ...prev, [field]: value === '__none__' ? '' : value }));
   };
   ```

2. **Todas as 6 ocorrências** de `<SelectItem value="">Não mapear</SelectItem>` (linhas 407, 422, 437, 452, 467, 482):
   ```tsx
   <SelectItem value="__none__">Não mapear</SelectItem>
   ```

Isso garante que o Radix UI nunca recebe `value=""`, mas o estado interno continua funcionando com `''` para "não mapeado".

**Nenhuma outra mudança necessária.** O resto do código (parsing, duplicates, import) está correto.
