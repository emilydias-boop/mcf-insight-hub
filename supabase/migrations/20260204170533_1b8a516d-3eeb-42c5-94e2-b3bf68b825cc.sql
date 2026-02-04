
-- Corrigir comp_plan existente com pesos corretos (35%/55%/0%/10%)
UPDATE sdr_comp_plan 
SET 
  fixo_valor = 3150,
  variavel_total = 1350,
  valor_meta_rpg = 472.50,
  valor_docs_reuniao = 742.50,
  valor_tentativas = 0,
  valor_organizacao = 135.00
WHERE id = '0a3f1e45-d1e7-4675-ae29-fdd424871cba';

-- Corrigir iFood no payout existente
UPDATE sdr_month_payout
SET ifood_mensal = 570
WHERE id = 'd0cff632-7f99-4e5b-a3e1-f7b867e1ead2';
