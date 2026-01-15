import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldAlert } from 'lucide-react';
import { AppRole } from '@/types/user-management';

// Roles que têm acesso padrão à Agenda R2
const R2_ALLOWED_ROLES: AppRole[] = ['admin', 'manager', 'coordenador'];

// IDs de usuários específicos que podem acessar R2 (independente do role)
export const R2_AUTHORIZED_USERS = [
  '04bb4045-701d-443c-b2c9-aee74e7f58d9', // Yanca Tavares
  'c8fd2b83-2aee-41a4-9154-e812f492bc5f', // Cristiane Gomes (Closer R1)
  'dd76c153-a4a5-432e-ab4c-0b48f6141659', // Julio Caetano (Closer R1)
  '6bb81a27-fd8f-4af8-bce0-377f3576124f', // Thaynar Tavares (Closer R1)
];

interface R2AccessGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const R2AccessGuard = ({ children, fallback }: R2AccessGuardProps) => {
  const { role, user } = useAuth();

  const hasRoleAccess = role && R2_ALLOWED_ROLES.includes(role);
  const hasUserAccess = user?.id && R2_AUTHORIZED_USERS.includes(user.id);

  if (!hasRoleAccess && !hasUserAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <Alert variant="destructive" className="max-w-2xl mx-auto my-8">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Acesso Negado</AlertTitle>
        <AlertDescription>
          Você não tem permissão para acessar a Agenda R2.
          Entre em contato com um administrador para mais informações.
        </AlertDescription>
      </Alert>
    );
  }

  return <>{children}</>;
};

// Helper para verificar se usuário pode ver R2 (usado no CRM.tsx)
export const canUserAccessR2 = (role: AppRole | null, userId: string | undefined): boolean => {
  const hasRoleAccess = role && R2_ALLOWED_ROLES.includes(role);
  const hasUserAccess = userId && R2_AUTHORIZED_USERS.includes(userId);
  return hasRoleAccess || hasUserAccess;
};
