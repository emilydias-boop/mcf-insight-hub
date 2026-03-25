import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MessageCircle, User, Phone, Mail, Calendar, Building, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { useToggleVideoSent } from '@/hooks/useVideoControl';
import { useState, useEffect } from 'react';

interface ContractRow {
  id: string;
  closerName: string;
  leadName: string;
  leadPhone: string;
  leadEmail: string;
  sdrName: string;
  originName: string;
  currentStage: string;
  date: string;
  salesChannel: string;
}

interface ControleDiegoDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: ContractRow | null;
  videoSent: boolean;
  videoNotes: string | null;
}

function formatWhatsAppUrl(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const number = digits.startsWith('55') ? digits : `55${digits}`;
  return `https://wa.me/${number}`;
}

export function ControleDiegoDrawer({ open, onOpenChange, contract, videoSent, videoNotes }: ControleDiegoDrawerProps) {
  const toggleMutation = useToggleVideoSent();
  const [notes, setNotes] = useState(videoNotes || '');
  const [sent, setSent] = useState(videoSent);

  useEffect(() => {
    setSent(videoSent);
    setNotes(videoNotes || '');
  }, [videoSent, videoNotes, contract?.id]);

  if (!contract) return null;

  const handleToggle = async (checked: boolean) => {
    setSent(checked);
    await toggleMutation.mutateAsync({
      attendeeId: contract.id,
      videoSent: checked,
      notes: notes || undefined,
    });
  };

  const handleSaveNotes = async () => {
    await toggleMutation.mutateAsync({
      attendeeId: contract.id,
      videoSent: sent,
      notes: notes || undefined,
    });
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {contract.leadName}
          </DrawerTitle>
          <DrawerDescription>Detalhes do contrato e controle de envio de vídeo</DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-6 space-y-5 overflow-y-auto">
          {/* Info grid */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <p className="text-muted-foreground">Closer</p>
              <p className="font-medium">{contract.closerName}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">SDR</p>
              <p className="font-medium">{contract.sdrName}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Data</p>
              <p className="font-medium">
                {contract.date ? format(parseISO(contract.date), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground flex items-center gap-1"><Building className="h-3 w-3" /> Pipeline</p>
              <Badge variant="outline">{contract.originName}</Badge>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" /> Email</p>
              <p className="font-medium text-xs">{contract.leadEmail || '-'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">Canal</p>
              <Badge variant="secondary">{contract.salesChannel}</Badge>
            </div>
          </div>

          {/* WhatsApp button */}
          {contract.leadPhone && (
            <Button
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              onClick={() => window.open(formatWhatsAppUrl(contract.leadPhone), '_blank')}
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Enviar vídeo via WhatsApp
            </Button>
          )}

          {/* Video sent toggle */}
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Checkbox
                id="video-sent"
                checked={sent}
                onCheckedChange={(checked) => handleToggle(!!checked)}
                disabled={toggleMutation.isPending}
              />
              <label htmlFor="video-sent" className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                {sent ? (
                  <><CheckCircle2 className="h-4 w-4 text-green-600" /> Vídeo enviado</>
                ) : (
                  <><Clock className="h-4 w-4 text-muted-foreground" /> Pendente de envio</>
                )}
              </label>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Observação</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observação opcional..."
                rows={2}
                className="text-sm"
              />
              <Button size="sm" variant="outline" onClick={handleSaveNotes} disabled={toggleMutation.isPending}>
                Salvar nota
              </Button>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
