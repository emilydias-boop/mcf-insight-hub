import { supabase } from "@/integrations/supabase/client";

type DocumentAction =
  | 'documento_enviado'
  | 'nfse_enviada'
  | 'termo_aceito'
  | 'documento_recebido'
  | 'status_atualizado'
  | 'arquivo_enviado';

type SentBy = 'colaborador' | 'gestor';

interface NotifyDocumentActionParams {
  employeeId: string;
  action: DocumentAction;
  documentTitle: string;
  sentBy: SentBy;
}

function getTitleForAction(action: DocumentAction, perspective: 'self' | 'other', sentBy: SentBy): string {
  const titles: Record<DocumentAction, Record<string, string>> = {
    documento_enviado: {
      self: 'Documento enviado',
      other: 'Novo documento recebido',
    },
    nfse_enviada: {
      self: 'NFSe enviada',
      other: 'Nova NFSe recebida',
    },
    termo_aceito: {
      self: 'Termo aceito',
      other: 'Termo de responsabilidade aceito',
    },
    documento_recebido: {
      self: 'Novo documento disponível',
      other: 'Documento enviado ao colaborador',
    },
    status_atualizado: {
      self: 'Status do documento atualizado',
      other: 'Documento atualizado',
    },
    arquivo_enviado: {
      self: 'Novo arquivo disponível',
      other: 'Arquivo enviado ao colaborador',
    },
  };
  return titles[action]?.[perspective] || 'Notificação de documento';
}

function getMessageForAction(
  action: DocumentAction,
  documentTitle: string,
  perspective: 'self' | 'other',
  sentBy: SentBy,
  employeeName: string,
  gestorName: string
): string {
  if (sentBy === 'colaborador') {
    if (perspective === 'self') {
      return `Você enviou "${documentTitle}" com sucesso.`;
    }
    return `${employeeName} enviou "${documentTitle}". Verifique e tome as ações necessárias.`;
  }
  // sentBy === 'gestor'
  if (perspective === 'self') {
    return `${gestorName} disponibilizou "${documentTitle}" para você.`;
  }
  return `Você enviou "${documentTitle}" para ${employeeName}.`;
}

export async function notifyDocumentAction({
  employeeId,
  action,
  documentTitle,
  sentBy,
}: NotifyDocumentActionParams): Promise<void> {
  try {
    // 1. Fetch employee with profile_id and gestor_id
    const { data: emp } = await supabase
      .from('employees')
      .select('profile_id, gestor_id, nome_completo')
      .eq('id', employeeId)
      .single();

    if (!emp) return;

    // 2. Fetch gestor profile_id
    let gestorProfileId: string | null = null;
    let gestorName = 'Gestor';

    if (emp.gestor_id) {
      const { data: gestor } = await supabase
        .from('employees')
        .select('profile_id, nome_completo')
        .eq('id', emp.gestor_id)
        .single();

      gestorProfileId = gestor?.profile_id || null;
      gestorName = gestor?.nome_completo || 'Gestor';
    }

    const employeeName = emp.nome_completo || 'Colaborador';

    // 3. Build notifications
    const notifications: Array<{
      user_id: string;
      title: string;
      message: string;
      type: string;
    }> = [];

    // Notification for the employee
    if (emp.profile_id) {
      notifications.push({
        user_id: emp.profile_id,
        title: getTitleForAction(action, sentBy === 'colaborador' ? 'self' : 'other', sentBy),
        message: getMessageForAction(action, documentTitle, sentBy === 'colaborador' ? 'self' : 'other', sentBy, employeeName, gestorName),
        type: sentBy === 'gestor' ? 'action_required' : 'info',
      });
    }

    // Notification for the manager
    if (gestorProfileId) {
      notifications.push({
        user_id: gestorProfileId,
        title: getTitleForAction(action, sentBy === 'gestor' ? 'self' : 'other', sentBy),
        message: getMessageForAction(action, documentTitle, sentBy === 'gestor' ? 'self' : 'other', sentBy, employeeName, gestorName),
        type: sentBy === 'colaborador' ? 'action_required' : 'info',
      });
    }

    // 4. Insert notifications
    if (notifications.length > 0) {
      await supabase.from('user_notifications').insert(notifications);
    }
  } catch (err) {
    // Notifications should never break the main flow
    console.error('Erro ao enviar notificações de documento:', err);
  }
}
