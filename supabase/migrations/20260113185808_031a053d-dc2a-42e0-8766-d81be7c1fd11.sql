-- Add categoria column to consortium_cards table
ALTER TABLE consortium_cards 
ADD COLUMN categoria TEXT NOT NULL DEFAULT 'inside' 
CHECK (categoria IN ('inside', 'life'));