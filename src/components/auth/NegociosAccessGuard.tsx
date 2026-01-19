import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldAlert } from 'lucide-react';
import { AppRole } from '@/types/user-management';

// Roles que têm acesso padrão à aba Negócios
const NEGOCIOS_ALLOWED_ROLES: AppRole[] = ['admin', 'manager', 'coordenador'];

// Configuração de usuários SDR com acesso especial a Negócios e suas origens autorizadas
export interface NegociosAccessConfig {
  userId: string;
  userName: string;
  allowedOriginIds: string[]; // IDs das origens específicas que o usuário pode ver
  whatsappPhone?: string; // Número para notificações WhatsApp
  email?: string; // Email para notificações
}

export const NEGOCIOS_AUTHORIZED_SDRS: NegociosAccessConfig[] = [
  {
    userId: 'c7005c87-76fc-43a9-8bfa-e1b41f48a9b7', // Caroline Aparecida Corrêa
    userName: 'Caroline Correa',
    allowedOriginIds: ['e3c04f21-ba2c-4c66-84f8-b4341c826b1c'], // PIPELINE INSIDE SALES
    whatsappPhone: '5519992937317',
    email: 'carol.correa@minhacasafinanciada.com',
  },
];

interface NegociosAccessGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const NegociosAccessGuard = ({ children, fallback }: NegociosAccessGuardProps) => {
  const { role, user } = useAuth();

  const hasRoleAccess = role && NEGOCIOS_ALLOWED_ROLES.includes(role);
  const hasUserAccess = user?.id && NEGOCIOS_AUTHORIZED_SDRS.some(config => config.userId === user.id);

  if (!hasRoleAccess && !hasUserAccess) {
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
export const canUserAccessNegocios = (role: AppRole | null, userId: string | undefined): boolean => {
  const hasRoleAccess = role && NEGOCIOS_ALLOWED_ROLES.includes(role);
  const hasUserAccess = userId && NEGOCIOS_AUTHORIZED_SDRS.some(config => config.userId === userId);
  return hasRoleAccess || hasUserAccess;
};

// Helper para obter origens permitidas para um SDR específico
export const getAuthorizedOriginsForUser = (userId: string | undefined): string[] => {
  if (!userId) return [];
  const config = NEGOCIOS_AUTHORIZED_SDRS.find(c => c.userId === userId);
  return config?.allowedOriginIds || [];
};

// Helper para verificar se um usuário é um SDR com acesso limitado a Negócios
export const isSdrWithNegociosAccess = (role: AppRole | null, userId: string | undefined): boolean => {
  const isAgendaOnlyRole = role === 'sdr' || role === 'closer';
  const hasUserAccess = userId && NEGOCIOS_AUTHORIZED_SDRS.some(config => config.userId === userId);
  return isAgendaOnlyRole && hasUserAccess;
};
