ALTER TABLE public.profiles ADD COLUMN can_book_r2 boolean DEFAULT false;

UPDATE public.profiles SET can_book_r2 = true
WHERE id IN (
  '04bb4045-701d-443c-b2c9-aee74e7f58d9',
  'dd76c153-a4a5-432e-ab4c-0b48f6141659',
  'c8fd2b83-2aee-41a4-9154-e812f492bc5f',
  '6bb81a27-fd8f-4af8-bce0-377f3576124f',
  '6cb06155-26dd-4be9-87ce-53e60a59a4e7',
  'a6802c50-1b85-4646-b20e-f40ae89c3157'
);