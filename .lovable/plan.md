# Consulta somente leitura: relatorio_diario_bu('2026-11-22')

A conexão de leitura comum recebeu "permission denied" (42501) para a função. Com a aprovação, rodo a consulta com acesso administrativo, numa transação somente leitura desfeita ao final:

```sql
begin read only;
select * from public.relatorio_diario_bu('2026-11-22') order by bu, metrica;
rollback;
```

- Nenhum arquivo, dado, função ou permissão é alterado.
- Nada é publicado; nenhum plano de outra pessoa é tocado.
- Saída bruta colada linha a linha, sem resumo nem tabela.
