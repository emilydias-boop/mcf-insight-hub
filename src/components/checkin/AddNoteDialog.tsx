import { useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useAddDealNote } from '@/hooks/useNextAction';

interface Props {
  dealId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddNoteDialog({ dealId, open, onOpenChange }: Props) {
  const [note, setNote] = useState('');
  const addNote = useAddDealNote();

  const save = () => {
    const text = note.trim();
    if (!text) return;
    addNote.mutate(
      { dealId, note: text },
      {
        onSuccess: () => {
          setNote('');
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova nota</DialogTitle>
        </DialogHeader>
        <Textarea
          autoFocus
          rows={6}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              save();
            }
          }}
          placeholder="Escreva a nota... (Ctrl+Enter para salvar)"
          className="resize-none text-sm"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={!note.trim() || addNote.isPending}>
            {addNote.isPending ? 'Salvando...' : 'Salvar nota'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}