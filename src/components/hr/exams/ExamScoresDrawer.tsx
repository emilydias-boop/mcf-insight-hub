import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Exam, useExamScores, useCreateScore, useDeleteScore } from '@/hooks/useExams';
import EmployeeSearchCombobox from './EmployeeSearchCombobox';

interface ExamScoresDrawerProps {
  exam: Exam | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ExamScoresDrawer({ exam, open, onOpenChange }: ExamScoresDrawerProps) {
  const { data: scores = [], isLoading } = useExamScores(exam?.id || null);
  const createScore = useCreateScore();
  const deleteScore = useDeleteScore();

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [nota, setNota] = useState('');
  const [observacao, setObservacao] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  if (!exam) return null;

  const handleAddScore = async () => {
    if (!selectedEmployeeId || !nota) return;

    const notaNum = parseFloat(nota);
    if (isNaN(notaNum) || notaNum < 0 || notaNum > 10) {
      return;
    }

    await createScore.mutateAsync({
      exam_id: exam.id,
      employee_id: selectedEmployeeId,
      nota: notaNum,
      observacao: observacao || undefined,
    });

    // Reset form
    setSelectedEmployeeId(null);
    setNota('');
    setObservacao('');
    setShowAddForm(false);
  };

  const handleRemoveScore = (scoreId: string) => {
    deleteScore.mutate(scoreId);
  };

  // Calcular média
  const media = scores.length > 0
    ? (scores.reduce((acc, s) => acc + Number(s.nota), 0) / scores.length).toFixed(1)
    : '-';

  // IDs de colaboradores já avaliados
  const evaluatedEmployeeIds = scores.map(s => s.employee_id);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="text-xl">{exam.titulo}</SheetTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{format(new Date(exam.data_aplicacao), "dd/MM/yyyy", { locale: ptBR })}</span>
            <span>•</span>
            <span>{scores.length} participante{scores.length !== 1 ? 's' : ''}</span>
            <span>•</span>
            <span>Média: {media}</span>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Botão para adicionar */}
          {!showAddForm && (
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={() => setShowAddForm(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Participante
            </Button>
          )}

          {/* Form de adicionar nota */}
          {showAddForm && (
            <div className="p-4 border rounded-lg space-y-3 bg-muted/30">
              <EmployeeSearchCombobox
                value={selectedEmployeeId}
                onChange={setSelectedEmployeeId}
                excludeIds={evaluatedEmployeeIds}
              />
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Nota (0-10)"
                  min={0}
                  max={10}
                  step={0.1}
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  className="w-28"
                />
                <Input
                  placeholder="Observação (opcional)"
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  className="flex-1"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowAddForm(false);
                    setSelectedEmployeeId(null);
                    setNota('');
                    setObservacao('');
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleAddScore}
                  disabled={!selectedEmployeeId || !nota || createScore.isPending}
                >
                  {createScore.isPending ? 'Salvando...' : 'Salvar Nota'}
                </Button>
              </div>
            </div>
          )}

          {/* Lista de notas */}
          <div className="space-y-2">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : scores.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma nota registrada ainda.
              </div>
            ) : (
              scores.map((score) => (
                <div
                  key={score.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="font-medium">
                      {score.employee?.nome_completo || 'Colaborador não encontrado'}
                    </div>
                    {score.employee?.cargo && (
                      <div className="text-xs text-muted-foreground">{score.employee.cargo}</div>
                    )}
                    {score.observacao && (
                      <div className="text-sm text-muted-foreground mt-1">
                        "{score.observacao}"
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={Number(score.nota) >= 7 ? 'default' : Number(score.nota) >= 5 ? 'secondary' : 'destructive'}
                      className="text-lg px-3 py-1"
                    >
                      {Number(score.nota).toFixed(1)}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveScore(score.id)}
                      disabled={deleteScore.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
