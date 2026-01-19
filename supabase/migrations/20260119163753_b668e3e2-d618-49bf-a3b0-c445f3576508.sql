-- Primeiro, remover templates duplicados que possam existir
DELETE FROM activity_templates WHERE stage_id IS NOT NULL;

-- NOVO LEAD (cf4a369c-c4a6-4299-933d-5ae3dcc39d4b) - Múltiplas tentativas de contato
INSERT INTO activity_templates (name, type, stage_id, origin_id, order_index, is_active, description, default_due_days) VALUES
('Tentativa de Ligação 01', 'call', 'cf4a369c-c4a6-4299-933d-5ae3dcc39d4b', 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c', 1, true, 'Primeira tentativa de contato telefônico', 0),
('Tentativa de Whatsapp 01', 'whatsapp', 'cf4a369c-c4a6-4299-933d-5ae3dcc39d4b', 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c', 2, true, 'Primeira mensagem de WhatsApp', 0),
('Tentativa de Whatsapp 02', 'whatsapp', 'cf4a369c-c4a6-4299-933d-5ae3dcc39d4b', 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c', 3, true, 'Segunda mensagem de WhatsApp', 0),
('Tentativa de Ligação 02', 'call', 'cf4a369c-c4a6-4299-933d-5ae3dcc39d4b', 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c', 4, true, 'Segunda tentativa de contato', 1),
('Tentativa de Ligação 03', 'call', 'cf4a369c-c4a6-4299-933d-5ae3dcc39d4b', 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c', 5, true, 'Terceira tentativa de contato', 1),
('Tentativa de Ligação 04', 'call', 'cf4a369c-c4a6-4299-933d-5ae3dcc39d4b', 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c', 6, true, 'Quarta tentativa de contato', 2),
('Tentativa de Ligação 05', 'call', 'cf4a369c-c4a6-4299-933d-5ae3dcc39d4b', 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c', 7, true, 'Quinta tentativa de contato', 2);

-- LEAD QUALIFICADO (a1d19874-4d47-4405-94fd-fb5237da44dd)
INSERT INTO activity_templates (name, type, stage_id, origin_id, order_index, is_active, description, default_due_days) VALUES
('Confirmação de Interesse', 'call', 'a1d19874-4d47-4405-94fd-fb5237da44dd', 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c', 1, true, 'Confirmar interesse e agendar reunião', 0),
('Envio de Material', 'whatsapp', 'a1d19874-4d47-4405-94fd-fb5237da44dd', 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c', 2, true, 'Enviar material informativo', 0),
('Follow-up de Qualificação', 'call', 'a1d19874-4d47-4405-94fd-fb5237da44dd', 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c', 3, true, 'Acompanhamento após qualificação', 1);

-- REUNIÃO 01 AGENDADA (a8365215-fd31-4bdc-bbe7-77100fa39e53)
INSERT INTO activity_templates (name, type, stage_id, origin_id, order_index, is_active, description, default_due_days) VALUES
('Confirmação de Reunião - 24h antes', 'whatsapp', 'a8365215-fd31-4bdc-bbe7-77100fa39e53', 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c', 1, true, 'Confirmar presença 24h antes', 0),
('Confirmação de Reunião - 1h antes', 'whatsapp', 'a8365215-fd31-4bdc-bbe7-77100fa39e53', 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c', 2, true, 'Lembrete 1h antes da reunião', 0),
('Envio de Link da Reunião', 'whatsapp', 'a8365215-fd31-4bdc-bbe7-77100fa39e53', 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c', 3, true, 'Enviar link de acesso', 0);

-- NO-SHOW (8f170b9b-5c99-43ce-afeb-896e1a6f4151)
INSERT INTO activity_templates (name, type, stage_id, origin_id, order_index, is_active, description, default_due_days) VALUES
('Tentativa de Reagendamento 01', 'call', '8f170b9b-5c99-43ce-afeb-896e1a6f4151', 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c', 1, true, 'Primeira tentativa de reagendar', 0),
('WhatsApp de Reagendamento', 'whatsapp', '8f170b9b-5c99-43ce-afeb-896e1a6f4151', 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c', 2, true, 'Oferecer novo horário via WhatsApp', 0),
('Tentativa de Reagendamento 02', 'call', '8f170b9b-5c99-43ce-afeb-896e1a6f4151', 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c', 3, true, 'Segunda tentativa de reagendar', 1);

-- REUNIÃO 01 REALIZADA (34995d75-933e-4d67-b7fc-19fcb8b81680)
INSERT INTO activity_templates (name, type, stage_id, origin_id, order_index, is_active, description, default_due_days) VALUES
('Follow-up pós R1', 'call', '34995d75-933e-4d67-b7fc-19fcb8b81680', 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c', 1, true, 'Acompanhamento após primeira reunião', 0),
('Envio de Proposta', 'email', '34995d75-933e-4d67-b7fc-19fcb8b81680', 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c', 2, true, 'Enviar proposta por e-mail', 1);

-- CONTRATO PAGO (062927f5-b7a3-496a-9d47-eb03b3d69b10)
INSERT INTO activity_templates (name, type, stage_id, origin_id, order_index, is_active, description, default_due_days) VALUES
('Boas-vindas ao Cliente', 'whatsapp', '062927f5-b7a3-496a-9d47-eb03b3d69b10', 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c', 1, true, 'Mensagem de boas-vindas', 0),
('Agendar R2 / Onboarding', 'call', '062927f5-b7a3-496a-9d47-eb03b3d69b10', 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c', 2, true, 'Agendar reunião de onboarding', 1);

-- REUNIÃO 02 AGENDADA (af1734ad-9ed8-46b0-9389-3ad8d1973931)
INSERT INTO activity_templates (name, type, stage_id, origin_id, order_index, is_active, description, default_due_days) VALUES
('Confirmação R2 - 24h antes', 'whatsapp', 'af1734ad-9ed8-46b0-9389-3ad8d1973931', 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c', 1, true, 'Confirmar reunião 2', 0),
('Confirmação R2 - 1h antes', 'whatsapp', 'af1734ad-9ed8-46b0-9389-3ad8d1973931', 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c', 2, true, 'Lembrete 1h antes', 0);

-- REUNIÃO 02 REALIZADA (155f9eab-0c1d-4215-b2e8-25fb546ba456)
INSERT INTO activity_templates (name, type, stage_id, origin_id, order_index, is_active, description, default_due_days) VALUES
('Follow-up pós R2', 'call', '155f9eab-0c1d-4215-b2e8-25fb546ba456', 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c', 1, true, 'Acompanhamento após segunda reunião', 0),
('Próximos Passos', 'whatsapp', '155f9eab-0c1d-4215-b2e8-25fb546ba456', 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c', 2, true, 'Enviar próximos passos', 1);