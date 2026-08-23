DROP POLICY "Admins e managers atualizam creditos" ON public.consorcio_creditos;
DROP POLICY "Admins e managers excluem creditos" ON public.consorcio_creditos;
DROP POLICY "Admins e managers inserem creditos" ON public.consorcio_creditos;

CREATE POLICY "Admins managers e cobranca consorcio atualizam creditos"
ON public.consorcio_creditos FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'cobranca_consorcio'::app_role));

CREATE POLICY "Admins managers e cobranca consorcio excluem creditos"
ON public.consorcio_creditos FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'cobranca_consorcio'::app_role));

CREATE POLICY "Admins managers e cobranca consorcio inserem creditos"
ON public.consorcio_creditos FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'cobranca_consorcio'::app_role));

INSERT INTO public.user_roles (user_id, role)
VALUES ('d77b494c-7b81-4714-a941-8e8d051b72f2', 'cobranca_consorcio'::app_role),
       ('3e91331b-dc4c-4126-83e8-4435e3cc9b76', 'cobranca_consorcio'::app_role)
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.roles_config (role_key, label, color, description, is_system, is_active)
VALUES ('cobranca_consorcio', 'Cobrança Consórcio', 'bg-lime-500/20 text-lime-400 border-lime-500/30', 'Equipe de cobrança e acompanhamento do consórcio; pode cadastrar e editar planos de crédito.', false, true)
ON CONFLICT (role_key) DO NOTHING;