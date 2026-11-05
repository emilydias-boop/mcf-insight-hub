Consulta somente leitura: relatorio_diario_bu de 04/11/2026

A consulta comum devolveu 42501 (sem permissão na função). No modo plano o caminho administrativo, que também é só leitura, fica bloqueado.

Ao aprovar:
- Rodar pelo caminho administrativo, só SELECT: `select * from public.relatorio_diario_bu('2026-11-04') order by bu, metrica;`
- Colar a saída bruta, linha a linha.
- Não alterar código, banco nem publicar.
