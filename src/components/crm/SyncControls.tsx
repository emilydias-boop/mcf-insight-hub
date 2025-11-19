import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface SyncStep {
  name: string;
  endpoint: string;
  status: 'pending' | 'running' | 'success' | 'error';
  result?: any;
  error?: string;
  duration?: number;
}

export const SyncControls = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<SyncStep[]>([
    { name: 'Origens e Estágios', endpoint: 'sync-origins-stages', status: 'pending' },
    { name: 'Contatos', endpoint: 'sync-contacts', status: 'pending' },
    { name: 'Negócios', endpoint: 'sync-deals', status: 'pending' },
    { name: 'Vincular Contatos', endpoint: 'sync-link-contacts', status: 'pending' },
  ]);

  const runSyncStep = async (step: SyncStep, index: number) => {
    setCurrentStep(index);
    
    // Atualizar status para running
    setSteps(prev => prev.map((s, i) => 
      i === index ? { ...s, status: 'running' } : s
    ));

    const startTime = Date.now();

    try {
      const { data, error } = await supabase.functions.invoke(step.endpoint);

      if (error) throw error;

      const duration = Date.now() - startTime;

      // Atualizar com sucesso
      setSteps(prev => prev.map((s, i) => 
        i === index ? { ...s, status: 'success', result: data, duration } : s
      ));

      return data;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      // Atualizar com erro
      setSteps(prev => prev.map((s, i) => 
        i === index ? { 
          ...s, 
          status: 'error', 
          error: error.message || 'Erro desconhecido',
          duration 
        } : s
      ));

      throw error;
    }
  };

  const handleFullSync = async () => {
    setIsSyncing(true);
    
    // Reset todos os steps
    setSteps(prev => prev.map(s => ({ ...s, status: 'pending', result: undefined, error: undefined })));
    setCurrentStep(0);

    try {
      toast.info('Iniciando sincronização completa...');

      // Executar cada step em sequência
      for (let i = 0; i < steps.length; i++) {
        await runSyncStep(steps[i], i);
        toast.success(`${steps[i].name} concluído!`);
      }

      toast.success('Sincronização completa! 🎉');
    } catch (error: any) {
      console.error('Erro na sincronização:', error);
      toast.error(`Erro: ${error.message || 'Falha na sincronização'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const getProgress = () => {
    const completed = steps.filter(s => s.status === 'success').length;
    return (completed / steps.length) * 100;
  };

  const getStepIcon = (status: SyncStep['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-destructive" />;
      case 'running':
        return <RefreshCw className="h-5 w-5 text-primary animate-spin" />;
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Sincronização com Clint CRM
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Sincronize dados em etapas otimizadas para evitar timeout
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={handleFullSync} 
          disabled={isSyncing}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {isSyncing ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Sincronizando...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Iniciar Sincronização Completa
            </>
          )}
        </Button>

        {isSyncing && (
          <div className="space-y-2">
            <Progress value={getProgress()} className="h-2" />
            <p className="text-sm text-muted-foreground text-center">
              {Math.round(getProgress())}% completo
            </p>
          </div>
        )}

        <div className="space-y-3 mt-4">
          {steps.map((step, index) => (
            <div
              key={step.endpoint}
              className={`flex items-center justify-between p-3 border rounded-lg ${
                step.status === 'running' ? 'border-primary bg-primary/5' : 'border-border'
              }`}
            >
              <div className="flex items-center gap-3">
                {getStepIcon(step.status)}
                <div>
                  <p className="font-medium text-foreground">{step.name}</p>
                  {step.result && (
                    <p className="text-xs text-muted-foreground">
                      {step.result.results?.groups_synced && `${step.result.results.groups_synced} grupos, `}
                      {step.result.results?.origins_synced && `${step.result.results.origins_synced} origens, `}
                      {step.result.results?.stages_synced && `${step.result.results.stages_synced} estágios`}
                      {step.result.results?.contacts_synced && `${step.result.results.contacts_synced} contatos`}
                      {step.result.results?.deals_synced && `${step.result.results.deals_synced} negócios`}
                      {step.result.results?.contacts_linked !== undefined && `${step.result.results.contacts_linked} vínculos`}
                    </p>
                  )}
                  {step.error && (
                    <p className="text-xs text-destructive">{step.error}</p>
                  )}
                </div>
              </div>
              {step.duration && (
                <span className="text-xs text-muted-foreground">
                  {(step.duration / 1000).toFixed(1)}s
                </span>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
