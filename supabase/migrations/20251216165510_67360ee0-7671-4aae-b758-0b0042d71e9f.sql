-- Desabilitar transação duplicada do Murillo Flores (arq.murillomflores@gmail.com)
-- Mantendo apenas murillomflores@gmail.com que está na planilha do usuário
UPDATE hubla_transactions
SET count_in_dashboard = false, updated_at = now()
WHERE id = 'adeabc5d-8098-486b-a3e4-11d086224cd8';