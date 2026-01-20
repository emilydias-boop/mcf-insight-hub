import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldAlert } from 'lucide-react';
import { AppRole } from '@/types/user-management';

// Roles que têm acesso padrão à aba Negócios
const NEGOCIOS_ALLOWED_ROLES: AppRole[] = ['admin', 'manager', 'coordenador', 'sdr'];

// ============ CONFIGURAÇÃO GLOBAL DE SDRs ============
// ID da origem autorizada para TODOS os SDRs (PIPELINE INSIDE SALES)
export const SDR_AUTHORIZED_ORIGIN_ID = 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c';

// ID do grupo/funil onde fica a origem autorizada (Perpétuo - X1)
export const SDR_AUTHORIZED_GROUP_ID = 'a6f3cbfc-0567-427f-a405-5a869aaa6010';

interface NegociosAccessGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const NegociosAccessGuard = ({ children, fallback }: NegociosAccessGuardProps) => {
  const { role } = useAuth();

  const hasRoleAccess = role && NEGOCIOS_ALLOWED_ROLES.includes(role);

  if (!hasRoleAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <Alert variant="destructive" className="max-w-2xl mx-auto my-8">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Acesso Negado</AlertTitle>
        <AlertDescription>
          Você não tem permissão para acessar a aba Negócios.
          Entre em contato com um administrador para mais informações.
        </AlertDescription>
      </Alert>
    );
  }

  return <>{children}</>;
};

// Helper para verificar se usuário pode ver aba Negócios
export const canUserAccessNegocios = (role: AppRole | null): boolean => {
  return role !== null && NEGOCIOS_ALLOWED_ROLES.includes(role);
};

// Helper para obter origens permitidas baseado na role
export const getAuthorizedOriginsForRole = (role: AppRole | null): string[] => {
  if (role === 'sdr') {
    return [SDR_AUTHORIZED_ORIGIN_ID];
  }
  return []; // Admin/Manager/Coordenador veem tudo
};

// Helper para verificar se é um SDR (acesso restrito ao Kanban)
export const isSdrRole = (role: AppRole | null): boolean => {
  return role === 'sdr';
};
