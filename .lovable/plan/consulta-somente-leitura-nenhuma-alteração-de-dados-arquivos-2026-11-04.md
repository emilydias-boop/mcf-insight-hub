Consulta somente leitura (nenhuma alteração de dados, arquivos ou publicação):

select * from public.relatorio_diario_bu('2026-11-03') order by bu, metrica;

- A leitura comum retorna "permissão negada" (42501) para essa função.
- O caminho administrativo, que já foi usado antes só para SELECT, fica bloqueado no modo plano.
- Ao aprovar, rodo somente esse SELECT pelo caminho administrativo e colo a saída bruta linha a linha.
