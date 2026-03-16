import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Copy } from 'lucide-react';
import { ActivitySummary } from '@/hooks/useDealActivitySummary';
import { SalesChannel } from '@/hooks/useBulkA010Check';

export interface CopyLeadData {
  name: string;
  phone: string;
  email: string;
  stage: string;
  createdAt: string;
  totalCalls: number;
  totalAttempts: number;
  owner: string;
  origin: string;
  channel: string;
  tags: string;
}

const FIELD_OPTIONS = [
  { key: 'name', label: 'Nome' },
  { key: 'phone', label: 'Telefone' },
  { key: 'email', label: 'Email' },
  { key: 'stage', label: 'Estágio' },
  { key: 'createdAt', label: 'Data de entrada' },
  { key: 'totalCalls', label: 'Nº ligações' },
  { key: 'totalAttempts', label: 'Tentativas' },
  { key: 'owner', label: 'Responsável' },
  { key: 'origin', label: 'Origem' },
  { key: 'channel', label: 'Canal' },
  { key: 'tags', label: 'Tags' },
] as const;

type FieldKey = typeof FIELD_OPTIONS[number]['key'];

const SEPARATORS = [
  { value: 'tab', label: 'Tabulação (para planilha)', char: '\t' },
  { value: 'dash', label: 'Traço ( - )', char: ' - ' },
  { value: 'comma', label: 'Vírgula', char: ', ' },
  { value: 'pipe', label: 'Pipe ( | )', char: ' | ' },
];

interface CopyLeadsFormatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: CopyLeadData[];
}

export function CopyLeadsFormatDialog({ open, onOpenChange, leads }: CopyLeadsFormatDialogProps) {
  const [selectedFields, setSelectedFields] = useState<Set<FieldKey>>(
    new Set(['name', 'phone', 'email', 'stage'])
  );
  const [separator, setSeparator] = useState('dash');

  const sepChar = SEPARATORS.find(s => s.value === separator)?.char || ' - ';

  const toggleField = (key: FieldKey) => {
    setSelectedFields(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const preview = useMemo(() => {
    if (leads.length === 0 || selectedFields.size === 0) return '';
    const sample = leads.slice(0, 3);
    return sample.map(lead => {
      return FIELD_OPTIONS
        .filter(f => selectedFields.has(f.key))
        .map(f => String((lead as any)[f.key] ?? ''))
        .join(sepChar);
    }).join('\n');
  }, [leads, selectedFields, sepChar]);

  const handleCopy = () => {
    if (selectedFields.size === 0) {
      toast.error('Selecione pelo menos um campo');
      return;
    }
    const text = leads.map(lead => {
      return FIELD_OPTIONS
        .filter(f => selectedFields.has(f.key))
        .map(f => String((lead as any)[f.key] ?? ''))
        .join(sepChar);
    }).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      toast.success(`${leads.length} lead(s) copiado(s)`);
      onOpenChange(false);
    }).catch(() => toast.error('Erro ao copiar'));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Copiar leads - Formato personalizado</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium mb-2 block">Campos para copiar</Label>
            <div className="grid grid-cols-2 gap-2">
              {FIELD_OPTIONS.map(f => (
                <label key={f.key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={selectedFields.has(f.key)}
                    onCheckedChange={() => toggleField(f.key)}
                  />
                  {f.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium mb-2 block">Separador</Label>
            <Select value={separator} onValueChange={setSeparator}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEPARATORS.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {preview && (
            <div>
              <Label className="text-sm font-medium mb-1 block">Preview</Label>
              <pre className="text-xs bg-muted p-2 rounded-md overflow-x-auto whitespace-pre-wrap max-h-24 overflow-y-auto">
                {preview}
                {leads.length > 3 && `\n... +${leads.length - 3} leads`}
              </pre>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleCopy} disabled={selectedFields.size === 0}>
            <Copy className="h-4 w-4 mr-1" />
            Copiar {leads.length} lead(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Helper to build CopyLeadData from raw deal data
export function buildCopyLeadData(
  deals: any[],
  stageName: string,
  activityMap?: Map<string, ActivitySummary>,
  channelMap?: Map<string, SalesChannel>,
): CopyLeadData[] {
  return deals.map(d => {
    const activity = activityMap?.get(d.id?.toLowerCase?.()?.trim?.());
    const channel = channelMap?.get(d.id);
    return {
      name: d.crm_contacts?.name || d.name || 'Sem nome',
      phone: d.crm_contacts?.phone || '(sem telefone)',
      email: d.crm_contacts?.email || '(sem email)',
      stage: stageName,
      createdAt: d.created_at ? new Date(d.created_at).toLocaleDateString('pt-BR') : '-',
      totalCalls: activity?.totalCalls ?? 0,
      totalAttempts: activity?.totalActivities ?? 0,
      owner: d.owner_name || '-',
      origin: (d as any).crm_origins?.name || '-',
      channel: channel || '-',
      tags: Array.isArray(d.tags) ? d.tags.join(', ') : '-',
    };
  });
}
