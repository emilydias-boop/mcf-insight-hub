import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getDealStatusFromStage, DealStatus } from '@/lib/dealStatusHelper';
import { toast } from 'sonner';

export interface SpreadsheetRow {
  excelName: string;
  excelEmail: string;
  excelPhone: string;
  // Match result
  matchStatus: 'found' | 'not_found';
  dealStatus?: DealStatus;
  // Local deal info
  localDealId?: string;
  localDealName?: string;
  localContactName?: string;
  localContactEmail?: string;
  localContactPhone?: string;
  localStageName?: string;
  localOwner?: string;
}

function normalize(val: string | null | undefined): string {
  return (val || '').toLowerCase().trim();
}

function last9Digits(phone: string | null | undefined): string {
  if (!phone) return '';
  const clean = phone.replace(/\D/g, '');
  return clean.length >= 9 ? clean.slice(-9) : clean;
}

/**
 * Compare spreadsheet rows against existing deals in a pipeline.
 * Deduplication: email → phone (last 9 digits) → name (fallback)
 */
export function compareSpreadsheetWithDeals(
  rows: Array<{ name: string; email: string; phone: string }>,
  deals: any[]
): SpreadsheetRow[] {
  // Index deals by email, phone suffix, name
  const byEmail = new Map<string, any>();
  const byPhone = new Map<string, any>();
  const byName = new Map<string, any>();

  for (const deal of deals) {
    const contact = deal.crm_contacts;
    const email = normalize(contact?.email);
    if (email && !byEmail.has(email)) byEmail.set(email, deal);

    const phoneSuffix = last9Digits(contact?.phone);
    if (phoneSuffix && !byPhone.has(phoneSuffix)) byPhone.set(phoneSuffix, deal);

    const name = normalize(contact?.name);
    if (name && !byName.has(name)) byName.set(name, deal);
  }

  return rows.map((row) => {
    const emailKey = normalize(row.email);
    const phoneKey = last9Digits(row.phone);
    const nameKey = normalize(row.name);

    const match =
      (emailKey ? byEmail.get(emailKey) : null) ||
      (phoneKey ? byPhone.get(phoneKey) : null) ||
      (nameKey ? byName.get(nameKey) : null);

    if (!match) {
      return {
        excelName: row.name,
        excelEmail: row.email,
        excelPhone: row.phone,
        matchStatus: 'not_found' as const,
      };
    }

    const contact = match.crm_contacts;
    const stageName = match.crm_stages?.stage_name || '';
    const dealStatus = getDealStatusFromStage(stageName);

    return {
      excelName: row.name,
      excelEmail: row.email,
      excelPhone: row.phone,
      matchStatus: 'found' as const,
      dealStatus,
      localDealId: match.id,
      localDealName: match.name,
      localContactName: contact?.name || '',
      localContactEmail: contact?.email || '',
      localContactPhone: contact?.phone || '',
      localStageName: stageName,
      localOwner: match.owner_id || '',
    };
  });
}

/**
 * Mutation to add 'base clint' tag to matched deals
 */
export function useAddBaseClintTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dealIds: string[]) => {
      const batchSize = 50;
      let updated = 0;

      for (let i = 0; i < dealIds.length; i += batchSize) {
        const batch = dealIds.slice(i, i + batchSize);

        // Fetch current tags for each deal
        const { data: deals, error: fetchError } = await supabase
          .from('crm_deals')
          .select('id, tags')
          .in('id', batch);

        if (fetchError) throw fetchError;

        for (const deal of deals || []) {
          const currentTags: string[] = Array.isArray(deal.tags) ? deal.tags : [];
          if (currentTags.includes('base clint')) continue;

          const { error } = await supabase
            .from('crm_deals')
            .update({ tags: [...currentTags, 'base clint'] })
            .eq('id', deal.id);

          if (error) throw error;
          updated++;
        }
      }

      return { updated };
    },
    onSuccess: (data) => {
      toast.success(`Tag 'base clint' aplicada em ${data.updated} deals!`);
      queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
    },
    onError: (error: any) => {
      toast.error(`Erro ao aplicar tag: ${error.message}`);
    },
  });
}
