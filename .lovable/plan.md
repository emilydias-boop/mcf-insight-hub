

## Corrigir erro "invalid input syntax for type date" ao criar cadastro pendente

### Problema

Ao colar os dados do check-list e submeter o formulario de aceite (PF ou PJ), o sistema envia strings vazias (`""`) para campos do tipo `date` no banco de dados (como `data_fundacao` e `data_contratacao`). O PostgreSQL rejeita strings vazias como valor de data, causando o erro:

```
invalid input syntax for type date: ""
```

Isso acontece porque o `...registrationData` no hook `useCreatePendingRegistration` envia todos os campos diretamente para o Supabase sem sanitizar valores vazios.

### Solucao

Sanitizar os dados antes do insert, convertendo strings vazias em `null` para todos os campos. Isso garante que campos opcionais nao preenchidos nao causem erros de tipo no banco.

### Alteracao

**`src/hooks/useConsorcioPendingRegistrations.ts`**

Na funcao `mutationFn` do `useCreatePendingRegistration`, antes de fazer o insert (linha 174-183), adicionar uma etapa de sanitizacao que percorre todos os campos do `registrationData` e converte strings vazias (`""`) em `null`:

```typescript
// Sanitizar: converter strings vazias em null para evitar erros de tipo no banco
const sanitized = Object.fromEntries(
  Object.entries(registrationData).map(([key, value]) => [
    key,
    value === '' ? null : value,
  ])
);
```

Em seguida, usar `sanitized` no lugar de `registrationData` no insert.

### Resultado esperado

- Campos de data vazios serao enviados como `null` em vez de `""`, evitando o erro do PostgreSQL
- Campos de texto vazios tambem serao tratados como `null`, mantendo consistencia
- O fluxo de colar check-list e submeter o cadastro funcionara sem erros
