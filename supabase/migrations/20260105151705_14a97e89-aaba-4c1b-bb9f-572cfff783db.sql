-- Add vendedor fields to consortium_payments
ALTER TABLE consortium_payments 
ADD COLUMN IF NOT EXISTS vendedor_id uuid REFERENCES employees(id),
ADD COLUMN IF NOT EXISTS vendedor_name text;