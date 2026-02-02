-- Remover constraint antiga de email único
ALTER TABLE closers DROP CONSTRAINT IF EXISTS closers_email_key;

-- Criar nova constraint composta (email + bu)
ALTER TABLE closers ADD CONSTRAINT closers_email_bu_unique UNIQUE (email, bu);