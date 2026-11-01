Consulta somente leitura: relatório diário por BU de 31/10/2026

Objetivo: rodar e colar a saída bruta, linha a linha, de:

```text
select * from public.relatorio_diario_bu('2026-10-31') order by bu, metrica;
```

Situação: pelo acesso normal de leitura, o banco recusou com `42501: permission denied for function relatorio_diario_bu`. O caminho administrativo usado em 30/10 não fica disponível no modo plano.

Passo único (após aprovação):
- Rodar a mesma consulta pelo caminho administrativo, somente SELECT.
- Colar as linhas exatamente como vierem (bu, metrica, valor, agregacao, status), sem arredondar.

Não será alterado: código, banco, funções, configurações. Nada é publicado.
