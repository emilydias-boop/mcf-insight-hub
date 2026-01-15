-- Criar tabela para histórico de movimentações
CREATE TABLE public.attendee_movement_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendee_id UUID NOT NULL REFERENCES meeting_slot_attendees(id) ON DELETE CASCADE,
  
  -- Slots de origem e destino
  from_slot_id UUID REFERENCES meeting_slots(id) ON DELETE SET NULL,
  to_slot_id UUID NOT NULL REFERENCES meeting_slots(id) ON DELETE CASCADE,
  
  -- Detalhes do slot de origem (snapshot)
  from_scheduled_at TIMESTAMPTZ,
  from_closer_id UUID,
  from_closer_name TEXT,
  
  -- Detalhes do slot de destino (snapshot)
  to_scheduled_at TIMESTAMPTZ NOT NULL,
  to_closer_id UUID,
  to_closer_name TEXT,
  
  -- Contexto da movimentação
  previous_status TEXT,
  reason TEXT,
  movement_type TEXT NOT NULL,
  
  -- Auditoria
  moved_by UUID REFERENCES profiles(id),
  moved_by_name TEXT,
  moved_by_role TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para consultas rápidas
CREATE INDEX idx_movement_logs_attendee ON attendee_movement_logs(attendee_id);
CREATE INDEX idx_movement_logs_created ON attendee_movement_logs(created_at DESC);
CREATE INDEX idx_movement_logs_moved_by ON attendee_movement_logs(moved_by);

-- RLS
ALTER TABLE attendee_movement_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view movement logs" ON attendee_movement_logs
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert movement logs" ON attendee_movement_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Adicionar coluna is_reschedule em meeting_slot_attendees
ALTER TABLE meeting_slot_attendees 
ADD COLUMN IF NOT EXISTS is_reschedule BOOLEAN DEFAULT false;