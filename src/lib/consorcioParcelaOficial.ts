import { supabase } from '@/integrations/supabase/client';
import { resolverParcelaOficial as resolver, type ParcelaOficialParams } from '../../supabase/functions/_shared/consorcioParcelaOficial';
export * from '../../supabase/functions/_shared/consorcioParcelaOficial';
export function resolverParcelaOficial(p: ParcelaOficialParams) { return resolver(p, supabase); }
