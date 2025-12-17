-- Vincular Julia Caroline ao seu user_id do auth
UPDATE employees 
SET user_id = '794a2257-422c-4b38-9014-3135d9e26361',
    updated_at = NOW()
WHERE id = '9bd46a2a-273d-4741-98c8-93b6594e918f'
  AND nome_completo = 'Julia Caroline';