-- Tabela para suportar múltiplos leads por slot (até 3)
CREATE TABLE public.meeting_slot_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_slot_id UUID NOT NULL REFERENCES public.meeting_slots(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.crm_contacts(id),
  deal_id UUID REFERENCES public.crm_deals(id),
  calendly_invitee_uri TEXT,
  status TEXT DEFAULT 'invited',
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_meeting_slot_attendees_slot ON public.meeting_slot_attendees(meeting_slot_id);
CREATE INDEX idx_meeting_slot_attendees_contact ON public.meeting_slot_attendees(contact_id);
CREATE INDEX idx_meeting_slot_attendees_deal ON public.meeting_slot_attendees(deal_id);

-- Adicionar colunas à meeting_slots
ALTER TABLE public.meeting_slots 
  ADD COLUMN IF NOT EXISTS max_attendees INTEGER DEFAULT 4,
  ADD COLUMN IF NOT EXISTS calendly_event_type_uri TEXT;

-- Adicionar event_type_uri aos closers
ALTER TABLE public.closers 
  ADD COLUMN IF NOT EXISTS calendly_event_type_uri TEXT;

-- Enable RLS
ALTER TABLE public.meeting_slot_attendees ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para meeting_slot_attendees
CREATE POLICY "Authenticated users can view attendees"
  ON public.meeting_slot_attendees
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert attendees"
  ON public.meeting_slot_attendees
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and coordenadores can update attendees"
  ON public.meeting_slot_attendees
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordenador'::app_role));

CREATE POLICY "Admins can delete attendees"
  ON public.meeting_slot_attendees
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));