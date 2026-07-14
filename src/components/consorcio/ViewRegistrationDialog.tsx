import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText, ExternalLink } from 'lucide-react';
import { TIPO_DOCUMENTO_OPTIONS } from '@/types/consorcio';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposalId: string;
  consortiumCardId?: string | null;
  contactName?: string;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '' ) return null;
  return (
    <div className="space-y-0.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium break-words">{value}</div>
    </div>
  );
}

function formatCurrency(v: number | null | undefined) {
  if (v === null || v === undefined) return null;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v));
}

export function ViewRegistrationDialog({ open, onOpenChange, proposalId, consortiumCardId, contactName }: Props) {
  const { data: reg, isLoading } = useQuery({
    queryKey: ['consorcio-pending-registration-by-proposal', proposalId],
    enabled: open && !!proposalId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consorcio_pending_registrations')
        .select('*')
        .eq('proposal_id', proposalId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const cardId = consortiumCardId || reg?.consortium_card_id || null;
  const pendingId = reg?.id || null;

  const { data: documents = [] } = useQuery({
    queryKey: ['consorcio-view-documents', cardId, pendingId],
    enabled: open && (!!cardId || !!pendingId),
    queryFn: async () => {
      let query = supabase.from('consortium_documents').select('*');
      if (cardId && pendingId) {
        query = query.or(`card_id.eq.${cardId},pending_registration_id.eq.${pendingId}`);
      } else if (cardId) {
        query = query.eq('card_id', cardId);
      } else if (pendingId) {
        query = query.eq('pending_registration_id', pendingId);
      }
      const { data, error } = await query.order('uploaded_at', { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const tipoPessoa = reg?.tipo_pessoa as 'pf' | 'pj' | undefined;

  const tipoDocLabel = (tipo: string) => TIPO_DOCUMENTO_OPTIONS.find(o => o.value === tipo)?.label || tipo;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            Dados da Cota {contactName ? `— ${contactName}` : ''}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[75vh] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !reg ? (
            <div className="py-8 text-sm text-muted-foreground text-center">
              Nenhum cadastro encontrado para esta proposta.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="uppercase">
                  {tipoPessoa === 'pj' ? 'Pessoa Jurídica' : 'Pessoa Física'}
                </Badge>
                {reg.status && (
                  <Badge variant="outline" className="capitalize">{String(reg.status).replace(/_/g, ' ')}</Badge>
                )}
              </div>

              {tipoPessoa === 'pf' ? (
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">Dados Pessoais</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Nome Completo" value={reg.nome_completo} />
                    <Field label="RG" value={reg.rg} />
                    <Field label="CPF" value={reg.cpf} />
                    <Field label="CPF Cônjuge" value={reg.cpf_conjuge} />
                    <Field label="Profissão" value={reg.profissao} />
                    <Field label="Renda" value={formatCurrency(reg.renda)} />
                    <Field label="Patrimônio" value={formatCurrency(reg.patrimonio)} />
                    <Field label="PIX" value={reg.pix} />
                  </div>

                  <Separator />
                  <h3 className="text-sm font-semibold">Contato</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Telefone" value={reg.telefone} />
                    <Field label="Email" value={reg.email} />
                  </div>

                  <Separator />
                  <h3 className="text-sm font-semibold">Endereço</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="CEP" value={reg.endereco_cep} />
                    <Field label="Endereço" value={reg.endereco_completo} />
                  </div>
                </section>
              ) : (
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">Dados da Empresa</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Razão Social" value={reg.razao_social} />
                    <Field label="CNPJ" value={reg.cnpj} />
                    <Field label="Natureza Jurídica" value={reg.natureza_juridica} />
                    <Field label="Inscrição Estadual" value={reg.inscricao_estadual} />
                    <Field label="Data de Fundação" value={reg.data_fundacao} />
                    <Field label="Nº Funcionários" value={reg.num_funcionarios} />
                    <Field label="Faturamento Mensal" value={formatCurrency(reg.faturamento_mensal)} />
                  </div>

                  <Separator />
                  <h3 className="text-sm font-semibold">Contato</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Telefone" value={reg.telefone_comercial} />
                    <Field label="Email" value={reg.email_comercial} />
                  </div>

                  <Separator />
                  <h3 className="text-sm font-semibold">Endereço Comercial</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="CEP" value={reg.endereco_comercial_cep} />
                    <Field label="Endereço" value={reg.endereco_comercial} />
                  </div>

                  {Array.isArray(reg.socios) && reg.socios.length > 0 && (
                    <>
                      <Separator />
                      <h3 className="text-sm font-semibold">Sócios</h3>
                      <div className="space-y-2">
                        {reg.socios.map((s: any, i: number) => (
                          <div key={i} className="grid grid-cols-2 gap-3 rounded border p-2">
                            <Field label={`Sócio ${i + 1} — CPF`} value={s.cpf} />
                            <Field label="Renda" value={formatCurrency(s.renda)} />
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </section>
              )}

              <Separator />
              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Dados da Cota / Proposta</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Valor do Crédito" value={formatCurrency(reg.valor_credito)} />
                  <Field label="Prazo (meses)" value={reg.prazo_meses} />
                  <Field label="Tipo de Produto" value={reg.tipo_produto} />
                  <Field label="Produto (código)" value={reg.produto_codigo} />
                  <Field label="Condição de Pagamento" value={reg.condicao_pagamento} />
                  <Field label="Inclui Seguro" value={reg.inclui_seguro === true ? 'Sim' : reg.inclui_seguro === false ? 'Não' : null} />
                  <Field label="Empresa Paga Parcelas" value={reg.empresa_paga_parcelas} />
                  <Field label="Tipo de Contrato" value={reg.tipo_contrato} />
                  <Field label="Parcelas Pagas pela Empresa" value={reg.parcelas_pagas_empresa} />
                  <Field label="Vendedor" value={reg.vendedor_name || reg.vendedor_name_cota} />
                  <Field label="Data do Aceite" value={reg.aceite_date} />
                  <Field label="Observações" value={reg.observacoes} />
                </div>
              </section>

              <Separator />
              <section className="space-y-3">
                <h3 className="text-sm font-semibold">
                  Documentos {documents.length > 0 ? `(${documents.length})` : ''}
                </h3>
                {documents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum documento anexado.</p>
                ) : (
                  <div className="space-y-2">
                    {documents.map(doc => (
                      <div key={doc.id} className="flex items-center justify-between rounded border p-2 text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="flex flex-col min-w-0">
                            <span className="font-medium truncate">{doc.nome_arquivo}</span>
                            <span className="text-xs text-muted-foreground">{tipoDocLabel(doc.tipo)}</span>
                          </div>
                        </div>
                        {doc.storage_url && (
                          <a
                            href={doc.storage_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
                          >
                            Abrir <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
