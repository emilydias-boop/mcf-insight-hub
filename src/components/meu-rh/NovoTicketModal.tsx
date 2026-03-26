import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Paperclip } from "lucide-react";
import { useCreateTicket, type RhTicket } from "@/hooks/useRhTickets";

interface NovoTicketModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
}

export function NovoTicketModal({ open, onOpenChange, employeeId }: NovoTicketModalProps) {
  const [tipo, setTipo] = useState<RhTicket['tipo']>('solicitacao');
  const [assunto, setAssunto] = useState('');
  const [descricao, setDescricao] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const createTicket = useCreateTicket();

  const handleSubmit = () => {
    if (!assunto.trim() || !descricao.trim()) return;

    createTicket.mutate(
      { employee_id: employeeId, tipo, assunto, descricao, file: file || undefined },
      {
        onSuccess: () => {
          setTipo('solicitacao');
          setAssunto('');
          setDescricao('');
          setFile(null);
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Solicitação</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as RhTicket['tipo'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ocorrencia">Ocorrência</SelectItem>
                <SelectItem value="solicitacao">Solicitação</SelectItem>
                <SelectItem value="sugestao">Sugestão</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Assunto</Label>
            <Input
              placeholder="Resumo da solicitação"
              value={assunto}
              onChange={(e) => setAssunto(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea
              placeholder="Descreva com detalhes..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={4}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Anexo (opcional)</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => document.getElementById('ticket-file-input')?.click()}
              >
                <Paperclip className="h-3.5 w-3.5" />
                {file ? file.name : 'Selecionar arquivo'}
              </Button>
              <input
                id="ticket-file-input"
                type="file"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              {file && (
                <Button variant="ghost" size="sm" onClick={() => setFile(null)}>
                  Remover
                </Button>
              )}
            </div>
          </div>

          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={!assunto.trim() || !descricao.trim() || createTicket.isPending}
          >
            {createTicket.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Enviar Solicitação
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
