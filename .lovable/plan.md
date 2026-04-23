

## Corrigir erro ao desativar Closer (`invalid input syntax for type uuid: ""`)

### Causa raiz

No `CloserFormDialog`, ao abrir um closer existente para edição, campos opcionais são inicializados como string vazia (`''`):

```ts
employee_id: closer.employee_id || '',   // linha 148
google_calendar_id: closer.google_calendar_id || '',  // linha 145
calendly_event_type_uri: ... || '',
```

Quando o usuário só clica em "Salvar" (ex: para desativar via toggle `Closer Ativo`), o `useUpdateCloser` faz:

```ts
.update({ ...formData, updated_at: ... })
```

Isso envia `employee_id: ""` para o Postgres, que rejeita: a coluna é `uuid` e string vazia não é um UUID válido → erro `invalid input syntax for type uuid: ""`.

O bug afeta **qualquer** edição de closer cujo `employee_id` esteja nulo, não só desativação.

### Correção

**1. `src/hooks/useClosers.ts` — sanitizar payload no `useUpdateCloser`**

Antes do `.update(...)`, normalizar campos UUID/opcionais: trocar `""` por `null`.

```ts
mutationFn: async ({ id, data }) => {
  const sanitized = {
    ...data,
    employee_id: data.employee_id === '' ? null : data.employee_id,
    calendly_event_type_uri: data.calendly_event_type_uri === '' ? null : data.calendly_event_type_uri,
    calendly_default_link: data.calendly_default_link === '' ? null : data.calendly_default_link,
    google_calendar_id: data.google_calendar_id === '' ? null : data.google_calendar_id,
    color: data.color === '' ? null : data.color,
    bu: data.bu === '' ? null : data.bu,
    meeting_type: data.meeting_type === '' ? null : data.meeting_type,
    updated_at: new Date().toISOString(),
  };
  // ...update com sanitized
}
```

Aplicar a mesma sanitização no `useCreateCloser` para evitar o mesmo bug ao criar (já trata parcialmente com `|| null`, mas reforçar consistência).

**2. `src/hooks/useR2Closers.ts` — mesma correção**

`useUpdateR2Closer` (linha ~150) tem o mesmo padrão `...data` sem sanitização. Aplicar o mesmo tratamento.

### Por que não corrigir só no Dialog

Corrigir só no Dialog (trocar `'' ` por `undefined` na inicialização) deixaria o hook frágil — qualquer outro chamador ou futuro componente cairia no mesmo erro. A defesa correta é no hook (camada de dados), garantindo que o Postgres nunca receba `""` para colunas UUID.

### Reversibilidade

Mudança puramente defensiva no payload. Sem migration, sem alteração de schema. Reverter = remover as linhas de sanitização.

### Resultado esperado

- Desativar closer (toggle "Closer Ativo" → Salvar) funciona normalmente.
- Editar qualquer campo de closer sem `employee_id` vinculado funciona.
- Mesmo comportamento para R2 Closers.

