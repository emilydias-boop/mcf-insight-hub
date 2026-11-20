# Consulta somente leitura: relatório diário por BU (19/11/2026)

O modo de planejamento só deixa usar a conexão de leitura comum, e ela não tem permissão para essa função (`permission denied for function relatorio_diario_bu`).

## O que será feito após aprovação
- Rodar exatamente `select * from public.relatorio_diario_bu('2026-11-19') order by bu, metrica;` com acesso administrativo, dentro de uma transação `begin read only ... rollback`.
- Colar a saída bruta, linha a linha, sem tabela nem resumo.
- Não editar arquivos, dados, funções nem publicar nada.
