-- Drop existing foreign key constraint referencing employees
ALTER TABLE consortium_cards
DROP CONSTRAINT IF EXISTS consortium_cards_vendedor_id_fkey;

-- Create new foreign key referencing profiles table
ALTER TABLE consortium_cards
ADD CONSTRAINT consortium_cards_vendedor_id_fkey
FOREIGN KEY (vendedor_id) REFERENCES profiles(id) ON DELETE SET NULL;