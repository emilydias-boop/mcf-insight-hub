

## Melhorar legibilidade dos KPI Cards do SDR

### Problema

Cada card mostra 5 informações em texto minúsculo (11px) sem hierarquia clara:
- **Meta: 198** e **70%** na mesma linha — não fica claro que 70% é o atingimento
- **Gap: -59** — termo técnico, muitos gestores não entendem de primeira
- **↗ +31%** — não explica que é comparação com período anterior
- Tudo tem a mesma cor e tamanho, vira "sopa de números"

### Solução

Reorganizar cada card com **hierarquia visual clara** e **labels descritivos**:

```text
┌─────────────────────────┐
│  AGENDAMENTOS           │
│  139                    │  ← valor grande, destaque
│                         │
│  ████████████░░░░  70%  │  ← barra com % atingimento
│  Meta: 198              │  ← abaixo da barra, contexto
│                         │
│  🔴 Faltam 59           │  ← em vez de "Gap: -59"
│  📈 +31% vs anterior    │  ← label explícito
└─────────────────────────┘
```

### Mudanças concretas no `SdrDetailKPICards.tsx`

1. **Trocar "Gap: -X"** por linguagem natural:
   - Negativo → "Faltam 59" (vermelho)
   - Positivo → "Acima: +5" (verde)
   - Zero → "Na meta ✓" (verde)

2. **Trocar "↗ +31%"** por "**+31% vs anterior**" — adicionar o texto "vs anterior" para contextualizar

3. **Reordenar layout** do card:
   - Título (11px uppercase)
   - Valor realizado (2xl bold)
   - Barra de progresso com % de atingimento à direita
   - Meta abaixo da barra (texto discreto)
   - Linha final: gap humanizado à esquerda, variação com label à direita

4. **Adicionar Tooltip** em cada card com explicação completa (ex: "Agendamentos realizados no período vs meta calculada. Comparação com o mesmo período do mês anterior.")

### Arquivo afetado

| Arquivo | Ação |
|---------|------|
| `SdrDetailKPICards.tsx` | Reescrever layout interno do `KPICard` — mesma estrutura de dados, apresentação mais clara |

Nenhuma mudança em hooks ou dados — apenas apresentação visual.

