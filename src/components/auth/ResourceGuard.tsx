import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldAlert } from 'lucide-react';
import { ResourceType, PermissionLevel } from '@/types/user-management';
import { useResourcePermission } from '@/hooks/useResourcePermission';

interface ResourceGuardProps {
  resource: ResourceType;
  requiredLevel?: 'view' | 'edit' | 'full';
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const ResourceGuard = ({ 
  resource, 
  requiredLevel = 'view',
  children, 
  fallback 
}: ResourceGuardProps) => {
  const { role } = useAuth();
  const { canView, canEdit, canFull } = useResourcePermission(resource);
  
  // Admins sempre têm acesso
  if (role === 'admin') {
    return <>{children}</>;
  }
  
  const hasAccess = 
    requiredLevel === 'view' ? canView :
    requiredLevel === 'edit' ? canEdit :
    requiredLevel === 'full' ? canFull : false;
  
  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <Alert variant="destructive" className="max-w-2xl mx-auto my-8">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Acesso Negado</AlertTitle>
        <AlertDescription>
          Você não tem permissão para acessar este recurso. 
          Entre em contato com um administrador para solicitar acesso.
        </AlertDescription>
      </Alert>
    );
  }
  
  return <>{children}</>;
};
