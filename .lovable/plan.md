

# Plano: Mover Outside para Entre R1 Agendada e R1 Realizada

## Ordem Atual das Colunas

| # | Coluna |
|---|--------|
| 1 | Closer |
| 2 | R1 Agendada |
| 3 | R1 Realizada |
| 4 | Outside |
| 5 | No-show |
| ... | ... |

## Nova Ordem das Colunas

| # | Coluna |
|---|--------|
| 1 | Closer |
| 2 | R1 Agendada |
| 3 | **Outside** |
| 4 | R1 Realizada |
| 5 | No-show |
| ... | ... |

---

## Alteracoes no Arquivo

**Arquivo:** `src/components/sdr/CloserSummaryTable.tsx`

### 1. Header (linhas 72-74)
Mover Outside de depois de R1 Realizada para depois de R1 Agendada

### 2. Body Rows (linhas 123-128)
Mover celula Outside (linhas 127-129) para depois de R1 Agendada (linha 123)

### 3. Totals Row (linhas 158-163)
Mover celula Outside (linhas 162-164) para depois de R1 Agendada (linha 158)

---

## Secao Tecnica

### Arquivo Afetado
- `src/components/sdr/CloserSummaryTable.tsx`

### Escopo
- 3 blocos de alteracao: Header, Body rows, Totals row
- Apenas reordenacao visual, sem mudanca de logica

### Estrutura Final do Header
```tsx
<TableHead>Closer</TableHead>
<TableHead>R1 Agendada</TableHead>
<TableHead>Outside</TableHead>       // Movido para ca
<TableHead>R1 Realizada</TableHead>
<TableHead>No-show</TableHead>
<TableHead>Taxa No-Show</TableHead>
<TableHead>Contrato Pago</TableHead>
<TableHead>R2 Agendada</TableHead>
<TableHead>Taxa Conv.</TableHead>
```

