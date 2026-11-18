# Consulta somente leitura: relatorio_diario_bu('2026-11-17')

A consulta padrão foi negada (42501, sem permissão na função). Para obter a saída, executar com acesso administrativo dentro de transação somente leitura:

```text
begin read only;
select * from public.relatorio_diario_bu('2026-11-17') order by bu, metrica;
rollback;
```

- Nenhuma tabela, função, dado ou tela será alterado; nada será publicado.
- A saída será colada bruta, linha a linha, sem resumo.
