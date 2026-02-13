
# Corrigir Contagem de Vendas de Lancamento

## Problema

A tabela "Faturamento por Closer" mostra apenas 4 transacoes de Lancamento (R$ 104), mas o banco de dados tem 46 transacoes com `sale_origin = 'launch'` (R$ 11.273 net) em Janeiro.

**Causa raiz**: O codigo primeiro tenta vincular cada transacao a um closer por email/telefone. Somente transacoes que NAO encontram nenhum closer verificam se sao de lancamento. Resultado: 42 vendas de lancamento estao sendo contabilizadas como vendas de closers.

## Solucao

Mover a verificacao de `sale_origin === 'launch'` para ANTES do loop de matching de closers. Assim, toda transacao marcada como lancamento vai direto para a linha "Lancamento", independente de o comprador ter contato com algum closer.

## Alteracao

### Arquivo: `src/components/relatorios/CloserRevenueSummaryTable.tsx`

Na funcao `useMemo` que processa as transacoes (linhas ~115-175), reorganizar a logica:

```text
// ANTES (atual):
for (const tx of transactions) {
  // 1. Tenta match com closer
  // 2. Se nao encontrou -> verifica se e lancamento
}

// DEPOIS (corrigido):
for (const tx of transactions) {
  // 1. Se sale_origin === 'launch' -> vai para Lancamento
  // 2. Senao -> tenta match com closer
  // 3. Se nao encontrou -> vai para Sem closer
}
```

Concretamente, adicionar antes do loop de closers:

```text
if (tx.sale_origin === 'launch') {
  launch.count++;
  launch.gross += gross;
  launch.net += net;
  launchTxs.push(tx);
  continue;
}
```

E remover a verificacao duplicada no bloco `if (!matched)`.

## Resultado Esperado

- Linha "Lancamento" mostrara ~46 transacoes em vez de 4
- Faturamento dos closers diminuira proporcionalmente (vendas de lancamento serao removidas)
- Totais gerais permanecem iguais
