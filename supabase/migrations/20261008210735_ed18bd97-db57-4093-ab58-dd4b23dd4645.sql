REVOKE EXECUTE ON FUNCTION public.pos_venda_checar_nota_novos() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.pos_venda_on_venda() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.pos_venda_registrar_cliente(text,text,text,text,text,numeric,timestamptz,text,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.pos_venda_escolher_gerente() FROM PUBLIC, anon, authenticated;