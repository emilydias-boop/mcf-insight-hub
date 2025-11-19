import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface SyncStep {
  name: string;
  endpoint?: string;
  status: 'pending' | 'running' | 'success' | 'error';
  result?: any;
  error?: string;
  duration?: number;
  origin_id?: string;
  type?: 'global' | 'origin';
}

export const SyncControls = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<SyncStep[]>([
    { name: 'Origens e Estágios', endpoint: 'sync-origins-stages', status: 'pending', type: 'global' },
  ]);

  const runSyncStep = async (step: SyncStep, index: number) => {
    setCurrentStep(index);
    
    // Atualizar status para running
    setSteps(prev => prev.map((s, i) => 
      i === index ? { ...s, status: 'running' } : s
    ));

    const startTime = Date.now();

    try {
      let data;
      
      if (step.type === 'origin' && step.origin_id) {
        // Sincronizar origin específica
        const result = await supabase.functions.invoke('sync-by-origin', {
          body: { origin_id: step.origin_id }
        });
        if (result.error) throw result.error;
        data = result.data;
      } else if (step.endpoint) {
        // Sincronizar endpoint global
        const result = await supabase.functions.invoke(step.endpoint);
        if (result.error) throw result.error;
        data = result.data;
      }

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
    setCurrentStep(0);

    try {
      toast.info('Iniciando sincronização completa...');

      // Passo 1: Criar steps iniciais globais
      const initialSteps: SyncStep[] = [
        { 
          name: 'Origens e Estágios', 
          endpoint: 'sync-origins-stages', 
          status: 'pending', 
          type: 'global' 
        },
        { 
          name: 'Todos os Contatos', 
          endpoint: 'sync-contacts', 
          status: 'pending', 
          type: 'global' 
        }
      ];

      setSteps(initialSteps);

      // Passo 1: Sincronizar origins e stages
      await runSyncStep(initialSteps[0], 0);
      toast.success('Origens e estágios sincronizados!');

      // Passo 2: Sincronizar TODOS os contatos (100k+)
      await runSyncStep(initialSteps[1], 1);
      toast.success('Contatos sincronizados!');

      // Passo 3: Buscar lista de origins
      const { data: origins, error: originsError } = await supabase
        .from('crm_origins')
        .select('id, name')
        .order('name');

      if (originsError) throw originsError;

      if (!origins || origins.length === 0) {
        toast.warning('Nenhuma origem encontrada');
        return;
      }

      // Passo 4: Criar steps para cada origin
      const originSteps: SyncStep[] = origins.map(origin => ({
        name: origin.name,
        status: 'pending',
        type: 'origin',
        origin_id: origin.id,
      }));

      setSteps(prev => [...prev, ...originSteps]);

      // Passo 5: Sincronizar cada origin
      for (let i = 0; i < originSteps.length; i++) {
        const stepIndex = 2 + i; // +2 porque temos 2 steps globais agora
        await runSyncStep(originSteps[i], stepIndex);
        toast.success(`${originSteps[i].name} sincronizado!`);
      }

      // Passo 6: Vincular contacts aos deals
      const linkStep: SyncStep = {
        name: 'Vincular Contatos aos Deals',
        endpoint: 'sync-link-contacts',
        status: 'pending',
        type: 'global',
      };

      setSteps(prev => [...prev, linkStep]);
      const linkIndex = 2 + originSteps.length;
      await runSyncStep(linkStep, linkIndex);

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
                      {step.type === 'origin' ? (
                        <>
                          {step.result.results?.contacts_synced || 0} contatos, {step.result.results?.deals_synced || 0} negócios
                        </>
                      ) : (
                        <>
                          {step.result.results?.groups_synced && `${step.result.results.groups_synced} grupos, `}
                          {step.result.results?.origins_synced && `${step.result.results.origins_synced} origens, `}
                          {step.result.results?.stages_synced && `${step.result.results.stages_synced} estágios`}
                          {step.result.results?.contacts_linked !== undefined && `${step.result.results.contacts_linked} vínculos`}
                        </>
                      )}
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
