import { useState, useEffect } from 'react';
import { Video, MessageSquare } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue
} from '@/components/ui/select';
import { 
  R2AttendeeExtended, R2StatusOption, R2ThermometerOption,
  LEAD_PROFILE_OPTIONS, VIDEO_STATUS_OPTIONS, DECISION_MAKER_TYPE_OPTIONS
} from '@/types/r2Agenda';
import { useUpdateR2Attendee } from '@/hooks/useR2AttendeeUpdate';

interface R2EvaluationTabProps {
  attendee: R2AttendeeExtended;
  statusOptions: R2StatusOption[];
  thermometerOptions: R2ThermometerOption[];
}

export function R2EvaluationTab({ 
  attendee, 
  statusOptions, 
  thermometerOptions 
}: R2EvaluationTabProps) {
  const updateAttendee = useUpdateR2Attendee();
  
  // Optimistic UI state
  const [localDecisionMaker, setLocalDecisionMaker] = useState<boolean | null>(null);
  const [localDecisionMakerType, setLocalDecisionMakerType] = useState<string | null>(null);
  const [localLeadProfile, setLocalLeadProfile] = useState<string | null>(null);
  const [localVideoStatus, setLocalVideoStatus] = useState<string>('pendente');
  const [localR2StatusId, setLocalR2StatusId] = useState<string | null>(null);
  const [localThermometerId, setLocalThermometerId] = useState<string | null>(null);
  const [localMeetingLink, setLocalMeetingLink] = useState<string>('');
  const [localR2Observations, setLocalR2Observations] = useState<string>('');

  // Sync local state with server data
  useEffect(() => {
    if (attendee) {
      setLocalDecisionMaker(attendee.is_decision_maker ?? null);
      setLocalDecisionMakerType(attendee.decision_maker_type ?? null);
      setLocalLeadProfile(attendee.lead_profile ?? null);
      setLocalVideoStatus(attendee.video_status ?? 'pendente');
      setLocalR2StatusId(attendee.r2_status_id ?? null);
      setLocalThermometerId(attendee.thermometer_ids?.[0] ?? null);
      setLocalMeetingLink(attendee.meeting_link ?? '');
      setLocalR2Observations(attendee.r2_observations ?? '');
    }
  }, [attendee.id, attendee.is_decision_maker, attendee.decision_maker_type,
      attendee.lead_profile, attendee.video_status, attendee.r2_status_id,
      attendee.thermometer_ids, attendee.meeting_link, attendee.r2_observations]);

  const isDecisionMaker = localDecisionMaker ?? attendee.is_decision_maker ?? true;

  const handleDecisionMakerChange = (value: boolean) => {
    setLocalDecisionMaker(value);
    if (value) setLocalDecisionMakerType(null);
    
    updateAttendee.mutate({
      attendeeId: attendee.id,
      updates: { 
        is_decision_maker: value,
        ...(value && { decision_maker_type: null })
      }
    });
  };

  const handleDecisionMakerTypeChange = (type: string | null) => {
    setLocalDecisionMakerType(type);
    updateAttendee.mutate({
      attendeeId: attendee.id,
      updates: { decision_maker_type: type }
    });
  };

  const handleOptimisticSelectUpdate = (
    field: string, 
    value: unknown, 
    setLocalState: (v: any) => void
  ) => {
    setLocalState(value);
    updateAttendee.mutate({
      attendeeId: attendee.id,
      updates: { [field]: value }
    });
  };

  const handleThermometerChange = (value: string | null) => {
    setLocalThermometerId(value);
    updateAttendee.mutate({
      attendeeId: attendee.id,
      updates: { thermometer_ids: value ? [value] : [] }
    });
  };

  const handleMeetingLinkBlur = () => {
    updateAttendee.mutate({
      attendeeId: attendee.id,
      updates: { meeting_link: localMeetingLink || null }
    });
  };

  const handleObservationsBlur = () => {
    updateAttendee.mutate({
      attendeeId: attendee.id,
      updates: { r2_observations: localR2Observations || null }
    });
  };

  return (
    <div className="space-y-4">
      {/* Row 1: Sócio Decisor */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">É o Decisor?</Label>
          <Select
            value={isDecisionMaker === false ? 'nao' : 'sim'}
            onValueChange={(v) => handleDecisionMakerChange(v === 'sim')}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sim">Sim</SelectItem>
              <SelectItem value="nao">Não</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isDecisionMaker === false && (
          <div className="space-y-1.5">
            <Label className="text-xs">Quem é o Decisor?</Label>
            <Select
              value={localDecisionMakerType || ''}
              onValueChange={(v) => handleDecisionMakerTypeChange(v || null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {DECISION_MAKER_TYPE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Row 2: Perfil do Lead + Status do Vídeo */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Perfil do Lead</Label>
          <Select
            value={localLeadProfile || ''}
            onValueChange={(v) => handleOptimisticSelectUpdate('lead_profile', v || null, setLocalLeadProfile)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {LEAD_PROFILE_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1">
            <Video className="h-3 w-3" />
            Status do Vídeo
          </Label>
          <Select
            value={localVideoStatus}
            onValueChange={(v) => handleOptimisticSelectUpdate('video_status', v, setLocalVideoStatus)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VIDEO_STATUS_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 3: Status Final + Termômetro */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Status Final</Label>
          <Select
            value={localR2StatusId || '__none__'}
            onValueChange={(v) => handleOptimisticSelectUpdate('r2_status_id', v === '__none__' ? null : v, setLocalR2StatusId)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Sem status —</SelectItem>
              {statusOptions.map(opt => (
                <SelectItem key={opt.id} value={opt.id}>
                  <div className="flex items-center gap-2">
                    <div 
                      className="h-2 w-2 rounded-full" 
                      style={{ backgroundColor: opt.color }} 
                    />
                    {opt.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Termômetro</Label>
          <Select
            value={localThermometerId || '__none__'}
            onValueChange={(v) => handleThermometerChange(v === '__none__' ? null : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Nenhum —</SelectItem>
              {thermometerOptions.map(opt => (
                <SelectItem key={opt.id} value={opt.id}>
                  <div className="flex items-center gap-2">
                    <div 
                      className="h-2 w-2 rounded-full" 
                      style={{ backgroundColor: opt.color }} 
                    />
                    {opt.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Link da Reunião */}
      <div className="space-y-1.5">
        <Label className="text-xs">Link da Reunião</Label>
        <Input
          value={localMeetingLink}
          onChange={(e) => setLocalMeetingLink(e.target.value)}
          onBlur={handleMeetingLinkBlur}
          placeholder="https://..."
        />
      </div>

      {/* Observações */}
      <div className="space-y-1.5">
        <Label className="text-xs flex items-center gap-1">
          <MessageSquare className="h-3 w-3" />
          Observações R2
        </Label>
        <Textarea
          value={localR2Observations}
          onChange={(e) => setLocalR2Observations(e.target.value)}
          onBlur={handleObservationsBlur}
          placeholder="Anotações sobre a reunião..."
          rows={3}
        />
      </div>
    </div>
  );
}
