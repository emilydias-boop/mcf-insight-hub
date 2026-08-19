import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { QualificationQuestionnaire } from '@/components/crm/qualification/QualificationQuestionnaire';
import {
  validateAnswers,
  answersToSummary,
  type QualificationAnswers,
} from '@/components/crm/qualification/QualificationQuestions';
import { useSaveQualificationNote } from '@/hooks/useQualificationNote';

interface Props {
  dealId: string;
  conversationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QualifyLeadDialog({ dealId, conversationId, open, onOpenChange }: Props) {
  const [answers, setAnswers] = useState<QualificationAnswers>({});
  const [paraR1, setParaR1] = useState(true);
  const save = useSaveQualificationNote();
  const { data: sdrName } = useQuery({
    queryKey: ['qualify-dialog-sdr-name'],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return null;
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .maybeSingle();
      return data?.full_name ?? userData.user?.email ?? null;
    },
    staleTime: 10 * 60 * 1000,
  });

  const { valid } = validateAnswers(answers);

  const handleSave = () => {
    if (!valid) {
      toast.error('Responda todas as perguntas com pelo menos 15 caracteres.');
      return;
    }
    const summary = answersToSummary(answers, sdrName ?? undefined, 'whatsapp');
    save.mutate(
      {
        dealId,
        
        summary,
        answers,
        channel: 'whatsapp',
        paraR1,
        extraMetadata: { conversation_id: conversationId },
      },
      {
        onSuccess: () => {
          setAnswers({});
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Qualificar lead</DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 -mx-2 px-2">
          <QualificationQuestionnaire
            answers={answers}
            onChange={setAnswers}
            disabled={save.isPending}
          />
        </ScrollArea>
        <div className="flex items-center gap-2 pt-2">
          <Checkbox
            id="para-r1"
            checked={paraR1}
            onCheckedChange={(v) => setParaR1(!!v)}
          />
          <Label htmlFor="para-r1" className="text-sm font-normal">
            Qualificação para R1
          </Label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!valid || save.isPending}>
            {save.isPending ? 'Salvando...' : 'Salvar qualificação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}