import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { resetSupabaseSession } from '@/lib/supabase-utils';

const TIMEOUT_SHOW_ACTIONS_MS = 8000; // Show action buttons after 8s

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [showTimeoutActions, setShowTimeoutActions] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    
    if (loading) {
      timer = setTimeout(() => {
        setShowTimeoutActions(true);
      }, TIMEOUT_SHOW_ACTIONS_MS);
    } else {
      setShowTimeoutActions(false);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [loading]);

  const handleRetry = () => {
    window.location.reload();
  };

  const handleGoToLogin = () => {
    window.location.href = '/auth';
  };

  const handleClearSession = async () => {
    try {
      await resetSupabaseSession();
      window.location.href = '/auth';
    } catch (e) {
      console.error('Error clearing session:', e);
      window.location.href = '/auth';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md px-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground mb-2">Carregando sua sessão...</p>
          
          {showTimeoutActions && (
            <div className="mt-6 space-y-3 animate-in fade-in duration-300">
              <p className="text-sm text-destructive mb-4">
                O carregamento está demorando mais que o esperado.
              </p>
              <div className="flex flex-col gap-2">
                <Button onClick={handleRetry} variant="default" className="w-full">
                  Tentar novamente
                </Button>
                <Button onClick={handleGoToLogin} variant="outline" className="w-full">
                  Ir para login
                </Button>
                <Button onClick={handleClearSession} variant="ghost" className="w-full text-muted-foreground">
                  Limpar sessão e reiniciar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                Se o problema persistir, pode haver instabilidade no servidor.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
