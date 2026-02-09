

# Corrigir erro ao salvar telefone — campo `clint_id` obrigatorio

## Causa raiz

A tabela `crm_contacts` tem uma coluna `clint_id` (TEXT, NOT NULL) sem valor padrao. Quando o sistema tenta criar um contato com apenas `name` e `phone`, o banco rejeita com:

> null value in column "clint_id" of relation "crm_contacts" violates not-null constraint

## Solucao

Gerar um `clint_id` unico ao criar o contato automaticamente no `SdrSummaryBlock.tsx`.

## Alteracao

### Arquivo: `src/components/crm/SdrSummaryBlock.tsx`

Na parte do `handleSavePhone` que cria o contato (bloco `else if (deal?.id)`), incluir o campo `clint_id`:

```text
const newContact = await createContact.mutateAsync({
  name: deal.name || 'Contato sem nome',
  phone: phoneValue,
  clint_id: `manual-${Date.now()}`
});
```

Isso gera um identificador unico como `manual-1707500000000` que satisfaz a constraint NOT NULL.

## Resultado

- O contato sera criado com sucesso no banco
- O `contact_id` sera vinculado ao deal
- O telefone aparecera no drawer imediatamente
- Nenhuma alteracao de schema necessaria
