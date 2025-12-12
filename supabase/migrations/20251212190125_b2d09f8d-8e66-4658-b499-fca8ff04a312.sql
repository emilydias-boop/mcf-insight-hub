-- Inserir os 11 registros de OB Construir de 06/12, 07/12 e 08/12 vindos da planilha Make
INSERT INTO hubla_transactions (
  hubla_id, customer_name, customer_email, customer_phone,
  product_name, product_category, net_value, product_price,
  sale_date, event_type, sale_status, source
) VALUES 
-- 06/12/2025 (4 registros)
('make_ob_construir_manual_1', 'Kenii katayama', 'kdininho9@hotmail.com', '5511961775233', 'OB Construir Para Alugar', 'ob_construir', 93.18, 147, '2025-12-06', 'invoice.payment_succeeded', 'completed', 'make'),
('make_ob_construir_manual_2', 'thiago araujo souza', 'thicorinthians100@gmail.com', '5511960539348', 'OB Construir Para Alugar', 'ob_construir', 88.73, 147, '2025-12-06', 'invoice.payment_succeeded', 'completed', 'make'),
('make_ob_construir_manual_3', 'Antuan Pamplona', 'antuan@coc.ufrj.br', '5524981270161', 'OB Construir Para Alugar', 'ob_construir', 89.21, 147, '2025-12-06', 'invoice.payment_succeeded', 'completed', 'make'),
('make_ob_construir_manual_4', 'Juliana Masciarelli Rodrigues', 'juliana.masciarelli@hotmail.com', '5561990001505', 'OB Construir Para Alugar', 'ob_construir', 91.33, 147, '2025-12-06', 'invoice.payment_succeeded', 'completed', 'make'),
-- 07/12/2025 (4 registros)
('make_ob_construir_manual_5', 'Luis Gustavo Ferreira Silva', 'luisgustavofs345@gmail.com', '5516999955887', 'OB Construir Para Alugar', 'ob_construir', 89.21, 147, '2025-12-07', 'invoice.payment_succeeded', 'completed', 'make'),
('make_ob_construir_manual_6', 'Beatriz Miranda Barros', 'beatrizbarrosadv@gmail.com', '5575999680599', 'OB Construir Para Alugar', 'ob_construir', 88.73, 147, '2025-12-07', 'invoice.payment_succeeded', 'completed', 'make'),
('make_ob_construir_manual_7', 'Rafael da Costa Oliveira Faria', 'rafaelcofaria@gmail.com', '5521981030903', 'OB Construir Para Alugar', 'ob_construir', 89.21, 147, '2025-12-07', 'invoice.payment_succeeded', 'completed', 'make'),
('make_ob_construir_manual_8', 'Anderson de Carvalho Almeida', 'anderlinealmeida@gmail.com', '5511973434147', 'OB Construir Para Alugar', 'ob_construir', 88.73, 147, '2025-12-07', 'invoice.payment_succeeded', 'completed', 'make'),
-- 08/12/2025 (3 registros)
('make_ob_construir_manual_9', 'Djaline Camillo Menegaz', 'djalinecamillomenegaz@outlook.com', '5566999088085', 'OB Construir Para Alugar', 'ob_construir', 89.78, 147, '2025-12-08', 'invoice.payment_succeeded', 'completed', 'make'),
('make_ob_construir_manual_10', 'Edson Miranda Melo', 'medsonl@bol.com.br', '5575991300767', 'OB Construir Para Alugar', 'ob_construir', 93.18, 147, '2025-12-08', 'invoice.payment_succeeded', 'completed', 'make'),
('make_ob_construir_manual_11', 'Wanessa Medrado de Souza Neves', 'wamesone21@gmail.com', '5565999799661', 'OB Construir Para Alugar', 'ob_construir', 7.79, 147, '2025-12-08', 'invoice.payment_succeeded', 'completed', 'make')
ON CONFLICT (hubla_id) DO NOTHING;