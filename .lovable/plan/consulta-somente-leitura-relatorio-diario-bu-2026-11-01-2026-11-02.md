Consulta somente leitura: relatorio_diario_bu('2026-11-01')

O acesso normal recusa a função (42501: permission denied). Nas rodadas anteriores o resultado veio pelo caminho administrativo, que só fica disponível fora do modo plano.

Ao aprovar, será rodado apenas:

select * from public.relatorio_diario_bu('2026-11-01') order by bu, metrica;

Nada será criado, alterado ou apagado. A saída bruta será colada linha a linha, com os valores sem arredondar.
