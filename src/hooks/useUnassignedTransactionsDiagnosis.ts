import { useMemo } from 'react';

interface Transaction {
  id: string;
  customer_email: string | null;
  customer_phone: string | null;
  product_name: string | null;
  product_category: string | null;
  product_price: number | null;
  net_value: number | null;
  sale_date: string | null;
  sale_status: string | null;
  installment_number: number | null;
  gross_override?: number | null;
  reference_price?: number | null;
}

interface AttendeeMatch {
  id: string;
  attendee_phone: string | null;
  deal_id: string | null;
  meeting_slots: { closer_id: string | null } | null;
  crm_deals: { crm_contacts: { email: string | null; phone: string | null } | null } | null;
}

export type DiagnosisReason = 'both_missing' | 'missing_email' | 'missing_phone' | 'no_match';

export interface TransactionDiagnosis {
  reason: DiagnosisReason;
  transaction: Transaction;
  contactExistsInCRM: boolean;
  suggestedCloserName?: string;
}

export interface DiagnosisSummary {
  total: number;
  bothMissing: number;
  missingEmail: number;
  missingPhone: number;
  noMatch: number;
  contactExistsCount: number;
}

const normalizePhone = (phone: string | null | undefined): string => {
  return (phone || '').replace(/\D/g, '');
};

export function useUnassignedTransactionsDiagnosis(
  transactions: Transaction[],
  allAttendees: AttendeeMatch[],
  closers: { id: string; name: string }[]
) {
  return useMemo(() => {
    // Build a map of all CRM emails/phones → closer name
    const emailToCloser = new Map<string, string>();
    const phoneToCloser = new Map<string, string>();
    const allCRMEmails = new Set<string>();
    const allCRMPhones = new Set<string>();

    for (const a of allAttendees) {
      const closerId = a.meeting_slots?.closer_id;
      const closerName = closers.find(c => c.id === closerId)?.name;
      const email = a.crm_deals?.crm_contacts?.email?.toLowerCase();
      const phone = normalizePhone(a.crm_deals?.crm_contacts?.phone);

      if (email) {
        allCRMEmails.add(email);
        if (closerName) emailToCloser.set(email, closerName);
      }
      if (phone.length >= 8) {
        allCRMPhones.add(phone);
        if (closerName) phoneToCloser.set(phone, closerName);
      }
    }

    const diagnosed: TransactionDiagnosis[] = [];
    const summary: DiagnosisSummary = {
      total: transactions.length,
      bothMissing: 0,
      missingEmail: 0,
      missingPhone: 0,
      noMatch: 0,
      contactExistsCount: 0,
    };

    for (const tx of transactions) {
      const txEmail = (tx.customer_email || '').toLowerCase().trim();
      const txPhone = normalizePhone(tx.customer_phone);
      const hasEmail = txEmail.length > 0;
      const hasPhone = txPhone.length >= 8;

      let reason: DiagnosisReason;
      if (!hasEmail && !hasPhone) {
        reason = 'both_missing';
        summary.bothMissing++;
      } else if (!hasEmail) {
        reason = 'missing_email';
        summary.missingEmail++;
      } else if (!hasPhone) {
        reason = 'missing_phone';
        summary.missingPhone++;
      } else {
        reason = 'no_match';
        summary.noMatch++;
      }

      // Check if contact exists in CRM (even if no closer match)
      const contactExistsInCRM =
        (hasEmail && allCRMEmails.has(txEmail)) ||
        (hasPhone && allCRMPhones.has(txPhone));

      if (contactExistsInCRM) summary.contactExistsCount++;

      // Suggest closer if found in CRM
      let suggestedCloserName: string | undefined;
      if (hasEmail && emailToCloser.has(txEmail)) {
        suggestedCloserName = emailToCloser.get(txEmail);
      } else if (hasPhone && phoneToCloser.has(txPhone)) {
        suggestedCloserName = phoneToCloser.get(txPhone);
      }

      diagnosed.push({
        reason,
        transaction: tx,
        contactExistsInCRM,
        suggestedCloserName,
      });
    }

    return { diagnosed, summary };
  }, [transactions, allAttendees, closers]);
}
