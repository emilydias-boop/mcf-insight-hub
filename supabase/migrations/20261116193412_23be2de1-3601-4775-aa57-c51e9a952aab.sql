CREATE TABLE public.pos_venda_gerente_contato (
  profile_id uuid PRIMARY KEY,
  telefone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pos_venda_gerente_contato TO authenticated;
GRANT ALL ON public.pos_venda_gerente_contato TO service_role;
ALTER TABLE public.pos_venda_gerente_contato ENABLE ROW LEVEL SECURITY;
CREATE POLICY "equipe le contato gerente" ON public.pos_venda_gerente_contato FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin rh editam contato gerente" ON public.pos_venda_gerente_contato FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'rh'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'rh'));

INSERT INTO public.pos_venda_gerente_contato (profile_id, telefone) VALUES
 ('ea4afaeb-fe35-4c9c-a220-5e62a846b247','5583981609894'),
 ('4b3d5fb6-1e86-4b21-912d-8824dbd59033','5524998165099'),
 ('e7b093fe-4407-4f98-b9dc-e9e85e373a48','5511920180929'),
 ('15f3eba4-83eb-4c19-9847-870bbdebc537','5511984011224');

UPDATE public.employees SET telefone = '5511984011224' WHERE id = 'd410c8f8-9b60-4a2c-ac1a-fe299cceb734' AND telefone IS NULL;

CREATE TABLE public.pos_venda_harvey_gerente_envios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL,
  gerente_id uuid,
  status text NOT NULL,
  http_status int,
  erro text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.pos_venda_harvey_gerente_envios (deal_id, created_at DESC);
GRANT SELECT ON public.pos_venda_harvey_gerente_envios TO authenticated;
GRANT ALL ON public.pos_venda_harvey_gerente_envios TO service_role;
ALTER TABLE public.pos_venda_harvey_gerente_envios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin ve envios harvey gerente" ON public.pos_venda_harvey_gerente_envios FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.pos_venda_harvey_gerente_notificar()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    PERFORM net.http_post(
      url := 'https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/harvey-gerente-sync',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlaGNmZ3F2aWdmY2VraWlwcWtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0Nzk1NzgsImV4cCI6MjA3OTA1NTU3OH0.Rab8S7rX6c7N92CufTkaXKJh0jpS9ydHWSmJMaPMVtE"}'::jsonb,
      body := jsonb_build_object('deal_id', NEW.id)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'harvey-gerente-sync falhou: %', SQLERRM;
  END;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.pos_venda_harvey_gerente_notificar() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_pos_venda_harvey_gerente
AFTER INSERT OR UPDATE OF owner_profile_id ON public.crm_deals
FOR EACH ROW
WHEN (NEW.origin_id = 'b05a0000-0000-4000-8000-000000000002' AND NEW.owner_profile_id IS NOT NULL)
EXECUTE FUNCTION public.pos_venda_harvey_gerente_notificar();