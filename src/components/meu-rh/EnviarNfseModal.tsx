import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, subMonths, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Upload } from "lucide-react";

interface EnviarNfseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  onSuccess: () => void;
}

export function EnviarNfseModal({ open, onOpenChange, employeeId, onSuccess }: EnviarNfseModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), 'yyyy-MM'));
  const [numeroNfse, setNumeroNfse] = useState('');
  const [valorNfse, setValorNfse] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [file, setFile] = useState<File | null>(null);

  // Gerar últimos 3 meses para o select
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
      // 1. Upload do arquivo
      const fileExt = file.name.split('.').pop();
      const fileName = `${employeeId}/nfse-${selectedOption.ano}-${selectedOption.mes}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('user-files')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // 2. Inserir registro na tabela
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
      
      // Reset form
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
