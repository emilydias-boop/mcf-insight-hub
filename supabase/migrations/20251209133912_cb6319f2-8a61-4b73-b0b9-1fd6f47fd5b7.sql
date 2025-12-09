-- 1. Remover duplicata Patrick (Make) - Hubla já tem o registro correto
DELETE FROM hubla_transactions 
WHERE hubla_id = 'make_contrato_1765225177985_silvades';

-- 2. Corrigir David Oliveira (Kiwify) para parcela 10 de 12 (é recorrência)
UPDATE hubla_transactions 
SET installment_number = 10, 
    total_installments = 12
WHERE hubla_id = 'kiwify_5e51e2d7-9491-43b0-ae01-7fad63d9c795';