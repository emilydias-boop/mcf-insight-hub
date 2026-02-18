

# Filtrar "Dono do Negocio" por BU no DealFormDialog

## Problema

O dropdown "Dono do negocio" no dialog "Criar Novo Negocio" busca **todos** os SDRs do sistema, independentemente da Business Unit. Quando acessado pela rota `/consorcio/crm/negocios`, mostra SDRs de outras BUs (Incorporador, etc.) e nao mostra membros do squad consorcio que nao tem role `sdr`.

## Causa Raiz

A query no `DealFormDialog.tsx` (linhas 95-128) busca apenas `user_roles.role = 'sdr'` globalmente, sem filtro por squad/BU.

## Solucao

Adicionar consciencia de BU ao DealFormDialog, filtrando os owners pelo squad da BU ativa.

### Alteracoes

**Arquivo: `src/components/crm/DealFormDialog.tsx`**

1. Importar `useActiveBU` para detectar a BU da rota atual
2. Alterar a query de `dealOwners` para:
   - Buscar profiles que contenham a BU ativa no array `squad`
   - Buscar roles `sdr` e `closer` (nao apenas `sdr`) para incluir closers do consorcio
   - Fazer interseccao: profiles com squad correto E que tenham role sdr/closer
   - Fallback: se nao houver BU ativa, manter comportamento atual (todos os SDRs)

Logica atualizada:

```text
// 1. Buscar profiles do squad da BU ativa
const profiles = await supabase
  .from('profiles')
  .select('id, full_name, email')
  .contains('squad', [activeBU])  // filtro por BU
  .eq('access_status', 'ativo')
  .order('full_name');

// 2. Buscar roles desses profiles (sdr + closer)
const roles = await supabase
  .from('user_roles')
  .select('user_id, role')
  .in('user_id', profileIds)
  .in('role', ['sdr', 'closer']);

// 3. Retornar apenas profiles que tenham role relevante
```

A queryKey incluira o `activeBU` para evitar cache cruzado entre BUs.

### Resultado

- Na rota `/consorcio/crm/negocios`: mostra apenas SDRs/Closers do squad "consorcio"
- Na rota `/crm/negocios` (Incorporador): mostra apenas SDRs/Closers do squad "incorporador"
- Sem BU ativa: fallback para todos os SDRs (comportamento atual)

