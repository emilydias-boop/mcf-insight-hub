-- Adicionar coluna BU aos closers para filtrar por unidade de negócio
ALTER TABLE closers ADD COLUMN IF NOT EXISTS bu TEXT;

-- Comentário explicando os valores possíveis
COMMENT ON COLUMN closers.bu IS 'Business Unit do closer: incorporador, consorcio, credito, projetos, leilao';

-- Definir valor padrão para closers existentes (incorporador como padrão)
UPDATE closers SET bu = 'incorporador' WHERE bu IS NULL;