import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LeadFullTimeline } from '@/components/crm/LeadFullTimeline';

interface R2ReportLeadHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  leadName: string | null;
  contactEmail?: string | null;
}

export function R2ReportLeadHistoryDialog({
  open,
  onOpenChange,
  dealId,
  leadName,
  contactEmail,
}: R2ReportLeadHistoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico — {leadName || 'Lead'}</DialogTitle>
        </DialogHeader>
        <LeadFullTimeline
          dealId={dealId}
          dealUuid={dealId}
          contactEmail={contactEmail || undefined}
        />
      </DialogContent>
    </Dialog>
  );
}
