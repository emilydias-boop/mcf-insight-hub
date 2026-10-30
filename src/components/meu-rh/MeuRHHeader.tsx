import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AvatarUploader } from "@/components/profile/AvatarUploader";
import { Badge } from "@/components/ui/badge";
import { EMPLOYEE_STATUS_LABELS } from "@/types/hr";
import type { Employee } from "@/types/hr";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MeuRHHeaderProps {
  employee: Employee;
  gestorName: string | null;
}

export function MeuRHHeader({ employee, gestorName }: MeuRHHeaderProps) {
  const statusConfig = EMPLOYEE_STATUS_LABELS[employee.status] || { label: employee.status, color: 'bg-gray-500' };
  
  const initials = employee.nome_completo
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase();

  const { user } = useAuth();
  const { data: avatarUrl } = useQuery({
    queryKey: ["my-avatar", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("avatar_url").eq("id", user!.id).maybeSingle();
      return (data?.avatar_url as string | null) ?? null;
    },
  });

  return (
    <div className="space-y-4">
      {/* Main header */}
      <div className="flex items-start gap-4">
        
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{employee.nome_completo}</h1>
            <Badge className={`${statusConfig.color} text-white text-xs`}>
              {statusConfig.label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{employee.cargo || 'Cargo não definido'}</p>
          <p className="text-xs text-muted-foreground/70">
            Essas são as informações cadastradas sobre você na MCF
          </p>
          {user?.id && (
            <div className="pt-2">
              <AvatarUploader userId={user.id} nome={employee.nome_completo} avatarUrl={avatarUrl ?? null} />
            </div>
          )}
        </div>
      </div>

      {/* Info line */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground border-t border-border/50 pt-3">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-foreground">{employee.tipo_contrato || 'N/A'}</span>
        </div>
        <span className="text-border">•</span>
        <div className="flex items-center gap-1.5">
          <span>Entrada:</span>
          <span className="font-medium text-foreground">
            {employee.data_admissao 
              ? format(new Date(employee.data_admissao), 'dd/MM/yyyy', { locale: ptBR })
              : 'N/A'}
          </span>
        </div>
        <span className="text-border">•</span>
        <div className="flex items-center gap-1.5">
          <span>Gestor:</span>
          <span className="font-medium text-foreground">{gestorName || 'N/A'}</span>
        </div>
      </div>
    </div>
  );
}
