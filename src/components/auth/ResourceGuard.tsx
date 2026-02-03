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
  const { role, loading } = useAuth();
  const { canView, canEdit, canFull } = useResourcePermission(resource);
  
  // Wait for auth to complete before checking permissions
  // With JWT-based roles, roles are available instantly with the session
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  // Admins always have access
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
