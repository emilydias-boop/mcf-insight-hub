-- 1) ONE-OFF FIX: enriquecer o lead "Thiago" com os dados do comprador Hubla
UPDATE public.crm_contacts
SET name = 'Thiago Teixeira Clemente',
    email = 'tec.consultoria@icloud.com',
    phone = '+5512991043714',
    updated_at = now()
WHERE id = '00570c09-9f84-47d2-b4e2-bb1131d17604';

UPDATE public.crm_deals
SET name = 'Thiago Teixeira Clemente',
    updated_at = now()
WHERE id = '98be16be-8bd9-416f-95a3-af6599fa3851';

UPDATE public.meeting_slot_attendees
SET attendee_name = 'Thiago Teixeira Clemente',
    attendee_phone = '+5512991043714',
    updated_at = now()
WHERE id = '167adfae-c5f2-47c1-affb-eea61862448d';

UPDATE public.hubla_transactions
SET linked_deal_id = '98be16be-8bd9-416f-95a3-af6599fa3851',
    updated_at = now()
WHERE id = 'fbab2806-ed7a-4dd9-81a5-8f29acc300e5'
  AND linked_deal_id IS NULL;

-- 2) PREVENÇÃO: função que sincroniza dados do comprador Hubla para o CRM
CREATE OR REPLACE FUNCTION public.sync_hubla_buyer_to_crm(p_attendee_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx          RECORD;
  v_att         RECORD;
  v_deal        RECORD;
  v_contact     RECORD;
  v_new_name    text;
  v_new_email   text;
  v_new_phone   text;
  v_new_attname text;
  v_new_attphone text;
BEGIN
  IF p_attendee_id IS NULL THEN
    RETURN;
  END IF;

  -- Última transação Hubla completed vinculada ao attendee
  SELECT id, customer_name, customer_email, customer_phone, linked_deal_id
    INTO v_tx
  FROM public.hubla_transactions
  WHERE linked_attendee_id = p_attendee_id
    AND sale_status = 'completed'
    AND COALESCE(customer_name, customer_email, customer_phone) IS NOT NULL
  ORDER BY sale_date DESC NULLS LAST, created_at DESC
  LIMIT 1;

  IF v_tx.id IS NULL THEN
    RETURN;
  END IF;

  -- Resolver attendee → deal / contact
  SELECT id, deal_id, contact_id, attendee_name, attendee_phone
    INTO v_att
  FROM public.meeting_slot_attendees
  WHERE id = p_attendee_id;

  IF v_att.id IS NULL THEN
    RETURN;
  END IF;

  -- Enriquecer crm_contacts (só preenche se atual estiver vazio ou mais curto)
  IF v_att.contact_id IS NOT NULL THEN
    SELECT id, name, email, phone
      INTO v_contact
    FROM public.crm_contacts
    WHERE id = v_att.contact_id;

    IF v_contact.id IS NOT NULL THEN
      v_new_name := CASE
        WHEN v_tx.customer_name IS NULL OR length(trim(v_tx.customer_name)) = 0 THEN v_contact.name
        WHEN v_contact.name IS NULL OR length(trim(v_contact.name)) = 0 THEN v_tx.customer_name
        WHEN array_length(regexp_split_to_array(trim(v_tx.customer_name), '\s+'), 1)
             > array_length(regexp_split_to_array(trim(v_contact.name), '\s+'), 1)
          THEN v_tx.customer_name
        ELSE v_contact.name
      END;

      v_new_email := CASE
        WHEN v_contact.email IS NULL OR length(trim(v_contact.email)) = 0 THEN v_tx.customer_email
        ELSE v_contact.email
      END;

      v_new_phone := CASE
        WHEN v_tx.customer_phone IS NULL OR length(trim(v_tx.customer_phone)) = 0 THEN v_contact.phone
        WHEN v_contact.phone IS NULL OR length(trim(v_contact.phone)) = 0 THEN v_tx.customer_phone
        WHEN length(regexp_replace(v_contact.phone, '\D', '', 'g')) < 10 THEN v_tx.customer_phone
        ELSE v_contact.phone
      END;

      UPDATE public.crm_contacts
      SET name = v_new_name,
          email = v_new_email,
          phone = v_new_phone,
          updated_at = now()
      WHERE id = v_contact.id
        AND (
          v_new_name IS DISTINCT FROM v_contact.name
          OR v_new_email IS DISTINCT FROM v_contact.email
          OR v_new_phone IS DISTINCT FROM v_contact.phone
        );
    END IF;
  END IF;

  -- Enriquecer crm_deals.name
  IF v_att.deal_id IS NOT NULL THEN
    SELECT id, name INTO v_deal FROM public.crm_deals WHERE id = v_att.deal_id;
    IF v_deal.id IS NOT NULL AND v_tx.customer_name IS NOT NULL THEN
      IF v_deal.name IS NULL
         OR length(trim(v_deal.name)) = 0
         OR array_length(regexp_split_to_array(trim(v_tx.customer_name), '\s+'), 1)
            > array_length(regexp_split_to_array(trim(COALESCE(v_deal.name, '')), '\s+'), 1)
      THEN
        UPDATE public.crm_deals
        SET name = v_tx.customer_name, updated_at = now()
        WHERE id = v_deal.id
          AND name IS DISTINCT FROM v_tx.customer_name;
      END IF;
    END IF;
  END IF;

  -- Enriquecer meeting_slot_attendees
  v_new_attname := CASE
    WHEN v_tx.customer_name IS NULL OR length(trim(v_tx.customer_name)) = 0 THEN v_att.attendee_name
    WHEN v_att.attendee_name IS NULL OR length(trim(v_att.attendee_name)) = 0 THEN v_tx.customer_name
    WHEN array_length(regexp_split_to_array(trim(v_tx.customer_name), '\s+'), 1)
         > array_length(regexp_split_to_array(trim(v_att.attendee_name), '\s+'), 1)
      THEN v_tx.customer_name
    ELSE v_att.attendee_name
  END;

  v_new_attphone := CASE
    WHEN v_tx.customer_phone IS NULL OR length(trim(v_tx.customer_phone)) = 0 THEN v_att.attendee_phone
    WHEN v_att.attendee_phone IS NULL OR length(trim(v_att.attendee_phone)) = 0 THEN v_tx.customer_phone
    WHEN length(regexp_replace(v_att.attendee_phone, '\D', '', 'g')) < 10 THEN v_tx.customer_phone
    ELSE v_att.attendee_phone
  END;

  UPDATE public.meeting_slot_attendees
  SET attendee_name = v_new_attname,
      attendee_phone = v_new_attphone,
      updated_at = now()
  WHERE id = v_att.id
    AND (
      v_new_attname IS DISTINCT FROM v_att.attendee_name
      OR v_new_attphone IS DISTINCT FROM v_att.attendee_phone
    );

  -- Vincular deal na transação se ainda não estiver vinculada
  IF v_tx.linked_deal_id IS NULL AND v_att.deal_id IS NOT NULL THEN
    UPDATE public.hubla_transactions
    SET linked_deal_id = v_att.deal_id, updated_at = now()
    WHERE id = v_tx.id AND linked_deal_id IS NULL;
  END IF;
END;
$$;

-- 3) Trigger em meeting_slot_attendees: ao marcar contract_paid
CREATE OR REPLACE FUNCTION public.trg_attendee_sync_hubla_buyer_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.status = 'contract_paid' AND COALESCE(OLD.status, '') <> 'contract_paid')
     OR (NEW.contract_paid_at IS NOT NULL AND OLD.contract_paid_at IS NULL)
  THEN
    PERFORM public.sync_hubla_buyer_to_crm(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_attendee_sync_hubla_buyer ON public.meeting_slot_attendees;
CREATE TRIGGER trg_attendee_sync_hubla_buyer
AFTER UPDATE OF status, contract_paid_at ON public.meeting_slot_attendees
FOR EACH ROW
EXECUTE FUNCTION public.trg_attendee_sync_hubla_buyer_fn();

-- 4) Trigger em hubla_transactions: ao vincular attendee ou completar venda
CREATE OR REPLACE FUNCTION public.trg_hubla_sync_buyer_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.linked_attendee_id IS NOT NULL
     AND COALESCE(NEW.sale_status, '') = 'completed'
  THEN
    PERFORM public.sync_hubla_buyer_to_crm(NEW.linked_attendee_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hubla_sync_buyer ON public.hubla_transactions;
CREATE TRIGGER trg_hubla_sync_buyer
AFTER INSERT OR UPDATE OF linked_attendee_id, sale_status ON public.hubla_transactions
FOR EACH ROW
EXECUTE FUNCTION public.trg_hubla_sync_buyer_fn();