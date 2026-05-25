import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  useActiveTransfer, useTransferBuyer, useTransferFinancials,
  useUpdateTransfer, useUpsertTransferBuyer,
  useAddTransferFinancial, useUpdateTransferFinancial, useDeleteTransferFinancial,
} from '@/hooks/useConsortiumTransfer';
import {
  TRANSFER_FASE_OPTIONS, TIPO_CONTEMPLACAO_OPTIONS,
  TRANSFER_FINANCIAL_TIPO_OPTIONS, type TransferStatusFase,
} from '@/types/consorcioTransfer';
import { Plus, Trash2, CheckCircle2, XCircle } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  cardId: string | null;
}

const FASE_ORDER: TransferStatusFase[] = [
  'precificacao','comprador','analise_credito','documentacao','transferencia_oficial','financeiro','concluida',
];

function fmtBRL(n: number | null | undefined) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n || 0));
}

export function TransferProcessDrawer({ open, onOpenChange, cardId }: Props) {
  const { data: transfer } = useActiveTransfer(cardId);
  const { data: buyer } = useTransferBuyer(transfer?.id || null);
  const { data: financials = [] } = useTransferFinancials(transfer?.id || null);
  const updateTransfer = useUpdateTransfer();
  const upsertBuyer = useUpsertTransferBuyer();
  const addFin = useAddTransferFinancial();
  const updFin = useUpdateTransferFinancial();
  const delFin = useDeleteTransferFinancial();

  // local form states
  const [pricing, setPricing] = useState<any>({});
  const [buyerForm, setBuyerForm] = useState<any>({});
  const [credit, setCredit] = useState<any>({});
  const [official, setOfficial] = useState<any>({});
  const [newFin, setNewFin] = useState<any>({ tipo: 'entrada_comprador', valor: '', status: 'previsto' });

  useEffect(() => {
    if (transfer) {
      setPricing({
        tipo_contemplacao: transfer.tipo_contemplacao || '',
        usou_capital_proprio: !!transfer.usou_capital_proprio,
        valor_capital_proprio: transfer.valor_capital_proprio || '',
        data_assembleia: transfer.data_assembleia || '',
        valor_lance: transfer.valor_lance || '',
        valor_credito_disponivel: transfer.valor_credito_disponivel || '',
        valor_total_comprador: transfer.valor_total_comprador || '',
        valor_comissao_empresa: transfer.valor_comissao_empresa || '',
        valor_repasse_consorciado: transfer.valor_repasse_consorciado || '',
        observacoes_precificacao: transfer.observacoes_precificacao || '',
      });
      setCredit({
        analise_status: transfer.analise_status,
        analise_data: transfer.analise_data || '',
        analise_observacao: transfer.analise_observacao || '',
      });
      setOfficial({
        protocolo_admin: transfer.protocolo_admin || '',
        data_envio_admin: transfer.data_envio_admin || '',
        data_efetivacao: transfer.data_efetivacao || '',
        nova_cota: transfer.nova_cota || '',
      });
    }
  }, [transfer?.id]);

  useEffect(() => {
    if (buyer) setBuyerForm(buyer);
    else if (transfer?.id) setBuyerForm({ tipo_pessoa: 'pf', transfer_id: transfer.id });
  }, [buyer, transfer?.id]);

  if (!transfer) return null;

  const currentIdx = FASE_ORDER.indexOf(transfer.status_fase);
  const isClosed = transfer.status_fase === 'concluida' || transfer.status_fase === 'cancelada';

  const advance = async () => {
    if (currentIdx < 0 || currentIdx >= FASE_ORDER.length - 1) return;
    await updateTransfer.mutateAsync({
      id: transfer.id, cardId: transfer.card_id,
      patch: { status_fase: FASE_ORDER[currentIdx + 1] as TransferStatusFase },
    });
  };

  const setFase = async (fase: TransferStatusFase) => {
    await updateTransfer.mutateAsync({ id: transfer.id, cardId: transfer.card_id, patch: { status_fase: fase } });
  };

  const savePricing = () => {
    const num = (v: any) => v === '' || v == null ? null : Number(v);
    updateTransfer.mutate({
      id: transfer.id, cardId: transfer.card_id,
      patch: {
        tipo_contemplacao: pricing.tipo_contemplacao || null,
        usou_capital_proprio: !!pricing.usou_capital_proprio,
        valor_capital_proprio: num(pricing.valor_capital_proprio),
        data_assembleia: pricing.data_assembleia || null,
        valor_lance: num(pricing.valor_lance),
        valor_credito_disponivel: num(pricing.valor_credito_disponivel),
        valor_total_comprador: num(pricing.valor_total_comprador),
        valor_comissao_empresa: num(pricing.valor_comissao_empresa),
        valor_repasse_consorciado: num(pricing.valor_repasse_consorciado),
        observacoes_precificacao: pricing.observacoes_precificacao || null,
      },
    });
  };

  const saveCredit = () => {
    updateTransfer.mutate({
      id: transfer.id, cardId: transfer.card_id,
      patch: {
        analise_status: credit.analise_status,
        analise_data: credit.analise_data || null,
        analise_observacao: credit.analise_observacao || null,
      },
    });
  };

  const saveOfficial = () => {
    updateTransfer.mutate({
      id: transfer.id, cardId: transfer.card_id,
      patch: {
        protocolo_admin: official.protocolo_admin || null,
        data_envio_admin: official.data_envio_admin || null,
        data_efetivacao: official.data_efetivacao || null,
        nova_cota: official.nova_cota || null,
      },
    });
  };

  const saveBuyer = () => {
    upsertBuyer.mutate({ ...buyerForm, transfer_id: transfer.id });
  };

  const addFinancialRow = () => {
    if (!newFin.valor) return;
    addFin.mutate({
      transfer_id: transfer.id,
      tipo: newFin.tipo,
      valor: Number(newFin.valor),
      status: newFin.status,
      data_prevista: newFin.data_prevista || null,
      observacao: newFin.observacao || null,
    });
    setNewFin({ tipo: 'entrada_comprador', valor: '', status: 'previsto' });
  };

  const cancelTransfer = async (motivo: string) => {
    await updateTransfer.mutateAsync({
      id: transfer.id, cardId: transfer.card_id,
      patch: { status_fase: 'cancelada', motivo_cancelamento: motivo, cancelado_em: new Date().toISOString() },
    });
    onOpenChange(false);
  };

  const concluir = async () => {
    await updateTransfer.mutateAsync({
      id: transfer.id, cardId: transfer.card_id,
      patch: { status_fase: 'concluida' },
    });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl p-0 flex flex-col">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-3">
            Processo de Transferência
            <Badge variant={isClosed ? 'secondary' : 'default'}>
              {TRANSFER_FASE_OPTIONS.find(f => f.value === transfer.status_fase)?.label}
            </Badge>
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-4">
            <Tabs defaultValue="resumo">
              <TabsList className="w-full flex-wrap h-auto">
                <TabsTrigger value="resumo">Resumo</TabsTrigger>
                <TabsTrigger value="precificacao">Precificação</TabsTrigger>
                <TabsTrigger value="comprador">Comprador</TabsTrigger>
                <TabsTrigger value="credito">Análise Crédito</TabsTrigger>
                <TabsTrigger value="oficial">Transferência Oficial</TabsTrigger>
                <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
              </TabsList>

              {/* RESUMO */}
              <TabsContent value="resumo" className="mt-4 space-y-4">
                <Card>
                  <CardHeader><CardTitle className="text-base">Fluxo</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {FASE_ORDER.map((f, i) => (
                        <Badge
                          key={f}
                          variant={i <= currentIdx ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => !isClosed && setFase(f)}
                        >
                          {i + 1}. {TRANSFER_FASE_OPTIONS.find(o => o.value === f)?.label}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-2 gap-4">
                  <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Lance</p><p className="text-lg font-bold">{fmtBRL(transfer.valor_lance)}</p></CardContent></Card>
                  <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Comprador</p><p className="text-lg font-bold">{fmtBRL(transfer.valor_total_comprador)}</p></CardContent></Card>
                  <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Comissão Empresa</p><p className="text-lg font-bold text-green-600">{fmtBRL(transfer.valor_comissao_empresa)}</p></CardContent></Card>
                  <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Repasse Consorciado</p><p className="text-lg font-bold text-orange-600">{fmtBRL(transfer.valor_repasse_consorciado)}</p></CardContent></Card>
                </div>

                {!isClosed && (
                  <div className="flex gap-2 flex-wrap">
                    <Button onClick={advance} disabled={currentIdx >= FASE_ORDER.length - 1}>
                      Avançar para {TRANSFER_FASE_OPTIONS.find(o => o.value === FASE_ORDER[currentIdx + 1])?.label || '—'}
                    </Button>
                    {currentIdx === FASE_ORDER.length - 2 && (
                      <Button variant="default" onClick={concluir}>
                        <CheckCircle2 className="h-4 w-4 mr-2" /> Concluir Transferência
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive"><XCircle className="h-4 w-4 mr-2" />Cancelar Processo</Button>
                      </AlertDialogTrigger>
                      <CancelDialog onConfirm={cancelTransfer} />
                    </AlertDialog>
                  </div>
                )}
              </TabsContent>

              {/* PRECIFICACAO */}
              <TabsContent value="precificacao" className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Tipo de contemplação</Label>
                    <Select value={pricing.tipo_contemplacao || ''} onValueChange={v => setPricing({ ...pricing, tipo_contemplacao: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {TIPO_CONTEMPLACAO_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Data da assembleia</Label>
                    <Input type="date" value={pricing.data_assembleia || ''} onChange={e => setPricing({ ...pricing, data_assembleia: e.target.value })} />
                  </div>
                  <div className="flex items-center gap-2 mt-6">
                    <Checkbox checked={!!pricing.usou_capital_proprio} onCheckedChange={v => setPricing({ ...pricing, usou_capital_proprio: !!v })} />
                    <Label>Usou capital próprio</Label>
                  </div>
                  <div>
                    <Label>Valor capital próprio</Label>
                    <Input type="number" step="0.01" value={pricing.valor_capital_proprio} onChange={e => setPricing({ ...pricing, valor_capital_proprio: e.target.value })} />
                  </div>
                  <div>
                    <Label>Valor do lance</Label>
                    <Input type="number" step="0.01" value={pricing.valor_lance} onChange={e => setPricing({ ...pricing, valor_lance: e.target.value })} />
                  </div>
                  <div>
                    <Label>Crédito disponível</Label>
                    <Input type="number" step="0.01" value={pricing.valor_credito_disponivel} onChange={e => setPricing({ ...pricing, valor_credito_disponivel: e.target.value })} />
                  </div>
                  <div>
                    <Label>Total cobrado do comprador</Label>
                    <Input type="number" step="0.01" value={pricing.valor_total_comprador} onChange={e => setPricing({ ...pricing, valor_total_comprador: e.target.value })} />
                  </div>
                  <div>
                    <Label>Comissão empresa</Label>
                    <Input type="number" step="0.01" value={pricing.valor_comissao_empresa} onChange={e => setPricing({ ...pricing, valor_comissao_empresa: e.target.value })} />
                  </div>
                  <div className="col-span-2">
                    <Label>Repasse ao consorciado</Label>
                    <Input type="number" step="0.01" value={pricing.valor_repasse_consorciado} onChange={e => setPricing({ ...pricing, valor_repasse_consorciado: e.target.value })} />
                  </div>
                  <div className="col-span-2">
                    <Label>Observações</Label>
                    <Textarea value={pricing.observacoes_precificacao} onChange={e => setPricing({ ...pricing, observacoes_precificacao: e.target.value })} />
                  </div>
                </div>
                <Button onClick={savePricing} disabled={updateTransfer.isPending}>Salvar precificação</Button>
              </TabsContent>

              {/* COMPRADOR */}
              <TabsContent value="comprador" className="mt-4 space-y-3">
                <div>
                  <Label>Tipo de pessoa</Label>
                  <Select value={buyerForm.tipo_pessoa || 'pf'} onValueChange={v => setBuyerForm({ ...buyerForm, tipo_pessoa: v })}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pf">Pessoa Física</SelectItem>
                      <SelectItem value="pj">Pessoa Jurídica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {buyerForm.tipo_pessoa === 'pj' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Razão social</Label><Input value={buyerForm.razao_social || ''} onChange={e => setBuyerForm({ ...buyerForm, razao_social: e.target.value })} /></div>
                    <div><Label>CNPJ</Label><Input value={buyerForm.cnpj || ''} onChange={e => setBuyerForm({ ...buyerForm, cnpj: e.target.value })} /></div>
                    <div><Label>Faturamento mensal</Label><Input type="number" value={buyerForm.faturamento_mensal || ''} onChange={e => setBuyerForm({ ...buyerForm, faturamento_mensal: e.target.value })} /></div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Nome completo</Label><Input value={buyerForm.nome_completo || ''} onChange={e => setBuyerForm({ ...buyerForm, nome_completo: e.target.value })} /></div>
                    <div><Label>CPF</Label><Input value={buyerForm.cpf || ''} onChange={e => setBuyerForm({ ...buyerForm, cpf: e.target.value })} /></div>
                    <div><Label>RG</Label><Input value={buyerForm.rg || ''} onChange={e => setBuyerForm({ ...buyerForm, rg: e.target.value })} /></div>
                    <div><Label>Data de nascimento</Label><Input type="date" value={buyerForm.data_nascimento || ''} onChange={e => setBuyerForm({ ...buyerForm, data_nascimento: e.target.value })} /></div>
                    <div><Label>Profissão</Label><Input value={buyerForm.profissao || ''} onChange={e => setBuyerForm({ ...buyerForm, profissao: e.target.value })} /></div>
                    <div><Label>Renda</Label><Input type="number" value={buyerForm.renda || ''} onChange={e => setBuyerForm({ ...buyerForm, renda: e.target.value })} /></div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Telefone</Label><Input value={buyerForm.telefone || ''} onChange={e => setBuyerForm({ ...buyerForm, telefone: e.target.value })} /></div>
                  <div><Label>E-mail</Label><Input type="email" value={buyerForm.email || ''} onChange={e => setBuyerForm({ ...buyerForm, email: e.target.value })} /></div>
                  <div><Label>CEP</Label><Input value={buyerForm.endereco_cep || ''} onChange={e => setBuyerForm({ ...buyerForm, endereco_cep: e.target.value })} /></div>
                  <div><Label>Cidade</Label><Input value={buyerForm.endereco_cidade || ''} onChange={e => setBuyerForm({ ...buyerForm, endereco_cidade: e.target.value })} /></div>
                  <div><Label>UF</Label><Input value={buyerForm.endereco_estado || ''} onChange={e => setBuyerForm({ ...buyerForm, endereco_estado: e.target.value })} /></div>
                  <div><Label>Bairro</Label><Input value={buyerForm.endereco_bairro || ''} onChange={e => setBuyerForm({ ...buyerForm, endereco_bairro: e.target.value })} /></div>
                  <div className="col-span-2"><Label>Rua, número e complemento</Label><Input value={buyerForm.endereco_rua || ''} onChange={e => setBuyerForm({ ...buyerForm, endereco_rua: e.target.value })} /></div>
                </div>
                <Button onClick={saveBuyer} disabled={upsertBuyer.isPending}>Salvar comprador</Button>
              </TabsContent>

              {/* CREDITO */}
              <TabsContent value="credito" className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Status</Label>
                    <Select value={credit.analise_status} onValueChange={v => setCredit({ ...credit, analise_status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pendente">Pendente</SelectItem>
                        <SelectItem value="em_analise">Em análise</SelectItem>
                        <SelectItem value="aprovado">Aprovado</SelectItem>
                        <SelectItem value="reprovado">Reprovado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Data</Label>
                    <Input type="date" value={credit.analise_data} onChange={e => setCredit({ ...credit, analise_data: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>Observação</Label>
                  <Textarea value={credit.analise_observacao} onChange={e => setCredit({ ...credit, analise_observacao: e.target.value })} />
                </div>
                <Button onClick={saveCredit} disabled={updateTransfer.isPending}>Salvar análise</Button>
              </TabsContent>

              {/* OFICIAL */}
              <TabsContent value="oficial" className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Protocolo</Label><Input value={official.protocolo_admin} onChange={e => setOfficial({ ...official, protocolo_admin: e.target.value })} /></div>
                  <div><Label>Nova cota (opcional)</Label><Input value={official.nova_cota} onChange={e => setOfficial({ ...official, nova_cota: e.target.value })} /></div>
                  <div><Label>Data envio à administradora</Label><Input type="date" value={official.data_envio_admin} onChange={e => setOfficial({ ...official, data_envio_admin: e.target.value })} /></div>
                  <div><Label>Data de efetivação</Label><Input type="date" value={official.data_efetivacao} onChange={e => setOfficial({ ...official, data_efetivacao: e.target.value })} /></div>
                </div>
                <Button onClick={saveOfficial} disabled={updateTransfer.isPending}>Salvar dados oficiais</Button>
              </TabsContent>

              {/* FINANCEIRO */}
              <TabsContent value="financeiro" className="mt-4 space-y-3">
                <Card>
                  <CardHeader><CardTitle className="text-base">Novo lançamento</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-5 gap-2">
                    <Select value={newFin.tipo} onValueChange={v => setNewFin({ ...newFin, tipo: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TRANSFER_FINANCIAL_TIPO_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input type="number" placeholder="Valor" value={newFin.valor} onChange={e => setNewFin({ ...newFin, valor: e.target.value })} />
                    <Input type="date" value={newFin.data_prevista || ''} onChange={e => setNewFin({ ...newFin, data_prevista: e.target.value })} />
                    <Select value={newFin.status} onValueChange={v => setNewFin({ ...newFin, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="previsto">Previsto</SelectItem>
                        <SelectItem value="recebido">Recebido</SelectItem>
                        <SelectItem value="pago">Pago</SelectItem>
                        <SelectItem value="cancelado">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={addFinancialRow}><Plus className="h-4 w-4" /></Button>
                  </CardContent>
                </Card>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Prevista</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {financials.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sem lançamentos</TableCell></TableRow>
                    )}
                    {financials.map(f => (
                      <TableRow key={f.id}>
                        <TableCell>{TRANSFER_FINANCIAL_TIPO_OPTIONS.find(o => o.value === f.tipo)?.label || f.tipo}</TableCell>
                        <TableCell>{fmtBRL(f.valor)}</TableCell>
                        <TableCell>{f.data_prevista || '-'}</TableCell>
                        <TableCell>
                          <Select value={f.status} onValueChange={v => updFin.mutate({ id: f.id, patch: { status: v as any, data_realizada: (v === 'recebido' || v === 'pago') ? new Date().toISOString().slice(0,10) : null } })}>
                            <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="previsto">Previsto</SelectItem>
                              <SelectItem value="recebido">Recebido</SelectItem>
                              <SelectItem value="pago">Pago</SelectItem>
                              <SelectItem value="cancelado">Cancelado</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Button size="icon" variant="ghost" onClick={() => delFin.mutate(f.id)}><Trash2 className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function CancelDialog({ onConfirm }: { onConfirm: (motivo: string) => void }) {
  const [motivo, setMotivo] = useState('');
  return (
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Cancelar transferência?</AlertDialogTitle>
        <AlertDialogDescription>Informe o motivo. Esta ação não pode ser desfeita.</AlertDialogDescription>
      </AlertDialogHeader>
      <Textarea value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Motivo do cancelamento" />
      <AlertDialogFooter>
        <AlertDialogCancel>Voltar</AlertDialogCancel>
        <AlertDialogAction disabled={!motivo.trim()} onClick={() => onConfirm(motivo.trim())}>Cancelar processo</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
}