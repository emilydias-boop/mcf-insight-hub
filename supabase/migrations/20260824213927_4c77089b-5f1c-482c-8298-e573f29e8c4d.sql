CREATE TABLE public.consorcio_cotas_fora_funil (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consortium_card_id uuid NOT NULL REFERENCES public.consortium_cards(id) ON DELETE CASCADE,
  motivo text NOT NULL,
  reconhecido_por uuid DEFAULT auth.uid(),
  reconhecido_por_nome text,
  desfeito_em timestamptz,
  desfeito_por uuid,
  desfeito_por_nome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT consorcio_cotas_fora_funil_motivo_min CHECK (char_length(btrim(motivo)) >= 10)
);

-- Um reconhecimento ATIVO por cota. Desfeito libera novo reconhecimento,
-- sem apagar a trilha anterior.
CREATE UNIQUE INDEX consorcio_cotas_fora_funil_card_ativo_uidx
  ON public.consorcio_cotas_fora_funil (consortium_card_id)
  WHERE desfeito_em IS NULL;

CREATE INDEX consorcio_cotas_fora_funil_card_idx
  ON public.consorcio_cotas_fora_funil (consortium_card_id);

GRANT SELECT, INSERT ON public.consorcio_cotas_fora_funil TO authenticated;
GRANT ALL ON public.consorcio_cotas_fora_funil TO service_role;

ALTER TABLE public.consorcio_cotas_fora_funil ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fora_funil_select_authenticated"
  ON public.consorcio_cotas_fora_funil
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "fora_funil_insert_authenticated"
  ON public.consorcio_cotas_fora_funil
  FOR INSERT TO authenticated
  WITH CHECK (reconhecido_por = auth.uid() AND desfeito_em IS NULL AND desfeito_por IS NULL);

-- Sem policy de UPDATE e sem policy/GRANT de DELETE: reconhecimento não se
-- edita nem se apaga. Desfazer passa pela função abaixo, que preserva a linha.
CREATE OR REPLACE FUNCTION public.consorcio_desfazer_fora_funil(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_nome text;
  v_row public.consorcio_cotas_fora_funil;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  SELECT * INTO v_row FROM public.consorcio_cotas_fora_funil WHERE id = p_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Reconhecimento não encontrado.';
  END IF;
  IF v_row.desfeito_em IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'ja_desfeito', 'id', p_id);
  END IF;

  SELECT full_name INTO v_nome FROM public.profiles WHERE id = v_actor;

  UPDATE public.consorcio_cotas_fora_funil
     SET desfeito_em = now(),
         desfeito_por = v_actor,
         desfeito_por_nome = v_nome
   WHERE id = p_id;

  RETURN jsonb_build_object('status', 'desfeito', 'id', p_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.consorcio_desfazer_fora_funil(uuid) TO authenticated;