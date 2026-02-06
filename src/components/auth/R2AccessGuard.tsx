import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldAlert } from 'lucide-react';
import { AppRole } from '@/types/user-management';
import { useMyR2Closer } from '@/hooks/useMyR2Closer';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Roles que têm acesso padrão à Agenda R2
const R2_ALLOWED_ROLES: AppRole[] = ['admin', 'manager', 'coordenador'];

interface R2AccessGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const R2AccessGuard = ({ children, fallback }: R2AccessGuardProps) => {
  const { role, user, allRoles, loading: authLoading } = useAuth();
  const { data: myR2Closer, isLoading: loadingR2Closer } = useMyR2Closer();

  // Verificar permissão individual na tabela user_permissions
  const { data: r2Permission, isLoading: loadingPermission } = useQuery({
    queryKey: ['user-r2-permission', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('user_permissions')
        .select('permission_level')
        .eq('user_id', user.id)
        .eq('resource', 'agenda_r2')
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  // Wait for auth to complete before checking access
  if (authLoading) {
    return null;
  }

  const hasRoleAccess = role && R2_ALLOWED_ROLES.includes(role);
  
  // Closers R2 também têm acesso
  const isR2Closer = !!myR2Closer?.id;
  const hasCloserAccess = (role === 'closer' || allRoles?.includes('closer')) && isR2Closer;

  // Permissão individual via user_permissions
  const hasUserPermission = r2Permission?.permission_level && 
    r2Permission.permission_level !== 'none';

  // Show loading while checking R2 closer status or individual permission
  const isCloser = role === 'closer' || allRoles?.includes('closer');
  if ((loadingR2Closer && isCloser) || loadingPermission) {
    return null;
  }

  if (!hasRoleAccess && !hasCloserAccess && !hasUserPermission) {
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
// Nota: para closers R2, a verificação completa é feita no componente R2AccessGuard
export const canUserAccessR2 = (role: AppRole | null, userId: string | undefined, allRoles?: AppRole[]): boolean => {
  const hasRoleAccess = role && R2_ALLOWED_ROLES.includes(role);
  // Closers podem acessar - verificação final de R2 é feita no guard
  const isCloser = role === 'closer' || (allRoles?.includes('closer') ?? false);
  return hasRoleAccess || isCloser;
};
