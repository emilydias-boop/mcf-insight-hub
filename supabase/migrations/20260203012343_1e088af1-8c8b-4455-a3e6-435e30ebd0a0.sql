-- Dropar AMBAS as policies primeiro
DROP POLICY IF EXISTS premiacoes_select_policy ON premiacoes;
DROP POLICY IF EXISTS premiacao_ganhadores_select_policy ON premiacao_ganhadores;