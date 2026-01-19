import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useCRMDeal } from '@/hooks/useCRMData';
import { useMeetingSuggestion } from '@/hooks/useMeetingSuggestion';
import { useSaveQualificationNote } from '@/hooks/useQualificationNote';
import { SuggestionCard } from './SuggestionCard';
import { QuickScheduleModal } from './QuickScheduleModal';
import { QualificationSummaryCard } from './qualification/QualificationSummaryCard';
import { 
  QUALIFICATION_FIELDS, 
  generateQualificationSummary,
  type QualificationDataType 
} from './qualification/QualificationFields';
import { ClipboardList, Sparkles, Calendar, Loader2, Save, Check, X, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

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
  const { user } = useAuth();
  const { data: deal, refetch: refetchDeal } = useCRMDeal(dealId);
  const saveQualification = useSaveQualificationNote();
  
  const [activeTab, setActiveTab] = useState<string>(autoFocus);
  const [qualificationData, setQualificationData] = useState<QualificationDataType>({});
  const [leadSummary, setLeadSummary] = useState('');
  const [isQualificationSaved, setIsQualificationSaved] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showManualSchedule, setShowManualSchedule] = useState(false);

  // Buscar sugestões de agendamento
  const { suggestions, topSuggestion, isLoading: suggestionsLoading } = useMeetingSuggestion({
    qualificationData: qualificationData as any,
    enabled: open && Object.keys(qualificationData).length >= 3,
  });

  // Carregar dados existentes
  useEffect(() => {
    if (deal?.custom_fields) {
      const fields = deal.custom_fields as Record<string, any>;
      
      // Carregar dados de qualificação
      setQualificationData({
        profissao: fields.profissao || '',
        tem_socio: fields.tem_socio === true || fields.tem_socio === 'true',
        nome_socio: fields.nome_socio || '',
        estado: fields.estado || '',
        renda: fields.renda || '',
        empreende: fields.empreende || '',
        terreno: fields.terreno || '',
        investimento: fields.investimento || '',
        solucao: fields.solucao || '',
      });
      setLeadSummary(fields.leadSummary || '');
      
      // Verificar se já foi salvo
      if (fields.qualification_saved) {
        setIsQualificationSaved(true);
        setIsEditing(false);
      }
    }
  }, [deal]);

  // Calcular progresso
  const requiredFields = QUALIFICATION_FIELDS.filter(f => f.required);
  const filledCount = requiredFields.filter(f => {
    const value = qualificationData[f.key];
    return value !== undefined && value !== null && value !== '';
  }).length;
  const progress = (filledCount / requiredFields.length) * 100;
  const isComplete = progress === 100;

  const handleFieldChange = (key: string, value: string | boolean) => {
    setQualificationData(prev => ({ ...prev, [key]: value }));
  };

  const handleGenerateSummary = () => {
    const userName = user?.email?.split('@')[0] || 'SDR';
    const summary = generateQualificationSummary(qualificationData, userName);
    setLeadSummary(summary);
  };

  const handleSaveQualification = async () => {
    try {
      // Gerar resumo se não existir
      let summary = leadSummary;
      if (!summary) {
        const userName = user?.email?.split('@')[0] || 'SDR';
        summary = generateQualificationSummary(qualificationData, userName);
        setLeadSummary(summary);
      }
      
      await saveQualification.mutateAsync({
        dealId,
        qualificationData,
        summary,
        paraR1: true,
      });

      setIsQualificationSaved(true);
      setIsEditing(false);
      refetchDeal();
      
      // Se completou qualificação, ir para aba de sugestões
      if (isComplete) {
        setActiveTab('suggestions');
      }
    } catch (error) {
      console.error('Error saving qualification:', error);
    }
  };

  const handleAcceptSuggestion = async () => {
    if (!topSuggestion) return;
    setShowManualSchedule(true);
  };

  const handleScheduleComplete = () => {
    setShowManualSchedule(false);
    onOpenChange(false);
    toast.success('Reunião agendada com sucesso!');
  };

  // Renderizar campo condicional
  const shouldShowField = (field: typeof QUALIFICATION_FIELDS[0]) => {
    if (!field.showIf) return true;
    return qualificationData[field.showIf] === true;
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
              {/* Se já salvou, mostrar apenas o resumo */}
              {isQualificationSaved && !isEditing ? (
                <div className="space-y-4">
                  <QualificationSummaryCard
                    data={qualificationData}
                    summary={leadSummary}
                    sdrName={user?.email?.split('@')[0]}
                    qualifiedAt={new Date().toISOString()}
                  />
                  
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setIsEditing(true)}
                      className="flex-1"
                    >
                      <Edit2 className="h-4 w-4 mr-2" />
                      Editar
                    </Button>
                    <Button 
                      onClick={() => setActiveTab('suggestions')}
                      className="flex-1"
                      disabled={!isComplete}
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      Ver Sugestões
                    </Button>
                  </div>
                </div>
              ) : (
                <>
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
                    {QUALIFICATION_FIELDS.map(field => {
                      if (!shouldShowField(field)) return null;
                      
                      return (
                        <div key={field.key} className="space-y-2">
                          <Label className="flex items-center gap-2">
                            {field.icon && <span>{field.icon}</span>}
                            {field.label}
                            {field.required && <span className="text-destructive ml-1">*</span>}
                          </Label>
                          
                          {field.type === 'boolean' && (
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={qualificationData[field.key] === true}
                                onCheckedChange={(checked) => handleFieldChange(field.key, !!checked)}
                              />
                              <span className="text-sm">
                                {qualificationData[field.key] ? 'Sim' : 'Não'}
                              </span>
                            </div>
                          )}
                          
                          {field.type === 'select' && (
                            <Select
                              value={qualificationData[field.key] as string || ''}
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
                          )}
                          
                          {field.type === 'text' && (
                            <Input
                              value={qualificationData[field.key] as string || ''}
                              onChange={(e) => handleFieldChange(field.key, e.target.value)}
                              placeholder="Digite..."
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Summary */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Resumo do Lead (para R1)</Label>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={handleGenerateSummary}
                        disabled={!isComplete}
                      >
                        <Sparkles className="h-4 w-4 mr-1" />
                        Gerar
                      </Button>
                    </div>
                    <Textarea
                      value={leadSummary}
                      onChange={(e) => setLeadSummary(e.target.value)}
                      placeholder="O resumo será gerado automaticamente ou escreva suas observações..."
                      rows={5}
                      className="text-sm"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        if (isQualificationSaved) {
                          setIsEditing(false);
                        } else {
                          onOpenChange(false);
                        }
                      }}
                      className="flex-1"
                    >
                      <X className="h-4 w-4 mr-2" />
                      {isQualificationSaved ? 'Cancelar' : 'Fechar'}
                    </Button>
                    <Button 
                      onClick={handleSaveQualification}
                      disabled={saveQualification.isPending}
                      className="flex-1"
                    >
                      {saveQualification.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      {isComplete ? 'Salvar e Continuar' : 'Salvar'}
                    </Button>
                  </div>
                </>
              )}
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
                    isLoading={saveQualification.isPending}
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
