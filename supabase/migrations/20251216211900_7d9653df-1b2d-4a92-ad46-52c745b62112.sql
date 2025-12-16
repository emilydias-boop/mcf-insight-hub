-- Marcar 6 transações A010 como não contar no dashboard
-- 5 transações do dia 12/12 (timezone BRT vs UTC) + 1 email com typo duplicado

UPDATE hubla_transactions 
SET count_in_dashboard = false, updated_at = now()
WHERE customer_email IN (
  '61ricardomarcelo@gmail.com',
  'caique.lpereira@hotmail.com',
  'emidio.matheus@outlook.com',
  'henriqueengcivilpf@gmail.com',
  'luks@grupozup.com',
  'guiilhermeafigueiredo@yahoo.com.br'
)
AND (product_category = 'a010' OR product_name ILIKE '%A010%')
AND count_in_dashboard = true;