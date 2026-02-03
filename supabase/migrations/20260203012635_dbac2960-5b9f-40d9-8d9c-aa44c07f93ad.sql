-- Recriar policy de premiacoes
CREATE POLICY premiacoes_select_policy ON premiacoes
FOR SELECT
USING (
  bu = ANY(
    COALESCE(
      (SELECT squad FROM profiles WHERE id = auth.uid()),
      ARRAY[]::TEXT[]
    )
  )
  OR is_bu_manager(auth.uid())
);

-- Recriar policy de premiacao_ganhadores  
CREATE POLICY premiacao_ganhadores_select_policy ON premiacao_ganhadores
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM premiacoes p
    WHERE p.id = premiacao_ganhadores.premiacao_id 
      AND (
        p.bu = ANY(
          COALESCE(
            (SELECT squad FROM profiles WHERE id = auth.uid()),
            ARRAY[]::TEXT[]
          )
        )
        OR is_bu_manager(auth.uid())
      )
  )
);