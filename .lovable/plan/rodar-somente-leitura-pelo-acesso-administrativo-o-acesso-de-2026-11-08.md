Rodar somente leitura, pelo acesso administrativo (o acesso de leitura não tem permissão para a função, que só lê dados):

select * from public.relatorio_diario_bu('2026-11-07') order by bu, metrica;

Colar a saída bruta, linha a linha. Nada será alterado nem publicado.
