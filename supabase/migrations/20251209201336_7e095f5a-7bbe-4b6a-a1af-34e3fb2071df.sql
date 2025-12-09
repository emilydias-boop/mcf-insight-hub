-- Adicionar contador de visualizações à tabela playbook_reads
ALTER TABLE public.playbook_reads 
ADD COLUMN IF NOT EXISTS visualizacoes_qtd INTEGER NOT NULL DEFAULT 1;

-- Comentários para documentar campos existentes
COMMENT ON COLUMN public.playbook_reads.lido_em IS 'Primeira visualização do documento';
COMMENT ON COLUMN public.playbook_reads.ultima_acao_em IS 'Última visualização do documento';
COMMENT ON COLUMN public.playbook_reads.visualizacoes_qtd IS 'Contador de quantas vezes o documento foi aberto';