-- Função utilitária para calcular o percentual correto por (tipo_produto, numero_parcela)
CREATE OR REPLACE FUNCTION public._percentual_comissao(tipo_produto text, numero_parcela int)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN tipo_produto = 'select' THEN
      CASE numero_parcela
        WHEN 1 THEN 1.20 WHEN 2 THEN 1.12 WHEN 3 THEN 1.12 WHEN 4 THEN 0.62
        WHEN 5 THEN 0.11 WHEN 6 THEN 0.11 WHEN 7 THEN 0.11 WHEN 8 THEN 1.11
        ELSE 0
      END
    WHEN tipo_produto = 'parcelinha' THEN
      CASE
        WHEN numero_parcela = 1 THEN 0.53
        WHEN numero_parcela BETWEEN 2 AND 4 THEN 0.43
        WHEN numero_parcela BETWEEN 5 AND 12 THEN 0.33
        ELSE 0
      END
    ELSE 0
  END
$$;

-- Recalcula comissão de todas as parcelas com base no valor_credito do cartão e tipo_produto
UPDATE public.consortium_installments AS i
SET valor_comissao = ROUND((c.valor_credito * public._percentual_comissao(c.tipo_produto, i.numero_parcela) / 100)::numeric, 2)
FROM public.consortium_cards AS c
WHERE i.card_id = c.id
  AND ROUND((c.valor_credito * public._percentual_comissao(c.tipo_produto, i.numero_parcela) / 100)::numeric, 2)
      <> ROUND(i.valor_comissao::numeric, 2);