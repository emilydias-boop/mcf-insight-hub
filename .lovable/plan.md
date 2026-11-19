# Consulta somente leitura: relatório diário por BU de 18/11/2026

A consulta comum foi negada por falta de permissão na função `relatorio_diario_bu`. Para obter a saída sem alterar nada:

1. Executar com acesso administrativo, dentro de uma transação somente leitura que é desfeita ao final:
   `begin read only; select * from public.relatorio_diario_bu('2026-11-18') order by bu, metrica; rollback;`
2. Colar a saída bruta, linha a linha, em bloco de texto.

Nenhum dado, função, tela ou permissão será alterado, e nada será publicado.
