import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Download, Plus, Trash2, BookOpen } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useExam, useExamScores, useCreateScore, useDeleteScore, ExamScore } from '@/hooks/useExams';
import EmployeeSearchCombobox from '@/components/hr/exams/EmployeeSearchCombobox';
import ExamMetrics from '@/components/hr/exams/ExamMetrics';
import { exportExamScores } from '@/lib/exportExamScores';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

function getNotaBadgeVariant(nota: number): 'default' | 'secondary' | 'destructive' {
  if (nota >= 7) return 'default';
  if (nota >= 5) return 'secondary';
  return 'destructive';
}

export default function ExamDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: exam, isLoading: loadingExam } = useExam(id || null);
  const { data: scores = [], isLoading: loadingScores } = useExamScores(id || null);
  const createScore = useCreateScore();
  const deleteScore = useDeleteScore();

  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [nota, setNota] = useState('');
  const [observacao, setObservacao] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  if (loadingExam) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Carregando...</div>;
  }

  if (!exam) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-muted-foreground">Prova não encontrada</p>
        <Button variant="outline" onClick={() => navigate('/rh/prova-equipe')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
      </div>
    );
  }

  const media = scores.length > 0
    ? scores.reduce((acc, s) => acc + Number(s.nota), 0) / scores.length
    : null;

  const evaluatedEmployeeIds = scores.map(s => s.employee_id);

  const handleAddScore = async () => {
    if (!selectedEmployeeId || !nota) return;
    const notaNum = parseFloat(nota);
    if (isNaN(notaNum) || notaNum < 0 || notaNum > 10) return;

    await createScore.mutateAsync({
      exam_id: exam.id,
      employee_id: selectedEmployeeId,
      nota: notaNum,
      observacao: observacao || undefined,
    });
    setSelectedEmployeeId(null);
    setNota('');
    setObservacao('');
    setShowAddForm(false);
  };

  const handleDelete = () => {
    if (deleteConfirmId) {
      deleteScore.mutate(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  const handleCreatePdi = async (score: ExamScore) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase.from('employee_pdi').insert({
        employee_id: score.employee_id,
        titulo: `Desenvolvimento - ${exam.titulo}`,
        descricao: `PDI criado a partir da prova "${exam.titulo}" com nota ${Number(score.nota).toFixed(1)}. ${score.observacao || ''}`.trim(),
        categoria: 'competencia',
        status: 'nao_iniciado',
        prioridade: Number(score.nota) < 5 ? 'alta' : 'media',
        created_by: user.user?.id,
      });
      if (error) throw error;
      toast({ title: 'PDI criado com sucesso!' });
    } catch (err: any) {
      toast({ title: 'Erro ao criar PDI', description: err.message, variant: 'destructive' });
    }
  };

  const lowScores = scores.filter(s => Number(s.nota) < 7);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/rh/prova-equipe')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{exam.titulo}</h1>
            {exam.descricao && <p className="text-muted-foreground mt-1">{exam.descricao}</p>}
            <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
              <span>{format(new Date(exam.data_aplicacao), "dd/MM/yyyy", { locale: ptBR })}</span>
              <span>•</span>
              <span>{scores.length} participante{scores.length !== 1 ? 's' : ''}</span>
              {media != null && (
                <>
                  <span>•</span>
                  <span>Média: <Badge variant={getNotaBadgeVariant(media)} className="ml-1">{media.toFixed(1)}</Badge></span>
                </>
              )}
            </div>
          </div>
        </div>
        <Button variant="outline" onClick={() => exportExamScores(exam, scores)} disabled={scores.length === 0}>
          <Download className="h-4 w-4 mr-2" /> Exportar XLSX
        </Button>
      </div>

      {/* Métricas */}
      <ExamMetrics scores={scores} />

      {/* Participantes */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Participantes</CardTitle>
          {!showAddForm && (
            <Button variant="outline" size="sm" onClick={() => setShowAddForm(true)}>
              <Plus className="h-4 w-4 mr-2" /> Adicionar
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {showAddForm && (
            <div className="p-4 border rounded-lg space-y-3 bg-muted/30 mb-4">
              <EmployeeSearchCombobox
                value={selectedEmployeeId}
                onChange={setSelectedEmployeeId}
                excludeIds={evaluatedEmployeeIds}
              />
              <div className="flex gap-2">
                <Input type="number" placeholder="Nota (0-10)" min={0} max={10} step={0.1}
                  value={nota} onChange={(e) => setNota(e.target.value)} className="w-28" />
                <Input placeholder="Observação (opcional)" value={observacao}
                  onChange={(e) => setObservacao(e.target.value)} className="flex-1" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setShowAddForm(false); setSelectedEmployeeId(null); setNota(''); setObservacao(''); }}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleAddScore} disabled={!selectedEmployeeId || !nota || createScore.isPending}>
                  {createScore.isPending ? 'Salvando...' : 'Salvar Nota'}
                </Button>
              </div>
            </div>
          )}

          {loadingScores ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : scores.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhuma nota registrada.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium text-muted-foreground">#</th>
                    <th className="pb-2 font-medium text-muted-foreground">Colaborador</th>
                    <th className="pb-2 font-medium text-muted-foreground">Cargo</th>
                    <th className="pb-2 font-medium text-muted-foreground">Squad</th>
                    <th className="pb-2 font-medium text-muted-foreground">Nota</th>
                    <th className="pb-2 font-medium text-muted-foreground">Observação</th>
                    <th className="pb-2 font-medium text-muted-foreground">Data</th>
                    <th className="pb-2 font-medium text-muted-foreground"></th>
                  </tr>
                </thead>
                <tbody>
                  {[...scores].sort((a, b) => Number(b.nota) - Number(a.nota)).map((score, i) => (
                    <tr key={score.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-3 pr-2 text-muted-foreground">{i + 1}</td>
                      <td className="py-3 pr-2 font-medium">{score.employee?.nome_completo || 'N/A'}</td>
                      <td className="py-3 pr-2 text-muted-foreground">{score.employee?.cargo || '-'}</td>
                      <td className="py-3 pr-2 text-muted-foreground">{score.employee?.squad || '-'}</td>
                      <td className="py-3 pr-2">
                        <Badge variant={getNotaBadgeVariant(Number(score.nota))} className="text-sm px-2">
                          {Number(score.nota).toFixed(1)}
                        </Badge>
                      </td>
                      <td className="py-3 pr-2 text-muted-foreground max-w-[200px] truncate">{score.observacao || '-'}</td>
                      <td className="py-3 pr-2 text-muted-foreground">{format(new Date(score.created_at), 'dd/MM/yy')}</td>
                      <td className="py-3">
                        <Button variant="ghost" size="icon" onClick={() => setDeleteConfirmId(score.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Integração PDI */}
      {lowScores.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <BookOpen className="h-4 w-4" />
              Sugestões de PDI (nota {'<'} 7)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {lowScores.map(score => (
              <div key={score.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <span className="font-medium">{score.employee?.nome_completo || 'N/A'}</span>
                  <span className="text-muted-foreground ml-2">— Nota: {Number(score.nota).toFixed(1)}</span>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleCreatePdi(score)}>
                  Criar PDI
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover nota?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
