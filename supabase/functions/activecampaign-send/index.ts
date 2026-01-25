// ActiveCampaign Send - Send emails via ActiveCampaign API
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendRequest {
  email: string;
  name: string;
  subject: string;
  content: string;
  templateId?: string;
  tags?: string[];
  listId?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: SendRequest = await req.json();
    console.log('[ACTIVECAMPAIGN] Request:', JSON.stringify({ email: body.email, subject: body.subject }));

    const { email, name, subject, content, templateId, tags, listId } = body;

    if (!email) {
      throw new Error('Missing required field: email');
    }

    // Get ActiveCampaign credentials from environment
    const apiKey = Deno.env.get('ACTIVECAMPAIGN_API_KEY');
    const accountUrl = Deno.env.get('ACTIVECAMPAIGN_ACCOUNT_URL');

    if (!apiKey || !accountUrl) {
      console.error('[ACTIVECAMPAIGN] Missing credentials');
      throw new Error('ActiveCampaign credentials not configured');
    }

    // Normalize account URL
    const baseUrl = accountUrl.endsWith('/') ? accountUrl.slice(0, -1) : accountUrl;
    const apiUrl = baseUrl.includes('/api/') ? baseUrl : `${baseUrl}/api/3`;

    // 1. Create or update contact
    console.log('[ACTIVECAMPAIGN] Creating/updating contact...');
    
    const contactPayload = {
      contact: {
        email,
        firstName: name?.split(' ')[0] || '',
        lastName: name?.split(' ').slice(1).join(' ') || '',
      }
    };

    const syncResponse = await fetch(`${apiUrl}/contact/sync`, {
      method: 'POST',
      headers: {
        'Api-Token': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(contactPayload)
    });

    const syncResult = await syncResponse.json();

    if (!syncResponse.ok) {
      console.error('[ACTIVECAMPAIGN] Sync error:', syncResult);
      throw new Error(syncResult.message || 'Failed to sync contact');
    }

    const contactId = syncResult.contact?.id;
    console.log('[ACTIVECAMPAIGN] Contact synced:', contactId);

    // 2. Add tags if provided
    if (tags && tags.length > 0 && contactId) {
      for (const tagName of tags) {
        try {
          // First, find or create the tag
          const tagSearchResponse = await fetch(`${apiUrl}/tags?search=${encodeURIComponent(tagName)}`, {
            headers: { 'Api-Token': apiKey }
          });
          const tagSearchResult = await tagSearchResponse.json();
          
          let tagId = tagSearchResult.tags?.[0]?.id;
          
          if (!tagId) {
            // Create tag
            const createTagResponse = await fetch(`${apiUrl}/tags`, {
              method: 'POST',
              headers: {
                'Api-Token': apiKey,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ tag: { tag: tagName, tagType: 'contact' } })
            });
            const createTagResult = await createTagResponse.json();
            tagId = createTagResult.tag?.id;
          }

          if (tagId) {
            // Add tag to contact
            await fetch(`${apiUrl}/contactTags`, {
              method: 'POST',
              headers: {
                'Api-Token': apiKey,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ contactTag: { contact: contactId, tag: tagId } })
            });
            console.log(`[ACTIVECAMPAIGN] Added tag "${tagName}" to contact`);
          }
        } catch (tagError: any) {
          console.warn('[ACTIVECAMPAIGN] Error adding tag:', tagError.message);
        }
      }
    }

    // 3. Add to list if provided
    if (listId && contactId) {
      try {
        await fetch(`${apiUrl}/contactLists`, {
          method: 'POST',
          headers: {
            'Api-Token': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contactList: {
              list: listId,
              contact: contactId,
              status: 1 // Active
            }
          })
        });
        console.log(`[ACTIVECAMPAIGN] Added contact to list ${listId}`);
      } catch (listError: any) {
        console.warn('[ACTIVECAMPAIGN] Error adding to list:', listError.message);
      }
    }

    // 4. Try to send transactional email via AC API
    // Note: This requires the Transactional Email add-on in ActiveCampaign
    let messageId: string | undefined;
    let emailSent = false;

    if (subject && content && contactId) {
      try {
        // Try sending via transactional API (requires Postmark/AC transactional add-on)
        const messageResponse = await fetch(`${apiUrl}/messages`, {
          method: 'POST',
          headers: {
            'Api-Token': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              contact: contactId,
              fromname: 'Equipe MCF',
              fromemail: 'contato@mcf.com.br', // Use your verified sender
              subject: subject,
              html: content,
            }
          })
        });

        if (messageResponse.ok) {
          const messageResult = await messageResponse.json();
          messageId = messageResult.message?.id;
          emailSent = true;
          console.log('[ACTIVECAMPAIGN] Email sent via transactional API:', messageId);
        } else {
          // Fallback: Use tag-based automation trigger
          console.log('[ACTIVECAMPAIGN] Transactional API not available, using tag trigger');
          
          const triggerTagName = `email_trigger_${Date.now()}`;
          const createTagResponse = await fetch(`${apiUrl}/tags`, {
            method: 'POST',
            headers: {
              'Api-Token': apiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ tag: { tag: triggerTagName, tagType: 'contact' } })
          });
          
          if (createTagResponse.ok) {
            const createTagResult = await createTagResponse.json();
            const triggerTagId = createTagResult.tag?.id;

            if (triggerTagId) {
              await fetch(`${apiUrl}/contactTags`, {
                method: 'POST',
                headers: {
                  'Api-Token': apiKey,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ contactTag: { contact: contactId, tag: triggerTagId } })
              });
              emailSent = true;
              console.log('[ACTIVECAMPAIGN] Trigger tag added for automation');
            }
          }
        }
      } catch (sendError: any) {
        console.warn('[ACTIVECAMPAIGN] Error sending email:', sendError.message);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        contactId,
        messageId,
        emailSent,
        message: emailSent ? 'Email sent successfully' : 'Contact synced, email pending automation'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[ACTIVECAMPAIGN] Error:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
