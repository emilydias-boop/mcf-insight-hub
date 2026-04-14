CREATE POLICY "Authenticated users can read released dates"
ON public.automation_settings
FOR SELECT
TO authenticated
USING (key LIKE 'agenda_released_dates_%');