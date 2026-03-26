

## Remover gráfico "Meta × Realizado"

O gráfico é redundante — os KPI cards já mostram meta vs realizado com % de atingimento, gap e cores. Além disso, a escala distorcida por Ligações torna os outros valores invisíveis.

### Mudanças

**Arquivo: `src/pages/crm/SdrMeetingsDetailPage.tsx`**
- Remover a importação de `SdrMetaVsRealizadoChart`
- Remover o grid que contém `SdrMetaVsRealizadoChart` + `SdrFunnelPanel` (linhas 181-184)
- Mover `SdrFunnelPanel` para outro lugar ou colocá-lo sozinho em largura total

**Layout resultante** (seção "Visão Geral"):
```text
[Auto Summary]
[KPIs 3×2] [Projeção vertical]
[Funnel - largura total]
[Evolução Diária] [Evolução Acumulada]
[Team Comparison]
[Daily Breakdown]
```

