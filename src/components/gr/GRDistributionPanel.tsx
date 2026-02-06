import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Settings, Loader2 } from 'lucide-react';

interface GRDistributionPanelProps {
  open: boolean;
  onClose: () => void;
}

export const GRDistributionPanel = ({ open, onClose }: GRDistributionPanelProps) => {
  const queryClient = useQueryClient();
  
  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['gr-distribution-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gr_distribution_rules')
        .select('*')
        .order('bu');
      
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });
  
  const updateRule = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const { error } = await supabase
        .from('gr_distribution_rules')
        .update(data)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gr-distribution-rules'] });
      toast.success('Configuração atualizada');
    },
    onError: (error: any) => {
      toast.error(`Erro: ${error.message}`);
    },
  });
  
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuração de Distribuição
          </SheetTitle>
        </SheetHeader>
        
        <div className="mt-6 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : rules.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma regra configurada
            </p>
          ) : (
            rules.map(rule => (
              <Card key={rule.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>{rule.bu.toUpperCase()}</span>
                    <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                      {rule.is_active ? 'Ativa' : 'Inativa'}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Distribuição Ativa</Label>
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={(checked) => updateRule.mutate({ id: rule.id, is_active: checked })}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Modo</Label>
                    <Select 
                      value={rule.mode}
                      onValueChange={(value) => updateRule.mutate({ id: rule.id, mode: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="automatico">Automático</SelectItem>
                        <SelectItem value="manual">Manual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Tipo de Balanceamento</Label>
                    <Select 
                      value={rule.balance_type}
                      onValueChange={(value) => updateRule.mutate({ id: rule.id, balance_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="capacity">Por Capacidade</SelectItem>
                        <SelectItem value="equal">Igualitário</SelectItem>
                        <SelectItem value="weighted">Ponderado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
