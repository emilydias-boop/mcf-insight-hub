import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { FileText, ChevronDown } from 'lucide-react';
import { 
  R2AttendeeExtended, 
  TEMPO_CONHECE_MCF_OPTIONS,
  JA_CONSTROI_OPTIONS,
  TERRENO_OPTIONS,
  IMOVEL_OPTIONS,
  RENDA_OPTIONS
} from '@/types/r2Agenda';
import { PROFISSAO_OPTIONS, ESTADO_OPTIONS } from '../qualification/QualificationFields';
import { useUpdateDealCustomFields } from '@/hooks/useUpdateDealCustomFields';
import { toast } from 'sonner';

interface R2QualificationTabProps {
  attendee: R2AttendeeExtended;
}

export function R2QualificationTab({ attendee }: R2QualificationTabProps) {
  const updateCustomFields = useUpdateDealCustomFields();
  
  const customFields = attendee.deal?.custom_fields || {};
  const dealId = attendee.deal_id;
  
  // Local state for optimistic UI
  const [localProfissao, setLocalProfissao] = useState(customFields.profissao || '');
  const [localEstado, setLocalEstado] = useState(customFields.estado || '');
  const [localRenda, setLocalRenda] = useState(customFields.renda || '');
  const [localIdade, setLocalIdade] = useState(customFields.idade || '');
  const [localJaConstroi, setLocalJaConstroi] = useState(customFields.ja_constroi || '');
  const [localTerreno, setLocalTerreno] = useState(customFields.terreno || '');
  const [localImovel, setLocalImovel] = useState(customFields.possui_imovel || '');
  const [localTempoMcf, setLocalTempoMcf] = useState(customFields.tempo_conhece_mcf || '');

  // Sync with server data when attendee changes
  useEffect(() => {
    const cf = attendee.deal?.custom_fields || {};
    setLocalProfissao(cf.profissao || '');
    setLocalEstado(cf.estado || '');
    setLocalRenda(cf.renda || '');
    setLocalIdade(cf.idade || '');
    setLocalJaConstroi(cf.ja_constroi || '');
    setLocalTerreno(cf.terreno || '');
    setLocalImovel(cf.possui_imovel || '');
    setLocalTempoMcf(cf.tempo_conhece_mcf || '');
  }, [attendee.id, attendee.deal?.custom_fields]);

  // Determine sales channel from origin
  const originName = attendee.deal?.origin?.name || '';
  const salesChannel = originName.toUpperCase().includes('A010') 
    ? 'A010' 
    : originName.toUpperCase().includes('LIVE') 
      ? 'LIVE' 
      : originName || 'N/A';
  
  const handleFieldUpdate = (field: string, value: string, setLocal: (v: string) => void) => {
    if (!dealId) {
      toast.error('Deal não encontrado');
      return;
    }
    
    setLocal(value);
    updateCustomFields.mutate({
      dealId,
      customFields: { [field]: value || null }
    });
  };

  const handleIdadeBlur = () => {
    if (!dealId || localIdade === (customFields.idade || '')) return;
    
    updateCustomFields.mutate({
      dealId,
      customFields: { idade: localIdade || null }
    });
  };

  const [isNoteOpen, setIsNoteOpen] = useState(true);

  return (
    <div className="space-y-4">
      {/* Sales Channel Badge */}
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground">Canal de Venda:</Label>
        <Badge 
          variant="outline" 
          className={
            salesChannel === 'A010' 
              ? 'border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-950' 
              : salesChannel === 'LIVE'
                ? 'border-purple-500 text-purple-600 bg-purple-50 dark:bg-purple-950'
                : 'border-muted'
          }
        >
          {salesChannel}
        </Badge>
      </div>

      {/* R1 SDR Qualification Note */}
      {attendee.r1_qualification_note && (
        <Collapsible open={isNoteOpen} onOpenChange={setIsNoteOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium flex-1 text-left">Qualificação do SDR (R1)</span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isNoteOpen ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 p-3 bg-muted/30 rounded-md text-sm whitespace-pre-wrap border border-border/50">
              {attendee.r1_qualification_note}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Grid of editable fields */}
      <div className="grid grid-cols-2 gap-4">
        {/* Profissão */}
        <div className="space-y-1.5">
          <Label className="text-xs">👤 Profissão</Label>
          <Select
            value={localProfissao}
            onValueChange={(v) => handleFieldUpdate('profissao', v, setLocalProfissao)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Não informado —</SelectItem>
              {PROFISSAO_OPTIONS.map(opt => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Estado */}
        <div className="space-y-1.5">
          <Label className="text-xs">📍 Estado</Label>
          <Select
            value={localEstado}
            onValueChange={(v) => handleFieldUpdate('estado', v, setLocalEstado)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Não informado —</SelectItem>
              {ESTADO_OPTIONS.map(opt => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Renda */}
        <div className="space-y-1.5">
          <Label className="text-xs">💰 Renda</Label>
          <Select
            value={localRenda}
            onValueChange={(v) => handleFieldUpdate('renda', v, setLocalRenda)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Não informado —</SelectItem>
              {RENDA_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.label}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Idade */}
        <div className="space-y-1.5">
          <Label className="text-xs">🎂 Idade</Label>
          <Input
            type="number"
            value={localIdade}
            onChange={(e) => setLocalIdade(e.target.value)}
            onBlur={handleIdadeBlur}
            placeholder="Ex: 35"
            min={18}
            max={100}
          />
        </div>

        {/* Já constrói */}
        <div className="space-y-1.5">
          <Label className="text-xs">🏗️ Já constrói?</Label>
          <Select
            value={localJaConstroi}
            onValueChange={(v) => handleFieldUpdate('ja_constroi', v, setLocalJaConstroi)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Não informado —</SelectItem>
              {JA_CONSTROI_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tem terreno */}
        <div className="space-y-1.5">
          <Label className="text-xs">🏡 Tem terreno?</Label>
          <Select
            value={localTerreno}
            onValueChange={(v) => handleFieldUpdate('terreno', v, setLocalTerreno)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Não informado —</SelectItem>
              {TERRENO_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tem imóvel */}
        <div className="space-y-1.5">
          <Label className="text-xs">🏠 Tem imóvel?</Label>
          <Select
            value={localImovel}
            onValueChange={(v) => handleFieldUpdate('possui_imovel', v, setLocalImovel)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Não informado —</SelectItem>
              {IMOVEL_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Conhece MCF há quanto tempo */}
        <div className="space-y-1.5">
          <Label className="text-xs">⏱️ Conhece MCF?</Label>
          <Select
            value={localTempoMcf}
            onValueChange={(v) => handleFieldUpdate('tempo_conhece_mcf', v, setLocalTempoMcf)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Não informado —</SelectItem>
              {TEMPO_CONHECE_MCF_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
