
# Plano: Mostrar Todos os SDRs no Filtro de Responsáveis

## Problema Identificado

O filtro "Todos os responsáveis" só mostra usuários que **já possuem deals atribuídos**. Isso ocorre porque o hook `useDealOwnerOptions` extrai owners apenas dos deals carregados.

### Evidência

| BU | SDR | Deals | Aparece no Filtro |
|----|-----|-------|-------------------|
| Consórcio | Cleiton Anacleto Lima | 368 | ✅ |
| Consórcio | ithaline clara dos santos | 0 | ❌ |
| Consórcio | Ygor Ferreira | 0 | ❌ |
| Incorporador | Evellyn Vieira dos Santos | 0 | ❌ |
| Incorporador | Juliana Rodrigues | 298 | ✅ |

---

## Solução Proposta

Modificar o hook `useDealOwnerOptions` para **combinar**:
1. Owners extraídos dos deals (lógica atual)
2. SDRs/Closers da BU ativa que ainda não têm deals

Isso garante que todos os membros da equipe apareçam no filtro, mesmo os novos.

---

## Mudanças Técnicas

### 1. Modificar `src/hooks/useDealOwnerOptions.ts`

Adicionar parâmetro opcional `activeBU` para incluir SDRs/Closers da BU que não têm deals:

```typescript
export function useDealOwnerOptions(
  deals: Deal[] | null | undefined,
  activeBU?: string // Nova prop
) {
  // Lógica atual: extrair owners dos deals...
  
  // NOVO: Buscar SDRs/Closers da BU ativa
  const { data: buTeamMembers } = useQuery({
    queryKey: ['bu-team-members', activeBU],
    queryFn: async () => {
      if (!activeBU) return [];
      
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, access_status, user_roles(role)')
        .contains('squad', [activeBU])
        .eq('access_status', 'ativo');
      
      return data?.filter(u => 
        u.user_roles?.some(r => ['sdr', 'closer'].includes(r.role))
      ) || [];
    },
    enabled: !!activeBU,
    staleTime: 60_000,
  });
  
  // Combinar: deals + equipe da BU
  const ownerOptions = useMemo(() => {
    const options = [...ownersFromDeals];
    
    // Adicionar membros da BU que não estão nos deals
    buTeamMembers?.forEach(member => {
      if (!options.some(o => o.value === member.id)) {
        options.push({
          value: member.id,
          label: member.full_name || member.email,
          roleLabel: member.user_roles?.[0]?.role?.toUpperCase(),
          isInactive: false,
        });
      }
    });
    
    return options.sort((a, b) => a.label.localeCompare(b.label));
  }, [ownersFromDeals, buTeamMembers]);
}
```

### 2. Atualizar `src/pages/crm/Negocios.tsx`

Passar a BU ativa para o hook:

```typescript
// Antes
const { ownerOptions } = useDealOwnerOptions(dealsData);

// Depois
const { ownerOptions } = useDealOwnerOptions(dealsData, activeBU);
```

---

## Fluxo Após Correção

```text
Filtro de Responsáveis
         |
         +---> Owners dos Deals Carregados
         |           |
         |           v
         |     [Cleiton, Juliana, ...]
         |
         +---> SDRs/Closers da BU Ativa
                     |
                     v
               [Evellyn, Ithaline, Ygor, ...]
                     |
                     v
           +------------------+
           | Combinar e       |
           | Remover Dupes    |
           +------------------+
                     |
                     v
           Dropdown Completo com Toda Equipe
```

---

## Resultado Esperado

Após a implementação:

### Consórcio
- Cleiton Anacleto Lima (SDR) ✅
- ithaline clara dos santos (SDR) ✅ **NOVO**
- Ygor Ferreira (SDR) ✅ **NOVO**
- João Pedro (Closer) ✅ **NOVO**
- Victoria Paz (Closer) ✅ **NOVO**

### Incorporador
- Todos os SDRs existentes ✅
- Evellyn Vieira dos Santos (SDR) ✅ **NOVO**
- Closers da BU ✅

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useDealOwnerOptions.ts` | Adicionar busca de SDRs/Closers por BU |
| `src/pages/crm/Negocios.tsx` | Passar `activeBU` para o hook |

---

## Benefícios

1. **Onboarding facilitado** - Novos SDRs já aparecem no filtro para receber leads
2. **Visão completa da equipe** - Managers veem toda a equipe da BU
3. **Retrocompatível** - Se não passar BU, funciona como antes
