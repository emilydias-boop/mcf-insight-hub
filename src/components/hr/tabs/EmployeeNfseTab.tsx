import { useState, useRef } from 'react';
import { Employee, RhNfse, NFSE_STATUS_LABELS, NFSE_PAGAMENTO_LABELS } from '@/types/hr';
import { useEmployeeNfse, useEmployeeMutations } from '@/hooks/useEmployees';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText, Plus, Eye, Download, Trash2, Loader2, Clock, CheckCircle, AlertCircle, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

interface EmployeeNfseTabProps {
  employee: Employee;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export default function EmployeeNfseTab({ employee }: EmployeeNfseTabProps) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [selectedYear, setSelectedYear] = useState(currentYear);
  
  const { data: nfseList, isLoading, refetch } = useEmployeeNfse(employee.id, selectedYear);
  const { createNfse, updateNfse, deleteNfse } = useEmployeeMutations();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [selectedNfse, setSelectedNfse] = useState<RhNfse | null>(null);
  const [returnMessage, setReturnMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    mes: currentMonth,
    ano: currentYear,
    numero_nfse: '',
    valor_nfse: 0,
    data_envio_nfse: '',
    status_nfse: 'pendente_envio' as RhNfse['status_nfse'],
    status_pagamento: 'pendente' as RhNfse['status_pagamento'],
    data_pagamento: '',
    observacoes: '',
  });

  // Find current month NFSe
  const currentMonthNfse = nfseList?.find(n => n.mes === currentMonth && n.ano === currentYear);

  const resetForm = () => {
    setFormData({
      mes: currentMonth,
      ano: currentYear,
      numero_nfse: '',
      valor_nfse: 0,
      data_envio_nfse: '',
      status_nfse: 'pendente_envio',
      status_pagamento: 'pendente',
      data_pagamento: '',
      observacoes: '',
    });
    setSelectedFile(null);
    setSelectedNfse(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (nfse: RhNfse) => {
    setSelectedNfse(nfse);
    setFormData({
      mes: nfse.mes,
      ano: nfse.ano,
      numero_nfse: nfse.numero_nfse || '',
      valor_nfse: nfse.valor_nfse,
      data_envio_nfse: nfse.data_envio_nfse || '',
      status_nfse: nfse.status_nfse,
      status_pagamento: nfse.status_pagamento,
      data_pagamento: nfse.data_pagamento || '',
      observacoes: nfse.observacoes || '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.valor_nfse) {
      toast.error('Informe o valor da NFSe');
      return;
    }

    setUploading(true);
    try {
      let storagePath = selectedNfse?.storage_path || null;
      let arquivoUrl = selectedNfse?.arquivo_url || null;

      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `nfse/${employee.id}/${formData.ano}-${formData.mes}-${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('user-files')
          .upload(fileName, selectedFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('user-files')
          .getPublicUrl(fileName);

        storagePath = fileName;
        arquivoUrl = urlData.publicUrl;

        if (selectedNfse?.storage_path && selectedNfse.storage_path !== fileName) {
          await supabase.storage.from('user-files').remove([selectedNfse.storage_path]);
        }
      }

      const nfseData = {
        ...formData,
        storage_path: storagePath,
        arquivo_url: arquivoUrl,
        data_envio_nfse: formData.data_envio_nfse || null,
        data_pagamento: formData.status_pagamento === 'pago' ? formData.data_pagamento || null : null,
      };

      if (selectedNfse) {
        await updateNfse.mutateAsync({ id: selectedNfse.id, data: nfseData });
      } else {
        await createNfse.mutateAsync({ ...nfseData, employee_id: employee.id });
      }

      setDialogOpen(false);
      resetForm();
      refetch();
    } catch (error: any) {
      toast.error('Erro: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedNfse) return;
    await deleteNfse.mutateAsync({ id: selectedNfse.id, storagePath: selectedNfse.storage_path || undefined });
    setDeleteDialogOpen(false);
    setSelectedNfse(null);
    refetch();
  };

  const handleStatusAction = async (nfse: RhNfse, newStatus: RhNfse['status_nfse']) => {
    await updateNfse.mutateAsync({ 
      id: nfse.id, 
      data: { status_nfse: newStatus } 
    });
    refetch();
  };

  const handleMarkAsPaid = async (nfse: RhNfse) => {
    await updateNfse.mutateAsync({ 
      id: nfse.id, 
      data: { 
        status_pagamento: 'pago',
        data_pagamento: new Date().toISOString().split('T')[0]
      } 
    });
    refetch();
  };

  const handleReturn = async () => {
    if (!selectedNfse) return;
    await updateNfse.mutateAsync({ 
      id: selectedNfse.id, 
      data: { 
        status_nfse: 'devolvida',
        observacoes: returnMessage || selectedNfse.observacoes
      } 
    });
    setReturnDialogOpen(false);
    setReturnMessage('');
    setSelectedNfse(null);
    refetch();
  };

  const handleView = async (nfse: RhNfse) => {
    if (!nfse.storage_path) return;
    const { data } = await supabase.storage.from('user-files').createSignedUrl(nfse.storage_path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  const handleDownload = async (nfse: RhNfse) => {
    if (!nfse.storage_path) return;
    const { data } = await supabase.storage.from('user-files').createSignedUrl(nfse.storage_path, 3600);
    if (data?.signedUrl) {
      const response = await fetch(data.signedUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `NFSe-${nfse.mes}-${nfse.ano}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="space-y-4">
      {/* Current Month Summary */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            NFSe do Mês Atual - {MONTH_NAMES[currentMonth - 1]}/{currentYear}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {currentMonthNfse ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Valor</p>
                  <p className="font-semibold">{formatCurrency(currentMonthNfse.valor_nfse)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status NFSe</p>
                  <Badge className={NFSE_STATUS_LABELS[currentMonthNfse.status_nfse]?.color || 'bg-gray-500'}>
                    {NFSE_STATUS_LABELS[currentMonthNfse.status_nfse]?.label || currentMonthNfse.status_nfse}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pagamento</p>
                  <Badge className={NFSE_PAGAMENTO_LABELS[currentMonthNfse.status_pagamento]?.color || 'bg-gray-500'}>
                    {NFSE_PAGAMENTO_LABELS[currentMonthNfse.status_pagamento]?.label || currentMonthNfse.status_pagamento}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Enviada em</p>
                  <p className="font-medium">
                    {currentMonthNfse.data_envio_nfse 
                      ? format(new Date(currentMonthNfse.data_envio_nfse), 'dd/MM/yyyy')
                      : '-'}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                {currentMonthNfse.status_nfse === 'nota_enviada' && (
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleStatusAction(currentMonthNfse, 'em_analise')}
                  >
                    <Clock className="h-4 w-4 mr-1" />
                    Em Análise
                  </Button>
                )}
                {(currentMonthNfse.status_nfse === 'em_analise' || currentMonthNfse.status_nfse === 'nota_enviada') && (
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="text-green-600 border-green-600 hover:bg-green-50"
                    onClick={() => handleStatusAction(currentMonthNfse, 'aprovada')}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Aprovar NFSe
                  </Button>
                )}
                {currentMonthNfse.status_nfse === 'aprovada' && currentMonthNfse.status_pagamento !== 'pago' && (
                  <Button 
                    size="sm" 
                    variant="default"
                    onClick={() => handleMarkAsPaid(currentMonthNfse)}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Marcar como Paga
                  </Button>
                )}
                {currentMonthNfse.status_nfse !== 'pendente_envio' && currentMonthNfse.status_nfse !== 'devolvida' && (
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="text-red-600 border-red-600 hover:bg-red-50"
                    onClick={() => {
                      setSelectedNfse(currentMonthNfse);
                      setReturnDialogOpen(true);
                    }}
                  >
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Devolver p/ Correção
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhuma NFSe enviada para este mês</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* NFSe History */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Histórico de NFSe</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-1" />Adicionar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : !nfseList || nfseList.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhuma NFSe registrada em {selectedYear}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês/Ano</TableHead>
                  <TableHead>Nº NFSe</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status NFSe</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Data Pgto</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nfseList.map((nfse) => (
                  <TableRow key={nfse.id}>
                    <TableCell>{MONTH_NAMES[nfse.mes - 1]}/{nfse.ano}</TableCell>
                    <TableCell>{nfse.numero_nfse || '-'}</TableCell>
                    <TableCell>{formatCurrency(nfse.valor_nfse)}</TableCell>
                    <TableCell>
                      <Badge className={NFSE_STATUS_LABELS[nfse.status_nfse]?.color || 'bg-gray-500'}>
                        {NFSE_STATUS_LABELS[nfse.status_nfse]?.label || nfse.status_nfse}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={NFSE_PAGAMENTO_LABELS[nfse.status_pagamento]?.color || 'bg-gray-500'}>
                        {NFSE_PAGAMENTO_LABELS[nfse.status_pagamento]?.label || nfse.status_pagamento}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {nfse.data_pagamento 
                        ? format(new Date(nfse.data_pagamento), 'dd/MM/yyyy')
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {nfse.storage_path && (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => handleView(nfse)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDownload(nfse)}>
                              <Download className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-red-500"
                          onClick={() => {
                            setSelectedNfse(nfse);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedNfse ? 'Editar NFSe' : 'Adicionar NFSe'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mês</Label>
                <Select value={String(formData.mes)} onValueChange={(v) => setFormData({ ...formData, mes: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES.map((m, i) => (
                      <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ano</Label>
                <Select value={String(formData.ano)} onValueChange={(v) => setFormData({ ...formData, ano: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Número da NFSe</Label>
              <Input
                value={formData.numero_nfse}
                onChange={(e) => setFormData({ ...formData, numero_nfse: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                value={formData.valor_nfse}
                onChange={(e) => setFormData({ ...formData, valor_nfse: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Data de Envio</Label>
              <Input
                type="date"
                value={formData.data_envio_nfse}
                onChange={(e) => setFormData({ ...formData, data_envio_nfse: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status NFSe</Label>
                <Select value={formData.status_nfse} onValueChange={(v) => setFormData({ ...formData, status_nfse: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(NFSE_STATUS_LABELS).map(([key, val]) => (
                      <SelectItem key={key} value={key}>{val.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status Pagamento</Label>
                <Select value={formData.status_pagamento} onValueChange={(v) => setFormData({ ...formData, status_pagamento: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(NFSE_PAGAMENTO_LABELS).map(([key, val]) => (
                      <SelectItem key={key} value={key}>{val.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {formData.status_pagamento === 'pago' && (
              <div className="space-y-2">
                <Label>Data de Pagamento</Label>
                <Input
                  type="date"
                  value={formData.data_pagamento}
                  onChange={(e) => setFormData({ ...formData, data_pagamento: e.target.value })}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Arquivo da NFSe (PDF)</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                className="hidden"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
              <Button
                variant="outline"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
              >
                {selectedFile ? selectedFile.name : selectedNfse?.storage_path ? 'Substituir arquivo' : 'Selecionar arquivo'}
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={uploading}>
              {uploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return Dialog */}
      <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Devolver NFSe para Correção</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Informe o motivo da devolução para o colaborador.
            </p>
            <div className="space-y-2">
              <Label>Mensagem</Label>
              <Textarea
                value={returnMessage}
                onChange={(e) => setReturnMessage(e.target.value)}
                placeholder="Ex: Valor incorreto, favor reenviar com o valor corrigido."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleReturn}>
              Devolver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir NFSe?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
