

# Corrigir nomes e adicionar "Encaixar no Carrinho" na aba Acumulados

## Problema 1: Nomes mostrando como e-mail
Na coluna "Nome", leads do tipo "Sem R2" aparecem com o e-mail porque o hook `useR2AccumulatedLeads` busca contatos apenas com `id, email, phone` (linha 125) -- sem o campo `name`. Como `attendee_name` e `deal_name` são nulos para esses leads, o fallback exibe o e-mail.

**Correção**: Adicionar `name` na query de `crm_contacts` e também buscar o deal name via `crm_deals` para os contatos sem R2.

## Problema 2: Encaixar lead acumulado no carrinho atual
O usuário quer poder pegar um lead acumulado e agendar uma R2 no carrinho da semana atual. Isso será feito abrindo o `R2QuickScheduleModal` com o deal pré-selecionado.

---

## Alterações

### 1. `src/hooks/useR2AccumulatedLeads.ts`
- Adicionar `name` na query de `crm_contacts` (linha 125): `select('id, name, email, phone')`
- Buscar deals associados a esses contatos via `crm_deals` para ter o nome do deal e o `deal_id` mesmo quando não há R2
- Adicionar `deal_id` e `contact_id` ao interface `R2AccumulatedLead`
- Nos leads "sem_r2", popular `attendee_name` com o nome do contato e `deal_name` com o nome do deal

### 2. `src/components/crm/R2AccumulatedList.tsx`
- Adicionar botão "Encaixar" em cada linha de lead acumulado
- Ao clicar, chamar um callback `onSchedule(lead)` passado via props
- O callback abrirá o `R2QuickScheduleModal` com o deal pré-selecionado

### 3. `src/pages/crm/R2Carrinho.tsx`
- Importar e renderizar o `R2QuickScheduleModal`
- Passar `onSchedule` para `R2AccumulatedList` que abre o modal com o deal do lead selecionado
- Após agendar, invalidar as queries de acumulados

### Detalhes técnicos

Interface atualizada:
```typescript
export interface R2AccumulatedLead {
  // ... existentes
  deal_id: string | null;    // novo
  contact_id: string | null; // novo
}
```

Na query de contatos:
```typescript
const { data: contacts } = await supabase
  .from('crm_contacts')
  .select('id, name, email, phone')  // adicionar name
  .in('email', emails);
```

Para "sem_r2", buscar deals do contato:
```typescript
const { data: contactDeals } = await supabase
  .from('crm_deals')
  .select('id, name, contact_id')
  .in('contact_id', contactIds);
```

Botão na lista:
```tsx
<TableCell>
  <Button size="sm" variant="outline" onClick={() => onSchedule?.(lead)}>
    Encaixar
  </Button>
</TableCell>
```

