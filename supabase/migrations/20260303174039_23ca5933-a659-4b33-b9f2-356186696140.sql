
-- Delete 19 duplicate deals within PIPELINE INSIDE SALES
-- Keeping the deal with most activities/history for each contact
-- Deals to delete are webhook duplicates with fewer activities

DELETE FROM crm_deals WHERE id IN (
  'f1d48db3-a0f3-41eb-a18d-1358eb5c7603',  -- Clayton Dias (0 ativ, dup)
  '5faf3662-7c2c-4c36-bf81-2c6e4a678ff8',  -- Daniel Muniz (1 ativ, dup)
  '4ad4aa4d-fd64-4909-b0d0-2fc2ca12c3da',  -- David Linhares (0 ativ, dup)
  '3cd7cb88-d6f0-441f-aac5-1ebfecc64384',  -- Fernando César (0 ativ, dup)
  '582e3c8f-31e6-471f-930a-3e43c953de93',  -- Gabriel Castillo (5 ativ, dup)
  '8dfab1e8-2c83-45e7-9d26-05e9b5df4b73',  -- Gunther Dantas (0 ativ, dup)
  '5d8211c9-36cb-4335-9a16-98cf327e8ce3',  -- Ismael Freitas (6 ativ, dup)
  '34c2d85d-fb8f-4463-9f31-5d5a276c187c',  -- Juventino (0 ativ, dup)
  '3fa2af94-47db-4516-b42b-d6a0389c1a71',  -- Kauan Moraes (3 ativ, dup)
  '727879b9-465b-4b55-8fdd-f171d5d97f73',  -- Lorran Pinho (0 ativ, dup)
  '0616624d-a4d8-4dfa-87ce-ca91e62d204c',  -- Lúcia Napolitano (0 ativ, dup)
  '64057cca-18c2-4e09-a05c-cc7ed1e0614b',  -- Macelo Araujo (0 ativ, dup)
  'b1bd5259-65f4-4227-904e-5c8c504b3667',  -- O Sal (0 ativ, dup)
  'cc8b9dfd-1899-497a-a925-189042d8a8d5',  -- Salomão Eineck (0 ativ, dup)
  'd63e4034-920f-4bdd-b1a1-ebc17a8634bd',  -- Tiago Brunelli (5 ativ, dup)
  '28d99693-b6b5-42a3-b290-d49764f69c7c',  -- Ulysses Silva (0 ativ, dup 1)
  '9baf28a4-db98-44b8-8206-51717dfe7216'   -- Ulysses Silva (0 ativ, dup 2)
);
