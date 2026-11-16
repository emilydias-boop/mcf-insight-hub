# Consulta somente leitura: relatorio_diario_bu('2026-11-15')

A consulta padrão retornou erro 42501 (sem permissão para a função), igual aos dias anteriores.

## Passo
- Executar, com acesso administrativo somente leitura, exatamente:
  `select * from public.relatorio_diario_bu('2026-11-15') order by bu, metrica;`
- Colar a saída bruta, linha a linha, sem resumo.

## Garantias
- Nenhuma alteração em código, dados ou permissões. Nada publicado.
