import { supabase } from '@/integrations/supabase/client';
import { getProdutoComissaoContext as lookup } from '../../supabase/functions/_shared/consorcioComissaoLookup';
import type { TipoProduto } from '@/types/consorcio';
export function getProdutoComissaoContext(valorCredito: number, tipoProduto: TipoProduto, extra?: { valorVenda?: number; valorParcela?: number }) { return lookup(valorCredito, tipoProduto, supabase, extra); }
