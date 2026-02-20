
CREATE TABLE consorcio_produto_adquirido_options (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  label text NOT NULL,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE deal_produtos_adquiridos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id uuid NOT NULL REFERENCES crm_deals(id) ON DELETE CASCADE,
  produto_option_id uuid NOT NULL REFERENCES consorcio_produto_adquirido_options(id),
  valor numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(deal_id, produto_option_id)
);

ALTER TABLE consorcio_produto_adquirido_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_produtos_adquiridos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read produto options"
ON consorcio_produto_adquirido_options FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert produto options"
ON consorcio_produto_adquirido_options FOR INSERT
TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update produto options"
ON consorcio_produto_adquirido_options FOR UPDATE
TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete produto options"
ON consorcio_produto_adquirido_options FOR DELETE
TO authenticated USING (true);

CREATE POLICY "Authenticated users can read deal produtos"
ON deal_produtos_adquiridos FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert deal produtos"
ON deal_produtos_adquiridos FOR INSERT
TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update deal produtos"
ON deal_produtos_adquiridos FOR UPDATE
TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete deal produtos"
ON deal_produtos_adquiridos FOR DELETE
TO authenticated USING (true);
