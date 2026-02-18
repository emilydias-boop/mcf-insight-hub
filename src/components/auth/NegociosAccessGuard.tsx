import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldAlert } from 'lucide-react';
import { AppRole } from '@/types/user-management';
import { BusinessUnit } from '@/hooks/useMyBU';

// ============ BUs ONDE SDRs PODEM ESCOLHER MÚLTIPLAS PIPELINES ============
// SDRs dessas BUs veem a sidebar e podem trocar de pipeline livremente
export const SDR_MULTI_PIPELINE_BUS: BusinessUnit[] = ['consorcio'];

// ============ MAPEAMENTO BU → PIPELINES ============
// Define quais origens/grupos cada Business Unit pode ver
export const BU_PIPELINE_MAP: Record<BusinessUnit, string[]> = {
  incorporador: [
    'a6f3cbfc-0567-427f-a405-5a869aaa6010',
    'e3c04f21-ba2c-4c66-84f8-b4341c826b1c',
  ],
  consorcio: [
    'b98e3746-d727-445b-b878-fc5742b6e6b8',
    '267905ec-8fcf-4373-8d62-273bb6c6f8ca',
    '35361575-d8a9-4ea0-8703-372a2988d2be',
    '4e2b810a-6782-4ce9-9c0d-10d04c018636',
  ],
  credito: [
    '8d33bad6-46ab-4f9c-a570-dc7b74be2ac9',
    '7f74499a-6474-4b9d-ad28-1fbc85579bc2',
  ],
  projetos: ['e3c04f21-ba2c-4c66-84f8-b4341c826b1c'],
  leilao: [
    'f8a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c',
    'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  ],
  marketing: [],
};

// ============ MAPEAMENTO BU → GRUPOS (para filtrar dropdown de funis) ============
export const BU_GROUP_MAP: Record<BusinessUnit, string[]> = {
  incorporador: ['a6f3cbfc-0567-427f-a405-5a869aaa6010'],
  consorcio: [
    'b98e3746-d727-445b-b878-fc5742b6e6b8',
    '267905ec-8fcf-4373-8d62-273bb6c6f8ca',
    '35361575-d8a9-4ea0-8703-372a2988d2be',
    'a6f3cbfc-0567-427f-a405-5a869aaa6010',
  ],
  credito: ['8d33bad6-46ab-4f9c-a570-dc7b74be2ac9'],
  projetos: [],
  leilao: ['f8a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c'],
  marketing: [],
};

// Grupo/Origem padrão para cada BU (para selecionar ao abrir)
export const BU_DEFAULT_ORIGIN_MAP: Record<BusinessUnit, string> = {
  incorporador: 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c',
  consorcio: '57013597-22f6-4969-848c-404b81dcc0cb',
  credito: '7f74499a-6474-4b9d-ad28-1fbc85579bc2',
  projetos: 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c',
  leilao: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  marketing: '',
};

// Grupo padrão para cada BU (para navegação na sidebar)
export const BU_DEFAULT_GROUP_MAP: Record<BusinessUnit, string> = {
  incorporador: 'a6f3cbfc-0567-427f-a405-5a869aaa6010',
  consorcio: 'b98e3746-d727-445b-b878-fc5742b6e6b8',
  credito: '8d33bad6-46ab-4f9c-a570-dc7b74be2ac9',
  projetos: 'a6f3cbfc-0567-427f-a405-5a869aaa6010',
  leilao: 'f8a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c',
  marketing: '',
};

// ============ CONFIGURAÇÃO GLOBAL DE SDRs ============
// ID da origem autorizada para TODOS os SDRs (PIPELINE INSIDE SALES - fallback Incorporador)
export const SDR_AUTHORIZED_ORIGIN_ID = 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c';

// ID do grupo/funil onde fica a origem autorizada (Perpétuo - X1)
export const SDR_AUTHORIZED_GROUP_ID = 'a6f3cbfc-0567-427f-a405-5a869aaa6010';

// Origem padrão para SDRs de cada BU (respeitando a BU ativa)
export const SDR_ORIGIN_BY_BU: Record<BusinessUnit, string> = {
  incorporador: 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c',
  consorcio: '57013597-22f6-4969-848c-404b81dcc0cb',
  credito: '7f74499a-6474-4b9d-ad28-1fbc85579bc2',
  projetos: 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c',
  leilao: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  marketing: '',
};

interface NegociosAccessGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

// Componente Guard (agora permite todos - filtro é por BU)
export const NegociosAccessGuard = ({ children, fallback }: NegociosAccessGuardProps) => {
  const { role } = useAuth();
  
  // AGORA: Todos têm acesso (filtro é baseado na BU, não na role)
  const hasAccess = true;

  if (!hasAccess) {
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
// AGORA: Todos podem acessar (filtro é baseado na BU)
export const canUserAccessNegocios = (_role: AppRole | null): boolean => {
  return true; // Acesso liberado para todos
};

// Helper para obter origens permitidas baseado na BU
export const getAuthorizedOriginsForBU = (bu: BusinessUnit | null): string[] => {
  if (!bu) return []; // Sem BU = vê tudo (admin)
  return BU_PIPELINE_MAP[bu] || [];
};

// Helper para obter origens permitidas baseado na role (legado - mantido para compatibilidade)
export const getAuthorizedOriginsForRole = (role: AppRole | null): string[] => {
  if (role === 'sdr') {
    return [SDR_AUTHORIZED_ORIGIN_ID];
  }
  return []; // Admin/Manager/Coordenador veem tudo
};

// Helper para verificar se é um SDR (acesso restrito ao Kanban)
// Suporta usuários com múltiplas roles (ex: SDR + Closer)
export const isSdrRole = (role: AppRole | null, allRoles?: AppRole[]): boolean => {
  if (role === 'sdr') return true;
  // Se tem allRoles, verificar se SDR está presente em qualquer role
  if (allRoles && allRoles.includes('sdr')) return true;
  return false;
};
