# Consulta somente leitura

Rodar `select * from public.relatorio_diario_bu('2026-11-20') order by bu, metrica;` em transacao READ ONLY com ROLLBACK, pelo acesso administrativo, e colar a saida bruta linha a linha.

- Nenhuma alteracao de dados, permissoes ou codigo.
- Nao publicar.
- Se o acesso administrativo seguir indisponivel, informar o erro sem contornar permissoes.
