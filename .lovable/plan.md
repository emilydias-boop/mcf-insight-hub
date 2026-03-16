

## Recalcular datas subsequentes ao editar qualquer parcela (não só a 1ª)

### Problema
Atualmente, o checkbox "Recalcular datas das demais parcelas" aparece **apenas para a parcela 1** (`isPrimeiraParcela`). Quando você altera a data da parcela 1 para janeiro e marca recalcular, a parcela 2 vai para fevereiro corretamente. Porém, se a parcela 2 já estava com data errada (março) e você quer corrigir editando a parcela 1, precisa marcar o checkbox.

O problema maior é que **não é possível recalcular a partir de qualquer parcela**, só da primeira. Se a parcela 2 está em março e deveria ser fevereiro, você não consegue editar a parcela 2 e pedir para recalcular as demais a partir dela.

### Solução

**1. `EditInstallmentDialog.tsx`** -- Mostrar checkbox de recalcular para **qualquer parcela**, não só a primeira

- Remover a condição `isPrimeiraParcela` do bloco do checkbox
- Ajustar o texto: "Recalcular datas das parcelas seguintes a partir desta"

**2. `ConsorcioCardDrawer.tsx`** -- Ajustar lógica de recalcular para começar da parcela editada + 1

- Atualmente usa `recalcularDatasAPartirDe(novaDataBase, diaVencimento, totalParcelas, 2)` (sempre a partir da parcela 2)
- Mudar para usar o `numero_parcela` da parcela editada + 1 como ponto de partida
- Exemplo: se editou a parcela 1 com data 19/01/2026, recalcula parcelas 2, 3, 4... a partir de fevereiro
- Se editou a parcela 5 com data 19/05/2026, recalcula parcelas 6, 7, 8... a partir de junho

### Arquivos

| Ação | Arquivo |
|------|---------|
| Editar | `src/components/consorcio/EditInstallmentDialog.tsx` -- remover condição `isPrimeiraParcela` do checkbox |
| Editar | `src/components/consorcio/ConsorcioCardDrawer.tsx` -- usar `numero_parcela` da parcela editada como base do recalculo |

