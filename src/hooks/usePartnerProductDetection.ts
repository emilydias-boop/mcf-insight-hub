import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PartnerProductInfo {
  isPartner: boolean;
  productLabel: string | null;
  productName: string | null;
}

interface AttendeeForCheck {
  id: string;
  email: string | null;
}

// Map product_name patterns to display labels
const PRODUCT_MAPPINGS: { pattern: RegExp; label: string }[] = [
  { pattern: /A001/i, label: 'A001' },
  { pattern: /A009/i, label: 'A009' },
  { pattern: /A010/i, label: 'A010' },
  { pattern: /A002/i, label: 'A002' },
  { pattern: /Anticrise Completo|A003/i, label: 'Anticrise' },
  { pattern: /Anticrise B[aá]sico|A004/i, label: 'Anticrise Básico' },
];

// Products to ignore (treated as new lead, not partner)
const IGNORED_PRODUCTS = [
  /Construir para Alugar/i,
  /Contrato/i,
  /P2/i,
  /Suplemento/i,
];

function classifyProduct(productName: string): string | null {
  // Check if it should be ignored
  if (IGNORED_PRODUCTS.some(p => p.test(productName))) return null;
  
  // Find matching product label
  for (const mapping of PRODUCT_MAPPINGS) {
    if (mapping.pattern.test(productName)) return mapping.label;
  }
  
  // Unknown product but not ignored - still a partner
  return productName;
}

/**
 * Batch hook to detect partner products for leads in the Consórcio BU.
 * Returns which main product each lead purchased (A001, A009, Anticrise, etc).
 */
export const usePartnerProductDetectionBatch = (attendees: AttendeeForCheck[]) => {
  return useQuery({
    queryKey: ['partner-product-detection', attendees.map(a => `${a.id}:${a.email}`).join(',')],
    queryFn: async (): Promise<Record<string, PartnerProductInfo>> => {
      if (!attendees.length) return {};

      const emails = [...new Set(
        attendees
          .map(a => a.email?.toLowerCase().trim())
          .filter((email): email is string => Boolean(email))
      )];

      if (!emails.length) return {};

      // Fetch all completed transactions for these emails
      const { data: transactions, error } = await supabase
        .from('hubla_transactions')
        .select('customer_email, product_name')
        .in('customer_email', emails)
        .eq('sale_status', 'completed')
        .order('sale_date', { ascending: false });

      if (error) {
        console.error('Error fetching transactions for partner detection:', error);
        return {};
      }

      // Build email -> best product map
      const emailToProduct = new Map<string, string>();
      for (const tx of transactions || []) {
        const email = tx.customer_email?.toLowerCase().trim();
        if (!email || !tx.product_name) continue;
        if (emailToProduct.has(email)) continue; // keep first (most recent)
        
        const label = classifyProduct(tx.product_name);
        if (label) {
          emailToProduct.set(email, label);
        }
      }

      // Map back to attendee IDs
      const result: Record<string, PartnerProductInfo> = {};
      for (const att of attendees) {
        const email = att.email?.toLowerCase().trim();
        if (!email) continue;
        
        const productLabel = emailToProduct.get(email);
        if (productLabel) {
          result[att.id] = {
            isPartner: true,
            productLabel,
            productName: productLabel,
          };
        }
      }

      return result;
    },
    enabled: attendees.length > 0,
    staleTime: 60000,
    gcTime: 300000,
  });
};
