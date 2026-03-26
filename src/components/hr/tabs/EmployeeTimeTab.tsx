import { useState } from 'react';
import { Employee } from '@/types/hr';
import { useEmployeeTimeRecords, useTimeRecordMutations } from '@/hooks/useEmployeeTimeCompliance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { format, differenceInCalendarDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Plus, Pencil, Trash2, Palmtree, AlertTriangle, FileText, Stethoscope } from 'lucide-react';

interface EmployeeTimeTabProps {
  employee: Employee;
}

const TIPO_OPTIONS = [
  { value: 'ferias', label: 'Férias', icon: Palmtree, color: 'bg-cyan-500' },
  { value: 'ausencia_justificada', label: 'Ausência Justificada', icon: Calendar, color: 'bg-blue-500' },
  { value: 'ausencia_injustificada', label: 'Ausência Injustificada', icon: AlertTriangle, color: 'bg-red-500' },
  { value: 'atestado', label: 'Atestado', icon: Stethoscope, color: 'bg-yellow-500' },
  { value: 'licenca', label: 'Licença', icon: FileText, color: 'bg-purple-500' },
];

export default function EmployeeTimeTab({ employee }: EmployeeTimeTabProps) {
  const { data: records, isLoading, refetch } = useEmployeeTimeRecords(employee.id);
  const { createRecord, updateRecord, deleteRecord } = useTimeRecordMutations();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [filterTipo, setFilterTipo] = useState<string>('all');

  const [formData, setFormData] = useState({
    tipo: 'ferias',
    data_inicio: format(new Date(), 'yyyy-MM-dd'),
    data_fim: '',
    dias: 0,
    motivo: '',
    observacoes: '',
  });

  const resetForm = () => {
    setFormData({ tipo: 'ferias', data_inicio: format(new Date(), 'yyyy-MM-dd'), data_fim: '', dias: 0, motivo: '', observacoes: '' });
    setSelectedRecord(null);
  };

  const openCreate = () => { resetForm(); setDialogOpen(true); };
  const openEdit = (r: any) => {
    setSelectedRecord(r);
    setFormData({
      tipo: r.tipo,
      data_inicio: r.data_inicio,
      data_fim: r.data_fim || '',
      dias: r.dias || 0,
      motivo: r.motivo || '',
      observacoes: r.observacoes || '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    const payload = {
      ...formData,
      data_fim: formData.data_fim || null,
      dias: formData.dias || (formData.data_fim ? differenceInCalendarDays(new Date(formData.data_fim), new Date(formData.data_inicio)) + 1 : 1),
      motivo: formData.motivo || null,
      observacoes: formData.observacoes || null,
    };

    if (selectedRecord) {
      await updateRecord.mutateAsync({ id: selectedRecord.id, data: payload });
    } else {
      await createRecord.mutateAsync({ ...payload, employee_id: employee.id });
    }
    setDialogOpen(false);
    resetForm();
    refetch();
  };

  const handleDelete = async () => {
    if (!selectedRecord) return;
    await deleteRecord.mutateAsync(selectedRecord.id);
    setDeleteDialogOpen(false);
    setSelectedRecord(null);
    refetch();
  };

  // Auto-calc dias when dates change
  const handleDateChange = (field: 'data_inicio' | 'data_fim', value: string) => {
    const newForm = { ...formData, [field]: value };
    if (newForm.data_inicio && newForm.data_fim) {
      newForm.dias = differenceInCalendarDays(new Date(newForm.data_fim), new Date(newForm.data_inicio)) + 1;
    }
    setFormData(newForm);
  };

  // Stats
  const feriasDias = records?.filter(r => r.tipo === 'ferias').reduce((sum, r) => sum + (r.dias || 0), 0) || 0;
  const ausenciasDias = records?.filter(r => r.tipo.startsWith('ausencia')).reduce((sum, r) => sum + (r.dias || 0), 0) || 0;
  const atestadosDias = records?.filter(r => r.tipo === 'atestado').reduce((sum, r) => sum + (r.dias || 0), 0) || 0;
  const licencaDias = records?.filter(r => r.tipo === 'licenca').reduce((sum, r) => sum + (r.dias || 0), 0) || 0;

  const filtered = filterTipo === 'all' ? records : records?.filter(r => r.tipo === filterTipo);

  if (isLoading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>;

  return (
    <div className="space-y-4">
      {/* Cards resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4 text-center">
          <Palmtree className="h-5 w-5 mx-auto text-cyan-500 mb-1" />
          <div className="text-2xl font-bold">{feriasDias}</div>
          <div className="text-xs text-muted-foreground">dias de férias</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <Calendar className="h-5 w-5 mx-auto text-blue-500 mb-1" />
          <div className="text-2xl font-bold">{ausenciasDias}</div>
          <div className="text-xs text-muted-foreground">dias ausência</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <Stethoscope className="h-5 w-5 mx-auto text-yellow-500 mb-1" />
          <div className="text-2xl font-bold">{atestadosDias}</div>
          <div className="text-xs text-muted-foreground">dias atestado</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <FileText className="h-5 w-5 mx-auto text-purple-500 mb-1" />
          <div className="text-2xl font-bold">{licencaDias}</div>
          <div className="text-xs text-muted-foreground">dias licença</div>
        </CardContent></Card>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {TIPO_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Novo Registro</Button>
      </div>

      {/* Lista */}
      {filtered && filtered.length > 0 ? (
        <div className="space-y-2">
          {filtered.map((record) => {
            const tipo = TIPO_OPTIONS.find(t => t.value === record.tipo);
            return (
              <div key={record.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge className={tipo?.color || 'bg-muted'}>{tipo?.label || record.tipo}</Badge>
                  <div>
                    <div className="text-sm font-medium">
                      {format(new Date(record.data_inicio), 'dd/MM/yyyy', { locale: ptBR })}
                      {record.data_fim && ` — ${format(new Date(record.data_fim), 'dd/MM/yyyy', { locale: ptBR })}`}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {record.dias ? `${record.dias} dia(s)` : ''}
                      {record.motivo ? ` · ${record.motivo}` : ''}
                    </div>
                    {record.observacoes && <div className="text-xs text-muted-foreground italic mt-1">"{record.observacoes}"</div>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(record)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setSelectedRecord(record); setDeleteDialogOpen(true); }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Nenhum registro encontrado</p>
        </CardContent></Card>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{selectedRecord ? 'Editar Registro' : 'Novo Registro'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select value={formData.tipo} onValueChange={v => setFormData({ ...formData, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPO_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data Início *</Label>
                <Input type="date" value={formData.data_inicio} onChange={e => handleDateChange('data_inicio', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Input type="date" value={formData.data_fim} onChange={e => handleDateChange('data_fim', e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Dias</Label>
              <Input type="number" value={formData.dias} onChange={e => setFormData({ ...formData, dias: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Motivo</Label>
              <Input value={formData.motivo} onChange={e => setFormData({ ...formData, motivo: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={formData.observacoes} onChange={e => setFormData({ ...formData, observacoes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={createRecord.isPending || updateRecord.isPending}>
              {selectedRecord ? 'Salvar' : 'Registrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir registro?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
