import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { WizardProgress } from './WizardProgress';
import { WizardStepInfo } from './WizardStepInfo';
import { WizardStepStages } from './WizardStepStages';
import { WizardStepDistribution } from './WizardStepDistribution';
import { WizardStepIntegrations } from './WizardStepIntegrations';
import { WizardStepReview } from './WizardStepReview';
import { WizardData, INITIAL_WIZARD_DATA, DEFAULT_STAGES } from './types';
import { useCreatePipeline } from '@/hooks/useCreatePipeline';

interface CreatePipelineWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (result: { groupId?: string; originId?: string }) => void;
}

const STEP_LABELS = ['Informações', 'Etapas', 'Distribuição', 'Integrações', 'Revisão'];

export const CreatePipelineWizard = ({ open, onOpenChange, onSuccess }: CreatePipelineWizardProps) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [data, setData] = useState<WizardData>({
    ...INITIAL_WIZARD_DATA,
    stages: DEFAULT_STAGES.map((s, i) => ({ ...s, id: crypto.randomUUID(), stage_order: i })),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const createPipeline = useCreatePipeline();

  const updateData = (updates: Partial<WizardData>) => {
    setData((prev) => ({ ...prev, ...updates }));
    // Clear related errors
    const errorKeys = Object.keys(updates);
    setErrors((prev) => {
      const newErrors = { ...prev };
      errorKeys.forEach((key) => delete newErrors[key]);
      return newErrors;
    });
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    switch (step) {
      case 1:
        if (!data.name.trim()) {
          newErrors.name = 'Nome é obrigatório';
        }
        if (data.type === 'origin' && !data.parent_group_id) {
          newErrors.parent_group_id = 'Selecione o grupo pai';
        }
        break;
      case 2:
        if (data.stages.length === 0) {
          newErrors.stages = 'Pelo menos uma etapa é obrigatória';
        }
        const hasWonOrLost = data.stages.some(
          (s) => s.stage_type === 'won' || s.stage_type === 'lost'
        );
        if (!hasWonOrLost) {
          newErrors.stages = 'Deve haver pelo menos uma etapa de "Ganho" ou "Perdido"';
        }
        break;
      case 3:
        const totalPercentage = data.distribution
          .filter((d) => d.is_active)
          .reduce((sum, d) => sum + d.percentage, 0);
        if (data.distribution.length > 0 && totalPercentage !== 100 && totalPercentage !== 0) {
          newErrors.distribution = 'O total deve ser 100% (ou 0% se não configurar)';
        }
        break;
      case 4:
        if (data.integration.enabled && !data.integration.slug.trim()) {
          newErrors['integration.slug'] = 'Slug é obrigatório quando webhook está ativado';
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 5));
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleCreate = async () => {
    if (!validateStep(currentStep)) return;

    try {
      const result = await createPipeline.mutateAsync(data);
      onSuccess?.({ groupId: result.groupId, originId: result.originId });
      onOpenChange(false);
      // Reset wizard
      setCurrentStep(1);
      setData({
        ...INITIAL_WIZARD_DATA,
        stages: DEFAULT_STAGES.map((s, i) => ({ ...s, id: crypto.randomUUID(), stage_order: i })),
      });
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset after animation
    setTimeout(() => {
      setCurrentStep(1);
      setData({
        ...INITIAL_WIZARD_DATA,
        stages: DEFAULT_STAGES.map((s, i) => ({ ...s, id: crypto.randomUUID(), stage_order: i })),
      });
      setErrors({});
    }, 300);
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <WizardStepInfo data={data} onChange={updateData} errors={errors} />;
      case 2:
        return <WizardStepStages data={data} onChange={updateData} errors={errors} />;
      case 3:
        return <WizardStepDistribution data={data} onChange={updateData} errors={errors} />;
      case 4:
        return <WizardStepIntegrations data={data} onChange={updateData} errors={errors} />;
      case 5:
        return <WizardStepReview data={data} />;
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Criar Novo Pipeline</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto py-4">
          <WizardProgress
            currentStep={currentStep}
            totalSteps={5}
            stepLabels={STEP_LABELS}
          />

          <div className="min-h-[300px]">
            {renderStep()}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={currentStep === 1 ? handleClose : handleBack}
          >
            {currentStep === 1 ? (
              'Cancelar'
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Voltar
              </>
            )}
          </Button>

          {currentStep < 5 ? (
            <Button onClick={handleNext}>
              {currentStep === 3 || currentStep === 4 ? 'Pular / ' : ''}
              Próximo
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button 
              onClick={handleCreate} 
              disabled={createPipeline.isPending}
              className="min-w-[120px]"
            >
              {createPipeline.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                'Criar Pipeline'
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
