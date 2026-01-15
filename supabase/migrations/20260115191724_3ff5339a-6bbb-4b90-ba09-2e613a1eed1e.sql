-- Tabela de status configuráveis para R2
CREATE TABLE IF NOT EXISTS r2_status_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6B7280',
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Inserir status padrão
INSERT INTO r2_status_options (name, color, display_order) VALUES
  ('Aprovado', '#22C55E', 1),
  ('Reembolso', '#EF4444', 2),
  ('Pendente', '#F59E0B', 3),
  ('Em Análise', '#3B82F6', 4),
  ('Cancelado', '#6B7280', 5);

-- Habilitar RLS
ALTER TABLE r2_status_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "r2_status_options_select" ON r2_status_options FOR SELECT USING (true);
CREATE POLICY "r2_status_options_insert" ON r2_status_options FOR INSERT WITH CHECK (true);
CREATE POLICY "r2_status_options_update" ON r2_status_options FOR UPDATE USING (true);
CREATE POLICY "r2_status_options_delete" ON r2_status_options FOR DELETE USING (true);

-- Tabela de termômetros/tags configuráveis
CREATE TABLE IF NOT EXISTS r2_thermometer_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6B7280',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Inserir tags padrão da planilha
INSERT INTO r2_thermometer_options (name, color) VALUES
  ('carrinho sexta-feira', '#22C55E'),
  ('inseguro', '#EF4444'),
  ('GRAVAÇÃO/indeciso', '#F59E0B'),
  ('precisa revisar', '#3B82F6'),
  ('prioridade alta', '#8B5CF6');

-- Habilitar RLS
ALTER TABLE r2_thermometer_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "r2_thermometer_options_select" ON r2_thermometer_options FOR SELECT USING (true);
CREATE POLICY "r2_thermometer_options_insert" ON r2_thermometer_options FOR INSERT WITH CHECK (true);
CREATE POLICY "r2_thermometer_options_update" ON r2_thermometer_options FOR UPDATE USING (true);
CREATE POLICY "r2_thermometer_options_delete" ON r2_thermometer_options FOR DELETE USING (true);

-- Adicionar campos específicos R2 em meeting_slot_attendees
ALTER TABLE meeting_slot_attendees 
  ADD COLUMN IF NOT EXISTS partner_name TEXT,
  ADD COLUMN IF NOT EXISTS lead_profile TEXT,
  ADD COLUMN IF NOT EXISTS video_status TEXT DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS r2_status_id UUID REFERENCES r2_status_options(id),
  ADD COLUMN IF NOT EXISTS thermometer_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS r2_confirmation TEXT,
  ADD COLUMN IF NOT EXISTS r2_observations TEXT,
  ADD COLUMN IF NOT EXISTS meeting_link TEXT,
  ADD COLUMN IF NOT EXISTS updated_by UUID,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Função de auditoria para R2
CREATE OR REPLACE FUNCTION log_r2_attendee_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data, new_data)
  VALUES (
    auth.uid(),
    TG_OP,
    'meeting_slot_attendees',
    COALESCE(NEW.id, OLD.id),
    to_jsonb(OLD),
    to_jsonb(NEW)
  );
  
  -- Atualizar updated_at
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at = now();
    NEW.updated_by = auth.uid();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger de auditoria
DROP TRIGGER IF EXISTS tr_r2_attendee_audit ON meeting_slot_attendees;
CREATE TRIGGER tr_r2_attendee_audit
  BEFORE UPDATE ON meeting_slot_attendees
  FOR EACH ROW EXECUTE FUNCTION log_r2_attendee_changes();