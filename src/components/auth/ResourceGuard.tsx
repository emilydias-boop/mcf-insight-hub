import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldAlert } from 'lucide-react';
import { ResourceType } from '@/types/user-management';
import { useMyPermissions } from '@/hooks/useMyPermissions';

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
  const { getPermissionLevel, isAdmin, isLoading: permLoading } = useMyPermissions();
  
  if (loading || permLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (isAdmin) {
    return <>{children}</>;
  }
  
  const level = getPermissionLevel(resource);
  
  const hasAccess = 
    requiredLevel === 'view' ? level !== 'none' :
    requiredLevel === 'edit' ? (level === 'edit' || level === 'full') :
    requiredLevel === 'full' ? level === 'full' : false;
  
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
