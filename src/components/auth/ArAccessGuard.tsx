import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldAlert } from 'lucide-react';
import { useCanManageAr } from '@/hooks/useArGestores';

export const ArAccessGuard = ({ children }: { children: React.ReactNode }) => {
  const { canManage, loading } = useCanManageAr();
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  if (!canManage) {
    return (
      <Alert variant="destructive" className="max-w-2xl mx-auto my-8">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Acesso Negado</AlertTitle>
        <AlertDescription>
          Você não tem permissão para acessar o módulo À Receber. Solicite ao administrador para delegar acesso.
        </AlertDescription>
      </Alert>
    );
  }
  return <>{children}</>;
};