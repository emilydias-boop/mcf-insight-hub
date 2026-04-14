import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { notifyDocumentAction } from "@/lib/notifyDocumentAction";
import { buildNfseDetailedEmailHtml } from "@/lib/nfseEmailBuilder";
import { toast } from "sonner";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Upload } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

const FINANCEIRO_EMAIL = 'financeiro@minhacasafinanciada.com';

interface EnviarNfseFechamentoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payoutId: string;
  employeeId: string;
  anoMes: string;
  valorEsperado: number;
  onSuccess: () => void;
}

async function sendNfseEmails(
  employeeId: string,
  monthLabel: string,
  numeroNfse: string,
  valorNfse: string,
  payoutId: string,
  storagePath: string
) {
  try {
    const { data: emp } = await supabase
      .from('employees')
      .select('nome_completo, gestor_id, email_pessoal')
      .eq('id', employeeId)
      .single();

    if (!emp) return;

    // Fetch payout details
    const { data: payout } = await supabase
      .from('sdr_month_payout')
      .select('aprovado_por, aprovado_em, valor_fixo, valor_variavel_total, total_conta, total_ifood, ifood_mensal, ifood_ultrameta, pct_reunioes_agendadas, valor_reunioes_agendadas, pct_reunioes_realizadas, valor_reunioes_realizadas, pct_tentativas, valor_tentativas, pct_organizacao, valor_organizacao')
      .eq('id', payoutId)
      .single();

    // Fetch approver name
    let aprovadorNome = '—';
    if (payout?.aprovado_por) {
      const { data: aprovador } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', payout.aprovado_por)
        .single();
      aprovadorNome = aprovador?.full_name || '—';
    }

    // Generate signed URL for PDF (7 days)
    let pdfUrl: string | undefined;
    const { data: signedData } = await supabase.storage
      .from('user-files')
      .createSignedUrl(storagePath, 60 * 60 * 24 * 7);
    if (signedData?.signedUrl) pdfUrl = signedData.signedUrl;

    const employeeName = emp.nome_completo || 'Colaborador';
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const senderEmail = authUser?.email || emp.email_pessoal || undefined;
    const senderName = employeeName;
    const subject = `Nova NFSe Fechamento — ${employeeName}`;
    const dataEnvio = format(new Date(), "dd/MM/yyyy 'às' HH:mm");

    const htmlContent = buildNfseDetailedEmailHtml({
      employeeName,
      monthLabel,
      numeroNfse,
      valorNfse,
      dataEnvio,
      pdfUrl,
      payout: payout ? {
        aprovado_por_nome: aprovadorNome,
        aprovado_em: payout.aprovado_em,
        valor_fixo: payout.valor_fixo,
        valor_variavel_total: payout.valor_variavel_total,
        total_conta: payout.total_conta,
        total_ifood: payout.total_ifood,
        ifood_mensal: payout.ifood_mensal,
        ifood_ultrameta: payout.ifood_ultrameta,
        pct_reunioes_agendadas: payout.pct_reunioes_agendadas,
        valor_reunioes_agendadas: payout.valor_reunioes_agendadas,
        pct_reunioes_realizadas: payout.pct_reunioes_realizadas,
        valor_reunioes_realizadas: payout.valor_reunioes_realizadas,
        pct_tentativas: payout.pct_tentativas,
        valor_tentativas: payout.valor_tentativas,
        pct_organizacao: payout.pct_organizacao,
        valor_organizacao: payout.valor_organizacao,
        pct_no_show: null,
        valor_no_show: null,
      } : undefined,
    });

    // 1. Email para o financeiro
    supabase.functions.invoke('brevo-send', {
      body: {
        to: FINANCEIRO_EMAIL,
        name: 'Financeiro MCF',
        subject,
        htmlContent,
        tags: ['nfse_fechamento', 'financeiro'],
        senderEmail,
        senderName,
      },
    }).catch(err => console.error('Erro email financeiro:', err));

    // 2. Email para o supervisor
    if (emp.gestor_id) {
      const { data: gestor } = await supabase
        .from('employees')
        .select('email_pessoal, nome_completo')
        .eq('id', emp.gestor_id)
        .single();

      if (gestor?.email_pessoal) {
        supabase.functions.invoke('brevo-send', {
          body: {
            to: gestor.email_pessoal,
            name: gestor.nome_completo || 'Supervisor',
            subject,
            htmlContent,
            tags: ['nfse_fechamento', 'supervisor'],
            senderEmail,
            senderName,
          },
        }).catch(err => console.error('Erro email supervisor:', err));
      }
    }
  } catch (err) {
    console.error('Erro ao enviar emails de NFSe:', err);
  }
}

export function EnviarNfseFechamentoModal({ 
  open, 
  onOpenChange, 
  payoutId,
  employeeId, 
  anoMes,
  valorEsperado,
  onSuccess 
}: EnviarNfseFechamentoModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [numeroNfse, setNumeroNfse] = useState('');
  const [valorNfse, setValorNfse] = useState(valorEsperado.toFixed(2).replace('.', ','));
  const [observacoes, setObservacoes] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const [year, month] = anoMes.split('-').map(Number);
  const monthLabel = format(parse(anoMes, 'yyyy-MM', new Date()), 'MMMM yyyy', { locale: ptBR });

  const handleSubmit = async () => {
    if (!file) {
      toast.error('Selecione o arquivo da NFSe');
      return;
    }

    const valorNumerico = parseFloat(valorNfse.replace(',', '.'));
    if (isNaN(valorNumerico) || valorNumerico <= 0) {
      toast.error('Informe um valor válido');
      return;
    }

    setIsSubmitting(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${employeeId}/nfse-fechamento-${year}-${month}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('user-files')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: nfseData, error: insertError } = await supabase
        .from('rh_nfse')
        .insert({
          employee_id: employeeId,
          mes: month,
          ano: year,
          numero_nfse: numeroNfse || null,
          valor_nfse: valorNumerico,
          storage_path: fileName,
          data_envio_nfse: new Date().toISOString(),
          status_nfse: 'nota_enviada',
          status_pagamento: 'pendente',
          observacoes: observacoes || null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const { error: updateError } = await supabase
        .from('sdr_month_payout')
        .update({ nfse_id: nfseData.id })
        .eq('id', payoutId);

      if (updateError) throw updateError;

      toast.success('NFSe enviada com sucesso!');
      
      notifyDocumentAction({
        employeeId,
        action: 'nfse_enviada',
        documentTitle: `NFSe Fechamento ${monthLabel}`,
        sentBy: 'colaborador',
      });

      // Send emails to financeiro and supervisor
      sendNfseEmails(employeeId, monthLabel, numeroNfse, valorNfse, payoutId, fileName);
      
      setNumeroNfse('');
      setValorNfse(valorEsperado.toFixed(2).replace('.', ','));
      setObservacoes('');
      setFile(null);
      
      onSuccess();
    } catch (error: any) {
      console.error('Erro ao enviar NFSe:', error);
      toast.error(error.message || 'Erro ao enviar NFSe');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Enviar NFSe do Fechamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="text-xs text-muted-foreground">Mês de referência</div>
            <div className="font-medium capitalize">{monthLabel}</div>
          </div>

          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
            <div className="text-xs text-primary">Valor esperado</div>
            <div className="text-lg font-bold text-primary">{formatCurrency(valorEsperado)}</div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Número da NFSe</Label>
            <Input
              value={numeroNfse}
              onChange={(e) => setNumeroNfse(e.target.value)}
              placeholder="Ex: 12345"
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Valor da NFSe (R$)</Label>
            <Input
              value={valorNfse}
              onChange={(e) => setValorNfse(e.target.value)}
              placeholder="Ex: 4000,00"
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Arquivo PDF</Label>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept=".pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="h-9 text-xs"
              />
            </div>
            {file && (
              <p className="text-[10px] text-muted-foreground">{file.name}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Observação (opcional)</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Alguma observação sobre esta nota..."
              className="min-h-[60px] text-xs resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Upload className="h-3.5 w-3.5 mr-1" />
                Enviar NFSe
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
