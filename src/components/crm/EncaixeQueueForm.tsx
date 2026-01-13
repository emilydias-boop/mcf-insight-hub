import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, AlertCircle, UserPlus } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAddToEncaixeQueue, useCloserDayCapacity } from '@/hooks/useEncaixeQueue';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface EncaixeQueueFormProps {
  dealId: string;
  dealName: string;
  contactId?: string;
  contactName?: string;
  closerId: string;
  closerName: string;
  preferredDate: Date;
  leadType: 'A' | 'B';
  onSuccess: () => void;
  onCancel: () => void;
}

export function EncaixeQueueForm({
  dealId,
  dealName,
  contactId,
  contactName,
  closerId,
  closerName,
  preferredDate,
  leadType,
  onSuccess,
  onCancel,
}: EncaixeQueueFormProps) {
  const [preferredTimeStart, setPreferredTimeStart] = useState<string>('any');
  const [preferredTimeEnd, setPreferredTimeEnd] = useState<string>('any');
  const [priority, setPriority] = useState<string>('1');
  const [notes, setNotes] = useState('');

  const { user } = useAuth();
  const addToQueue = useAddToEncaixeQueue();
  const { data: dayCapacity } = useCloserDayCapacity(closerId, preferredDate);

  const handleSubmit = () => {
    addToQueue.mutate(
      {
        dealId,
        contactId,
        closerId,
        preferredDate,
        preferredTimeStart: preferredTimeStart === 'any' ? undefined : preferredTimeStart,
        preferredTimeEnd: preferredTimeEnd === 'any' ? undefined : preferredTimeEnd,
        leadType,
        priority: parseInt(priority),
        notes: notes || undefined,
        createdBy: user?.id,
      },
      {
        onSuccess: () => {
          onSuccess();
        },
      }
    );
  };

  const timeSlots = [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
    '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
    '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
  ];

  return (
    <div className="space-y-4">
      <Alert className="bg-amber-50 border-amber-200">
        <AlertCircle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          <strong>Agenda cheia!</strong> A agenda de {closerName} para{' '}
          {format(preferredDate, "dd 'de' MMMM", { locale: ptBR })} está completa.
          {dayCapacity && (
            <span className="block text-sm mt-1">
              ({dayCapacity.bookedCount}/{dayCapacity.totalSlotsAvailable} slots ocupados)
            </span>
          )}
        </AlertDescription>
      </Alert>

      <div className="bg-muted/50 p-4 rounded-lg space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <UserPlus className="h-4 w-4 text-primary" />
          <span>Adicionar à Fila de Encaixe</span>
        </div>

        <div className="text-sm text-muted-foreground">
          <p>
            <strong>Lead:</strong> {contactName || dealName}
          </p>
          <p>
            <strong>Closer:</strong> {closerName}
          </p>
          <p>
            <strong>Data:</strong> {format(preferredDate, "dd/MM/yyyy (EEEE)", { locale: ptBR })}
          </p>
          <p>
            <strong>Tipo:</strong> Lead {leadType}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-sm">Horário Preferido (início)</Label>
          <Select value={preferredTimeStart} onValueChange={setPreferredTimeStart}>
            <SelectTrigger>
              <SelectValue placeholder="Qualquer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Qualquer horário</SelectItem>
              {timeSlots.map((time) => (
                <SelectItem key={time} value={time}>
                  {time}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-sm">Horário Preferido (fim)</Label>
          <Select value={preferredTimeEnd} onValueChange={setPreferredTimeEnd}>
            <SelectTrigger>
              <SelectValue placeholder="Qualquer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Qualquer horário</SelectItem>
              {timeSlots.map((time) => (
                <SelectItem key={time} value={time}>
                  {time}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm">Prioridade</Label>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">🔴 Alta - Encaixar primeiro</SelectItem>
            <SelectItem value="2">🟡 Média - Normal</SelectItem>
            <SelectItem value="3">🟢 Baixa - Pode esperar</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-sm">Observações (opcional)</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ex: Cliente prefere horário da tarde, já remarcou 2x..."
          rows={2}
        />
      </div>

      <div className="flex gap-2 pt-2">
        <Button
          variant="outline"
          onClick={onCancel}
          className="flex-1"
          disabled={addToQueue.isPending}
        >
          Voltar
        </Button>
        <Button
          onClick={handleSubmit}
          className="flex-1 gap-2"
          disabled={addToQueue.isPending}
        >
          <Clock className="h-4 w-4" />
          {addToQueue.isPending ? 'Adicionando...' : 'Adicionar à Fila'}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Você será notificado quando um slot ficar disponível (no-show ou cancelamento)
      </p>
    </div>
  );
}
