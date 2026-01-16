-- Primeiro criar o unique index para evitar duplicatas
CREATE UNIQUE INDEX IF NOT EXISTS idx_consorcio_creditos_produto_valor 
ON consorcio_creditos (produto_id, valor_credito) 
WHERE produto_id IS NOT NULL;