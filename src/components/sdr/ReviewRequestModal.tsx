import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertCircle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateReviewRequest } from "@/hooks/useSdrMeetings";
import { toast } from "sonner";

interface ReviewRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultPeriod?: string;
}

const PROBLEM_TYPES = [
  { value: 'agendamentos_errados', label: 'Agendamentos não batem' },
  { value: 'reunioes_realizadas', label: 'Reuniões realizadas erradas' },
  { value: 'no_show', label: 'No-show incorreto' },
  { value: 'outro', label: 'Outro' },
];

export function ReviewRequestModal({ open, onOpenChange, defaultPeriod }: ReviewRequestModalProps) {
  const [tipoProblema, setTipoProblema] = useState('');
  const [periodo, setPeriodo] = useState(defaultPeriod || format(new Date(), 'yyyy-MM'));
  const [descricao, setDescricao] = useState('');
  
  const createRequest = useCreateReviewRequest();

  const handleSubmit = async () => {
    if (!tipoProblema) {
      toast.error('Selecione o tipo de problema');
      return;
    }
    
    try {
      await createRequest.mutateAsync({
        periodo,
        tipo_problema: tipoProblema,
        descricao: descricao || undefined
      });
      
      toast.success('Solicitação de revisão enviada com sucesso!');
      onOpenChange(false);
      
      // Reset form
      setTipoProblema('');
      setDescricao('');
    } catch (error) {
      toast.error('Erro ao enviar solicitação');
      console.error(error);
    }
  };

  // Generate month options (last 12 months)
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    return {
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM yyyy', { locale: ptBR })
    };
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            Solicitar Revisão dos Números
          </DialogTitle>
          <DialogDescription>
            Use este formulário para reportar inconsistências nos seus indicadores.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo de Problema *</Label>
            <Select value={tipoProblema} onValueChange={setTipoProblema}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo de problema" />
              </SelectTrigger>
              <SelectContent>
                {PROBLEM_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="periodo">Período de Referência</Label>
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o mês" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((month) => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição / Observações</Label>
            <Textarea
              id="descricao"
              placeholder="Descreva o problema que você identificou..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={4}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={createRequest.isPending}>
            {createRequest.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Enviar Solicitação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
