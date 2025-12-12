-- Inserir os 13 registros de OB Vitalício de 06/12 e 07/12 vindos da planilha Make
INSERT INTO hubla_transactions (
  hubla_id, customer_name, customer_email, customer_phone,
  product_name, product_category, net_value, product_price,
  sale_date, event_type, sale_status, source
) VALUES 
-- 06/12/2025 (4 registros)
('make_ob_vitalicio_manual_1', 'Kenii katayama', 'kdininho9@hotmail.com', '5511961775233', 'OB Acesso Vitalício', 'ob_vitalicio', 54.76, 97, '2025-12-06', 'invoice.payment_succeeded', 'completed', 'make'),
('make_ob_vitalicio_manual_2', 'Antuan Pamplona', 'antuan@coc.ufrj.br', '5524981270161', 'OB Acesso Vitalício', 'ob_vitalicio', 52.42, 97, '2025-12-06', 'invoice.payment_succeeded', 'completed', 'make'),
('make_ob_vitalicio_manual_3', 'Juliana Masciarelli Rodrigues', 'juliana.masciarelli@hotmail.com', '5561990001505', 'OB Acesso Vitalício', 'ob_vitalicio', 8.31, 97, '2025-12-06', 'invoice.payment_succeeded', 'completed', 'make'),
('make_ob_vitalicio_manual_4', 'Alessandra Aparecida Figueiró Defavari', 'aleadefavari@gmail.com', '5519997213955', 'OB Acesso Vitalício', 'ob_vitalicio', 51.77, 97, '2025-12-06', 'invoice.payment_succeeded', 'completed', 'make'),
-- 07/12/2025 (9 registros)
('make_ob_vitalicio_manual_5', 'Bruno Amâncio Machado', 'brunoamanciomachado@gmail.com', '5535998799939', 'OB Acesso Vitalício', 'ob_vitalicio', 54.1, 97, '2025-12-07', 'invoice.payment_succeeded', 'completed', 'make'),
('make_ob_vitalicio_manual_6', 'Luis Gustavo Ferreira Silva', 'luisgustavofs345@gmail.com', '5516999955887', 'OB Acesso Vitalício', 'ob_vitalicio', 52.42, 97, '2025-12-07', 'invoice.payment_succeeded', 'completed', 'make'),
('make_ob_vitalicio_manual_7', 'Boanerges da Silva mesquita', 'boanerges.silva12@gmail.com', '5568999583262', 'OB Acesso Vitalício', 'ob_vitalicio', 51.77, 97, '2025-12-07', 'invoice.payment_succeeded', 'completed', 'make'),
('make_ob_vitalicio_manual_8', 'Mateus Müller Leobet', 'mateus@mlmincorporadora.com.br', '5554999856773', 'OB Acesso Vitalício', 'ob_vitalicio', 51.77, 97, '2025-12-07', 'invoice.payment_succeeded', 'completed', 'make'),
('make_ob_vitalicio_manual_9', 'Rafael da Costa Oliveira Faria', 'rafaelcofaria@gmail.com', '5521981030903', 'OB Acesso Vitalício', 'ob_vitalicio', 52.42, 97, '2025-12-07', 'invoice.payment_succeeded', 'completed', 'make'),
('make_ob_vitalicio_manual_10', 'Marcelo Farah', 'marcelocfarah@gmail.com', '5511992779955', 'OB Acesso Vitalício', 'ob_vitalicio', 54.1, 97, '2025-12-07', 'invoice.payment_succeeded', 'completed', 'make'),
('make_ob_vitalicio_manual_11', 'Leandro Martins', 'leandro.saudmed@gmail.com', '5511940353448', 'OB Acesso Vitalício', 'ob_vitalicio', 51.77, 97, '2025-12-07', 'invoice.payment_succeeded', 'completed', 'make'),
('make_ob_vitalicio_manual_12', 'Juarez Abdulmassih Filho', 'juarezmassih@gmail.com', '5561999833365', 'OB Acesso Vitalício', 'ob_vitalicio', 51.77, 97, '2025-12-07', 'invoice.payment_succeeded', 'completed', 'make'),
('make_ob_vitalicio_manual_13', 'Renato Antonio Soares', 'dr.renatoasoares@gmail.com', '5511995530476', 'OB Acesso Vitalício', 'ob_vitalicio', 54.1, 97, '2025-12-07', 'invoice.payment_succeeded', 'completed', 'make')
ON CONFLICT (hubla_id) DO NOTHING;