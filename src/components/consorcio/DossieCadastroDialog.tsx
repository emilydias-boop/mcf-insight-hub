import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, CheckCircle2, ExternalLink, FileText, Loader2, Upload } from 'lucide-react';
import { usePendingRegistration } from '@/hooks/useConsorcioPendingRegistrations';
import { useBatchUploadPendingDocuments } from '@/hooks/useConsorcioDocuments';
import { TIPO_DOCUMENTO_OPTIONS, type TipoDocumento } from '@/types/consorcio';
import { documentosFaltantes, tipoDocumentoLabel } from '@/lib/consorcioDocumentosEsperados';
import { camposCadastroFaltantes } from '@/lib/consorcioCadastroIncompleto';

import { formatCurrency } from '@/lib/consorcioCalculos';
import { tipoContratoLabel, getParcelasEmpresa } from '@/lib/consorcioParcelasEmpresa';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registrationId: string;
}

function Campo({ label, value }: { label: string; value: React.ReactNode }) {
  const vazio = value === null || value === undefined || value === '';
  return (
    <div className="space-y-0.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-sm ${vazio ? 'text-muted-foreground' : 'font-medium'} break-words`}>
        {vazio ? 'não informado' : value}
      </div>
    </div>
  );
}

function dataBR(v?: string | null) {
  if (!v) return null;
  const iso = v.length === 10 ? `${v}T00:00:00` : v;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? v : format(d, 'dd/MM/yyyy', { locale: ptBR });
}

/**
 * Dossiê do cadastro — tudo que a equipe de cadastro precisa para efetivar a cota
 * na Embracon em um clique: dados pessoais, dados do plano e os documentos com
 * link para abrir. Somente leitura, exceto o anexo de documento que falta.
 */
export function DossieCadastroDialog({ open, onOpenChange, registrationId }: Props) {
  const { data: reg, isLoading } = usePendingRegistration(open ? registrationId : null);
  const cardId = reg?.consortium_card_id || null;

  const { data: documentos = [], refetch: refetchDocs } = useQuery({
    queryKey: ['dossie-cadastro-documentos', registrationId, cardId],
    enabled: open,
    queryFn: async () => {
      // Os anexos migram de `pending_registration_id` para `card_id` quando a cota
      // é aberta — buscamos os dois lados para o dossiê nunca aparecer vazio.
      let query = supabase.from('consortium_documents').select('*');
      query = cardId
        ? query.or(`card_id.eq.${cardId},pending_registration_id.eq.${registrationId}`)
        : query.eq('pending_registration_id', registrationId);
      const { data, error } = await query.order('uploaded_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Array<{
        id: string; tipo: string; nome_arquivo: string; storage_url?: string | null; uploaded_at: string;
      }>;
    },
  });

  const tipoPessoa = (reg?.tipo_pessoa || 'pf') as 'pf' | 'pj';
  const faltantes = useMemo(
    () => (reg ? documentosFaltantes(tipoPessoa, documentos) : []),
    [reg, tipoPessoa, documentos],
  );

  const parcelasEmpresa = useMemo(
    () =>
      reg
        ? getParcelasEmpresa({
            prazo_meses: reg.prazo_meses,
            parcelas_pagas_empresa: reg.parcelas_pagas_empresa,
            tipo_contrato: reg.tipo_contrato,
            valor_credito: reg.valor_credito,
            empresa_paga_parcelas: reg.empresa_paga_parcelas,
          })
        : [],
    [reg],
  );

  const upload = useBatchUploadPendingDocuments();
  const inputRef = useRef<HTMLInputElement>(null);
  const [tipoUpload, setTipoUpload] = useState<TipoDocumento>('cnh' as TipoDocumento);

  const nome = tipoPessoa === 'pj' ? reg?.razao_social : reg?.nome_completo;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Dossiê do cadastro {nome ? `— ${nome}` : ''}</DialogTitle>
          <DialogDescription>
            Tudo que a equipe de cadastro precisa para efetivar a cota na Embracon, sem sair da tela.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !reg ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Cadastro não encontrado.</p>
        ) : (
          <ScrollArea className="max-h-[70vh] flex-1 pr-4">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="uppercase">
                  {tipoPessoa === 'pj' ? 'Pessoa Jurídica' : 'Pessoa Física'}
                </Badge>
                <Badge variant="outline">{String(reg.status || '').replace(/_/g, ' ')}</Badge>
                {reg.grupo || reg.cota ? (
                  <Badge variant="outline" className="tabular-nums">
                    grupo {reg.grupo || '—'} · cota {reg.cota || '—'}
                  </Badge>
                ) : null}
              </div>

              {/* Campos cadastrais faltando: mesma regra do selo "cadastro incompleto". */}
              {camposFaltantes.length > 0 && (
                <div className="rounded border border-amber-500/40 bg-amber-500/5 p-2 text-sm">
                  <p className="font-medium text-amber-700 dark:text-amber-400">
                    Cadastro incompleto — {camposFaltantes.length} campo(s)
                  </p>
                  <p className="text-muted-foreground">{camposFaltantes.join(' · ')}</p>
                </div>
              )}



              {/* Documentos primeiro: é o que trava o cadastro na Embracon. */}
              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Documentos ({documentos.length})</h3>
                {faltantes.length === 0 ? (
                  <div className="flex items-center gap-2 rounded border border-emerald-500/40 bg-emerald-500/5 p-2 text-sm text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" /> Checklist de documentos completo.
                  </div>
                ) : (
                  <div className="rounded border border-amber-500/40 bg-amber-500/5 p-2 text-sm">
                    <div className="flex items-center gap-2 font-medium text-amber-600 dark:text-amber-400">
                      <AlertCircle className="h-4 w-4" /> Faltando {faltantes.length} documento
                      {faltantes.length > 1 ? 's' : ''}
                    </div>
                    <ul className="mt-1 list-disc pl-6 text-xs text-muted-foreground">
                      {faltantes.map((f) => (
                        <li key={f.label}>{f.label}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {documentos.length > 0 && (
                  <div className="space-y-2">
                    {documentos.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between gap-3 rounded border p-2 text-sm">
                        <div className="flex min-w-0 items-center gap-2">
                          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate font-medium">{doc.nome_arquivo}</span>
                            <span className="text-xs text-muted-foreground">
                              {tipoDocumentoLabel(doc.tipo)} · {dataBR(doc.uploaded_at)}
                            </span>
                          </div>
                        </div>
                        {doc.storage_url && (
                          <a
                            href={doc.storage_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex shrink-0 items-center gap-1 text-xs text-primary hover:underline"
                          >
                            Abrir <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-end gap-2 rounded border border-dashed p-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Anexar documento</Label>
                    <Select value={tipoUpload} onValueChange={(v) => setTipoUpload(v as TipoDocumento)}>
                      <SelectTrigger className="h-9 w-[220px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIPO_DOCUMENTO_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <input
                    ref={inputRef}
                    type="file"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      await upload.mutateAsync({
                        pendingRegistrationId: registrationId,
                        documents: [{ file, tipo: tipoUpload }],
                      });
                      e.target.value = '';
                      void refetchDocs();
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={upload.isPending}
                    onClick={() => inputRef.current?.click()}
                  >
                    {upload.isPending ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-1 h-4 w-4" />
                    )}
                    Enviar arquivo
                  </Button>
                </div>
              </section>

              <Separator />

              {tipoPessoa === 'pf' ? (
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">Dados pessoais</h3>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                    <Campo label="Nome completo" value={reg.nome_completo} />
                    <Campo label="CPF" value={reg.cpf} />
                    <Campo label="RG" value={reg.rg} />
                    <Campo label="CPF do cônjuge" value={reg.cpf_conjuge} />
                    <Campo label="Profissão" value={reg.profissao} />
                    <Campo label="Renda" value={reg.renda != null ? formatCurrency(Number(reg.renda)) : null} />
                    <Campo label="Patrimônio" value={reg.patrimonio != null ? formatCurrency(Number(reg.patrimonio)) : null} />
                    <Campo label="PIX" value={reg.pix} />
                    <Campo label="Telefone" value={reg.telefone} />
                    <Campo label="E-mail" value={reg.email} />
                    <Campo label="CEP" value={reg.endereco_cep} />
                    <Campo label="Endereço" value={reg.endereco_completo} />
                  </div>
                </section>
              ) : (
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">Dados da empresa</h3>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                    <Campo label="Razão social" value={reg.razao_social} />
                    <Campo label="CNPJ" value={reg.cnpj} />
                    <Campo label="Natureza jurídica" value={reg.natureza_juridica} />
                    <Campo label="Inscrição estadual" value={reg.inscricao_estadual} />
                    <Campo label="Data de fundação" value={dataBR(reg.data_fundacao)} />
                    <Campo label="Nº funcionários" value={reg.num_funcionarios} />
                    <Campo
                      label="Faturamento mensal"
                      value={reg.faturamento_mensal != null ? formatCurrency(Number(reg.faturamento_mensal)) : null}
                    />
                    <Campo label="Telefone comercial" value={reg.telefone_comercial} />
                    <Campo label="E-mail comercial" value={reg.email_comercial} />
                    <Campo label="CEP" value={reg.endereco_comercial_cep} />
                    <Campo label="Endereço comercial" value={reg.endereco_comercial} />
                  </div>
                  {Array.isArray(reg.socios) && reg.socios.length > 0 && (
                    <>
                      <h4 className="text-xs font-semibold text-muted-foreground">Sócios</h4>
                      <div className="space-y-2">
                        {reg.socios.map((s, i) => (
                          <div key={i} className="grid grid-cols-3 gap-3 rounded border p-2">
                            <Campo label={`Sócio ${i + 1}`} value={s.nome} />
                            <Campo label="CPF" value={s.cpf} />
                            <Campo label="Renda" value={s.renda != null ? formatCurrency(Number(s.renda)) : null} />
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </section>
              )}

              <Separator />

              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Dados do plano</h3>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  <Campo label="Valor do crédito" value={reg.valor_credito != null ? formatCurrency(Number(reg.valor_credito)) : null} />
                  <Campo label="Prazo (meses)" value={reg.prazo_meses} />
                  <Campo label="Categoria" value={reg.categoria} />
                  <Campo label="Tipo de produto" value={reg.tipo_produto} />
                  <Campo label="Produto (código)" value={reg.produto_codigo} />
                  <Campo label="Condição de pagamento" value={reg.condicao_pagamento} />
                  <Campo label="Inclui seguro" value={reg.inclui_seguro === true ? 'Sim' : reg.inclui_seguro === false ? 'Não' : null} />
                  <Campo label="Tipo de contrato" value={tipoContratoLabel(reg.tipo_contrato)} />
                  <Campo label="Empresa paga parcelas" value={reg.empresa_paga_parcelas} />
                  <Campo label="Parcelas pagas pela empresa" value={reg.parcelas_pagas_empresa} />
                  <Campo label="Dia de vencimento" value={reg.dia_vencimento ?? 'A definir'} />
                  <Campo label="Origem" value={reg.origem_detalhe || reg.origem} />
                  <Campo label="Vendedor" value={reg.vendedor_name_cota || reg.vendedor_name} />
                  <Campo label="Data do aceite" value={dataBR(reg.aceite_date)} />
                  <Campo label="Observações" value={reg.observacoes} />
                </div>

                {parcelasEmpresa.length > 0 && (
                  <div className="rounded border p-2">
                    <div className="mb-1 text-xs font-medium">
                      Parcelas pagas pela empresa ({parcelasEmpresa.length})
                    </div>
                    <ul className="grid max-h-40 grid-cols-2 gap-x-4 overflow-auto text-xs md:grid-cols-3">
                      {parcelasEmpresa.map((p) => (
                        <li key={p.numero} className="flex justify-between gap-2">
                          <span className="text-muted-foreground">Parcela {p.numero}</span>
                          <span className="font-medium tabular-nums">{formatCurrency(p.valor)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
