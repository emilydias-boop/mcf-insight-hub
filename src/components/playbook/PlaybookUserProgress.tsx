import { PlaybookRole } from "@/types/playbook";
import { usePlaybookUserProgress } from "@/hooks/usePlaybookReads";
import { Progress } from "@/components/ui/progress";
import { BookOpen } from "lucide-react";

interface PlaybookUserProgressProps {
  userId: string;
  userRole: PlaybookRole | string;
}

export function PlaybookUserProgress({ userId, userRole }: PlaybookUserProgressProps) {
  const { data: progress, isLoading } = usePlaybookUserProgress(
    userId,
    userRole as PlaybookRole
  );

  if (isLoading) {
    return (
      <div className="animate-pulse h-16 bg-muted rounded-lg" />
    );
  }

  if (!progress || progress.total === 0) {
    return (
      <div className="flex items-center gap-3 p-4 border rounded-lg bg-muted/50">
        <BookOpen className="h-5 w-5 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          Nenhum documento obrigatório para este cargo.
        </span>
      </div>
    );
  }

  const percentage = Math.round((progress.confirmados / progress.total) * 100);

  return (
    <div className="space-y-3 p-4 border rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <span className="font-medium">Playbook</span>
        </div>
        <span className="text-sm text-muted-foreground">
          {progress.confirmados} de {progress.total} confirmados
        </span>
      </div>
      <Progress value={percentage} className="h-2" />
      <p className="text-xs text-muted-foreground">
        {percentage === 100 
          ? 'Todos os documentos obrigatórios foram confirmados.' 
          : `${progress.total - progress.confirmados} documento(s) pendente(s) de confirmação.`
        }
      </p>
    </div>
  );
}
