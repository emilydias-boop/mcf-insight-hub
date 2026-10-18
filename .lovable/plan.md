# Relatório diário por BU de 16/10 e 17/10 (somente leitura)

## O que será feito
1. Rodar estas duas consultas:
   - `select * from public.relatorio_diario_bu('2026-10-16') order by bu, metrica;`
   - `select * from public.relatorio_diario_bu('2026-10-17') order by bu, metrica;`
   O canal de leitura normal costuma recusar esta função com "permission denied" (42501). Se isso acontecer, as consultas rodam pelo canal administrativo, dentro de uma transação só de leitura (READ ONLY) desfeita no final, como nos relatórios de 13/10 a 15/10.
2. Colar a saída bruta de cada data, linha a linha, sem resumir e sem mudar a ordem.
3. Registrar os dois pedidos em roadmap.md e marcá-los como concluídos.

## O que não será feito
- Nenhum dado será inserido, alterado ou excluído. Não haverá migration, alteração de código nem publicação.
- A troca do card do Kawer para o William continua pendente e depende de nova aprovação.
