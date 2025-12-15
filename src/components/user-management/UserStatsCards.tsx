import { KPICard } from "@/components/ui/KPICard";
import { Users, Shield, UserCheck, Building2 } from "lucide-react";
import { UserSummary } from "@/types/user-management";

interface UserStatsCardsProps {
  users: UserSummary[];
}

export function UserStatsCards({ users }: UserStatsCardsProps) {
  // Conta usuários ativos: quem não está explicitamente marcado como inativo
  const activeUsers = users.filter(u => u.is_active !== false && u.status !== 'inativo').length;
  const admins = users.filter(u => u.role === 'admin').length;
  const managers = users.filter(u => u.role === 'manager').length;
  const sdrsClosers = users.filter(u => u.role === 'sdr' || u.role === 'closer').length;
  const coordenadores = users.filter(u => u.role === 'coordenador').length;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <KPICard
        title="Usuários Ativos"
        value={activeUsers.toString()}
        icon={Users}
        variant="neutral"
      />
      <KPICard
        title="Admins / Managers"
        value={`${admins} / ${managers}`}
        icon={Shield}
        variant="neutral"
      />
      <KPICard
        title="SDRs / Closers"
        value={sdrsClosers.toString()}
        icon={UserCheck}
        variant="neutral"
      />
      <KPICard
        title="Coordenadores"
        value={coordenadores.toString()}
        icon={Building2}
        variant="neutral"
      />
    </div>
  );
}
