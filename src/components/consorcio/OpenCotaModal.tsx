import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, FileText, ExternalLink } from 'lucide-react';
import { formatarCep } from '@/lib/cepUtils';

// Formatting functions
function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { usePendingRegistration, useOpenCota } from '@/hooks/useConsorcioPendingRegistrations';
import { useConsorcioProdutos } from '@/hooks/useConsorcioProdutos';
import { useConsorcioOrigemOptions, useConsorcioCategoriaOptions, useConsorcioVendedorOptions } from '@/hooks/useConsorcioConfigOptions';
import { calcularParcela, findProdutoForCredito, formatCurrency } from '@/lib/consorcioCalculos';
import { ParcelaComposicao } from './ParcelaComposicao';
import { CONDICAO_PAGAMENTO_OPTIONS, PRAZO_OPTIONS, PrazoParcelas, CondicaoPagamento } from '@/types/consorcioProdutos';
import { CATEGORIA_OPTIONS, ORIGEM_OPTIONS } from '@/types/consorcio';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Label } from '@/components/ui/label';

interface OpenCotaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registrationId: string;
}

export function OpenCotaModal({ open, onOpenChange, registrationId }: OpenCotaModalProps) {
  const { data: registration, isLoading: regLoading } = usePendingRegistration(registrationId);
  const { data: produtos = [] } = useConsorcioProdutos();
  const { data: origemOptions = [] } = useConsorcioOrigemOptions();
  const { data: categoriaOptions = [] } = useConsorcioCategoriaOptions();
  const { data: vendedorOptions = [] } = useConsorcioVendedorOptions();
  const openCota = useOpenCota();

  // Fetch documents linked to this pending registration
  const { data: documents = [] } = useQuery({
    queryKey: ['pending-reg-documents', registrationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consortium_documents')
        .select('*')
        .eq('pending_registration_id', registrationId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!registrationId,
  });

  const form = useForm({
    defaultValues: {
      // Client data (editable)
      cliente_nome: '',
      cliente_cpf: '',
      cliente_rg: '',
      cliente_profissao: '',
      cliente_telefone: '',
      cliente_email: '',
      cliente_endereco: '',
      cliente_cep: '',
      cliente_renda: 0,
      cliente_patrimonio: 0,
      cliente_pix: '',
      // Cota data
      categoria: 'inside',
      grupo: '',
      cota: '',
      valor_credito: 0,
      prazo_meses: 200,
      tipo_produto: 'select',
      produto_codigo: '',
      condicao_pagamento: 'convencional',
      inclui_seguro: false,
      empresa_paga_parcelas: 'nao',
      tipo_contrato: 'normal',
      parcelas_pagas_empresa: 0,
      dia_vencimento: 15,
      inicio_segunda_parcela: 'automatico',
      data_contratacao: new Date().toISOString().split('T')[0],
      origem: '',
      origem_detalhe: '',
      vendedor_id: '',
      vendedor_name: '',
      valor_comissao: 0,
      e_transferencia: false,
      transferido_de: '',
      observacoes: '',
    },
  });

  // Populate client fields when registration loads
  useEffect(() => {
    if (registration) {
      form.setValue('cliente_nome', registration.nome_completo || '');
      form.setValue('cliente_cpf', registration.cpf ? formatCpf(registration.cpf) : '');
      form.setValue('cliente_rg', registration.rg || '');
      form.setValue('cliente_profissao', registration.profissao || '');
      form.setValue('cliente_telefone', registration.telefone ? formatPhone(registration.telefone) : '');
      form.setValue('cliente_email', registration.email || '');
      form.setValue('cliente_endereco', registration.endereco_completo || '');
      form.setValue('cliente_cep', registration.endereco_cep || '');
      form.setValue('cliente_renda', registration.renda || 0);
      form.setValue('cliente_patrimonio', registration.patrimonio || 0);
      form.setValue('cliente_pix', registration.pix || '');
    }
  }, [registration, form]);

  const valorCredito = form.watch('valor_credito');
  const prazoMeses = form.watch('prazo_meses');
  const tipoProduto = form.watch('tipo_produto');
  const condicaoPagamento = form.watch('condicao_pagamento');
  const incluiSeguro = form.watch('inclui_seguro');
  const empresaPaga = form.watch('empresa_paga_parcelas');
  const vendedorId = form.watch('vendedor_id');

  // Auto-detect product
  const produtoDetectado = useMemo(() => {
    if (!valorCredito || valorCredito <= 0) return null;
    const tipoTaxa = tipoProduto === 'select' ? 'primeira_parcela' : 'dividida_12';
    return findProdutoForCredito(produtos, valorCredito, tipoTaxa as any);
  }, [valorCredito, tipoProduto, produtos]);

  // Calculate parcela
  const calculoParcela = useMemo(() => {
    if (!produtoDetectado || !valorCredito || !prazoMeses) return null;
    return calcularParcela(
      valorCredito,
      prazoMeses as PrazoParcelas,
      produtoDetectado,
      (condicaoPagamento || 'convencional') as CondicaoPagamento,
      incluiSeguro || false
    );
  }, [produtoDetectado, valorCredito, prazoMeses, condicaoPagamento, incluiSeguro]);

  // Update vendedor_name when vendedor_id changes
  useEffect(() => {
    if (vendedorId) {
      const vendedor = vendedorOptions.find((v: any) => v.id === vendedorId);
      if (vendedor) form.setValue('vendedor_name', (vendedor as any).nome);
    }
  }, [vendedorId, vendedorOptions, form]);

  const onSubmit = async (data: any) => {
    if (!registration) return;

    // Extract client data from form
    const clienteData = {
      nome_completo: data.cliente_nome || null,
      cpf: data.cliente_cpf?.replace(/\D/g, '') || null,
      rg: data.cliente_rg || null,
      profissao: data.cliente_profissao || null,
      telefone: data.cliente_telefone || null,
      email: data.cliente_email || null,
      endereco_completo: data.cliente_endereco || null,
      endereco_cep: data.cliente_cep || null,
      renda: data.cliente_renda || null,
      patrimonio: data.cliente_patrimonio || null,
      pix: data.cliente_pix || null,
    };

    await openCota.mutateAsync({
      registrationId,
      registration: { ...registration, ...clienteData },
      cotaData: {
        ...data,
        parcelas_pagas_empresa_count: data.empresa_paga_parcelas === 'sim' ? data.parcelas_pagas_empresa : 0,
      },
      clienteData,
    });

    onOpenChange(false);
  };

  if (regLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!registration) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Abertura de Cota — {registration.tipo_pessoa === 'pf' ? registration.nome_completo : registration.razao_social}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[75vh] pr-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Editable client data */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Dados do Cliente</CardTitle>
              </CardHeader>
              <CardContent>
                {registration.tipo_pessoa === 'pf' ? (
                  <div className="grid grid-cols-3 gap-3">
                    <FormField control={form.control} name="cliente_nome" rules={{ required: 'Obrigatório' }} render={({ field }) => (
                      <FormItem><FormLabel>Nome Completo *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="cliente_cpf" rules={{ required: 'Obrigatório' }} render={({ field }) => (
                      <FormItem><FormLabel>CPF *</FormLabel><FormControl><Input {...field} onChange={e => field.onChange(formatCpf(e.target.value))} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="cliente_rg" render={({ field }) => (
                      <FormItem><FormLabel>RG</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="cliente_profissao" render={({ field }) => (
                      <FormItem><FormLabel>Profissão</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="cliente_telefone" rules={{ required: 'Obrigatório' }} render={({ field }) => (
                      <FormItem><FormLabel>Telefone *</FormLabel><FormControl><Input {...field} onChange={e => field.onChange(formatPhone(e.target.value))} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="cliente_email" rules={{ required: 'Obrigatório' }} render={({ field }) => (
                      <FormItem><FormLabel>Email *</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <div className="col-span-2">
                      <FormField control={form.control} name="cliente_endereco" render={({ field }) => (
                        <FormItem><FormLabel>Endereço Completo</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                      )} />
                    </div>
                    <FormField control={form.control} name="cliente_cep" render={({ field }) => (
                      <FormItem><FormLabel>CEP</FormLabel><FormControl><Input {...field} onChange={e => field.onChange(formatarCep(e.target.value))} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="cliente_renda" render={({ field }) => (
                      <FormItem><FormLabel>Renda</FormLabel><FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(Number(e.target.value))} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="cliente_patrimonio" render={({ field }) => (
                      <FormItem><FormLabel>Patrimônio</FormLabel><FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(Number(e.target.value))} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="cliente_pix" render={({ field }) => (
                      <FormItem><FormLabel>PIX</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                    )} />
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Razão Social:</span> <strong>{registration.razao_social}</strong></div>
                    <div><span className="text-muted-foreground">CNPJ:</span> {registration.cnpj}</div>
                    <div><span className="text-muted-foreground">Natureza Jurídica:</span> {registration.natureza_juridica}</div>
                    <div><span className="text-muted-foreground">Inscrição Estadual:</span> {registration.inscricao_estadual}</div>
                    <div><span className="text-muted-foreground">Data Fundação:</span> {registration.data_fundacao}</div>
                    <div><span className="text-muted-foreground">Telefone:</span> {registration.telefone_comercial}</div>
                    <div><span className="text-muted-foreground">Email:</span> {registration.email_comercial}</div>
                    <div className="col-span-2"><span className="text-muted-foreground">Endereço:</span> {registration.endereco_comercial}</div>
                    <div><span className="text-muted-foreground">Funcionários:</span> {registration.num_funcionarios}</div>
                    <div><span className="text-muted-foreground">Faturamento:</span> {registration.faturamento_mensal ? formatCurrency(registration.faturamento_mensal) : '—'}</div>
                    {registration.socios && registration.socios.length > 0 && (
                      <div className="col-span-3">
                        <span className="text-muted-foreground">Sócios:</span>
                        <div className="mt-1 space-y-1">
                          {registration.socios.map((s: any, i: number) => (
                            <Badge key={i} variant="outline" className="mr-2">
                              CPF: {s.cpf} — Renda: {formatCurrency(s.renda || 0)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {documents.length > 0 && (
                  <div className="mt-4">
                    <span className="text-sm text-muted-foreground">Documentos:</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {documents.map((doc: any) => (
                        <a
                          key={doc.id}
                          href={doc.storage_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <FileText className="h-3 w-3" />
                          {doc.nome_arquivo}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Separator />

            {/* Cota form */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Dados da Cota (preencher)</CardTitle>
              </CardHeader>
              <CardContent>
                  <div className="space-y-4">
                    {/* Categoria + Grupo + Cota */}
                    <div className="grid grid-cols-3 gap-3">
                      <FormField control={form.control} name="categoria" rules={{ required: 'Obrigatório' }} render={({ field }) => (
                        <FormItem>
                          <FormLabel>Categoria *</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              {(categoriaOptions.length > 0 ? categoriaOptions : CATEGORIA_OPTIONS).map((o: any) => (
                                <SelectItem key={o.value || o.id} value={o.value || o.id}>{o.label || o.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="grupo" rules={{ required: 'Obrigatório' }} render={({ field }) => (
                        <FormItem><FormLabel>Grupo *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="cota" rules={{ required: 'Obrigatório' }} render={({ field }) => (
                        <FormItem><FormLabel>Cota *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>

                    {/* Valor + Prazo + Tipo */}
                    <div className="grid grid-cols-3 gap-3">
                      <FormField control={form.control} name="valor_credito" rules={{ required: 'Obrigatório' }} render={({ field }) => (
                        <FormItem><FormLabel>Valor do Crédito *</FormLabel><FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(Number(e.target.value))} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="prazo_meses" rules={{ required: 'Obrigatório' }} render={({ field }) => (
                        <FormItem>
                          <FormLabel>Prazo (meses) *</FormLabel>
                          <Select value={String(field.value)} onValueChange={v => field.onChange(Number(v))}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              {PRAZO_OPTIONS.map(o => (
                                <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="tipo_produto" rules={{ required: 'Obrigatório' }} render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo *</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="select">Select</SelectItem>
                              <SelectItem value="parcelinha">Parcelinha</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    {/* Produto + Condicao + Seguro */}
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-sm">Produto Embracon</Label>
                        <p className="text-sm font-medium mt-1">
                          {produtoDetectado ? produtoDetectado.nome : 'Auto-detectado pelo valor'}
                        </p>
                      </div>
                      <FormField control={form.control} name="condicao_pagamento" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Condição de Pagamento</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              {CONDICAO_PAGAMENTO_OPTIONS.map(o => (
                                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="inclui_seguro" render={({ field }) => (
                        <FormItem className="flex items-center gap-3 pt-6">
                          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          <FormLabel>Seguro de Vida</FormLabel>
                        </FormItem>
                      )} />
                    </div>

                    {/* Composição da parcela */}
                    {calculoParcela && produtoDetectado && (
                      <ParcelaComposicao
                        calculo={calculoParcela}
                        prazo={prazoMeses}
                        incluiSeguro={incluiSeguro || false}
                        taxaAntecipadaTipo={tipoProduto === 'select' ? 'primeira_parcela' : 'dividida_12'}
                      />
                    )}

                    {/* Empresa paga */}
                    <div className="grid grid-cols-3 gap-3">
                      <FormField control={form.control} name="empresa_paga_parcelas" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Empresa paga parcelas?</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="nao">Não</SelectItem>
                              <SelectItem value="sim">Sim</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                      {empresaPaga === 'sim' && (
                        <>
                          <FormField control={form.control} name="tipo_contrato" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Tipo Contrato</FormLabel>
                              <Select value={field.value} onValueChange={field.onChange}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                  <SelectItem value="normal">Normal</SelectItem>
                                  <SelectItem value="intercalado">Intercalado (Par)</SelectItem>
                                  <SelectItem value="intercalado_impar">Intercalado (Ímpar)</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="parcelas_pagas_empresa" render={({ field }) => (
                            <FormItem><FormLabel>Qtd Parcelas</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(Number(e.target.value))} /></FormControl></FormItem>
                          )} />
                        </>
                      )}
                    </div>

                    {/* Vencimento + 2a parcela */}
                    <div className="grid grid-cols-3 gap-3">
                      <FormField control={form.control} name="dia_vencimento" rules={{ required: 'Obrigatório' }} render={({ field }) => (
                        <FormItem><FormLabel>Dia de Vencimento *</FormLabel><FormControl><Input type="number" min={1} max={31} {...field} onChange={e => field.onChange(Number(e.target.value))} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="inicio_segunda_parcela" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Início 2ª Parcela</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="automatico">Automático</SelectItem>
                              <SelectItem value="proximo_mes">Próximo Mês</SelectItem>
                              <SelectItem value="pular_mes">Pular 1 Mês</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="data_contratacao" rules={{ required: 'Obrigatório' }} render={({ field }) => (
                        <FormItem><FormLabel>Data de Contratação *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>

                    {/* Origem + Vendedor */}
                    <div className="grid grid-cols-3 gap-3">
                      <FormField control={form.control} name="origem" rules={{ required: 'Obrigatório' }} render={({ field }) => (
                        <FormItem>
                          <FormLabel>Origem *</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                            <SelectContent>
                              {(origemOptions.length > 0 ? origemOptions : ORIGEM_OPTIONS).map((o: any) => (
                                <SelectItem key={o.value || o.id} value={o.value || o.id}>{o.label || o.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="origem_detalhe" render={({ field }) => (
                        <FormItem><FormLabel>Detalhe da Origem</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                      )} />
                      <FormField control={form.control} name="vendedor_id" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vendedor Responsável</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                            <SelectContent>
                              {vendedorOptions.map((v: any) => (
                                <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                    </div>

                    {/* Comissão + transferência */}
                    <div className="grid grid-cols-3 gap-3">
                      <FormField control={form.control} name="valor_comissao" render={({ field }) => (
                        <FormItem><FormLabel>Valor Comissão</FormLabel><FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(Number(e.target.value))} /></FormControl></FormItem>
                      )} />
                      <FormField control={form.control} name="e_transferencia" render={({ field }) => (
                        <FormItem className="flex items-center gap-3 pt-6">
                          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          <FormLabel>É Transferência?</FormLabel>
                        </FormItem>
                      )} />
                      {form.watch('e_transferencia') && (
                        <FormField control={form.control} name="transferido_de" render={({ field }) => (
                          <FormItem><FormLabel>Transferido de</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                        )} />
                      )}
                    </div>

                    {/* Observações */}
                    <FormField control={form.control} name="observacoes" render={({ field }) => (
                      <FormItem><FormLabel>Observações</FormLabel><FormControl><Textarea {...field} rows={3} /></FormControl></FormItem>
                    )} />

                    <div className="flex justify-end gap-2 pt-4">
                      <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit" disabled={openCota.isPending}>
                        {openCota.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Confirmar Abertura da Cota
                      </Button>
                    </div>
                  </div>
              </CardContent>
            </Card>

                    <div className="flex justify-end gap-2 pt-4">
                      <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit" disabled={openCota.isPending}>
                        {openCota.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Confirmar Abertura da Cota
                      </Button>
                    </div>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
