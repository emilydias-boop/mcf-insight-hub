UPDATE public.consorcio_termo_modelos
SET conteudo = replace(conteudo, '## Cronograma das 12 primeiras parcelas', '## Cronograma das primeiras {{cronograma_qtd}} parcelas')
WHERE tipo = 'comprovante_cadastro'
  AND conteudo LIKE '%## Cronograma das 12 primeiras parcelas%';