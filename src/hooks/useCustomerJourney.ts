import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CustomerTransaction {
  id: string;
  sale_date: string;
  product_name: string;
  product_category: string | null;
  product_price: number | null;
  net_value: number | null;
  installment_number: number | null;
  total_installments: number | null;
  event_type: string;
  hubla_id: string;
}

export interface CustomerJourney {
  transactions: CustomerTransaction[];
  totalInvested: number;
  firstA010Date: string | null;
  firstContractDate: string | null;
  firstPartnershipDate: string | null;
  daysToContract: number | null;
  daysToPartnership: number | null;
  uniqueProducts: string[];
  currentInstallment: number | null;
  totalInstallments: number | null;
  estimatedNextDueDate: string | null;
  isOverdue: boolean;
}

const MILESTONE_PRODUCTS = {
  a010: ['a010'],
  contract: ['a000', 'contrato'],
  partnership: ['a009', 'parceria', 'parceiro'],
};

const isMilestone = (productName: string, category: string | null, type: 'a010' | 'contract' | 'partnership'): boolean => {
  const lowerName = productName.toLowerCase();
  const lowerCategory = (category || '').toLowerCase();
  return MILESTONE_PRODUCTS[type].some(keyword => 
    lowerName.includes(keyword) || lowerCategory.includes(keyword)
  );
};

export const useCustomerJourney = (email: string | null) => {
  return useQuery({
    queryKey: ['customer-journey', email],
    queryFn: async (): Promise<CustomerJourney | null> => {
      if (!email) return null;

      const { data, error } = await supabase
        .from('hubla_transactions')
        .select('id, sale_date, product_name, product_category, product_price, net_value, installment_number, total_installments, event_type, hubla_id')
        .ilike('customer_email', email)
        .order('sale_date', { ascending: true });

      if (error || !data) return null;

      const transactions = data as CustomerTransaction[];
      
      // Calculate total invested (sum of net_value for first installments only)
      const totalInvested = transactions
        .filter(t => (t.installment_number || 1) === 1)
        .reduce((sum, t) => sum + (t.net_value || 0), 0);

      // Find milestone dates
      let firstA010Date: string | null = null;
      let firstContractDate: string | null = null;
      let firstPartnershipDate: string | null = null;

      for (const t of transactions) {
        if (!firstA010Date && isMilestone(t.product_name, t.product_category, 'a010')) {
          firstA010Date = t.sale_date;
        }
        if (!firstContractDate && isMilestone(t.product_name, t.product_category, 'contract')) {
          firstContractDate = t.sale_date;
        }
        if (!firstPartnershipDate && isMilestone(t.product_name, t.product_category, 'partnership')) {
          firstPartnershipDate = t.sale_date;
        }
      }

      // Calculate days between milestones
      const daysToContract = firstA010Date && firstContractDate
        ? Math.round((new Date(firstContractDate).getTime() - new Date(firstA010Date).getTime()) / (1000 * 60 * 60 * 24))
        : null;

      const daysToPartnership = firstContractDate && firstPartnershipDate
        ? Math.round((new Date(firstPartnershipDate).getTime() - new Date(firstContractDate).getTime()) / (1000 * 60 * 60 * 24))
        : null;

      // Get unique products
      const uniqueProducts = [...new Set(transactions.map(t => t.product_name))];

      // Find latest recurring payment for installment status
      const recurringTransactions = transactions.filter(t => (t.total_installments || 1) > 1);
      const latestRecurring = recurringTransactions.length > 0 
        ? recurringTransactions[recurringTransactions.length - 1]
        : null;

      const currentInstallment = latestRecurring?.installment_number || null;
      const totalInstallments = latestRecurring?.total_installments || null;

      // Estimate next due date (30 days from last payment)
      let estimatedNextDueDate: string | null = null;
      let isOverdue = false;

      if (latestRecurring && currentInstallment && totalInstallments && currentInstallment < totalInstallments) {
        const lastPaymentDate = new Date(latestRecurring.sale_date);
        const nextDue = new Date(lastPaymentDate);
        nextDue.setMonth(nextDue.getMonth() + 1);
        estimatedNextDueDate = nextDue.toISOString();
        isOverdue = new Date() > nextDue;
      }

      return {
        transactions,
        totalInvested,
        firstA010Date,
        firstContractDate,
        firstPartnershipDate,
        daysToContract,
        daysToPartnership,
        uniqueProducts,
        currentInstallment,
        totalInstallments,
        estimatedNextDueDate,
        isOverdue,
      };
    },
    enabled: !!email,
  });
};
