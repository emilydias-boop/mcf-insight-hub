-- Add missing R2 status options for "Fora do Carrinho"
INSERT INTO r2_status_options (name, color, display_order, is_active) VALUES
  ('Reprovado', '#DC2626', 6, true),
  ('Desistente', '#9333EA', 7, true),
  ('Próxima Semana', '#F97316', 8, true)
ON CONFLICT DO NOTHING;