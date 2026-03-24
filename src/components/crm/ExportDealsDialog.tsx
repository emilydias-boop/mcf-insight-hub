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
}

export const ExportDealsDialog = ({ open, onOpenChange, deals, stages }: ExportDealsDialogProps) => {
  const [selectedStages, setSelectedStages] = useState<Set<string>>(new Set(stages.map(s => s.id)));
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set(EXPORT_FIELDS.map(f => f.key)));

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

  const filteredDeals = useMemo(() => {
    return deals.filter(d => selectedStages.has(d.stage_id));
  }, [deals, selectedStages]);

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
            disabled={selectedStages.size === 0 || selectedFields.size === 0 || filteredDeals.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar Excel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
