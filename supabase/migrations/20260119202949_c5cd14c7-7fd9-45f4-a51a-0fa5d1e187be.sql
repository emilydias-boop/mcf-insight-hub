-- Adicionar colunas para contagem automática de ligações
ALTER TABLE sdr_month_kpi 
ADD COLUMN IF NOT EXISTS ligacoes_contato INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tentativas_auto INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ligacoes_manual_override BOOLEAN DEFAULT FALSE;

-- Atualizar sdr.user_id onde possível via email
UPDATE sdr s
SET user_id = u.id
FROM auth.users u
WHERE LOWER(s.email) = LOWER(u.email)
  AND s.user_id IS NULL
  AND s.email IS NOT NULL;

-- Comentário nas colunas para documentação
COMMENT ON COLUMN sdr_month_kpi.ligacoes_contato IS 'Ligações atendidas (contatos) calculadas automaticamente';
COMMENT ON COLUMN sdr_month_kpi.tentativas_auto IS 'Tentativas de ligação calculadas automaticamente';
COMMENT ON COLUMN sdr_month_kpi.ligacoes_manual_override IS 'Se true, usa tentativas_ligacoes manual; se false, usa tentativas_auto';