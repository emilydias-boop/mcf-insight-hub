-- Política para INSERT - Usuários autenticados podem criar links
CREATE POLICY "Allow insert for authenticated" 
ON public.closer_meeting_links 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Política para UPDATE - Usuários autenticados podem atualizar links
CREATE POLICY "Allow update for authenticated" 
ON public.closer_meeting_links 
FOR UPDATE 
TO authenticated 
USING (true)
WITH CHECK (true);

-- Política para DELETE - Usuários autenticados podem deletar links
CREATE POLICY "Allow delete for authenticated" 
ON public.closer_meeting_links 
FOR DELETE 
TO authenticated 
USING (true);