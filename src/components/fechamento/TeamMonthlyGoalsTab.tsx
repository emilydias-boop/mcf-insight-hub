import { useState, useEffect } from 'react';
import { format, addMonths, subMonths, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  ChevronLeft, 
  ChevronRight, 
  Copy, 
  Save, 
  Target,
  Loader2,
  Trophy,
  Star,
} from 'lucide-react';
import { 
  useTeamMonthlyGoals, 
  useUpsertTeamMonthlyGoals,
  useCopyGoalsFromPreviousMonth,
  DEFAULT_GOAL_VALUES,
} from '@/hooks/useTeamMonthlyGoals';
import { formatCurrency } from '@/lib/formatters';

const BU_OPTIONS = [
  { value: 'incorporador', label: 'Incorporador' },
  { value: 'consorcio', label: 'Consórcio' },
  { value: 'credito', label: 'Crédito' },
  { value: 'leilao', label: 'Leilão' },
];

interface GoalFormData {
  meta_valor: string;
  meta_premio_ifood: string;
  supermeta_valor: string;
  supermeta_premio_ifood: string;
  ultrameta_valor: string;
  ultrameta_premio_ifood: string;
  meta_divina_valor: string;
  meta_divina_premio_sdr: string;
  meta_divina_premio_closer: string;
}

const formatNumberForInput = (value: number) => String(value);

interface TeamMonthlyGoalsTabProps {
  defaultBU?: string;
  lockBU?: boolean;
}

export function TeamMonthlyGoalsTab({ defaultBU, lockBU }: TeamMonthlyGoalsTabProps) {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [selectedBu, setSelectedBu] = useState(defaultBU || 'incorporador');
  const [formData, setFormData] = useState<GoalFormData>({
    meta_valor: formatNumberForInput(DEFAULT_GOAL_VALUES.meta_valor),
    meta_premio_ifood: formatNumberForInput(DEFAULT_GOAL_VALUES.meta_premio_ifood),
    supermeta_valor: formatNumberForInput(DEFAULT_GOAL_VALUES.supermeta_valor),
    supermeta_premio_ifood: formatNumberForInput(DEFAULT_GOAL_VALUES.supermeta_premio_ifood),
    ultrameta_valor: formatNumberForInput(DEFAULT_GOAL_VALUES.ultrameta_valor),
    ultrameta_premio_ifood: formatNumberForInput(DEFAULT_GOAL_VALUES.ultrameta_premio_ifood),
    meta_divina_valor: formatNumberForInput(DEFAULT_GOAL_VALUES.meta_divina_valor),
    meta_divina_premio_sdr: formatNumberForInput(DEFAULT_GOAL_VALUES.meta_divina_premio_sdr),
    meta_divina_premio_closer: formatNumberForInput(DEFAULT_GOAL_VALUES.meta_divina_premio_closer),
  });

  // Sync with defaultBU prop
  useEffect(() => {
    if (defaultBU) setSelectedBu(defaultBU);
  }, [defaultBU]);

  const { data: existingGoal, isLoading } = useTeamMonthlyGoals(selectedMonth, selectedBu);
  const upsertGoals = useUpsertTeamMonthlyGoals();
  const copyFromPrevious = useCopyGoalsFromPreviousMonth();

  // Update form when existing goal is loaded
  useEffect(() => {
    if (existingGoal) {
      setFormData({
        meta_valor: formatNumberForInput(existingGoal.meta_valor || 0),
        meta_premio_ifood: formatNumberForInput(existingGoal.meta_premio_ifood || 0),
        supermeta_valor: formatNumberForInput(existingGoal.supermeta_valor || 0),
        supermeta_premio_ifood: formatNumberForInput(existingGoal.supermeta_premio_ifood || 0),
        ultrameta_valor: formatNumberForInput(existingGoal.ultrameta_valor || 0),
        ultrameta_premio_ifood: formatNumberForInput(existingGoal.ultrameta_premio_ifood || 0),
        meta_divina_valor: formatNumberForInput(existingGoal.meta_divina_valor || 0),
        meta_divina_premio_sdr: formatNumberForInput(existingGoal.meta_divina_premio_sdr || 0),
        meta_divina_premio_closer: formatNumberForInput(existingGoal.meta_divina_premio_closer || 0),
      });
    } else {
      setFormData({
        meta_valor: formatNumberForInput(DEFAULT_GOAL_VALUES.meta_valor),
        meta_premio_ifood: formatNumberForInput(DEFAULT_GOAL_VALUES.meta_premio_ifood),
        supermeta_valor: formatNumberForInput(DEFAULT_GOAL_VALUES.supermeta_valor),
        supermeta_premio_ifood: formatNumberForInput(DEFAULT_GOAL_VALUES.supermeta_premio_ifood),
        ultrameta_valor: formatNumberForInput(DEFAULT_GOAL_VALUES.ultrameta_valor),
        ultrameta_premio_ifood: formatNumberForInput(DEFAULT_GOAL_VALUES.ultrameta_premio_ifood),
        meta_divina_valor: formatNumberForInput(DEFAULT_GOAL_VALUES.meta_divina_valor),
        meta_divina_premio_sdr: formatNumberForInput(DEFAULT_GOAL_VALUES.meta_divina_premio_sdr),
        meta_divina_premio_closer: formatNumberForInput(DEFAULT_GOAL_VALUES.meta_divina_premio_closer),
      });
    }
  }, [existingGoal]);

  const handleMonthChange = (direction: 'prev' | 'next') => {
    const currentDate = parse(selectedMonth, 'yyyy-MM', new Date());
    const newDate = direction === 'prev' 
      ? subMonths(currentDate, 1) 
      : addMonths(currentDate, 1);
    setSelectedMonth(format(newDate, 'yyyy-MM'));
  };

  const handleInputChange = (field: keyof GoalFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    const meta = Number(formData.meta_valor);
    const supermeta = Number(formData.supermeta_valor);
    const ultrameta = Number(formData.ultrameta_valor);
    const divina = Number(formData.meta_divina_valor);

    if (meta >= supermeta || supermeta >= ultrameta || ultrameta >= divina) {
      const { toast } = await import('sonner');
      toast.error('Os valores das metas devem ser crescentes: Meta < Supermeta < Ultrameta < Meta Divina');
      return;
    }

    await upsertGoals.mutateAsync({
      ano_mes: selectedMonth,
      bu: selectedBu,
      meta_valor: Number(formData.meta_valor),
      meta_premio_ifood: Number(formData.meta_premio_ifood),
      supermeta_valor: Number(formData.supermeta_valor),
      supermeta_premio_ifood: Number(formData.supermeta_premio_ifood),
      ultrameta_valor: Number(formData.ultrameta_valor),
      ultrameta_premio_ifood: Number(formData.ultrameta_premio_ifood),
      meta_divina_valor: Number(formData.meta_divina_valor),
      meta_divina_premio_sdr: Number(formData.meta_divina_premio_sdr),
      meta_divina_premio_closer: Number(formData.meta_divina_premio_closer),
    });
  };

  const handleCopyFromPrevious = async () => {
    await copyFromPrevious.mutateAsync({
      targetAnoMes: selectedMonth,
      bu: selectedBu,
    });
  };

  const displayMonth = format(parse(selectedMonth, 'yyyy-MM', new Date()), 'MMMM yyyy', { locale: ptBR });
  const buLabel = BU_OPTIONS.find(o => o.value === selectedBu)?.label || selectedBu;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Metas Mensais da Equipe
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Month and BU selectors */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => handleMonthChange('prev')}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[140px] text-center font-medium capitalize">
                {displayMonth}
              </span>
              <Button variant="outline" size="icon" onClick={() => handleMonthChange('next')}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {lockBU ? (
              <Badge variant="outline" className="text-sm px-3 py-1">{buLabel}</Badge>
            ) : (
              <div className="flex items-center gap-2">
                <Label>BU:</Label>
                <Select value={selectedBu} onValueChange={setSelectedBu}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BU_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {existingGoal && (
              <span className="text-xs text-green-500 bg-green-500/10 px-2 py-1 rounded">
                Configurado
              </span>
            )}

            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>

          {/* Goals table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Nível</TableHead>
                  <TableHead className="w-[200px]">Valor Meta</TableHead>
                  <TableHead>Premiação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Meta */}
                <TableRow>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-yellow-500" />
                      <span className="font-medium">Meta</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground text-sm">R$</span>
                      <Input type="number" value={formData.meta_valor} onChange={(e) => handleInputChange('meta_valor', e.target.value)} className="w-32" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">iFood:</span>
                      <span className="text-muted-foreground text-sm">R$</span>
                      <Input type="number" value={formData.meta_premio_ifood} onChange={(e) => handleInputChange('meta_premio_ifood', e.target.value)} className="w-24" />
                    </div>
                  </TableCell>
                </TableRow>

                {/* Supermeta */}
                <TableRow>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-orange-500" />
                      <span className="font-medium">Supermeta</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground text-sm">R$</span>
                      <Input type="number" value={formData.supermeta_valor} onChange={(e) => handleInputChange('supermeta_valor', e.target.value)} className="w-32" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">iFood:</span>
                      <span className="text-muted-foreground text-sm">R$</span>
                      <Input type="number" value={formData.supermeta_premio_ifood} onChange={(e) => handleInputChange('supermeta_premio_ifood', e.target.value)} className="w-24" />
                    </div>
                  </TableCell>
                </TableRow>

                {/* Ultrameta */}
                <TableRow className="bg-red-500/5">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-red-500" />
                      <span className="font-medium text-red-500">Ultrameta</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground text-sm">R$</span>
                      <Input type="number" value={formData.ultrameta_valor} onChange={(e) => handleInputChange('ultrameta_valor', e.target.value)} className="w-32" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">iFood (todos):</span>
                      <span className="text-muted-foreground text-sm">R$</span>
                      <Input type="number" value={formData.ultrameta_premio_ifood} onChange={(e) => handleInputChange('ultrameta_premio_ifood', e.target.value)} className="w-24" />
                    </div>
                  </TableCell>
                </TableRow>

                {/* Meta Divina */}
                <TableRow className="bg-purple-500/5">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-purple-500" />
                      <span className="font-medium text-purple-500">Meta Divina</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground text-sm">R$</span>
                      <Input type="number" value={formData.meta_divina_valor} onChange={(e) => handleInputChange('meta_divina_valor', e.target.value)} className="w-32" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">SDR:</span>
                        <span className="text-muted-foreground text-sm">R$</span>
                        <Input type="number" value={formData.meta_divina_premio_sdr} onChange={(e) => handleInputChange('meta_divina_premio_sdr', e.target.value)} className="w-28" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Closer:</span>
                        <span className="text-muted-foreground text-sm">R$</span>
                        <Input type="number" value={formData.meta_divina_premio_closer} onChange={(e) => handleInputChange('meta_divina_premio_closer', e.target.value)} className="w-28" />
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* Info box */}
          <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 space-y-1">
            <p><strong>Ultrameta:</strong> Se batida, libera R$ {formatCurrency(Number(formData.ultrameta_premio_ifood))} de iFood para <strong>todos</strong> da equipe.</p>
            <p><strong>Meta Divina:</strong> O melhor SDR recebe R$ {formatCurrency(Number(formData.meta_divina_premio_sdr))} e o melhor Closer recebe R$ {formatCurrency(Number(formData.meta_divina_premio_closer))}.</p>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap justify-between gap-3">
            <Button 
              variant="outline"
              onClick={handleCopyFromPrevious}
              disabled={copyFromPrevious.isPending}
            >
              {copyFromPrevious.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Copy className="h-4 w-4 mr-2" />
              )}
              Copiar do Mês Anterior
            </Button>

            <Button 
              onClick={handleSave}
              disabled={upsertGoals.isPending}
            >
              {upsertGoals.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
