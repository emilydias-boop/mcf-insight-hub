import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export function OperationalCostsConfig() {
  const queryClient = useQueryClient();
  const [teamCost, setTeamCost] = useState("");
  const [officeCost, setOfficeCost] = useState("");

  // Buscar custos do mês atual
  const currentMonth = new Date().toISOString().split('T')[0].slice(0, 7) + '-01';
  
  const { data: costs, isLoading } = useQuery({
    queryKey: ['operational-costs', currentMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operational_costs')
        .select('*')
        .eq('month', currentMonth);
      
      if (error) throw error;
      
      const team = data?.find(c => c.cost_type === 'team');
      const office = data?.find(c => c.cost_type === 'office');
      
      setTeamCost(team?.amount?.toString() || "");
      setOfficeCost(office?.amount?.toString() || "");
      
      return { team, office };
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const updates = [];
      
      if (teamCost) {
        updates.push({
          month: currentMonth,
          cost_type: 'team',
          amount: parseFloat(teamCost),
          description: 'Custo mensal da equipe',
          is_recurring: true,
        });
      }
      
      if (officeCost) {
        updates.push({
          month: currentMonth,
          cost_type: 'office',
          amount: parseFloat(officeCost),
          description: 'Custo mensal do escritório',
          is_recurring: true,
        });
      }

      const { error } = await supabase
        .from('operational_costs')
        .upsert(updates, {
          onConflict: 'month,cost_type',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operational-costs'] });
      toast.success('Custos operacionais salvos com sucesso');
    },
    onError: (error: Error) => {
      toast.error('Erro ao salvar custos: ' + error.message);
    },
  });

  const handleSave = () => {
    if (!teamCost && !officeCost) {
      toast.error('Preencha pelo menos um dos custos');
      return;
    }
    saveMutation.mutate();
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Custos Operacionais Mensais</CardTitle>
        <CardDescription>
          Configure os custos fixos que serão divididos por 4 semanas nas métricas semanais
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="team-cost">Custo Equipe (mensal)</Label>
          <Input
            id="team-cost"
            type="number"
            placeholder="Ex: 50000"
            value={teamCost}
            onChange={(e) => setTeamCost(e.target.value)}
            step="0.01"
          />
          <p className="text-xs text-muted-foreground">
            Valor total mensal da folha de pagamento da equipe
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="office-cost">Custo Escritório (mensal)</Label>
          <Input
            id="office-cost"
            type="number"
            placeholder="Ex: 15000"
            value={officeCost}
            onChange={(e) => setOfficeCost(e.target.value)}
            step="0.01"
          />
          <p className="text-xs text-muted-foreground">
            Aluguel, luz, internet e demais custos fixos do escritório
          </p>
        </div>

        <Button 
          onClick={handleSave} 
          disabled={saveMutation.isPending}
          className="w-full"
        >
          {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar Custos
        </Button>
      </CardContent>
    </Card>
  );
}
