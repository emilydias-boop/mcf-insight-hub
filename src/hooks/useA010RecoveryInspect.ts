import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface InspectRow {
  source: 'hubla' | 'kiwify';
  name: string;
  email: string;
  phone: string | null;
  value?: number;
  product?: string | null;
  sale_date?: string | null;
}

export interface InspectItem {
  bucket: 'matched_by_email' | 'matched_by_phone_only' | 'no_match' | 'error';
  match_type: 'email' | 'phone' | 'none';
  planilha: InspectRow;
  contato_existente: { id: string; name: string; email: string; phone: string } | null;
  ultimo_deal: {
    id: string;
    name: string;
    product_name: string | null;
    pipeline: string | null;
    stage: string | null;
    owner_email: string | null;
    created_at: string;
    tags: string[];
  } | null;
  risco: 'baixo' | 'medio' | 'alto';
}

export interface InspectResponse {
  mode: 'inspect';
  processed: number;
  counts: {
    matched_by_email: number;
    matched_by_phone_only: number;
    no_match: number;
    errors: number;
  };
  buckets: {
    matched_by_email: InspectItem[];
    matched_by_phone_only: InspectItem[];
    no_match: InspectItem[];
    errors: any[];
  };
}

export function useA010RecoveryInspect() {
  return useMutation<InspectResponse, Error, InspectRow[]>({
    mutationFn: async (rows) => {
      const { data, error } = await supabase.functions.invoke('backfill-a010-from-spreadsheets', {
        body: { mode: 'inspect', rows },
      });
      if (error) throw error;
      return data as InspectResponse;
    },
  });
}