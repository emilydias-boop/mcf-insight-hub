DELETE FROM public.deal_activities WHERE deal_id = '7ff66e52-601d-44ec-825a-513315f1a212';
DELETE FROM public.lead_profiles WHERE deal_id = '7ff66e52-601d-44ec-825a-513315f1a212' OR contact_id = '4ce3456a-9934-489c-a798-77570688984b';
DELETE FROM public.crm_deals WHERE id = '7ff66e52-601d-44ec-825a-513315f1a212';
DELETE FROM public.crm_contacts WHERE id = '4ce3456a-9934-489c-a798-77570688984b';

UPDATE public.crm_deals
SET tags = array_remove(tags, 'Anamnese-YTB')
WHERE id = 'dc9b9b7e-1d15-444a-acfc-15fc6a546ec1';

DELETE FROM public.deal_activities
WHERE deal_id = 'dc9b9b7e-1d15-444a-acfc-15fc6a546ec1'
  AND activity_type = 'tags_changed'
  AND created_at > now() - interval '1 hour';