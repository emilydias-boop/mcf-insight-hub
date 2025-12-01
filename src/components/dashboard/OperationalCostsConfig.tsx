import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export function OperationalCostsConfig() {
  const queryClient = useQueryClient();
  const [teamCost, setTeamCost] = useState("");
  const [officeCost, setOfficeCost] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Generate month options for the last 12 months
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return {
      value: `${year}-${month}`,
      label: date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    };
  });

  const currentMonth = `${selectedMonth}-01`;
  
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
      
      // Format values with proper decimal handling (store as R$ 23162.50)
      setTeamCost(team?.amount ? (team.amount).toFixed(2) : "");
      setOfficeCost(office?.amount ? (office.amount).toFixed(2) : "");
      
      return { team, office };
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const updates = [];
      
      if (teamCost) {
        const amount = parseFloat(teamCost.replace(/[^\d.-]/g, ''));
        if (isNaN(amount)) {
          throw new Error('Custo de equipe inválido');
        }
        updates.push({
          month: currentMonth,
          cost_type: 'team',
          amount: amount,
          description: 'Custo mensal da equipe',
          is_recurring: true,
        });
      }
      
      if (officeCost) {
        const amount = parseFloat(officeCost.replace(/[^\d.-]/g, ''));
        if (isNaN(amount)) {
          throw new Error('Custo de escritório inválido');
        }
        updates.push({
          month: currentMonth,
          cost_type: 'office',
          amount: amount,
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
          <Label htmlFor="month-select">Mês de Referência</Label>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger id="month-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="team-cost">Custo Equipe (mensal)</Label>
          <Input
            id="team-cost"
            type="text"
            placeholder="Ex: 23162.50"
            value={teamCost}
            onChange={(e) => setTeamCost(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Valor total mensal da folha de pagamento da equipe (use ponto para decimais: 23162.50)
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="office-cost">Custo Escritório (mensal)</Label>
          <Input
            id="office-cost"
            type="text"
            placeholder="Ex: 5344.00"
            value={officeCost}
            onChange={(e) => setOfficeCost(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Aluguel, luz, internet e demais custos fixos do escritório (use ponto para decimais: 5344.00)
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
