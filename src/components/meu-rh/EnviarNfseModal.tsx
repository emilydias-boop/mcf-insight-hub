import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { notifyDocumentAction } from "@/lib/notifyDocumentAction";
import { buildNfseDetailedEmailHtml } from "@/lib/nfseEmailBuilder";
import { toast } from "sonner";
import { format, subMonths, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Upload } from "lucide-react";

const FINANCEIRO_EMAIL = 'financeiro@minhacasafinanciada.com';

interface EnviarNfseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  onSuccess: () => void;
  valorSugerido?: number;
}

async function sendNfseEmails(employeeId: string, monthLabel: string, numeroNfse: string, valorNfse: string, storagePath: string) {
  try {
    const { data: emp } = await supabase
      .from('employees')
      .select('nome_completo, gestor_id, email_pessoal')
      .eq('id', employeeId)
      .single();

    if (!emp) return;

    // Generate signed URL for PDF (7 days)
    let pdfUrl: string | undefined;
    const { data: signedData } = await supabase.storage
      .from('user-files')
      .createSignedUrl(storagePath, 60 * 60 * 24 * 7);
    if (signedData?.signedUrl) pdfUrl = signedData.signedUrl;

    const employeeName = emp.nome_completo || 'Colaborador';
    const senderEmail = emp.email_pessoal || undefined;
    const senderName = employeeName;
    const subject = `Nova NFSe recebida — ${employeeName}`;
    const dataEnvio = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

    const htmlContent = buildNfseDetailedEmailHtml({
      employeeName,
      monthLabel,
      numeroNfse,
      valorNfse,
      dataEnvio,
      pdfUrl,
    });

    // 1. Email para o financeiro
    supabase.functions.invoke('brevo-send', {
      body: {
        to: FINANCEIRO_EMAIL,
        name: 'Financeiro MCF',
        subject,
        htmlContent,
        tags: ['nfse', 'financeiro'],
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
            tags: ['nfse', 'supervisor'],
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

export function EnviarNfseModal({ open, onOpenChange, employeeId, onSuccess, valorSugerido }: EnviarNfseModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), 'yyyy-MM'));
  const [numeroNfse, setNumeroNfse] = useState('');
  const [valorNfse, setValorNfse] = useState(() =>
    valorSugerido ? valorSugerido.toFixed(2).replace('.', ',') : ''
  );
  const [observacoes, setObservacoes] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const monthOptions = Array.from({ length: 3 }, (_, i) => {
    const date = subMonths(startOfMonth(new Date()), i);
    return {
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM yyyy', { locale: ptBR }),
      mes: date.getMonth() + 1,
      ano: date.getFullYear(),
    };
  });

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

    const selectedOption = monthOptions.find(m => m.value === selectedMonth);
    if (!selectedOption) return;

    setIsSubmitting(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${employeeId}/nfse-${selectedOption.ano}-${selectedOption.mes}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('user-files')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase
        .from('rh_nfse')
        .insert({
          employee_id: employeeId,
          mes: selectedOption.mes,
          ano: selectedOption.ano,
          numero_nfse: numeroNfse || null,
          valor_nfse: valorNumerico,
          storage_path: fileName,
          data_envio_nfse: new Date().toISOString(),
          status_nfse: 'nota_enviada',
          status_pagamento: 'pendente',
          observacoes: observacoes || null,
        });

      if (insertError) throw insertError;

      toast.success('NFSe enviada com sucesso!');
      
      const selectedLabel = monthOptions.find(m => m.value === selectedMonth)?.label || selectedMonth;
      
      notifyDocumentAction({
        employeeId,
        action: 'nfse_enviada',
        documentTitle: `NFSe ${selectedLabel}`,
        sentBy: 'colaborador',
      });

      // Send emails to financeiro and supervisor
      sendNfseEmails(employeeId, selectedLabel, numeroNfse, valorNfse, fileName);
      
      setNumeroNfse('');
      setValorNfse('');
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
          <DialogTitle className="text-base">Enviar NFSe</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Mês de referência</Label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((m) => (
                  <SelectItem key={m.value} value={m.value} className="text-xs capitalize">
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            {valorSugerido && (
              <p className="text-[10px] text-muted-foreground">
                Valor sugerido com base no seu salário: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorSugerido)}
              </p>
            )}
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
