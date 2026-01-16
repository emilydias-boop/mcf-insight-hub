-- Add columns to store installment composition data
ALTER TABLE consortium_cards
ADD COLUMN IF NOT EXISTS produto_embracon TEXT DEFAULT 'auto',
ADD COLUMN IF NOT EXISTS condicao_pagamento TEXT DEFAULT 'convencional',
ADD COLUMN IF NOT EXISTS inclui_seguro_vida BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS parcela_1a_12a NUMERIC,
ADD COLUMN IF NOT EXISTS parcela_demais NUMERIC;