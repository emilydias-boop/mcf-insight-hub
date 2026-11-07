Consulta somente leitura (nenhuma alteração de dados ou código)

- Rodar: `select * from public.relatorio_diario_bu('2026-11-06') order by bu, metrica;` pelo acesso administrativo do banco.
- Motivo: o acesso de leitura recebe "permission denied" nessa função. Confirmei que ela é STABLE e não contém INSERT/UPDATE/DELETE/TRUNCATE, então rodar como admin não altera nada.
- Entrega: colar a saída bruta, linha a linha, sem resumir.
