-- Remover políticas antigas de whatsapp_conversations
DROP POLICY IF EXISTS "Usuários autenticados podem visualizar conversas" ON whatsapp_conversations;
DROP POLICY IF EXISTS "SDRs podem atualizar conversas" ON whatsapp_conversations;
DROP POLICY IF EXISTS "SDRs podem criar conversas" ON whatsapp_conversations;

-- Remover políticas antigas de whatsapp_messages
DROP POLICY IF EXISTS "Usuários autenticados podem visualizar mensagens" ON whatsapp_messages;
DROP POLICY IF EXISTS "Usuários podem atualizar status das mensagens" ON whatsapp_messages;
DROP POLICY IF EXISTS "Usuários podem enviar mensagens" ON whatsapp_messages;

-- ========================================
-- POLÍTICAS PARA whatsapp_conversations
-- ========================================

-- SELECT: SDRs veem apenas suas conversas, supervisores veem todas
CREATE POLICY "Ver conversas por owner ou supervisor"
ON whatsapp_conversations FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid() 
  OR owner_id IS NULL
  OR has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'coordenador')
  OR has_role(auth.uid(), 'manager')
);

-- UPDATE: SDRs atualizam suas conversas ou sem owner, supervisores podem atualizar qualquer
CREATE POLICY "Atualizar conversas por owner ou supervisor"
ON whatsapp_conversations FOR UPDATE
TO authenticated
USING (
  owner_id = auth.uid()
  OR owner_id IS NULL
  OR has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'coordenador')
  OR has_role(auth.uid(), 'manager')
);

-- INSERT: Qualquer autenticado pode criar (webhook precisa)
CREATE POLICY "Criar conversas autenticado"
ON whatsapp_conversations FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- ========================================
-- POLÍTICAS PARA whatsapp_messages
-- ========================================

-- SELECT: Ver mensagens das conversas que o usuário pode ver
CREATE POLICY "Ver mensagens das próprias conversas"
ON whatsapp_messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM whatsapp_conversations wc
    WHERE wc.id = whatsapp_messages.conversation_id
    AND (
      wc.owner_id = auth.uid()
      OR wc.owner_id IS NULL
      OR has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'coordenador')
      OR has_role(auth.uid(), 'manager')
    )
  )
);

-- UPDATE: Atualizar status de mensagens das próprias conversas
CREATE POLICY "Atualizar mensagens das próprias conversas"
ON whatsapp_messages FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM whatsapp_conversations wc
    WHERE wc.id = whatsapp_messages.conversation_id
    AND (
      wc.owner_id = auth.uid()
      OR wc.owner_id IS NULL
      OR has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'coordenador')
      OR has_role(auth.uid(), 'manager')
    )
  )
);

-- INSERT: Enviar mensagens nas próprias conversas
CREATE POLICY "Enviar mensagens nas próprias conversas"
ON whatsapp_messages FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM whatsapp_conversations wc
    WHERE wc.id = conversation_id
    AND (
      wc.owner_id = auth.uid()
      OR wc.owner_id IS NULL
      OR has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'coordenador')
      OR has_role(auth.uid(), 'manager')
    )
  )
);