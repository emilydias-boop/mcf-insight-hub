# Leitura do relatório diário por BU — 13/11/2026

Somente leitura. Nada será alterado nem publicado.

1. Executar com acesso administrativo (apenas SELECT):
   `select * from public.relatorio_diario_bu('2026-11-13') order by bu, metrica;`
2. Colar a saída bruta, linha a linha.

## Motivo
A consulta de leitura comum foi recusada (erro 42501, sem permissão na função). O acesso administrativo só fica disponível fora do modo de planejamento.
