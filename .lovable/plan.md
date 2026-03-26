

## Unificar gráficos: remover bar chart, transformar line chart em diário

### O que muda

Remover o gráfico de barras "Evolução Diária" (`SdrMeetingsChart`) e transformar o "Evolução Acumulada" (`SdrCumulativeChart`) em um gráfico de **linha diária** (não acumulativo), mostrando o realizado de cada dia vs a meta diária como linha de referência.

### Arquivos afetados

| Arquivo | Ação |
|---------|------|
| `src/components/sdr/SdrCumulativeChart.tsx` | Trocar `accumulated`/`metaAccumulated` por `realized`/`metaDiaria` do DailyRow; renomear título para "Evolução Diária"; largura total |
| `src/pages/crm/SdrMeetingsDetailPage.tsx` | Remover `SdrMeetingsChart` e seu import; remover grid 2-col; renderizar `SdrCumulativeChart` sozinho em largura total |

### Detalhes técnicos

**SdrCumulativeChart.tsx** — mudar `chartData` de:
```js
{ realizado: row.accumulated, meta: row.metaAccumulated }
```
para:
```js
{ realizado: row.realized, meta: row.metaDiaria }
```
- Título: "Evolução Diária"
- Icone: `BarChart3` ou `TrendingUp`
- Linha "Realizado" sobe e desce por dia
- Linha "Meta" fica flat (meta diária constante, 0 nos fins de semana)

**SdrMeetingsDetailPage.tsx** — remover import de `SdrMeetingsChart`, remover grid wrapper, deixar apenas:
```tsx
<SdrCumulativeChart dailyRows={perfData.dailyRows} isLoading={perfData.isLoading} />
```

