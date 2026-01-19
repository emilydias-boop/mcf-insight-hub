import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useCRMDeal, useUpdateCRMDeal } from '@/hooks/useCRMData';
import { useMeetingSuggestion, type QualificationData } from '@/hooks/useMeetingSuggestion';
import { SuggestionCard } from './SuggestionCard';
import { QuickScheduleModal } from './QuickScheduleModal';
import { ClipboardList, Sparkles, Calendar, Loader2, Save, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

// Campos de qualificação do Perpétuo X1
const QUALIFICATION_FIELDS = [
  {
    key: 'renda',
    label: 'Renda Mensal',
    type: 'select',
    options: [
      'Até R$ 5.000',
      'R$ 5.000 a R$ 10.000',
      'R$ 10.000 a R$ 20.000',
      'R$ 20.000 a R$ 30.000',
      '+R$ 30.000',
    ],
    required: true,
  },
  {
    key: 'empreende',
    label: 'Já Empreende?',
    type: 'select',
    options: ['Sim, tenho negócio próprio', 'Sim, mas é CLT também', 'Não, sou CLT', 'Não trabalho atualmente'],
    required: true,
  },
  {
    key: 'terreno',
    label: 'Possui Terreno?',
    type: 'select',
    options: ['Sim, já tenho terreno', 'Não, mas pretendo comprar', 'Não tenho e não pretendo'],
    required: true,
  },
  {
    key: 'investimento',
    label: 'Quanto Pretende Investir?',
    type: 'select',
    options: [
      'Até R$ 50.000',
      'R$ 50.000 a R$ 100.000',
      'R$ 100.000 a R$ 200.000',
      '+R$ 200.000',
    ],
    required: true,
  },
  {
    key: 'solucao',
    label: 'Qual Solução Busca?',
    type: 'select',
    options: [
      'Renda extra',
      'Substituir emprego atual',
      'Investimento para aposentadoria',
      'Negócio para família',
      'Outro',
    ],
    required: true,
  },
];

interface QualificationAndScheduleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  contactName?: string;
  autoFocus?: 'qualification' | 'schedule';
}

export function QualificationAndScheduleModal({
  open,
  onOpenChange,
  dealId,
  contactName,
  autoFocus = 'qualification',
}: QualificationAndScheduleModalProps) {
  const { data: deal, refetch: refetchDeal } = useCRMDeal(dealId);
  const updateDeal = useUpdateCRMDeal();
  
  const [activeTab, setActiveTab] = useState<string>(autoFocus);
  const [qualificationData, setQualificationData] = useState<QualificationData>({});
  const [leadSummary, setLeadSummary] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showManualSchedule, setShowManualSchedule] = useState(false);

  // Buscar sugestões de agendamento
  const { suggestions, topSuggestion, isLoading: suggestionsLoading } = useMeetingSuggestion({
    qualificationData,
    enabled: open && Object.keys(qualificationData).length >= 3,
  });

  // Carregar dados existentes
  useEffect(() => {
    if (deal?.custom_fields) {
      const fields = deal.custom_fields as Record<string, any>;
      setQualificationData({
        renda: fields.renda || '',
        empreende: fields.empreende || '',
        terreno: fields.terreno || '',
        investimento: fields.investimento || '',
        solucao: fields.solucao || '',
      });
      setLeadSummary(fields.leadSummary || '');
    }
  }, [deal]);

  // Calcular progresso
  const requiredFields = QUALIFICATION_FIELDS.filter(f => f.required);
  const filledCount = requiredFields.filter(f => qualificationData[f.key as keyof QualificationData]).length;
  const progress = (filledCount / requiredFields.length) * 100;
  const isComplete = progress === 100;

  const handleFieldChange = (key: string, value: string) => {
    setQualificationData(prev => ({ ...prev, [key]: value }));
  };

  const generateSummary = () => {
    const parts: string[] = [];
    
    if (qualificationData.renda) parts.push(`Renda: ${qualificationData.renda}`);
    if (qualificationData.empreende) parts.push(`Empreende: ${qualificationData.empreende}`);
    if (qualificationData.terreno) parts.push(`Terreno: ${qualificationData.terreno}`);
    if (qualificationData.investimento) parts.push(`Investimento: ${qualificationData.investimento}`);
    if (qualificationData.solucao) parts.push(`Busca: ${qualificationData.solucao}`);
    
    const summary = parts.join(' | ');
    setLeadSummary(summary);
    return summary;
  };

  const handleSaveQualification = async () => {
    setIsSaving(true);
    try {
      const summary = leadSummary || generateSummary();
      
      await updateDeal.mutateAsync({
        id: dealId,
        custom_fields: {
          ...(deal?.custom_fields as Record<string, any> || {}),
          ...qualificationData,
          leadSummary: summary,
        },
      });

      toast.success('Qualificação salva!');
      refetchDeal();
      
      // Se completou qualificação, ir para aba de sugestões
      if (isComplete) {
        setActiveTab('suggestions');
      }
    } catch (error) {
      console.error('Error saving qualification:', error);
      toast.error('Erro ao salvar qualificação');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAcceptSuggestion = async () => {
    if (!topSuggestion) return;
    
    // Abrir modal de agendamento com dados pré-preenchidos
    setShowManualSchedule(true);
  };

  const handleScheduleComplete = () => {
    setShowManualSchedule(false);
    onOpenChange(false);
    toast.success('Reunião agendada com sucesso!');
  };

  return (
    <>
      <Dialog open={open && !showManualSchedule} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              Qualificar e Agendar
              {contactName && (
                <span className="text-muted-foreground font-normal">— {contactName}</span>
              )}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="qualification" className="text-xs sm:text-sm">
                <ClipboardList className="h-4 w-4 mr-1 sm:mr-2" />
                Qualificação
              </TabsTrigger>
              <TabsTrigger value="suggestions" className="text-xs sm:text-sm" disabled={!isComplete}>
                <Sparkles className="h-4 w-4 mr-1 sm:mr-2" />
                Sugestão IA
              </TabsTrigger>
              <TabsTrigger value="manual" className="text-xs sm:text-sm">
                <Calendar className="h-4 w-4 mr-1 sm:mr-2" />
                Manual
              </TabsTrigger>
            </TabsList>

            {/* Tab: Qualificação */}
            <TabsContent value="qualification" className="space-y-4 mt-4">
              {/* Progress */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progresso da qualificação</span>
                  <span className="font-medium">{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>

              {/* Fields */}
              <div className="grid gap-4">
                {QUALIFICATION_FIELDS.map(field => (
                  <div key={field.key} className="space-y-2">
                    <Label>
                      {field.label}
                      {field.required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    <Select
                      value={qualificationData[field.key as keyof QualificationData] || ''}
                      onValueChange={(value) => handleFieldChange(field.key, value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {field.options?.map(opt => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Resumo do Lead</Label>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={generateSummary}
                    disabled={!isComplete}
                  >
                    <Sparkles className="h-4 w-4 mr-1" />
                    Gerar
                  </Button>
                </div>
                <Textarea
                  value={leadSummary}
                  onChange={(e) => setLeadSummary(e.target.value)}
                  placeholder="O resumo será gerado automaticamente..."
                  rows={3}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button 
                  variant="outline" 
                  onClick={() => onOpenChange(false)}
                  className="flex-1"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
                <Button 
                  onClick={handleSaveQualification}
                  disabled={isSaving}
                  className="flex-1"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {isComplete ? 'Salvar e Continuar' : 'Salvar'}
                </Button>
              </div>
            </TabsContent>

            {/* Tab: Sugestões IA */}
            <TabsContent value="suggestions" className="space-y-4 mt-4">
              {suggestionsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-40 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : topSuggestion ? (
                <div className="space-y-4">
                  <SuggestionCard
                    suggestion={topSuggestion}
                    onAccept={handleAcceptSuggestion}
                    onChooseOther={() => setActiveTab('manual')}
                    isLoading={isSaving}
                  />

                  {suggestions.length > 1 && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground font-medium">
                        Outras opções disponíveis:
                      </p>
                      <div className="grid gap-2">
                        {suggestions.slice(1, 4).map((s, idx) => (
                          <Card 
                            key={idx} 
                            className="cursor-pointer hover:border-primary/50 transition-colors"
                            onClick={() => {
                              // TODO: Selecionar esta sugestão
                            }}
                          >
                            <CardContent className="p-3 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div 
                                  className="w-3 h-3 rounded-full" 
                                  style={{ backgroundColor: s.closerColor }}
                                />
                                <span className="font-medium">{s.closerName}</span>
                                <span className="text-muted-foreground">
                                  {format(s.date, "dd/MM 'às' HH:mm")}
                                </span>
                              </div>
                              <span className="text-sm font-medium text-primary">
                                {s.score}/100
                              </span>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    Complete a qualificação para receber sugestões de agendamento
                  </p>
                </div>
              )}
            </TabsContent>

            {/* Tab: Manual */}
            <TabsContent value="manual" className="mt-4">
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-4">
                  Escolha manualmente o dia, horário e closer para a reunião
                </p>
                <Button onClick={() => setShowManualSchedule(true)}>
                  <Calendar className="h-4 w-4 mr-2" />
                  Abrir Agenda
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Modal de agendamento manual */}
      <QuickScheduleModal
        open={showManualSchedule}
        onOpenChange={(open) => {
          setShowManualSchedule(open);
          if (!open) handleScheduleComplete();
        }}
        closers={[]}
        prefilledDealId={dealId}
        prefilledNotes={leadSummary}
        preselectedCloserId={topSuggestion?.closerId}
        preselectedDate={topSuggestion?.date}
      />
    </>
  );
}
