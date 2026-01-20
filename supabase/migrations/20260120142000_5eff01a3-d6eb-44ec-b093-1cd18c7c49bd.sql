-- Allow SDRs to update CRM contacts (specifically phone numbers)
-- Currently only managers/admins can update, but SDRs need to edit phone

DROP POLICY IF EXISTS "Managers e admins podem atualizar contatos" ON crm_contacts;

CREATE POLICY "Authenticated users can update contacts"
ON crm_contacts
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);