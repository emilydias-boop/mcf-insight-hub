# Leitura: relatorio_diario_bu('2026-10-30')

Somente leitura. Nenhuma alteração em código, banco ou configuração.

## Situação
- A consulta normal foi recusada pelo banco: `42501: permission denied for function relatorio_diario_bu` (o leitor comum não tem permissão de executar essa função).
- O caminho administrativo de leitura, usado nas rodadas anteriores, fica bloqueado no modo plano.

## O que será feito ao aprovar
1. Rodar exatamente `select * from public.relatorio_diario_bu('2026-10-30') order by bu, metrica;` pelo caminho administrativo, somente SELECT.
2. Colar a saída bruta, linha a linha, sem interpretação.
