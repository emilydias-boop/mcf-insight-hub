
# Plano: Mover Coluna Outside para Entre R1 Realizada e No-show

## Ordem Atual das Colunas

| # | Coluna |
|---|--------|
| 1 | Closer |
| 2 | R1 Agendada |
| 3 | R1 Realizada |
| 4 | No-show |
| 5 | Taxa No-Show |
| 6 | Contrato Pago |
| 7 | **Outside** |
| 8 | R2 Agendada |
| 9 | Taxa Conv. |

## Nova Ordem das Colunas

| # | Coluna |
|---|--------|
| 1 | Closer |
| 2 | R1 Agendada |
| 3 | R1 Realizada |
| 4 | **Outside** |
| 5 | No-show |
| 6 | Taxa No-Show |
| 7 | Contrato Pago |
| 8 | R2 Agendada |
| 9 | Taxa Conv. |

---

## Alteracoes no Arquivo

**Arquivo:** `src/components/sdr/CloserSummaryTable.tsx`

### 1. Header (linhas 71-79)
Mover a coluna "Outside" da posicao 7 para a posicao 4 (entre R1 Realizada e No-show)

### 2. Body - Linhas de cada Closer (linhas 116-146)
Mover a celula Outside (atualmente linhas 136-138) para depois de R1 Realizada (linha 126)

### 3. Totals Row (linhas 153-197)
Mover a celula Outside do total (atualmente linhas 179-181) para depois de R1 Realizada (linha 161)

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
<TableHead>R1 Realizada</TableHead>
<TableHead>Outside</TableHead>       // Movido para ca
<TableHead>No-show</TableHead>
<TableHead>Taxa No-Show</TableHead>
<TableHead>Contrato Pago</TableHead>
<TableHead>R2 Agendada</TableHead>
<TableHead>Taxa Conv.</TableHead>
```
