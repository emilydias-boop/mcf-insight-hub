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

function getEmployeeEmail(emp: { email_pessoal?: string | null }): string | null {
  return emp.email_pessoal || null;
}

function buildEmailHtml(subject: string, message: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <div style="background: #1a1a2e; padding: 24px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 20px;">MCF - Minha Casa Financiada</h1>
      </div>
      <div style="padding: 32px 24px;">
        <h2 style="color: #1a1a2e; margin: 0 0 16px;">${subject}</h2>
        <p style="color: #333; font-size: 15px; line-height: 1.6;">${message}</p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="https://mcf-insight-hub.lovable.app" 
             style="background: #1a1a2e; color: #fff; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Ver no Sistema
          </a>
        </div>
      </div>
      <div style="background: #f5f5f5; padding: 16px 24px; text-align: center; font-size: 12px; color: #888;">
        Este é um email automático. Por favor, não responda.
      </div>
    </div>
  `;
}

async function sendDocumentEmail(
  to: string,
  recipientName: string,
  subject: string,
  message: string,
  action: DocumentAction
): Promise<void> {
  try {
    const content = buildEmailHtml(subject, message);
    await supabase.functions.invoke('activecampaign-send', {
      body: {
        email: to,
        name: recipientName,
        subject,
        content,
        tags: ['notificacao_documento', action],
      },
    });
  } catch (err) {
    console.error('Erro ao enviar email de documento via ActiveCampaign:', err);
  }
}

export async function notifyDocumentAction({
  employeeId,
  action,
  documentTitle,
  sentBy,
}: NotifyDocumentActionParams): Promise<void> {
  try {
    // 1. Fetch employee with profile_id, gestor_id, and emails
    const { data: emp } = await supabase
      .from('employees')
      .select('profile_id, gestor_id, nome_completo, email_pessoal')
      .eq('id', employeeId)
      .single();

    if (!emp) return;

    // 2. Fetch gestor profile_id and emails
    let gestorProfileId: string | null = null;
    let gestorName = 'Gestor';
    let gestorEmail: string | null = null;

    if (emp.gestor_id) {
      const { data: gestor } = await supabase
        .from('employees')
        .select('profile_id, nome_completo, email_pessoal')
        .eq('id', emp.gestor_id)
        .single();

      gestorProfileId = gestor?.profile_id || null;
      gestorName = gestor?.nome_completo || 'Gestor';
      gestorEmail = gestor ? getEmployeeEmail(gestor) : null;
    }

    const employeeName = emp.nome_completo || 'Colaborador';
    const employeeEmail = getEmployeeEmail(emp);

    // 3. Build notifications
    const notifications: Array<{
      user_id: string;
      title: string;
      message: string;
      type: string;
    }> = [];

    const empTitle = getTitleForAction(action, sentBy === 'colaborador' ? 'self' : 'other', sentBy);
    const empMessage = getMessageForAction(action, documentTitle, sentBy === 'colaborador' ? 'self' : 'other', sentBy, employeeName, gestorName);
    const gestorTitle = getTitleForAction(action, sentBy === 'gestor' ? 'self' : 'other', sentBy);
    const gestorMessage = getMessageForAction(action, documentTitle, sentBy === 'gestor' ? 'self' : 'other', sentBy, employeeName, gestorName);

    // Notification for the employee
    if (emp.profile_id) {
      notifications.push({
        user_id: emp.profile_id,
        title: empTitle,
        message: empMessage,
        type: sentBy === 'gestor' ? 'action_required' : 'info',
      });
    }

    // Notification for the manager
    if (gestorProfileId) {
      notifications.push({
        user_id: gestorProfileId,
        title: gestorTitle,
        message: gestorMessage,
        type: sentBy === 'colaborador' ? 'action_required' : 'info',
      });
    }

    // 4. Insert notifications
    if (notifications.length > 0) {
      await supabase.from('user_notifications').insert(notifications);
    }

    // 5. Send emails (fire-and-forget)
    if (employeeEmail) {
      sendDocumentEmail(employeeEmail, employeeName, empTitle, empMessage, action);
    }
    if (gestorEmail) {
      sendDocumentEmail(gestorEmail, gestorName, gestorTitle, gestorMessage, action);
    }
  } catch (err) {
    // Notifications should never break the main flow
    console.error('Erro ao enviar notificações de documento:', err);
  }
}
