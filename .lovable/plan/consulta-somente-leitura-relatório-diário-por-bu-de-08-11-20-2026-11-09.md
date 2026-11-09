Consulta somente leitura: relatório diário por BU de 08/11/2026

- O acesso de leitura não tem permissão para executar `relatorio_diario_bu` (permission denied).
- A função é STABLE e só lê dados; nas rodadas anteriores (06 e 07/11) ela rodou pelo acesso administrativo.
- No modo atual esse acesso está bloqueado. Ao aprovar, rodo apenas:

```text
select * from public.relatorio_diario_bu('2026-11-08') order by bu, metrica;
```

e colo a saída bruta, linha a linha. Nada é editado, nenhum dado é alterado, nada é publicado.
