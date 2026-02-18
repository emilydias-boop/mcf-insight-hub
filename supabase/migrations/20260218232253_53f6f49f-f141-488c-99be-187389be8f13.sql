
-- Step 1: Remove launch flag from all EXCEPT the 25 approved emails
UPDATE hubla_transactions 
SET sale_origin = NULL 
WHERE sale_origin = 'launch' 
AND LOWER(customer_email) NOT IN (
  'chavesjunior60@gmail.com',
  'josinaldojx3@gmail.com',
  'abraopericias@gmail.com',
  'edinho.vasques@yahoo.com.br',
  'pedrofmanco@outlook.com.br',
  'arlan_unai45@hotmail.com',
  'dil_903@hotmail.com',
  'alessandrosantanasouza4@gmail.com',
  'drpedrohquirino@gmail.com',
  'olavovilela10@gmail.com',
  'fernandamauzer@gmail.com',
  'alessandro.perossi@hotmail.com',
  'brenolucas@gmail.com',
  'paulowaf@gmail.com',
  'rodrigomoreira@harpiapecas.com.br',
  'joseclerqb@gmail.com',
  'gobira.thon@gmail.com',
  'engenheiroyurimonteiro@gmail.com',
  'fernandaholdorf@gmail.com',
  'linofernandoviveiros@gmail.com',
  'neynrap2017@gmail.com',
  'wallceveras@gmail.com',
  'ricardson.rocha@gmail.com',
  'jfmoveis@icloud.com',
  'fabioacq10@gmail.com'
);

-- Step 2: Ensure the 2 missing emails get the launch flag
UPDATE hubla_transactions 
SET sale_origin = 'launch' 
WHERE LOWER(customer_email) IN ('chavesjunior60@gmail.com', 'arlan_unai45@hotmail.com')
AND sale_origin IS NULL;
