

# Auto-expandir grupos na sidebar de Origens

## Problema

A sidebar de origens mostra grupos colapsados por padrão. Quando o usuário tem poucas origens (ex: 2 pipelines no grupo "Perpétuo - X1"), ele precisa clicar no grupo para ver as origens. Isso é desnecessário.

## Solução

Adicionar um `useEffect` no `OriginsSidebar.tsx` que, após os dados carregarem, auto-expande todos os grupos quando o total de origens é pequeno (≤ 10).

| Arquivo | Alteração |
|---|---|
| `src/components/crm/OriginsSidebar.tsx` | Adicionar `useEffect` após linha ~182 que calcula total de origens e seta `expandedGroups` com todos os IDs de grupo se total ≤ 10 |

### Lógica

```typescript
useEffect(() => {
  if (!dataToUse || !isGroupedTree) return;
  const groups = dataToUse as Group[];
  const totalOrigins = groups.reduce((sum, g) => sum + g.children.length, 0);
  if (totalOrigins <= 10) {
    setExpandedGroups(new Set(groups.map(g => g.id)));
  }
}, [dataToUse, isGroupedTree]);
```

Resultado: com poucas origens (como o caso do SDR que vê apenas 2), os grupos já aparecem expandidos mostrando as origens diretamente. Com muitas origens (admin), continua colapsado.

