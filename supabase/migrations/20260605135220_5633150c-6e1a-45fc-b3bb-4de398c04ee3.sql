UPDATE public.consorcio_closer_payout
SET ote_total = 8000,
    fixo_valor = 5600,
    variavel_total = 2400,
    total_conta = 5600 + COALESCE(valor_variavel_final, 0) + COALESCE(bonus_extra, 0),
    updated_at = now()
WHERE closer_id = '4e3eabf5-149f-4130-ad8b-72fa929671f6'
  AND ano_mes = '2026-05'
  AND status <> 'LOCKED';