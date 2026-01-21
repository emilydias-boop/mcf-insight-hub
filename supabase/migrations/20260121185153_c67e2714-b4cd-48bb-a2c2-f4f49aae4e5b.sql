-- Add decision maker fields to meeting_slot_attendees
ALTER TABLE meeting_slot_attendees 
  ADD COLUMN IF NOT EXISTS is_decision_maker boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS decision_maker_type text;

-- Add comment for documentation
COMMENT ON COLUMN meeting_slot_attendees.is_decision_maker IS 'Whether the lead is the decision maker';
COMMENT ON COLUMN meeting_slot_attendees.decision_maker_type IS 'Type of relationship to decision maker: outro_socio, esposa, marido, filho, filha, irmao, irma, pai, mae, outros';