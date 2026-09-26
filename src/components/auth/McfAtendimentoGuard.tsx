import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PauseCircle, ShieldAlert } from 'lucide-react';
import { useMcfAtendimentoAccess } from '@/hooks/useMcfAtendimentoAccess';
import { useWaEnvioStatus, formatDesdePausa } from '@/hooks/wa/useWaEnvioStatus';

export const McfAtendimentoGuard = ({ children }: { children: React.ReactNode }) => {
  const { hasAccess, loading } = useMcfAtendimentoAccess();
  const wa = useWaEnvioStatus();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <Alert variant="destructive" className="max-w-2xl mx-auto my-8">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Acesso Negado</AlertTitle>
        <AlertDescription>
          Você não tem permissão para acessar o MCF - Atendimento. Solicite acesso a um administrador.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      {wa.pausado && (
        <Alert className="mx-4 mt-4 w-auto border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-200 [&>svg]:text-amber-600">
          <PauseCircle className="h-4 w-4" />
          <AlertTitle>Envio de WhatsApp pausado</AlertTitle>
          <AlertDescription>
            {wa.motivo ?? 'Envio suspenso'}. Pausado desde {formatDesdePausa(wa.desde)} por {wa.porNome ?? '—'}.
            Conversas e mensagens recebidas continuam visíveis; nenhuma mensagem sai (caixa, disparos,
            lembretes e automações por WhatsApp) até religar.
          </AlertDescription>
        </Alert>
      )}
      {children}
    </>
  );
};
