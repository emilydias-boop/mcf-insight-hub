import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, ClipboardList, Users, Calendar, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useExams, useDeleteExam, Exam } from '@/hooks/useExams';
import ExamFormDialog from '@/components/hr/exams/ExamFormDialog';
import ExamScoresDrawer from '@/components/hr/exams/ExamScoresDrawer';
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

export default function ProvaEquipe() {
  const { data: exams = [], isLoading } = useExams();
  const deleteExam = useDeleteExam();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleExamClick = (exam: Exam) => {
    setSelectedExam(exam);
    setDrawerOpen(true);
  };

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
            Registre notas de provas e avaliações da equipe
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Prova
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Provas</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{exams.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Avaliações</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {exams.reduce((acc, e) => acc + (e.participantes_count || 0), 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Última Prova</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {exams[0]
                ? format(new Date(exams[0].data_aplicacao), 'dd/MM', { locale: ptBR })
                : '-'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Provas */}
      <Card>
        <CardHeader>
          <CardTitle>Provas Recentes</CardTitle>
          <CardDescription>
            Clique em uma prova para registrar ou ver as notas
          </CardDescription>
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
                  onClick={() => handleExamClick(exam)}
                >
                  <div className="flex-1">
                    <div className="font-medium">{exam.titulo}</div>
                    {exam.descricao && (
                      <div className="text-sm text-muted-foreground truncate max-w-md">
                        {exam.descricao}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(exam.data_aplicacao), "dd/MM/yyyy", { locale: ptBR })}
                    </div>
                    <Badge variant="secondary">
                      {exam.participantes_count || 0} participantes
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmId(exam.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Nova Prova */}
      <ExamFormDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      {/* Drawer de Notas */}
      <ExamScoresDrawer
        exam={selectedExam}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />

      {/* Confirm Delete */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover prova?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá arquivar a prova. As notas serão mantidas no histórico.
            </AlertDialogDescription>
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
