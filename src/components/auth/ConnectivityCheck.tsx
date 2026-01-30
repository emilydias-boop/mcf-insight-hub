import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
  checkSupabaseConnectivity, 
  resetSupabaseSession, 
  getSupabaseDiagnostics,
  ConnectivityStatus 
} from '@/lib/supabase-utils';
import { RefreshCw, CheckCircle2, XCircle, AlertTriangle, ExternalLink, Wifi } from 'lucide-react';
import { toast } from 'sonner';

interface ConnectivityCheckProps {
  onReconnect?: () => void;
  showAlways?: boolean;
}

export function ConnectivityCheck({ onReconnect, showAlways = false }: ConnectivityCheckProps) {
  const [status, setStatus] = useState<ConnectivityStatus>('checking');
  const [message, setMessage] = useState('Verificando conexão...');
  const [isChecking, setIsChecking] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [hasError, setHasError] = useState(false);

  const checkConnection = async () => {
    setIsChecking(true);
    setStatus('checking');
    setMessage('Verificando conexão...');
    
    try {
      const result = await checkSupabaseConnectivity();
      setStatus(result.status);
      setMessage(result.message);
      setHasError(result.status !== 'ok');
      
      // Log diagnostics on error
      if (result.status !== 'ok') {
        console.log('[ConnectivityCheck] Diagnostics:', getSupabaseDiagnostics());
      }
    } catch (err) {
      setStatus('network_error');
      setMessage('Erro ao verificar conexão');
      setHasError(true);
    } finally {
      setIsChecking(false);
    }
  };

  const handleReconnect = async () => {
    setIsReconnecting(true);
    try {
      await resetSupabaseSession();
      toast.success('Sessão limpa! Tentando reconectar...');
      
      // Re-check connectivity
      await checkConnection();
      
      onReconnect?.();
    } catch (err) {
      toast.error('Erro ao reconectar');
    } finally {
      setIsReconnecting(false);
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  // Don't show if OK and not showAlways
  if (status === 'ok' && !showAlways && !hasError) {
    return null;
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'checking':
        return <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />;
      case 'ok':
        return <CheckCircle2 className="h-4 w-4 text-primary" />;
      case 'cors_blocked':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'server_error':
        return <AlertTriangle className="h-4 w-4 text-accent-foreground" />;
      case 'network_error':
        return <Wifi className="h-4 w-4 text-destructive" />;
      default:
        return null;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'ok':
        return 'border-primary/30 bg-primary/5';
      case 'cors_blocked':
      case 'network_error':
        return 'border-destructive/30 bg-destructive/5';
      case 'server_error':
        return 'border-accent/30 bg-accent/5';
      default:
        return 'border-muted';
    }
  };

  return (
    <div className={`rounded-lg border p-4 space-y-3 ${getStatusColor()}`}>
      <div className="flex items-center gap-2">
        {getStatusIcon()}
        <span className="text-sm font-medium">{message}</span>
      </div>

      {status !== 'ok' && status !== 'checking' && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {status === 'cors_blocked' && (
              <>
                Isso pode acontecer quando a origem do app não está configurada no Supabase.
                Verifique as configurações de URL e CORS no dashboard.
              </>
            )}
            {status === 'server_error' && (
              <>
                O servidor Supabase está instável ou sobrecarregado. 
                Tente novamente em alguns minutos ou verifique o status em status.supabase.com.
              </>
            )}
            {status === 'network_error' && (
              <>
                Não foi possível conectar ao servidor. Verifique sua conexão com a internet
                ou se há algum bloqueio de firewall/extensão.
              </>
            )}
          </p>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReconnect}
              disabled={isReconnecting}
            >
              {isReconnecting ? (
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-1" />
              )}
              Reconectar
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={checkConnection}
              disabled={isChecking}
            >
              Testar novamente
            </Button>

            {status === 'cors_blocked' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open('https://supabase.com/dashboard/project/rehcfgqvigfcekiipqkc/auth/url-configuration', '_blank')}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Configurar URLs
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
