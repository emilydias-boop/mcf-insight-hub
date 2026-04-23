import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Returns a Set of contact IDs that are flagged as duplicates
 * (share email lowercase OR 9-digit phone suffix with another active contact).
 * Cached for 5 minutes to avoid hammering the RPC.
 */
export const useDuplicateContactIds = () => {
  return useQuery({
    queryKey: ['duplicate-contact-ids'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_duplicate_contact_ids');
      if (error) {
        console.error('[useDuplicateContactIds] RPC error:', error);
        return new Set<string>();
      }
      const ids = (data || []).map((row: any) => row.contact_id as string);
      return new Set<string>(ids);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
  });
};

export interface DuplicateContactMatch {
  contact_id: string;
  contact_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  match_type: 'email' | 'phone';
}

/**
 * Imperatively check if a contact already exists with the given email or phone.
 * Returns the existing contact info, or null if no match.
 */
export const checkDuplicateContactByIdentity = async (
  email?: string | null,
  phone?: string | null
): Promise<DuplicateContactMatch | null> => {
  const { data, error } = await supabase.rpc('check_duplicate_contact_by_identity', {
    p_email: email || null,
    p_phone: phone || null,
  });
  if (error) {
    console.error('[checkDuplicateContactByIdentity] RPC error:', error);
    return null;
  }
  if (!data || data.length === 0) return null;
  return data[0] as DuplicateContactMatch;
};