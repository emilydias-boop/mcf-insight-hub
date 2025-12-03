import { KPICard } from "@/components/ui/KPICard";
import { Users, Shield, AlertTriangle, Target } from "lucide-react";
import { UserSummary } from "@/types/user-management";

interface UserStatsCardsProps {
  users: UserSummary[];
}

export function UserStatsCards({ users }: UserStatsCardsProps) {
  // Conta usuários ativos: quem não está explicitamente marcado como inativo
  const activeUsers = users.filter(u => u.is_active !== false && u.status !== 'inativo').length;
  const admins = users.filter(u => u.role === 'admin').length;
  const managers = users.filter(u => u.role === 'manager').length;
  const usersWithRedFlags = users.filter(u => (u.red_flags_count || 0) > 0).length;
  const usersWithUnmetTargets = users.filter(u => {
    const achieved = u.targets_achieved || 0;
    const total = u.total_targets || 0;
    return total > 0 && achieved < total;
  }).length;

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
        title="Com Red Flags"
        value={usersWithRedFlags.toString()}
        icon={AlertTriangle}
        variant="danger"
      />
      <KPICard
        title="Metas Pendentes"
        value={usersWithUnmetTargets.toString()}
        icon={Target}
        variant="neutral"
      />
    </div>
  );
}
