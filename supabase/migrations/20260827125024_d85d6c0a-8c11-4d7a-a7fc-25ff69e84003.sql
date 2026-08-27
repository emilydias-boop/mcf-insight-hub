UPDATE consorcio_termo_modelos SET ativo = false, updated_at = now()
 WHERE tipo = 'adesao' AND ativo;

INSERT INTO consorcio_termo_modelos (nome, tipo, versao, ativo, conteudo, created_by)
SELECT v3.nome,
       'adesao',
       (SELECT COALESCE(MAX(versao), 0) + 1 FROM consorcio_termo_modelos WHERE tipo = 'adesao'),
       true,
       replace(
         replace(
           v3.conteudo,
           '**Valor da parcela (1ª à 12ª):** {{parcela_1a_12a}}',
           '**{{parcela_diferenciada_label}}:** {{parcela_1a_12a}}'
         ),
         '**Valor das demais parcelas:** {{parcela_demais}}',
         '**{{parcela_demais_label}}:** {{parcela_demais}}'
       ),
       v3.created_by
FROM consorcio_termo_modelos v3
WHERE v3.id = 'f3421c82-aa21-44b7-92df-505f2ac3ea4e';