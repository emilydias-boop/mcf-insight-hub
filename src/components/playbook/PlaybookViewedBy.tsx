import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Eye } from "lucide-react";

interface Viewer {
  id: string;
  user_id: string;
  ultima_acao_em: string;
  visualizacoes_qtd: number;
  profiles: {
    id: string;
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;
}

interface PlaybookViewedByProps {
  viewers: Viewer[];
  maxAvatars?: number;
}

export function PlaybookViewedBy({ viewers, maxAvatars = 5 }: PlaybookViewedByProps) {
  if (!viewers || viewers.length === 0) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Eye className="h-4 w-4" />
        <span>Nenhuma visualização ainda</span>
      </div>
    );
  }

  const displayedViewers = viewers.slice(0, maxAvatars);
  const remainingCount = viewers.length - maxAvatars;

  const getInitials = (name: string | null, email: string | null) => {
    if (name) {
      return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
    }
    if (email) {
      return email[0].toUpperCase();
    }
    return '?';
  };

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <div className="flex items-center gap-2 cursor-pointer">
          <Eye className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Visto por</span>
          <div className="flex -space-x-2">
            {displayedViewers.map((viewer) => (
              <Avatar key={viewer.id} className="h-7 w-7 border-2 border-background">
                <AvatarImage src={viewer.profiles?.avatar_url || undefined} />
                <AvatarFallback className="text-xs bg-primary/10">
                  {getInitials(viewer.profiles?.full_name || null, viewer.profiles?.email || null)}
                </AvatarFallback>
              </Avatar>
            ))}
            {remainingCount > 0 && (
              <div className="h-7 w-7 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                <span className="text-xs font-medium text-muted-foreground">+{remainingCount}</span>
              </div>
            )}
          </div>
        </div>
      </HoverCardTrigger>
      <HoverCardContent className="w-72" align="end">
        <div className="space-y-1">
          <p className="text-sm font-medium mb-2">
            {viewers.length} {viewers.length === 1 ? 'pessoa visualizou' : 'pessoas visualizaram'}
          </p>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {viewers.map((viewer) => (
              <div key={viewer.id} className="flex items-center gap-3 py-1">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={viewer.profiles?.avatar_url || undefined} />
                  <AvatarFallback className="text-xs bg-primary/10">
                    {getInitials(viewer.profiles?.full_name || null, viewer.profiles?.email || null)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {viewer.profiles?.full_name || viewer.profiles?.email || 'Usuário'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(viewer.ultima_acao_em), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                    {viewer.visualizacoes_qtd > 1 && (
                      <span> · {viewer.visualizacoes_qtd} visualizações</span>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
