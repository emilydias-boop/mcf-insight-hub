Consulta somente leitura: relatorio_diario_bu('2026-11-02')

O acesso normal de leitura foi recusado (42501: permission denied for function relatorio_diario_bu), como nas rodadas anteriores.

Passo único, após aprovação:
- Executar pelo caminho administrativo, somente SELECT:
  select * from public.relatorio_diario_bu('2026-11-02') order by bu, metrica;
- Colar a saída bruta, linha a linha.

Nada será alterado: sem código, banco, funções, configurações, migração ou publicação.
