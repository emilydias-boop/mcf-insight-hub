# Consulta somente leitura: relatorio_diario_bu('2026-11-12')

No modo de planejamento, a consulta foi recusada por falta de permissão na função (erro 42501). A ferramenta com acesso administrativo usada nas rodadas anteriores só está liberada no modo de construção.

## Ao aprovar
- Rodar exatamente: `select * from public.relatorio_diario_bu('2026-11-12') order by bu, metrica;` com acesso administrativo.
- Colar a saída bruta, linha por linha, num bloco de código.
- Não editar arquivos, não alterar dados e não publicar.
