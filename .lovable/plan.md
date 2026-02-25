

## Corrigir erro "invalid input syntax for type date" ao cadastrar cota

### Problema identificado

A tabela `consorcio_pending_registrations` tem 3 colunas do tipo `date` no PostgreSQL: `data_fundacao`, `aceite_date` e `data_contratacao`. Quando uma string vazia `""` e enviada para essas colunas, o PostgreSQL rejeita com o erro `invalid input syntax for type date: ""`.

Ha dois pontos no codigo onde strings vazias escapam da sanitizacao:

**1. `AcceptProposalModal.tsx` (Modal de Aceite PF/PJ)**
- O formulario usa `useForm<any>` com defaultValues que incluem `data_fundacao: ''` para PJ
- Quando o usuario envia como PF, o campo `data_fundacao` ainda vai como `''` no `...data` spread
- A sanitizacao no hook (linha 174) converte `''` para `null`, mas nao cobre o caso de `0` (numeros zero) que tambem podem gerar problemas

**2. `useConsorcioPendingRegistrations.ts` (useOpenCota, linha 445)**
- Ao atualizar `consorcio_pending_registrations` com `...cotaData`, todos os campos do formulario do `OpenCotaModal` sao espalhados diretamente
- Campos como `inicio_segunda_parcela`, `origem_detalhe`, `transferido_de` podem ser strings vazias
- O `data_contratacao` deveria estar sempre preenchido, mas se por algum motivo estiver vazio, causa o erro

### Alteracoes

**1. `src/hooks/useConsorcioPendingRegistrations.ts`**

- **Linha 173-179 (useCreatePendingRegistration)**: Melhorar sanitizacao para converter `''` em `null` especificamente para os campos de tipo date (`data_fundacao`, `aceite_date`, `data_contratacao`). Na verdade, a sanitizacao ja faz isso, mas vamos garantir que funciona filtrando tambem campos `undefined`.

- **Linha 440-447 (useOpenCota)**: Adicionar sanitizacao antes do `...cotaData` no update de `consorcio_pending_registrations`. Filtrar campos vazios e converter strings vazias em null para colunas date:

```typescript
// Sanitizar cotaData antes de salvar
const dateColumns = ['data_contratacao', 'data_fundacao', 'aceite_date'];
const cleanCotaData = Object.fromEntries(
  Object.entries(cotaData)
    .filter(([_, v]) => v !== undefined && v !== '')
    .map(([k, v]) => [k, (dateColumns.includes(k) && v === '') ? null : v])
);

await supabase
  .from('consorcio_pending_registrations')
  .update({
    status: 'cota_aberta',
    consortium_card_id: card.id,
    ...cleanCotaData,
  } as any)
  .eq('id', registrationId);
```

**2. `src/components/consorcio/AcceptProposalModal.tsx`**

- **Linha 248-256 (onSubmit)**: Antes de chamar `createRegistration.mutateAsync`, filtrar os campos PJ quando `tipoPessoa === 'pf'` e vice-versa, para nao enviar campos irrelevantes. Tambem garantir que `data_fundacao` vazio nao e enviado:

```typescript
// Filtrar campos irrelevantes baseado no tipo de pessoa
const { documents, ...rawData } = { documents, ...data };
const fieldsToExclude = tipoPessoa === 'pf'
  ? ['razao_social', 'cnpj', 'natureza_juridica', 'inscricao_estadual', 'data_fundacao', ...]
  : ['nome_completo', 'rg', 'cpf', 'cpf_conjuge', 'profissao', ...];
const cleanData = Object.fromEntries(
  Object.entries(data).filter(([k]) => !fieldsToExclude.includes(k))
);
```

**3. `src/components/consorcio/OpenCotaModal.tsx`**

- Na funcao `onSubmit` (linha 198-228): Os campos `data_contratacao` e outros date fields do formulario ja vem do `<Input type="date">` que envia `''` quando vazio. Garantir que esses campos vazios virem `null` ou sejam removidos antes de enviar ao hook.

### Resultado

Os modais de aceite e abertura de cota nao mais enviarao strings vazias para colunas do tipo `date`, eliminando o erro `invalid input syntax for type date: ""`.

