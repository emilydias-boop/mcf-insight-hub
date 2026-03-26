

## Colocar Funil e Evolução Diária lado a lado

### Mudança

**Arquivo: `src/pages/crm/SdrMeetingsDetailPage.tsx`** (linhas 180-184)

Envolver `SdrFunnelPanel` e `SdrCumulativeChart` em um grid de 2 colunas:

```tsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
  <SdrFunnelPanel funnel={perfData.funnel} isLoading={perfData.isLoading} />
  <SdrCumulativeChart dailyRows={perfData.dailyRows} isLoading={perfData.isLoading} />
</div>
```

Layout resultante:
```text
[Auto Summary]
[KPIs 3×2] [Projeção]
[Funil Individual | Evolução Diária]
[Team Comparison]
[Daily Breakdown]
```

