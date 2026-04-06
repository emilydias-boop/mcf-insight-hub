INSERT INTO employees (nome_completo, email_pessoal, cargo, status, salario_base, nivel, fechamento_manual)
VALUES ('Luis Felipe de Souza Oliveira Ramos', 'luis.felipe@minhacasafinanciada.com', 'Supervisor', 'ativo', 0, 1, true)
ON CONFLICT DO NOTHING;