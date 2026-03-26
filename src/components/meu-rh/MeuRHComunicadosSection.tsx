import { Megaphone, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useActiveAnnouncements, ANNOUNCEMENT_TYPE_LABELS, type RhAnnouncement } from "@/hooks/useRhAnnouncements";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

function AnnouncementCard({ announcement }: { announcement: RhAnnouncement }) {
  const typeInfo = ANNOUNCEMENT_TYPE_LABELS[announcement.tipo];

  return (
    <div className={`p-4 rounded-lg border transition-colors ${
      announcement.destaque ? 'border-primary/30 bg-primary/5 ring-1 ring-primary/10' : 'bg-card hover:bg-accent/50'
    }`}>
      <div className="flex items-start gap-3">
        <span className="text-xl mt-0.5">{typeInfo.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {announcement.destaque && (
              <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
            )}
            <span className="font-medium text-sm">{announcement.titulo}</span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {typeInfo.label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground whitespace-pre-line">
            {announcement.conteudo}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Publicado em {format(parseISO(announcement.data_publicacao), "dd/MM/yyyy", { locale: ptBR })}
          </p>
        </div>
      </div>
    </div>
  );
}

export function MeuRHComunicadosSection() {
  const { data: announcements, isLoading } = useActiveAnnouncements();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
        </CardContent>
      </Card>
    );
  }

  if (!announcements || announcements.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="p-3 rounded-full bg-muted mb-4">
            <Megaphone className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-1">Nenhum comunicado</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Avisos, aniversariantes e recados da empresa aparecerão aqui.
          </p>
        </CardContent>
      </Card>
    );
  }

  const destaques = announcements.filter(a => a.destaque);
  const regulares = announcements.filter(a => !a.destaque);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Megaphone className="h-5 w-5" />
          Comunicados
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {destaques.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
              Destaques
            </h4>
            <div className="space-y-3">
              {destaques.map(a => <AnnouncementCard key={a.id} announcement={a} />)}
            </div>
          </div>
        )}
        {regulares.length > 0 && (
          <div>
            {destaques.length > 0 && (
              <h4 className="text-sm font-semibold text-muted-foreground mb-2">Outros comunicados</h4>
            )}
            <div className="space-y-3">
              {regulares.map(a => <AnnouncementCard key={a.id} announcement={a} />)}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
