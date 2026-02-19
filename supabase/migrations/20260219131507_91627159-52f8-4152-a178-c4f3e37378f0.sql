-- Mapear 3 produtos faltantes como BU Incorporador
UPDATE product_configurations 
SET target_bu = 'incorporador' 
WHERE product_name IN ('OB Construir Para Alugar', 'OB Acesso Vitalício', 'Imersão Presencial');