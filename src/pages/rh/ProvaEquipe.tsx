import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useExams, useDeleteExam } from '@/hooks/useExams';
import ExamFormDialog from '@/components/hr/exams/ExamFormDialog';
import ExamStatsCards from '@/components/hr/exams/ExamStatsCards';
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

export default function ProvaEquipe() {
  const { data: exams = [], isLoading } = useExams();
  const deleteExam = useDeleteExam();
  const navigate = useNavigate();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleDelete = () => {
    if (deleteConfirmId) {
      deleteExam.mutate(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Prova Equipe</h1>
          <p className="text-muted-foreground">
            Avaliações, notas e desenvolvimento da equipe
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Prova
        </Button>
      </div>

      {/* Stats Cards */}
      <ExamStatsCards />

      {/* Lista de Provas */}
      <Card>
        <CardHeader>
          <CardTitle>Provas Recentes</CardTitle>
          <CardDescription>Clique em uma prova para ver detalhes e notas</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : exams.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma prova cadastrada. Clique em "Nova Prova" para começar.
            </div>
          ) : (
            <div className="space-y-2">
              {exams.map((exam) => (
                <div
                  key={exam.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/rh/prova-equipe/${exam.id}`)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{exam.titulo}</div>
                    {exam.descricao && (
                      <div className="text-sm text-muted-foreground truncate max-w-md">{exam.descricao}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 ml-4 shrink-0">
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(exam.data_aplicacao), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                    <Badge variant="secondary">{exam.participantes_count || 0} part.</Badge>
                    {exam.media != null ? (
                      <Badge variant={getNotaBadgeVariant(exam.media)}>
                        Média {exam.media.toFixed(1)}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Sem notas</Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(exam.id); }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ExamFormDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover prova?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação irá arquivar a prova. As notas serão mantidas no histórico.</AlertDialogDescription>
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
