# Consulta somente leitura: relatorio_diario_bu('2026-11-23')

- Rodar, com acesso administrativo e apenas leitura: `select * from public.relatorio_diario_bu('2026-11-23') order by bu, metrica;`
- Colar a saída bruta linha a linha, sem resumir.
- Nada será alterado em código, banco, dados ou permissões, e nada será publicado.

Motivo: a conexão de leitura comum retorna `42501 permission denied for function relatorio_diario_bu` (a função só aceita EXECUTE do service_role), e o acesso administrativo só fica disponível fora do modo de planejamento.
