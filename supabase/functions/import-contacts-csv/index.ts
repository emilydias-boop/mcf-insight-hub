import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ClintContact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  tags?: string[];
  custom_fields?: Record<string, any>;
}

interface CSVContact {
  name: string;
  email?: string;
  complete_phone?: string;
  tags?: string;
  [key: string]: any;
}

interface ImportStats {
  total: number;
  created: number;
  updated: number;
  errors: number;
  errorDetails: Array<{ line: number; name: string; error: string }>;
}

// Parse CSV with semicolon separator
function parseCSV(csvText: string): CSVContact[] {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length === 0) {
    console.log('❌ CSV vazio');
    return [];
  }
  
  const headers = lines[0].split(';').map(h => h.trim().replace(/"/g, ''));
  console.log('📋 Cabeçalhos do CSV:', headers);
  
  // Detectar qual coluna contém o nome (flexível para português/inglês)
  const nameColumnIndex = headers.findIndex(h => 
    h.toLowerCase() === 'name' || 
    h.toLowerCase() === 'nome' || 
    h.toLowerCase() === 'name ' ||
    h.toLowerCase() === 'nome '
  );
  
  if (nameColumnIndex === -1) {
    console.log('⚠️ Coluna de nome não encontrada. Cabeçalhos disponíveis:', headers);
  }
  
  const contacts: CSVContact[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(';').map(v => v.trim().replace(/"/g, ''));
    const contact: CSVContact = { name: '' };
    
    headers.forEach((header, index) => {
      if (values[index]) {
        contact[header] = values[index];
      }
    });
    
    // Tentar pegar o nome de várias formas
    const name = contact.name || contact.Name || contact.nome || contact.Nome || 
                 (nameColumnIndex >= 0 ? values[nameColumnIndex] : '');
    
    if (name && name.trim()) {
      contact.name = name.trim();
      contacts.push(contact);
      if (i <= 3) {
        console.log(`✅ Linha ${i} válida:`, contact);
      }
    } else {
      if (i <= 3) {
        console.log(`⚠️ Linha ${i} sem nome:`, contact);
      }
    }
  }
  
  console.log(`📊 Total de contatos válidos: ${contacts.length} de ${lines.length - 1} linhas`);
  return contacts;
}

// Normalize phone number
function normalizePhone(phone?: string): string | undefined {
  if (!phone) return undefined;
  return phone.replace(/\D/g, '');
}

// Validate email
function isValidEmail(email?: string): boolean {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Convert CSV contact to API format
function convertToAPIFormat(csvContact: CSVContact): Partial<ClintContact> {
  const contact: Partial<ClintContact> = {
    name: csvContact.name,
  };
  
  if (csvContact.email && isValidEmail(csvContact.email)) {
    contact.email = csvContact.email.toLowerCase();
  }
  
  if (csvContact.complete_phone) {
    contact.phone = normalizePhone(csvContact.complete_phone);
  }
  
  // Parse tags
  if (csvContact.tags) {
    contact.tags = csvContact.tags.split(',').map(t => t.trim()).filter(Boolean);
  }
  
  // Collect custom fields
  const customFields: Record<string, any> = {};
  const standardFields = ['name', 'email', 'complete_phone', 'tags'];
  
  Object.keys(csvContact).forEach(key => {
    if (!standardFields.includes(key) && csvContact[key]) {
      customFields[key] = csvContact[key];
    }
  });
  
  if (Object.keys(customFields).length > 0) {
    contact.custom_fields = customFields;
  }
  
  return contact;
}

// Call Clint API
async function callClintAPI(resource: string, method: string, data?: any, apiKey?: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const { data: result, error } = await supabase.functions.invoke('clint-api', {
    body: { resource, method, data },
  });
  
  if (error) throw error;
  return result;
}

// Fetch all contacts from Clint API with pagination
async function fetchAllClintContacts(): Promise<ClintContact[]> {
  console.log('Fetching all contacts from Clint API...');
  const allContacts: ClintContact[] = [];
  let page = 1;
  let hasMore = true;
  
  while (hasMore) {
    const response = await callClintAPI(`contacts?page=${page}&per_page=100`, 'GET');
    const contacts = response.data || [];
    allContacts.push(...contacts);
    
    console.log(`Fetched page ${page}: ${contacts.length} contacts`);
    
    if (contacts.length < 100) {
      hasMore = false;
    } else {
      page++;
    }
  }
  
  console.log(`Total contacts fetched: ${allContacts.length}`);
  return allContacts;
}

// Find matching contact
function findMatch(csvContact: Partial<ClintContact>, apiContacts: ClintContact[]): ClintContact | undefined {
  // Priority 1: Match by email
  if (csvContact.email) {
    const emailMatch = apiContacts.find(c => 
      c.email?.toLowerCase() === csvContact.email?.toLowerCase()
    );
    if (emailMatch) return emailMatch;
  }
  
  // Priority 2: Match by phone
  if (csvContact.phone) {
    const phoneMatch = apiContacts.find(c => 
      normalizePhone(c.phone) === normalizePhone(csvContact.phone)
    );
    if (phoneMatch) return phoneMatch;
  }
  
  return undefined;
}

// Merge contact data
function mergeContact(existing: ClintContact, newData: Partial<ClintContact>): Partial<ClintContact> {
  const merged: Partial<ClintContact> = {
    name: newData.name || existing.name,
    email: newData.email || existing.email,
    phone: newData.phone || existing.phone,
  };
  
  // Merge tags (remove duplicates)
  const existingTags = existing.tags || [];
  const newTags = newData.tags || [];
  merged.tags = [...new Set([...existingTags, ...newTags])];
  
  // Merge custom_fields
  merged.custom_fields = {
    ...(existing.custom_fields || {}),
    ...(newData.custom_fields || {}),
  };
  
  return merged;
}

// Process contacts in chunks
async function processContacts(csvContacts: CSVContact[], apiContacts: ClintContact[]): Promise<ImportStats> {
  const stats: ImportStats = {
    total: csvContacts.length,
    created: 0,
    updated: 0,
    errors: 0,
    errorDetails: [],
  };
  
  const CHUNK_SIZE = 50;
  
  for (let i = 0; i < csvContacts.length; i += CHUNK_SIZE) {
    const chunk = csvContacts.slice(i, Math.min(i + CHUNK_SIZE, csvContacts.length));
    console.log(`Processing chunk ${Math.floor(i / CHUNK_SIZE) + 1}: contacts ${i + 1} to ${i + chunk.length}`);
    
    for (let j = 0; j < chunk.length; j++) {
      const csvContact = chunk[j];
      const lineNumber = i + j + 2; // +2 because of header and 0-index
      
      try {
        const apiContact = convertToAPIFormat(csvContact);
        
        if (!apiContact.name) {
          throw new Error('Name is required');
        }
        
        const match = findMatch(apiContact, apiContacts);
        
        if (match) {
          // Update existing contact
          const mergedData = mergeContact(match, apiContact);
          await callClintAPI(`contacts/${match.id}`, 'PUT', mergedData);
          stats.updated++;
          console.log(`Updated: ${apiContact.name}`);
        } else {
          // Create new contact
          const result = await callClintAPI('contacts', 'POST', apiContact);
          stats.created++;
          console.log(`Created: ${apiContact.name}`);
          
          // Add to apiContacts for future matching
          apiContacts.push(result.data);
        }
      } catch (error: any) {
        stats.errors++;
        stats.errorDetails.push({
          line: lineNumber,
          name: csvContact.name || 'Unknown',
          error: error?.message || 'Unknown error',
        });
        console.error(`Error processing contact at line ${lineNumber}:`, error);
      }
    }
    
    // Small delay between chunks to avoid rate limits
    if (i + CHUNK_SIZE < csvContacts.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return stats;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const startTime = Date.now();
    console.log('Starting CSV import...');
    
    // Get file from form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      throw new Error('No file provided');
    }
    
    console.log(`File received: ${file.name} (${file.size} bytes)`);
    
    // Read file content
    let csvText: string;
    
    if (file.name.endsWith('.gz')) {
      console.log('Decompressing .gz file...');
      const compressed = new Uint8Array(await file.arrayBuffer());
      // For now, we'll handle uncompressed files. User should upload uncompressed CSV
      // or we need to add a decompression library
      throw new Error('Compressed files not yet supported. Please upload uncompressed CSV.');
    } else {
      csvText = await file.text();
    }
    
    console.log('Parsing CSV...');
    const csvContacts = parseCSV(csvText);
    console.log(`Parsed ${csvContacts.length} contacts from CSV`);
    
    if (csvContacts.length === 0) {
      throw new Error('No valid contacts found in CSV');
    }
    
    console.log('Fetching existing contacts from API...');
    const apiContacts = await fetchAllClintContacts();
    
    console.log('Processing contacts...');
    const stats = await processContacts(csvContacts, apiContacts);
    
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    
    console.log('Import completed:', stats);
    
    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          ...stats,
          duration,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Import error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
