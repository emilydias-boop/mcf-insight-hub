# Consulta somente leitura: relatório diário das BUs de 14/11/2026

Nada será alterado nem publicado.

## Passo
- Rodar exatamente: `select * from public.relatorio_diario_bu('2026-11-14') order by bu, metrica;`
- Colar a saída bruta, linha a linha.

## Detalhe técnico
A consulta de leitura padrão não tem permissão para essa função (erro 42501). Como nas rodadas anteriores, ela precisa rodar com acesso de administrador, que só funciona no modo de execução. A consulta é só SELECT e não altera dados.
