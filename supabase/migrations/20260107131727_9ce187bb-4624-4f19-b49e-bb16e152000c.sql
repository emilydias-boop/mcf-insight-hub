-- Permitir leitura pública de perfis marcados como visíveis na TV
-- Isso é necessário para que a página /tv-sdr/fullscreen funcione sem login

CREATE POLICY "Public read for TV dashboard"
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (show_on_tv = true);

-- Permitir leitura pública de metas de equipe para a TV
CREATE POLICY "Public read for team targets on TV"
ON public.team_targets
FOR SELECT
TO anon
USING (true);