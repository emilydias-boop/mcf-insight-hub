
# Plano: Corrigir Dessincronizacao de Ownership no CRM

## Problema Identificado

Quando um SDR trabalha com um lead (liga, arrasta, agenda), o lead **"some" do Kanban** porque existe uma **dessincronizacao entre dois campos de ownership**:

- `owner_id`: email do responsavel (usado no filtro **frontend**)
- `owner_profile_id`: UUID do responsavel (usado no filtro **backend**)

**O que acontece:**
1. Backend retorna o lead (baseado em `owner_profile_id`)
2. Frontend filtra FORA o lead (porque `owner_id` tem email diferente)
3. Lead "desaparece" da tela do SDR

**Dados do banco confirmam o problema:**
- 20+ deals encontrados onde `owner_id` aponta para um email e `owner_profile_id` aponta para outro usuario
- Exemplo: Deal "Manoel" tem `owner_id: claudia.carielo@...` mas `owner_profile_id` corresponde a `jessica.bellini.r2@...`

---

## Solucao

### Parte 1: Correcao de Dados Existentes (SQL)

Executar no **Cloud View > Run SQL** para sincronizar os campos:

```sql
-- Atualizar owner_profile_id para corresponder ao owner_id
UPDATE crm_deals d
SET owner_profile_id = p.id
FROM profiles p
WHERE LOWER(d.owner_id) = LOWER(p.email)
  AND d.owner_id IS NOT NULL
  AND (d.owner_profile_id IS NULL OR d.owner_profile_id != p.id);
```

### Parte 2: Prevenir Futuras Dessincronizacoes

Garantir que TODOS os pontos de atualizacao de ownership sincronizem ambos os campos.

#### 2.1 Edge Function: `calendly-create-event`

Ao mover deal para estagio (linha ~660), tambem deve sincronizar ownership se necessario.

**Arquivo:** `supabase/functions/calendly-create-event/index.ts`
**Alteracao:** Nenhuma necessaria aqui - esta funcao nao altera ownership.

#### 2.2 Hook: `useUpdateCRMDeal`

**Arquivo:** `src/hooks/useCRMData.ts`
**Alteracao:** Adicionar logica para sincronizar `owner_profile_id` quando `owner_id` for atualizado.

```typescript
// Linha ~558-570, na mutationFn
mutationFn: async ({ id, previousStageId, ...deal }: any) => {
  // NOVO: Se owner_id mudou, buscar profile_id correspondente
  if (deal.owner_id && !deal.owner_profile_id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', deal.owner_id)
      .maybeSingle();
    
    if (profile) {
      deal.owner_profile_id = profile.id;
    }
  }
  
  // ... resto do codigo existente
```

#### 2.3 Unificar Filtro no Frontend

**Arquivo:** `src/pages/crm/Negocios.tsx`
**Alteracao:** Remover filtro duplicado no frontend (linhas 331-333) ja que o backend ja filtra.

```typescript
// REMOVER estas linhas (331-333):
// if (isRestrictedRole && userProfile?.email) {
//   if (deal.owner_id !== userProfile.email) return false;
// }
```

**Justificativa:** O backend ja filtra por `owner_profile_id` (linha 211). O filtro frontend duplicado causa inconsistencia quando os campos estao dessincronizados.

---

## Resumo das Alteracoes

| Arquivo | Tipo | Alteracao |
|---------|------|-----------|
| SQL Migration | Data Fix | Sincronizar owner_profile_id com owner_id |
| `src/hooks/useCRMData.ts` | Prevencao | Auto-sync owner_profile_id ao atualizar owner_id |
| `src/pages/crm/Negocios.tsx` | Simplificacao | Remover filtro frontend duplicado |

---

## Resultado Esperado

- Leads nao vao mais "sumir" do Kanban apos acoes
- Filtro de ownership sera consistente (apenas backend)
- Dados historicos serao corrigidos pelo SQL
