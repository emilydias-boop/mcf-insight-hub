import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useStartWaConversation } from '@/hooks/whatsapp/useWhatsapp';
import { toast } from 'sonner';

export function WaStartConversationDialog({
  open,
  onOpenChange,
  onCreated,
  defaultPhone,
  defaultName,
  dealId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (conversationId: string) => void;
  defaultPhone?: string;
  defaultName?: string;
  dealId?: string;
}) {
  const [phone, setPhone] = useState(defaultPhone ?? '');
  const [name, setName] = useState(defaultName ?? '');
  const start = useStartWaConversation();

  const submit = async () => {
    if (!phone.trim()) return;
    try {
      const res = await start.mutateAsync({
        phone: phone.trim(),
        contact_name: name.trim() || undefined,
        deal_id: dealId,
      });
      toast.success('Mensagem inicial enviada');
      onOpenChange(false);
      setPhone(''); setName('');
      if (res?.conversation_id) onCreated?.(res.conversation_id);
    } catch (err) {
      toast.error('Falha ao iniciar conversa', { description: (err as Error).message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova conversa WhatsApp</DialogTitle>
          <DialogDescription>
            Envia a mensagem inicial de boas-vindas ao cliente com o prazo de agendamento (hoje + 2 dias).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Telefone (com DDD)</Label>
            <Input
              placeholder="+55 11 99999-9999"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Aceita formatos brasileiros. Ex: 11999999999 ou +5511999999999.
            </p>
          </div>
          <div>
            <Label>Nome do contato (opcional)</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!phone.trim() || start.isPending} className="bg-emerald-600 hover:bg-emerald-700">
            {start.isPending ? 'Enviando...' : 'Enviar boas-vindas'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}