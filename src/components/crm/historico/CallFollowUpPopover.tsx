import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, PencilLine } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface Props {
  callId: string;
  initialAction: string | null;
  initialAt: string | null;
  initialSummary: string | null;
  disabled?: boolean;
}

const ACTIONS: { value: string; label: string }[] = [
  { value: 'none', label: 'Sem ação' },
  { value: 'retornar', label: 'Retornar mais tarde' },
  { value: 'whatsapp', label: 'Chamar no WhatsApp' },
  { value: 'sem_interesse', label: 'Sem interesse' },
  { value: 'agendado', label: 'Agendou reunião' },
  { value: 'outro', label: 'Outro' },
];

function toLocalInput(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CallFollowUpPopover({ callId, initialAction, initialAt, initialSummary, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<string>(initialAction ?? 'none');
  const [followUpAt, setFollowUpAt] = useState<string>(toLocalInput(initialAt));
  const [summary, setSummary] = useState<string>(initialSummary ?? '');
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  async function handleSave() {
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        follow_up_action: action === 'none' ? null : action,
        follow_up_at: followUpAt ? new Date(followUpAt).toISOString() : null,
        summary: summary.trim() ? summary.trim() : null,
      };
      const { error } = await supabase.from('calls').update(payload).eq('id', callId);
      if (error) throw error;
      toast.success('Follow-up atualizado');
      qc.invalidateQueries({ queryKey: ['meu-historico-calls'] });
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" disabled={disabled} className="h-7 px-2 gap-1">
          <PencilLine className="h-3.5 w-3.5" />
          <span className="text-xs">Follow-up</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3" align="end">
        <div className="space-y-1">
          <Label className="text-xs">Ação</Label>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTIONS.map((a) => (
                <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Quando retornar (opcional)</Label>
          <Input
            type="datetime-local"
            className="h-8"
            value={followUpAt}
            onChange={(e) => setFollowUpAt(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Resumo da ligação</Label>
          <Textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Anote o que foi conversado, próximos passos, objeções..."
            rows={4}
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
            Salvar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}