import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCurrency } from '@/lib/formatters';
import { getDiasUteisMes } from '@/lib/businessDays';
import { RefreshCw, Edit2, Calendar, Plus, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface WorkingDay {
  id: string;
  ano_mes: string;
  dias_uteis_base: number;
  dias_uteis_final: number;
  feriados_nacionais: string[] | null;
  paradas_empresa: string[] | null;
  ifood_valor_dia: number;
  ifood_mensal_calculado: number | null;
  observacoes: string | null;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const formatMonthLabel = (anoMes: string) => {
  const [year, month] = anoMes.split('-');
  return `${MONTH_NAMES[parseInt(month) - 1]} ${year}`;
};

const EditWorkingDayDialog = ({ 
  workingDay, 
  onSuccess 
}: { 
  workingDay: WorkingDay; 
  onSuccess: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [diasUteisBase, setDiasUteisBase] = useState(workingDay.dias_uteis_base.toString());
  const [diasUteisFinal, setDiasUteisFinal] = useState(workingDay.dias_uteis_final.toString());
  const [ifoodValorDia, setIfoodValorDia] = useState(workingDay.ifood_valor_dia.toString());
  const [observacoes, setObservacoes] = useState(workingDay.observacoes || '');

  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<WorkingDay>) => {
      const { error } = await supabase
        .from('working_days_calendar')
        .update(data)
        .eq('id', workingDay.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['working-days-calendar'] });
      toast.success('Calendário atualizado com sucesso');
      setOpen(false);
      onSuccess();
    },
    onError: (error: any) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });

  const handleSubmit = () => {
    updateMutation.mutate({
      dias_uteis_base: parseInt(diasUteisBase),
      dias_uteis_final: parseInt(diasUteisFinal),
      ifood_valor_dia: parseFloat(ifoodValorDia),
      observacoes: observacoes || null,
    });
  };

  const calculatedIfood = parseInt(diasUteisFinal) * parseFloat(ifoodValorDia);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <Edit2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar {formatMonthLabel(workingDay.ano_mes)}</DialogTitle>
          <DialogDescription>
            Ajuste os dias úteis e valor iFood para este mês
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dias_base">Dias Úteis Base</Label>
              <Input
                id="dias_base"
                type="number"
                value={diasUteisBase}
                onChange={(e) => setDiasUteisBase(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dias_final">Dias Úteis Final</Label>
              <Input
                id="dias_final"
                type="number"
                value={diasUteisFinal}
                onChange={(e) => setDiasUteisFinal(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Após descontar feriados e paradas
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ifood_valor">Valor iFood/Dia (R$)</Label>
            <Input
              id="ifood_valor"
              type="number"
              step="0.01"
              value={ifoodValorDia}
              onChange={(e) => setIfoodValorDia(e.target.value)}
            />
          </div>
          <div className="p-3 bg-muted rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">iFood Mensal Calculado:</span>
              <span className="font-semibold">{formatCurrency(calculatedIfood)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {diasUteisFinal} dias × R$ {ifoodValorDia} = {formatCurrency(calculatedIfood)}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="obs">Observações</Label>
            <Input
              id="obs"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex: Carnaval, Recesso..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={updateMutation.isPending}>
            {updateMutation.isPending && <RefreshCw className="h-4 w-4 animate-spin mr-2" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const WorkingDaysCalendar = () => {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [selectedYearToAdd, setSelectedYearToAdd] = useState(currentYear.toString());

  const { data: workingDays, isLoading, refetch } = useQuery({
    queryKey: ['working-days-calendar'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('working_days_calendar')
        .select('*')
        .order('ano_mes', { ascending: true });
      if (error) throw error;
      return data as WorkingDay[];
    },
  });

  // Check if current year exists
  const hasCurrentYear = workingDays?.some(wd => wd.ano_mes.startsWith(String(currentYear)));

  // Get available years to add (current + next 2 years that don't exist yet)
  const existingYears = new Set(workingDays?.map(wd => wd.ano_mes.split('-')[0]) || []);
  const availableYearsToAdd = [currentYear, currentYear + 1, currentYear + 2]
    .filter(y => !existingYears.has(String(y)));

  // Mutation to generate year data
  const addYearMutation = useMutation({
    mutationFn: async (year: number) => {
      const months = [];
      for (let month = 0; month < 12; month++) {
        const date = new Date(year, month, 1);
        const anoMes = `${year}-${String(month + 1).padStart(2, '0')}`;
        const diasUteis = getDiasUteisMes(date);
        
        months.push({
          ano_mes: anoMes,
          dias_uteis_base: diasUteis,
          dias_uteis_final: diasUteis,
          ifood_valor_dia: 30, // Default value
          observacoes: `${MONTH_NAMES[month]} ${year}`,
        });
      }
      
      const { error } = await supabase
        .from('working_days_calendar')
        .upsert(months, { onConflict: 'ano_mes' });
      
      if (error) throw error;
      return year;
    },
    onSuccess: (year) => {
      queryClient.invalidateQueries({ queryKey: ['working-days-calendar'] });
      toast.success(`Calendário de ${year} gerado com sucesso!`);
    },
    onError: (error: any) => {
      toast.error(`Erro ao gerar calendário: ${error.message}`);
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Calendário de Dias Úteis</CardTitle>
              <CardDescription>
                Configure dias úteis e valor iFood por mês. O iFood Mensal é calculado automaticamente.
              </CardDescription>
            </div>
          </div>
          
          {availableYearsToAdd.length > 0 && (
            <div className="flex items-center gap-2">
              <Select value={selectedYearToAdd} onValueChange={setSelectedYearToAdd}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableYearsToAdd.map(year => (
                    <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                onClick={() => addYearMutation.mutate(parseInt(selectedYearToAdd))}
                disabled={addYearMutation.isPending}
                size="sm"
              >
                {addYearMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Adicionar Ano
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Alert if current year is missing */}
        {!hasCurrentYear && (
          <Alert variant="destructive" className="bg-yellow-500/10 border-yellow-500/30 text-yellow-400">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="flex items-center gap-2">
              <span>O calendário não possui dados para {currentYear}.</span>
              <Button 
                variant="link" 
                className="p-0 h-auto text-yellow-400 underline"
                onClick={() => addYearMutation.mutate(currentYear)}
                disabled={addYearMutation.isPending}
              >
                Clique aqui para adicionar
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mês</TableHead>
              <TableHead className="text-center">Dias Base</TableHead>
              <TableHead className="text-center">Dias Final</TableHead>
              <TableHead className="text-right">R$/Dia</TableHead>
              <TableHead className="text-right">iFood Mensal</TableHead>
              <TableHead>Observações</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workingDays?.map((wd) => (
              <TableRow key={wd.id}>
                <TableCell className="font-medium">
                  {formatMonthLabel(wd.ano_mes)}
                </TableCell>
                <TableCell className="text-center">{wd.dias_uteis_base}</TableCell>
                <TableCell className="text-center">{wd.dias_uteis_final}</TableCell>
                <TableCell className="text-right">{formatCurrency(wd.ifood_valor_dia)}</TableCell>
                <TableCell className="text-right font-semibold">
                  {formatCurrency(wd.ifood_mensal_calculado || 0)}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                  {wd.observacoes || '-'}
                </TableCell>
                <TableCell>
                  <EditWorkingDayDialog workingDay={wd} onSuccess={() => refetch()} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
