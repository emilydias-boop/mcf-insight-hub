import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download } from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';

interface ExportField {
  key: string;
  label: string;
  getter: (deal: any) => string | number | null;
}

const EXPORT_FIELDS: ExportField[] = [
  { key: 'deal_name', label: 'Nome do Negócio', getter: d => d.name },
  { key: 'contact_name', label: 'Nome do Contato', getter: d => d.crm_contacts?.name },
  { key: 'email', label: 'Email', getter: d => d.crm_contacts?.email },
  { key: 'phone', label: 'Telefone', getter: d => d.crm_contacts?.phone },
  { key: 'stage', label: 'Estágio', getter: d => d.crm_stages?.stage_name },
  { key: 'value', label: 'Valor', getter: d => d.value },
  { key: 'tags', label: 'Tags', getter: d => (d.tags || []).join(', ') },
  { key: 'owner', label: 'Responsável', getter: d => d.owner_id },
  { key: 'origin', label: 'Origem', getter: d => d.crm_origins?.name },
  { key: 'created_at', label: 'Data de Criação', getter: d => d.created_at ? format(new Date(d.created_at), 'dd/MM/yyyy HH:mm') : '' },
  { key: 'stage_moved_at', label: 'Data de Movimentação', getter: d => d.stage_moved_at ? format(new Date(d.stage_moved_at), 'dd/MM/yyyy HH:mm') : '' },
  { key: 'product_name', label: 'Produto', getter: d => d.product_name },
  { key: 'sdr', label: 'SDR Original', getter: d => d.custom_fields?.sdr_original || d.custom_fields?.sdr },
  { key: 'closer_r1', label: 'Closer R1', getter: d => d.custom_fields?.closer_r1 },
  { key: 'closer_r2', label: 'Closer R2', getter: d => d.custom_fields?.closer_r2 },
];

interface Stage {
  id: string;
  stage_name: string;
  stage_order?: number;
}

interface ExportDealsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deals: any[];
  stages: Stage[];
  /** Mapa email (lowercase) → canal detectado pelo board (A010 = comprador A010). */
  channelMap?: Map<string, 'a010' | 'bio' | 'live'>;
}

type ExportChannel = 'A010' | 'ANAMNESE_COMPLETA' | 'ANAMNESE_INCOMPLETA' | 'OUTROS';

const CHANNEL_OPTIONS: { key: ExportChannel; label: string }[] = [
  { key: 'A010', label: 'A010' },
  { key: 'ANAMNESE_COMPLETA', label: 'Anamnese Completa' },
  { key: 'ANAMNESE_INCOMPLETA', label: 'Anamnese Incompleta' },
  { key: 'OUTROS', label: 'Outros' },
];

function normalizeTagsForChannel(tagsRaw: any): string[] {
  if (!Array.isArray(tagsRaw)) return [];
  return tagsRaw.map((t: any) => {
    if (typeof t === 'string') {
      if (t.startsWith('{')) {
        try { return String(JSON.parse(t)?.name ?? t).toUpperCase().trim(); }
        catch { return t.toUpperCase().trim(); }
      }
      return t.toUpperCase().trim();
    }
    return String(t?.name ?? '').toUpperCase().trim();
  });
}

function getDealChannel(
  deal: any,
  channelMap?: Map<string, 'a010' | 'bio' | 'live'>,
): ExportChannel {
  const email = (deal?.crm_contacts?.email || deal?.contact?.email || deal?.email || '')
    .toString()
    .toLowerCase()
    .trim();
  if (email && channelMap?.get(email) === 'a010') return 'A010';

  const tags = normalizeTagsForChannel(deal.tags);
  // Fallback: tag A010 também identifica como A010 (caso o map ainda não tenha carregado).
  if (tags.some((t) => t === 'A010' || t.startsWith('A010 ') || t.includes('A010 (MAKE)'))) return 'A010';
  if (tags.some((t) => t === 'ANAMNESE-INCOMPLETA')) return 'ANAMNESE_INCOMPLETA';
  if (tags.some((t) => t === 'ANAMNESE')) return 'ANAMNESE_COMPLETA';
  return 'OUTROS';
}

export const ExportDealsDialog = ({ open, onOpenChange, deals, stages, channelMap }: ExportDealsDialogProps) => {
  const [selectedStages, setSelectedStages] = useState<Set<string>>(new Set(stages.map(s => s.id)));
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set(EXPORT_FIELDS.map(f => f.key)));
  const [selectedChannels, setSelectedChannels] = useState<Set<ExportChannel>>(
    new Set(CHANNEL_OPTIONS.map(c => c.key)),
  );

  // Reset selections when stages change
  useMemo(() => {
    setSelectedStages(new Set(stages.map(s => s.id)));
  }, [stages]);

  const toggleStage = (stageId: string) => {
    setSelectedStages(prev => {
      const next = new Set(prev);
      next.has(stageId) ? next.delete(stageId) : next.add(stageId);
      return next;
    });
  };

  const toggleField = (fieldKey: string) => {
    setSelectedFields(prev => {
      const next = new Set(prev);
      next.has(fieldKey) ? next.delete(fieldKey) : next.add(fieldKey);
      return next;
    });
  };

  const toggleAllStages = () => {
    if (selectedStages.size === stages.length) {
      setSelectedStages(new Set());
    } else {
      setSelectedStages(new Set(stages.map(s => s.id)));
    }
  };

  const toggleAllFields = () => {
    if (selectedFields.size === EXPORT_FIELDS.length) {
      setSelectedFields(new Set());
    } else {
      setSelectedFields(new Set(EXPORT_FIELDS.map(f => f.key)));
    }
  };

  const toggleChannel = (key: ExportChannel) => {
    setSelectedChannels(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleAllChannels = () => {
    if (selectedChannels.size === CHANNEL_OPTIONS.length) {
      setSelectedChannels(new Set());
    } else {
      setSelectedChannels(new Set(CHANNEL_OPTIONS.map(c => c.key)));
    }
  };

  const filteredDeals = useMemo(() => {
    return deals.filter(d =>
      selectedStages.has(d.stage_id) &&
      selectedChannels.has(getDealChannel(d, channelMap)),
    );
  }, [deals, selectedStages, selectedChannels, channelMap]);

  const handleExport = () => {
    const activeFields = EXPORT_FIELDS.filter(f => selectedFields.has(f.key));
    const rows = filteredDeals.map(deal =>
      activeFields.reduce((row, field) => {
        row[field.label] = field.getter(deal) ?? '';
        return row;
      }, {} as Record<string, any>)
    );

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Negócios');

    // Auto-width columns
    const colWidths = activeFields.map(f => ({
      wch: Math.max(f.label.length, ...rows.map(r => String(r[f.label] || '').length).slice(0, 100)) + 2,
    }));
    ws['!cols'] = colWidths;

    XLSX.writeFile(wb, `negocios-crm-${format(new Date(), 'yyyy-MM-dd-HHmm')}.xlsx`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Exportar Negócios</DialogTitle>
          <DialogDescription>
            Selecione os estágios e campos para incluir na planilha.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[55vh] pr-4">
          {/* Channels section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Canais</h4>
              <Button variant="ghost" size="sm" onClick={toggleAllChannels} className="text-xs h-7">
                {selectedChannels.size === CHANNEL_OPTIONS.length ? 'Desmarcar todos' : 'Marcar todos'}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {CHANNEL_OPTIONS.map(channel => (
                <label key={channel.key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={selectedChannels.has(channel.key)}
                    onCheckedChange={() => toggleChannel(channel.key)}
                  />
                  <span className="truncate">{channel.label}</span>
                </label>
              ))}
            </div>
          </div>

          <Separator className="my-4" />

          {/* Stages section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Estágios</h4>
              <Button variant="ghost" size="sm" onClick={toggleAllStages} className="text-xs h-7">
                {selectedStages.size === stages.length ? 'Desmarcar todos' : 'Marcar todos'}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {stages.map(stage => (
                <label key={stage.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={selectedStages.has(stage.id)}
                    onCheckedChange={() => toggleStage(stage.id)}
                  />
                  <span className="truncate">{stage.stage_name}</span>
                </label>
              ))}
            </div>
          </div>

          <Separator className="my-4" />

          {/* Fields section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Campos</h4>
              <Button variant="ghost" size="sm" onClick={toggleAllFields} className="text-xs h-7">
                {selectedFields.size === EXPORT_FIELDS.length ? 'Desmarcar todos' : 'Marcar todos'}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {EXPORT_FIELDS.map(field => (
                <label key={field.key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={selectedFields.has(field.key)}
                    onCheckedChange={() => toggleField(field.key)}
                  />
                  <span className="truncate">{field.label}</span>
                </label>
              ))}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="flex-row items-center justify-between sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {filteredDeals.length} negócio{filteredDeals.length !== 1 ? 's' : ''} selecionado{filteredDeals.length !== 1 ? 's' : ''}
          </span>
          <Button
            onClick={handleExport}
            disabled={selectedStages.size === 0 || selectedChannels.size === 0 || selectedFields.size === 0 || filteredDeals.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar Excel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
