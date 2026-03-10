

## Problema: Ícone de alerta aparece mesmo com valor correto

O triângulo amarelo aparece porque `hasDivergence` compara o valor **calculado localmente** com o valor **salvo no banco** (`payout.valor_variavel_total`). Agora que a tabela mostra o valor calculado correto, a divergência é entre o display (correto) e o banco (desatualizado) — ou seja, o alerta está dizendo "o banco está desatualizado", não "o valor exibido está errado".

O ícone deveria ser removido ou repensado, já que agora o valor exibido já é o correto. O alerta só faz sentido para indicar que o banco precisa de recálculo (Edge Function), mas isso confunde o usuário.

### Solução

Remover o ícone `AlertTriangle` da coluna "Variável" no `PayoutTableRow.tsx`. O valor exibido já é o correto (calculado localmente), então não há motivo para alertar o usuário. O botão "Recalcular Todos" já existe para sincronizar o banco quando necessário.

### Mudança

| Arquivo | O que muda |
|---------|-----------|
| `src/components/fechamento/PayoutTableRow.tsx` | Remover a lógica `hasDivergence` e o ícone `AlertTriangle` da coluna Variável (linhas 79-80 e o bloco condicional no JSX) |

