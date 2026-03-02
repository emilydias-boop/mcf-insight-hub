
-- Create roles_config table
CREATE TABLE public.roles_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_key text UNIQUE NOT NULL,
  label text NOT NULL,
  color text DEFAULT 'bg-muted text-muted-foreground border-border',
  description text,
  is_system boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.roles_config ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read roles
CREATE POLICY "Authenticated users can view roles"
ON public.roles_config FOR SELECT
TO authenticated
USING (true);

-- Only admins can insert/update/delete (via edge function with service role, but also direct)
CREATE POLICY "Admins can manage roles"
ON public.roles_config FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_roles_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_roles_config_updated_at
BEFORE UPDATE ON public.roles_config
FOR EACH ROW
EXECUTE FUNCTION public.update_roles_config_updated_at();

-- Seed with existing roles
INSERT INTO public.roles_config (role_key, label, color, description, is_system) VALUES
  ('admin', 'Admin', 'bg-red-500/20 text-red-700 border-red-500/30', 'Administrador do sistema com acesso total', true),
  ('manager', 'Manager', 'bg-purple-500/20 text-purple-700 border-purple-500/30', 'Gerente com acesso amplo ao sistema', true),
  ('coordenador', 'Coordenador', 'bg-blue-500/20 text-blue-700 border-blue-500/30', 'Coordenador de equipe', false),
  ('sdr', 'SDR', 'bg-green-500/20 text-green-700 border-green-500/30', 'Sales Development Representative', false),
  ('closer', 'Closer', 'bg-orange-500/20 text-orange-700 border-orange-500/30', 'Closer de vendas', false),
  ('closer_sombra', 'Closer Sombra', 'bg-amber-500/20 text-amber-700 border-amber-500/30', 'Closer em treinamento', false),
  ('financeiro', 'Financeiro', 'bg-emerald-500/20 text-emerald-700 border-emerald-500/30', 'Equipe financeira', false),
  ('rh', 'RH', 'bg-pink-500/20 text-pink-700 border-pink-500/30', 'Recursos Humanos', false),
  ('gr', 'Gerente de Conta', 'bg-cyan-500/20 text-cyan-700 border-cyan-500/30', 'Gerente de relacionamento', false),
  ('viewer', 'Viewer', 'bg-gray-500/20 text-gray-700 border-gray-500/30', 'Acesso somente leitura', true);
