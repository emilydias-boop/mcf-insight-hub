
# Correção: Tabela "Faturamento por Closer" mostra apenas closers reais

## Problema

Transações automáticas (Lançamento, A010, Vitalício, Renovação) estão sendo adicionadas à tabela de Closer e SDR usando o nome da origem como label. Essas categorias devem aparecer APENAS na tabela "Faturamento por Origem", não nas tabelas de Closer e SDR.

## Solução

No arquivo `src/hooks/useAcquisitionReport.ts`, na seção que constrói os dados por dimensão (linha ~305), adicionar uma verificação: só incluir na `closerMap` e `sdrMap` transações que NÃO sejam de origens automáticas.

```text
// Antes (linha 308-309):
addTo(closerMap, closerName, gross, net, isOutside);
addTo(sdrMap, sdrName, gross, net, isOutside);

// Depois:
const isAutomatic = AUTOMATIC_ORIGINS.has(origin);
if (!isAutomatic) {
  addTo(closerMap, closerName, gross, net, isOutside);
  addTo(sdrMap, sdrName, gross, net, isOutside);
}
```

As tabelas de Canal, Origem e Outside continuam recebendo todas as transações normalmente.

## Resultado

- Tabela Closer: apenas Julio, Cristiane Gomes, Thayna, Mateus Macedo e "Sem Closer"
- Tabela SDR: apenas SDRs reais e "Sem SDR"
- Tabela Origem: continua mostrando Lançamento, A010, Vitalício, Renovação etc.
- KPIs no topo mantêm o total geral (todas as transações)

## Arquivo alterado

| Arquivo | Alteração |
|---|---|
| `src/hooks/useAcquisitionReport.ts` | Filtrar origens automáticas das tabelas Closer e SDR |
