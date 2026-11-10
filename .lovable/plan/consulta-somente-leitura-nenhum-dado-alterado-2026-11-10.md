Consulta somente leitura (nenhum dado alterado)

O modo de leitura do banco não tem permissão para executar `relatorio_diario_bu`. A consulta só roda com o acesso administrativo, que fica bloqueado enquanto o modo plano estiver ativo.

Ao aprovar:
- Rodar `select * from public.relatorio_diario_bu('2026-11-09') order by bu, metrica;` com acesso administrativo.
- Colar a saída bruta, uma linha por vez.
- Não editar nenhum arquivo nem dado.
