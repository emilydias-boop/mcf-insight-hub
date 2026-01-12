-- Remove atividades de teste/duplicadas da Caroline Correa
DELETE FROM deal_activities 
WHERE id IN (
  '0328dfea-0680-43b3-a089-002206f261df',  -- Teste Alex (14:05:19)
  '99e23e9f-c793-405f-a433-fdceb2ed5cdc'   -- Duplicado Vinicius (12:58:15)
);