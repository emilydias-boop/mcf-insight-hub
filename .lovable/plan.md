

## Corrigir exibição de Tags no Controle Diego

### Problema
O campo `tags` em `crm_contacts` armazena objetos JSON (ex: `{"id": "uuid", "name": "Anamnese"}`) e não strings simples. O código atual faz `Array.isArray(contact.tags) ? contact.tags : []`, resultando em objetos sendo convertidos para string como `{"id":"00596262-..."}`.

### Solução
No `useContractReport.ts`, ao extrair `contactTags`, parsear os objetos e extrair o campo `name`:

```typescript
// Linha ~247 de useContractReport.ts
const contactTags: string[] = Array.isArray(contact?.tags)
  ? contact.tags
      .map((t: any) => (typeof t === 'string' ? t : t?.name))
      .filter(Boolean)
  : [];
```

### Arquivo modificado
- `src/hooks/useContractReport.ts` -- parsear tags como objetos e extrair `.name`

