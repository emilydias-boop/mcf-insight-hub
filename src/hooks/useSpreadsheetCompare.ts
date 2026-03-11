import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getDealStatusFromStage, DealStatus } from '@/lib/dealStatusHelper';
import { toast } from 'sonner';

export interface SpreadsheetRow {
  excelName: string;
  excelEmail: string;
  excelPhone: string;
  // Match result
  matchStatus: 'found_in_current' | 'found_elsewhere' | 'not_found';
  dealStatus?: DealStatus;
  // Contact info (for found_elsewhere / found_in_current)
  contactId?: string;
  // Local deal info (for found_in_current)
  localDealId?: string;
  localDealName?: string;
  localContactName?: string;
  localContactEmail?: string;
  localContactPhone?: string;
  localStageName?: string;
  localOwner?: string;
  // Origin info (for found_elsewhere)
  originName?: string;
  // Extra columns from spreadsheet (unmapped)
  extraColumns?: Record<string, string>;
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
 * Compare spreadsheet rows against existing deals in a pipeline (legacy local).
 */
export function compareSpreadsheetWithDeals(
  rows: Array<{ name: string; email: string; phone: string }>,
  deals: any[]
): SpreadsheetRow[] {
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
      matchStatus: 'found_in_current' as const,
      dealStatus,
      contactId: contact?.id,
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
 * Global search: find contacts across ALL pipelines via crm_contacts table.
 * For each found contact, check if they already have a deal in the current origin.
 */
export async function compareSpreadsheetGlobal(
  rows: Array<{ name: string; email: string; phone: string }>,
  currentOriginId: string,
  onProgress?: (current: number, total: number) => void
): Promise<SpreadsheetRow[]> {
  const results: SpreadsheetRow[] = [];
  const BATCH = 20;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    onProgress?.(Math.min(i + BATCH, rows.length), rows.length);

    const batchResults = await Promise.all(
      batch.map(async (row) => {
        const emailKey = normalize(row.email);
        const phoneKey = last9Digits(row.phone);
        const nameKey = normalize(row.name);

        let contact: any = null;

        // 1. Search by email
        if (emailKey && !contact) {
          const { data } = await supabase
            .from('crm_contacts')
            .select('id, name, email, phone')
            .ilike('email', emailKey)
            .limit(1);
          if (data?.length) contact = data[0];
        }

        // 2. Search by phone suffix
        if (!contact && phoneKey) {
          const { data } = await supabase
            .from('crm_contacts')
            .select('id, name, email, phone')
            .ilike('phone', `%${phoneKey}`)
            .limit(1);
          if (data?.length) contact = data[0];
        }

        // 3. Search by name (exact, case-insensitive)
        if (!contact && nameKey) {
          const { data } = await supabase
            .from('crm_contacts')
            .select('id, name, email, phone')
            .ilike('name', nameKey)
            .limit(1);
          if (data?.length) contact = data[0];
        }

        if (!contact) {
          return {
            excelName: row.name,
            excelEmail: row.email,
            excelPhone: row.phone,
            matchStatus: 'not_found' as const,
          } as SpreadsheetRow;
        }

        // Contact found — check if deal exists in current origin
        const { data: dealInCurrent } = await supabase
          .from('crm_deals')
          .select('id, name, owner_id, stage_id, crm_stages(stage_name)')
          .eq('contact_id', contact.id)
          .eq('origin_id', currentOriginId)
          .limit(1);

        if (dealInCurrent?.length) {
          const deal = dealInCurrent[0];
          const stageName = (deal as any).crm_stages?.stage_name || '';
          const dealStatus = getDealStatusFromStage(stageName);
          return {
            excelName: row.name,
            excelEmail: row.email,
            excelPhone: row.phone,
            matchStatus: 'found_in_current' as const,
            dealStatus,
            contactId: contact.id,
            localDealId: deal.id,
            localDealName: deal.name,
            localContactName: contact.name || '',
            localContactEmail: contact.email || '',
            localContactPhone: contact.phone || '',
            localStageName: stageName,
            localOwner: deal.owner_id || '',
          } as SpreadsheetRow;
        }

        // Contact exists but NOT in current pipeline — find where they are
        const { data: dealElsewhere } = await supabase
          .from('crm_deals')
          .select('id, name, owner_id, crm_stages(stage_name), crm_origins(name)')
          .eq('contact_id', contact.id)
          .limit(1);

        const elseOriginName = dealElsewhere?.length
          ? (dealElsewhere[0] as any).crm_origins?.name || 'Outra pipeline'
          : 'Sem deal';

        return {
          excelName: row.name,
          excelEmail: row.email,
          excelPhone: row.phone,
          matchStatus: 'found_elsewhere' as const,
          contactId: contact.id,
          localContactName: contact.name || '',
          localContactEmail: contact.email || '',
          localContactPhone: contact.phone || '',
          originName: elseOriginName,
        } as SpreadsheetRow;
      })
    );

    results.push(...batchResults);
  }

  return results;
}

/**
 * Mutation to create deals for not-found leads via edge function
 */
const BATCH_SIZE = 500;

export function useCreateNotFoundDeals() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      leads,
      originId,
      ownerEmail,
      ownerProfileId,
      onProgress,
    }: {
      leads: Array<{ name: string; email: string; phone: string; contact_id?: string }>;
      originId: string;
      ownerEmail?: string;
      ownerProfileId?: string;
      onProgress?: (batch: number, totalBatches: number) => void;
    }) => {
      const totalBatches = Math.ceil(leads.length / BATCH_SIZE);
      let totalCreated = 0;
      let totalSkipped = 0;

      for (let i = 0; i < leads.length; i += BATCH_SIZE) {
        const batch = leads.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        onProgress?.(batchNum, totalBatches);

        const { data, error } = await supabase.functions.invoke('import-spreadsheet-leads', {
          body: {
            leads: batch,
            origin_id: originId,
            owner_email: ownerEmail,
            owner_profile_id: ownerProfileId,
          },
        });

        if (error) throw error;
        const result = data as { created: number; skipped: number; total: number };
        totalCreated += result.created;
        totalSkipped += result.skipped;
      }

      return { created: totalCreated, skipped: totalSkipped, total: leads.length };
    },
    onSuccess: (data) => {
      toast.success(`${data.created} leads criados${data.skipped > 0 ? ` (${data.skipped} já existiam)` : ''}`);
      queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
    },
    onError: (error: any) => {
      toast.error(`Erro ao criar leads: ${error.message}`);
    },
  });
}
