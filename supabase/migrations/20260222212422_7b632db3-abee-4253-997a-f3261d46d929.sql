-- Primeiro: limpar vendedor_ids que referenciam profiles (não existem em consorcio_vendedor_options)
UPDATE consortium_cards
SET vendedor_id = NULL
WHERE vendedor_id IS NOT NULL
AND vendedor_id NOT IN (SELECT id FROM consorcio_vendedor_options);

-- Agora: recriar a constraint correta
ALTER TABLE consortium_cards DROP CONSTRAINT IF EXISTS consortium_cards_vendedor_id_fkey;

ALTER TABLE consortium_cards ADD CONSTRAINT consortium_cards_vendedor_id_fkey
  FOREIGN KEY (vendedor_id) REFERENCES consorcio_vendedor_options(id)
  ON DELETE SET NULL;