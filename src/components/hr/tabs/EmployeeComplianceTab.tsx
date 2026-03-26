import { useState } from 'react';
import { Employee } from '@/types/hr';
import { useEmployeeCompliance, useComplianceMutations } from '@/hooks/useEmployeeTimeCompliance';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ShieldAlert, Plus, Pencil, Trash2, AlertTriangle, AlertOctagon, Info } from 'lucide-react';

interface EmployeeComplianceTabProps {
  employee: Employee;
}

const TIPO_OPTIONS = [
  { value: 'advertencia', label: 'Advertência' },
  { value: 'descumprimento_politica', label: 'Descumprimento de Política' },
  { value: 'investigacao', label: 'Investigação Interna' },
  { value: 'flag_risco', label: 'Flag de Risco' },
];

const SEVERIDADE_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  leve: { label: 'Leve', color: 'bg-yellow-500', icon: Info },
  media: { label: 'Média', color: 'bg-orange-500', icon: AlertTriangle },
  grave: { label: 'Grave', color: 'bg-red-600', icon: AlertOctagon },
};

const STATUS_OPTIONS = [
  { value: 'aberto', label: 'Aberto' },
  { value: 'em_andamento', label: 'Em Andamento' },
  { value: 'encerrado', label: 'Encerrado' },
];

export default function EmployeeComplianceTab({ employee }: EmployeeComplianceTabProps) {
  const { data: records, isLoading, refetch } = useEmployeeCompliance(employee.id);
  const { createCompliance, updateCompliance, deleteCompliance } = useComplianceMutations();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);

  const [formData, setFormData] = useState({
    tipo: 'advertencia',
    severidade: 'leve',
    titulo: '',
    descricao: '',
    data_ocorrencia: format(new Date(), 'yyyy-MM-dd'),
    status: 'aberto',
  });

  const resetForm = () => {
    setFormData({ tipo: 'advertencia', severidade: 'leve', titulo: '', descricao: '', data_ocorrencia: format(new Date(), 'yyyy-MM-dd'), status: 'aberto' });
    setSelectedRecord(null);
  };

  const openCreate = () => { resetForm(); setDialogOpen(true); };
  const openEdit = (r: any) => {
    setSelectedRecord(r);
    setFormData({
      tipo: r.tipo,
      severidade: r.severidade,
      titulo: r.titulo,
      descricao: r.descricao || '',
      data_ocorrencia: r.data_ocorrencia,
      status: r.status,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.titulo) return;
    const payload = { ...formData, descricao: formData.descricao || null };

    if (selectedRecord) {
      await updateCompliance.mutateAsync({ id: selectedRecord.id, data: payload });
    } else {
      await createCompliance.mutateAsync({ ...payload, employee_id: employee.id });
    }
    setDialogOpen(false);
    resetForm();
    refetch();
  };

  const handleDelete = async () => {
    if (!selectedRecord) return;
    await deleteCompliance.mutateAsync(selectedRecord.id);
    setDeleteDialogOpen(false);
    setSelectedRecord(null);
    refetch();
  };

  const abertos = records?.filter(r => r.status !== 'encerrado').length || 0;
  const graves = records?.filter(r => r.severidade === 'grave' && r.status !== 'encerrado').length || 0;

  if (isLoading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>;

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="pt-4 text-center">
          <div className="text-2xl font-bold">{records?.length || 0}</div>
          <div className="text-xs text-muted-foreground">Total registros</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <div className="text-2xl font-bold text-orange-500">{abertos}</div>
          <div className="text-xs text-muted-foreground">Abertos</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <div className="text-2xl font-bold text-red-500">{graves}</div>
          <div className="text-xs text-muted-foreground">Graves ativos</div>
        </CardContent></Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Novo Registro</Button>
      </div>

      {records && records.length > 0 ? (
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
          <div className="space-y-4">
            {records.map((record) => {
              const sev = SEVERIDADE_CONFIG[record.severidade] || SEVERIDADE_CONFIG.leve;
              const tipo = TIPO_OPTIONS.find(t => t.value === record.tipo);
              return (
                <div key={record.id} className="relative pl-10">
                  <div className="absolute left-0 w-8 h-8 rounded-full bg-background border-2 flex items-center justify-center">
                    <ShieldAlert className="h-4 w-4 text-destructive" />
                  </div>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{record.titulo}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(record.data_ocorrencia), "dd/MM/yyyy", { locale: ptBR })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={sev.color}>{sev.label}</Badge>
                          <Badge variant={record.status === 'encerrado' ? 'secondary' : record.status === 'em_andamento' ? 'default' : 'outline'}>
                            {STATUS_OPTIONS.find(s => s.value === record.status)?.label}
                          </Badge>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(record)}><Pencil className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { setSelectedRecord(record); setDeleteDialogOpen(true); }}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </div>
                      {record.descricao && <p className="text-sm text-muted-foreground mt-2">{record.descricao}</p>}
                      <div className="text-xs text-muted-foreground mt-1">{tipo?.label}</div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          <ShieldAlert className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Nenhum registro de compliance</p>
        </CardContent></Card>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{selectedRecord ? 'Editar Registro' : 'Novo Registro de Compliance'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select value={formData.tipo} onValueChange={v => setFormData({ ...formData, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TIPO_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Severidade *</Label>
                <Select value={formData.severidade} onValueChange={v => setFormData({ ...formData, severidade: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="leve">Leve</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="grave">Grave</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input value={formData.titulo} onChange={e => setFormData({ ...formData, titulo: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data Ocorrência *</Label>
                <Input type="date" value={formData.data_ocorrencia} onChange={e => setFormData({ ...formData, data_ocorrencia: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={formData.descricao} onChange={e => setFormData({ ...formData, descricao: e.target.value })} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={createCompliance.isPending || updateCompliance.isPending}>
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
