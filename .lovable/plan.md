

# Filtrar Thobson e Luis Felipe do Fechamento Consórcio

## Diagnóstico

A query `useConsorcioPayouts` busca **todos** os registros de `consorcio_closer_payout` do mês, sem aplicar o filtro de cargos excluídos (`CARGOS_EXCLUIDOS_LIST`). Já existe um filtro em `useConsorcioClosers()` que exclui cargos como "Closer R2", mas ele só é usado para listar closers — não para filtrar os payouts exibidos na tabela.

Dados no banco:
- **Thobson**: cargo = "Closer R2" (está na lista de exclusão, mas o payout aparece mesmo assim)
- **Luis Felipe**: sem registro em `employees`, então passa no filtro de cargos. Se ele não deve aparecer, precisa ser desativado na tabela `closers` ou ter um cargo excludente

## Solução

### Arquivo: `src/hooks/useConsorcioFechamento.ts` — `useConsorcioPayouts`

Após buscar os payouts, aplicar o mesmo filtro de cargos excluídos que já existe em `useConsorcioClosers`:
1. Coletar os emails dos closers dos payouts retornados
2. Buscar os cargos desses emails na tabela `employees`
3. Filtrar payouts cujo closer tenha cargo na `CARGOS_EXCLUIDOS_LIST`

Isso garante que Thobson (Closer R2) não apareça na listagem.

Para Luis Felipe: confirmar com o usuário se ele deve ser excluído por outro motivo (ex: desativação do closer) ou se precisa de um cargo específico no `employees`.

## Resultado esperado
- Thobson não aparece mais na lista de fechamento consórcio (cargo "Closer R2" excluído)
- Luis Felipe: depende da confirmação — se o cargo dele não está na lista de exclusão, pode ser necessário desativá-lo ou adicionar seu cargo à lista

