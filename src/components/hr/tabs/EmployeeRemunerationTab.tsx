import { useState, useEffect, useRef } from 'react';
import { Employee, RhNfse, TIPO_VARIAVEL_OPTIONS, NFSE_STATUS_LABELS, NFSE_PAGAMENTO_LABELS } from '@/types/hr';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useEmployeeSdrPayouts, useEmployeeMutations, useEmployeeNfse } from '@/hooks/useEmployees';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DollarSign, TrendingUp, Calendar, AlertCircle, Pencil, X, Save, Plus, FileText, Trash2, Eye, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface EmployeeRemunerationTabProps {
  employee: Employee;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatMonth = (anoMes: string) => {
  const [year, month] = anoMes.split('-');
  return format(new Date(parseInt(year), parseInt(month) - 1), 'MMMM yyyy', { locale: ptBR });
};

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export default function EmployeeRemunerationTab({ employee }: EmployeeRemunerationTabProps) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  
  const { data: payouts, isLoading: payoutsLoading } = useEmployeeSdrPayouts(employee.sdr_id);
  const { data: nfseList, isLoading: nfseLoading, refetch: refetchNfse } = useEmployeeNfse(employee.id, selectedYear);
  const { updateEmployee, createNfse, updateNfse, deleteNfse } = useEmployeeMutations();
  
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    salario_base: employee.salario_base || 0,
    nivel: employee.nivel || 1,
    ote_mensal: employee.ote_mensal || 0,
    tipo_variavel: employee.tipo_variavel || '',
    descricao_comissao: employee.descricao_comissao || '',
    modelo_fechamento: employee.modelo_fechamento || '',
    fechamento_manual: employee.fechamento_manual || false,
    banco: employee.banco || '',
    agencia: employee.agencia || '',
    conta: employee.conta || '',
    tipo_conta: employee.tipo_conta || '',
    pix: employee.pix || '',
  });

  // Sync formData when employee changes
  useEffect(() => {
    setFormData({
      salario_base: employee.salario_base || 0,
      nivel: employee.nivel || 1,
      ote_mensal: employee.ote_mensal || 0,
      tipo_variavel: employee.tipo_variavel || '',
      descricao_comissao: employee.descricao_comissao || '',
      modelo_fechamento: employee.modelo_fechamento || '',
      fechamento_manual: employee.fechamento_manual || false,
      banco: employee.banco || '',
      agencia: employee.agencia || '',
      conta: employee.conta || '',
      tipo_conta: employee.tipo_conta || '',
      pix: employee.pix || '',
    });
  }, [employee]);

  // NFSe form state
  const [nfseDialogOpen, setNfseDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedNfse, setSelectedNfse] = useState<RhNfse | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [nfseFormData, setNfseFormData] = useState({
    mes: new Date().getMonth() + 1,
    ano: currentYear,
    numero_nfse: '',
    valor_nfse: 0,
    data_envio_nfse: '',
    status_nfse: 'pendente_envio' as RhNfse['status_nfse'],
    status_pagamento: 'pendente' as RhNfse['status_pagamento'],
    data_pagamento: '',
    observacoes: '',
  });

  const handleSave = () => {
    updateEmployee.mutate(
      { id: employee.id, data: formData },
      { onSuccess: () => setIsEditing(false) }
    );
  };

  const resetNfseForm = () => {
    setNfseFormData({
      mes: new Date().getMonth() + 1,
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

  const openNfseCreateDialog = () => {
    resetNfseForm();
    setNfseDialogOpen(true);
  };

  const openNfseEditDialog = (nfse: RhNfse) => {
    setSelectedNfse(nfse);
    setNfseFormData({
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
    setNfseDialogOpen(true);
  };

  const handleNfseSubmit = async () => {
    if (!nfseFormData.valor_nfse) {
      toast.error('Informe o valor da NFSe');
      return;
    }

    setUploading(true);
    try {
      let storagePath = selectedNfse?.storage_path || null;
      let arquivoUrl = selectedNfse?.arquivo_url || null;

      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `nfse/${employee.id}/${nfseFormData.ano}-${nfseFormData.mes}-${Date.now()}.${fileExt}`;
        
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
        ...nfseFormData,
        storage_path: storagePath,
        arquivo_url: arquivoUrl,
        data_envio_nfse: nfseFormData.data_envio_nfse || null,
        data_pagamento: nfseFormData.status_pagamento === 'pago' ? nfseFormData.data_pagamento || null : null,
      };

      if (selectedNfse) {
        await updateNfse.mutateAsync({ id: selectedNfse.id, data: nfseData });
      } else {
        await createNfse.mutateAsync({ ...nfseData, employee_id: employee.id });
      }

      setNfseDialogOpen(false);
      resetNfseForm();
      refetchNfse();
    } catch (error: any) {
      toast.error('Erro: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleNfseDelete = async () => {
    if (!selectedNfse) return;
    await deleteNfse.mutateAsync({ id: selectedNfse.id, storagePath: selectedNfse.storage_path || undefined });
    setDeleteDialogOpen(false);
    setSelectedNfse(null);
    refetchNfse();
  };

  const handleViewNfse = async (nfse: RhNfse) => {
    if (!nfse.storage_path) return;
    const { data } = await supabase.storage.from('user-files').createSignedUrl(nfse.storage_path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  const handleDownloadNfse = async (nfse: RhNfse) => {
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

  const InfoRow = ({ label, value }: { label: string; value: string | null }) => (
    <div className="flex justify-between py-2">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="font-medium text-sm">{value || '-'}</span>
    </div>
  );

  const isPJ = employee.tipo_contrato === 'PJ';

  return (
    <div className="space-y-4">
      {/* Configuração de Remuneração */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Configuração de Remuneração
          </CardTitle>
          {!isEditing ? (
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
              <Pencil className="h-4 w-4 mr-1" />Editar
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                <X className="h-4 w-4" />
              </Button>
              <Button size="sm" onClick={handleSave} disabled={updateEmployee.isPending}>
                <Save className="h-4 w-4 mr-1" />Salvar
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Salário Base / Retirada (R$)</Label>
                <Input
                  type="number"
                  value={formData.salario_base}
                  onChange={(e) => setFormData({ ...formData, salario_base: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Nível</Label>
                <Select value={String(formData.nivel)} onValueChange={(v) => setFormData({ ...formData, nivel: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                      <SelectItem key={n} value={String(n)}>Nível {n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>OTE Mensal (R$)</Label>
                <Input
                  type="number"
                  value={formData.ote_mensal}
                  onChange={(e) => setFormData({ ...formData, ote_mensal: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de Variável</Label>
                <Select value={formData.tipo_variavel || '_none'} onValueChange={(v) => setFormData({ ...formData, tipo_variavel: v === '_none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Selecione...</SelectItem>
                    {TIPO_VARIAVEL_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Descrição do Modelo de Comissão</Label>
                <Textarea
                  value={formData.descricao_comissao}
                  onChange={(e) => setFormData({ ...formData, descricao_comissao: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Modelo de Fechamento</Label>
                <Input
                  value={formData.modelo_fechamento}
                  onChange={(e) => setFormData({ ...formData, modelo_fechamento: e.target.value })}
                  placeholder="Ex: Fechamento Inside Sales Crédito"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Fechamento Manual</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Quando ativo, o cálculo automático é desativado para este colaborador
                    </p>
                  </div>
                  <Switch
                    checked={formData.fechamento_manual}
                    onCheckedChange={(checked) => setFormData({ ...formData, fechamento_manual: checked })}
                  />
                </div>
                {formData.fechamento_manual && (
                  <Alert className="border-yellow-500/50 bg-yellow-500/10 py-2">
                    <AlertCircle className="h-3.5 w-3.5 text-yellow-500" />
                    <AlertDescription className="text-xs text-yellow-500">
                      O cálculo automático será desativado. Valores devem ser preenchidos manualmente no fechamento.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
              <div className="col-span-2 border-t pt-4 mt-2">
                <h4 className="font-medium mb-3">Dados Bancários</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Banco</Label>
                    <Input value={formData.banco} onChange={(e) => setFormData({ ...formData, banco: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Agência</Label>
                    <Input value={formData.agencia} onChange={(e) => setFormData({ ...formData, agencia: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Conta</Label>
                    <Input value={formData.conta} onChange={(e) => setFormData({ ...formData, conta: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Conta</Label>
                    <Select value={formData.tipo_conta || '_none'} onValueChange={(v) => setFormData({ ...formData, tipo_conta: v === '_none' ? '' : v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Selecione...</SelectItem>
                        <SelectItem value="corrente">Corrente</SelectItem>
                        <SelectItem value="poupanca">Poupança</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label>Chave PIX</Label>
                    <Input value={formData.pix} onChange={(e) => setFormData({ ...formData, pix: e.target.value })} />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="divide-y">
              <InfoRow label="Salário Base / Retirada" value={formatCurrency(employee.salario_base)} />
              <InfoRow label="Nível" value={`Nível ${employee.nivel}`} />
              <InfoRow label="OTE Mensal" value={employee.ote_mensal ? formatCurrency(employee.ote_mensal) : null} />
              <InfoRow label="Tipo de Variável" value={TIPO_VARIAVEL_OPTIONS.find(o => o.value === employee.tipo_variavel)?.label || employee.tipo_variavel} />
              <InfoRow label="Descrição Comissão" value={employee.descricao_comissao} />
              <InfoRow label="Modelo de Fechamento" value={employee.modelo_fechamento} />
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground text-sm">Fechamento Manual</span>
                <Badge variant={employee.fechamento_manual ? "default" : "secondary"} className="text-xs">
                  {employee.fechamento_manual ? "Ativo" : "Desativado"}
                </Badge>
              </div>
              <div className="pt-3 mt-3 border-t">
                <h4 className="font-medium text-sm mb-2">Dados Bancários</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Banco:</span> {employee.banco || '-'}</div>
                  <div><span className="text-muted-foreground">Agência:</span> {employee.agencia || '-'}</div>
                  <div><span className="text-muted-foreground">Conta:</span> {employee.conta || '-'}</div>
                  <div><span className="text-muted-foreground">Tipo:</span> {employee.tipo_conta || '-'}</div>
                  <div className="col-span-2"><span className="text-muted-foreground">PIX:</span> {employee.pix || '-'}</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* NFSe Mensais (só para PJ) */}
      {isPJ && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              NFSe Mensais (PJ)
            </CardTitle>
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
              <Button size="sm" onClick={openNfseCreateDialog}>
                <Plus className="h-4 w-4 mr-1" />Adicionar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {nfseLoading ? (
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
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nfseList.map((nfse) => (
                    <TableRow key={nfse.id}>
                      <TableCell>{MONTH_NAMES[nfse.mes - 1]}/{nfse.ano}</TableCell>
                      <TableCell>{nfse.numero_nfse || '-'}</TableCell>
                      <TableCell>{formatCurrency(nfse.valor_nfse)}</TableCell>
                      <TableCell>
                        <Badge className={NFSE_STATUS_LABELS[nfse.status_nfse].color}>
                          {NFSE_STATUS_LABELS[nfse.status_nfse].label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={NFSE_PAGAMENTO_LABELS[nfse.status_pagamento].color}>
                          {NFSE_PAGAMENTO_LABELS[nfse.status_pagamento].label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {nfse.data_pagamento ? format(new Date(nfse.data_pagamento), 'dd/MM/yy') : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {nfse.storage_path && (
                            <>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleViewNfse(nfse)}>
                                <Eye className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownloadNfse(nfse)}>
                                <Download className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openNfseEditDialog(nfse)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { setSelectedNfse(nfse); setDeleteDialogOpen(true); }}>
                            <Trash2 className="h-3 w-3" />
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
      )}

      {/* Histórico de Fechamentos SDR */}
      {employee.sdr_id && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Histórico de Fechamentos SDR
            </CardTitle>
          </CardHeader>
          <CardContent>
            {payoutsLoading ? (
              <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
            ) : !payouts || payouts.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Nenhum fechamento encontrado</p>
              </div>
            ) : (
              <div className="space-y-3">
                {payouts.map((payout: any) => (
                  <div key={payout.id} className="p-4 rounded-lg border bg-muted/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium capitalize">{formatMonth(payout.ano_mes)}</span>
                      </div>
                      <Badge variant={payout.status === 'LOCKED' ? 'default' : payout.status === 'APPROVED' ? 'secondary' : 'outline'}>
                        {payout.status === 'LOCKED' ? 'Finalizado' : payout.status === 'APPROVED' ? 'Aprovado' : 'Rascunho'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><span className="text-muted-foreground">Fixo:</span> <span className="ml-2 font-medium">{formatCurrency(payout.fixo_valor || 0)}</span></div>
                      <div><span className="text-muted-foreground">Variável:</span> <span className="ml-2 font-medium">{formatCurrency(payout.variavel_valor || 0)}</span></div>
                      <div><span className="text-muted-foreground">iFood:</span> <span className="ml-2 font-medium">{formatCurrency((payout.ifood_mensal || 0) + (payout.ifood_ultrameta || 0))}</span></div>
                      <div><span className="text-muted-foreground font-semibold">Total:</span> <span className="ml-2 font-bold text-primary">{formatCurrency(payout.total_payout || 0)}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* NFSe Dialog */}
      <Dialog open={nfseDialogOpen} onOpenChange={setNfseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedNfse ? 'Editar NFSe' : 'Adicionar NFSe'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mês</Label>
                <Select value={String(nfseFormData.mes)} onValueChange={(v) => setNfseFormData({ ...nfseFormData, mes: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES.map((name, i) => (
                      <SelectItem key={i} value={String(i + 1)}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ano</Label>
                <Select value={String(nfseFormData.ano)} onValueChange={(v) => setNfseFormData({ ...nfseFormData, ano: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Número NFSe</Label>
                <Input value={nfseFormData.numero_nfse} onChange={(e) => setNfseFormData({ ...nfseFormData, numero_nfse: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Valor NFSe (R$) *</Label>
                <Input type="number" value={nfseFormData.valor_nfse} onChange={(e) => setNfseFormData({ ...nfseFormData, valor_nfse: Number(e.target.value) })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Arquivo {selectedNfse?.storage_path ? '(substituir)' : ''}</Label>
              <Input ref={fileInputRef} type="file" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} accept=".pdf,.xml" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data de Envio</Label>
                <Input type="date" value={nfseFormData.data_envio_nfse} onChange={(e) => setNfseFormData({ ...nfseFormData, data_envio_nfse: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Status NFSe</Label>
                <Select value={nfseFormData.status_nfse} onValueChange={(v: RhNfse['status_nfse']) => setNfseFormData({ ...nfseFormData, status_nfse: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente_envio">Pendente envio</SelectItem>
                    <SelectItem value="nota_enviada">Nota enviada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status Pagamento</Label>
                <Select value={nfseFormData.status_pagamento} onValueChange={(v: RhNfse['status_pagamento']) => setNfseFormData({ ...nfseFormData, status_pagamento: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="em_atraso">Em atraso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {nfseFormData.status_pagamento === 'pago' && (
                <div className="space-y-2">
                  <Label>Data de Pagamento</Label>
                  <Input type="date" value={nfseFormData.data_pagamento} onChange={(e) => setNfseFormData({ ...nfseFormData, data_pagamento: e.target.value })} />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={nfseFormData.observacoes} onChange={(e) => setNfseFormData({ ...nfseFormData, observacoes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNfseDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleNfseSubmit} disabled={uploading}>
              {uploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {selectedNfse ? 'Salvar' : 'Adicionar'}
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
              Esta ação não pode ser desfeita. A NFSe será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleNfseDelete} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
