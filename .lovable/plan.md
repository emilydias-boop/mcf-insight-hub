

## Corrigir duplicidade de período e botão solto

### Problemas identificados

1. **Período exibido 2 vezes**: no `SdrDetailHeader` (badge "Período: 01/03/2026 - 31/03/2026") e no `SdrPerformanceFilters` (texto "01/03/2026 — 31/03/2026" à direita)
2. **Botão "Atualizar" solto**: fica em um `div` próprio entre os filtros e as tabs, criando espaço desnecessário

### Solução

| Arquivo | Ação |
|---------|------|
| `SdrDetailHeader.tsx` | Remover o badge de período (linhas 72-77) — o período já está controlado e exibido nos filtros |
| `SdrPerformanceFilters.tsx` | Adicionar o botão "Atualizar" dentro da barra de filtros, ao lado do texto de período (à direita) |
| `SdrMeetingsDetailPage.tsx` | Remover o `div` standalone do botão Atualizar (linhas 167-172), passar `onRefresh` e `isLoading` como props ao `SdrPerformanceFilters` |

### Resultado

- Header mostra apenas nome, cargo, squad e status
- Filtros ficam com: Período | Comparação | Meta | datas | botão Atualizar — tudo numa linha
- Zero espaço desperdiçado entre filtros e conteúdo

