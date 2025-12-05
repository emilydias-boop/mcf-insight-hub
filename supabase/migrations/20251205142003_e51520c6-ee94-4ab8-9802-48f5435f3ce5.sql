
-- Atualizar categorias para a010 (conforme planilha do usuário)
-- Estes emails aparecem na planilha A010 mas estavam categorizados como OB

UPDATE hubla_transactions
SET product_category = 'a010',
    updated_at = now()
WHERE id IN (
  'c46394f4-c808-4956-b5e5-24e2c44ca594',  -- brunogregorioo@gmail.com (02/12)
  'e55b7cdd-9df9-4349-adb8-1a6a873e74b5',  -- erineia@hotmail.com.br (03/12)
  '34b7c18c-6bb3-4141-8219-ff4987d82bef'   -- andrecardoso.sv@hotmail.com (04/12)
);
