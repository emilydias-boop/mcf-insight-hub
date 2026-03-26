

## Reorganizar KPIs + Projeção lado a lado

### Layout proposto

```text
┌──────────────────────────────────┐ ┌──────────────────┐
│  Agend.  │ R1 Real. │ Contratos │ │ Projeção Período │
│──────────┼──────────┼───────────│ │                  │
│  Tx Cont │ Tx NoSh  │ Ligações  │ │ Meta Final: 110  │
└──────────────────────────────────┘ │ Realizado:  96   │
                                     │ Projeção:   111  │
                                     │ Faltam:     14   │
                                     │ Necess/dia: 4.7  │
                                     │ ████████░░  87%  │
                                     └──────────────────┘
```

### Mudanças

**Arquivo 1: `src/pages/crm/SdrMeetingsDetailPage.tsx`**
- Agrupar KPIs e Projeção num wrapper flex/grid lado a lado:
  - Esquerda (~65%): `<SdrDetailKPICards />`
  - Direita (~35%): `<SdrProjectionCard />`

**Arquivo 2: `src/components/sdr/SdrProjectionCard.tsx`**
- Mudar layout de horizontal (grid-cols-5) para vertical (stack)
- Cada item (Meta Final, Realizado, Projeção, Faltam, Necessário/dia) empilhado
- Barra de progresso no rodapé
- Altura se ajusta automaticamente aos KPIs ao lado

### Arquivos afetados

| Arquivo | Ação |
|---------|------|
| `src/pages/crm/SdrMeetingsDetailPage.tsx` | Wrapper flex para KPIs + Projeção lado a lado |
| `src/components/sdr/SdrProjectionCard.tsx` | Layout vertical em vez de horizontal |

