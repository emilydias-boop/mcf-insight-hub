import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, StickyNote } from 'lucide-react';
import { fetchMeetingInfoByDeal } from '@/hooks/useConsorcioPostMeeting';
import { cn } from '@/lib/utils';

/**
 * Nota da R1 (closer_notes/notes de meeting_slot_attendees), somente leitura.
 * A fonte é a existente — nada é copiado para outras tabelas.
 */
export function useR1CloserNote(dealId?: string | null) {
  return useQuery({
    queryKey: ['r1-closer-note', dealId],
    enabled: !!dealId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const map = await fetchMeetingInfoByDeal([dealId as string]);
      const info = map[dealId as string];
      return (info?.closer_notes || info?.notes || '').trim();
    },
  });
}

export function CloserR1NoteBlock({
  dealId,
  className,
}: {
  dealId?: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const { data: note = '' } = useR1CloserNote(dealId);

  if (!note) return null;

  return (
    <div className={cn('rounded-md border bg-muted/30', className)}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium"
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <StickyNote className="h-4 w-4 text-amber-600" />
        Nota do closer na R1
      </button>
      {open && (
        <p className="whitespace-pre-wrap border-t px-3 py-2 text-sm text-muted-foreground">
          {note}
        </p>
      )}
    </div>
  );
}
