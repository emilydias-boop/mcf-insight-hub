import { supabase, SUPABASE_PROJECT_URL } from '@/integrations/supabase/client';

/**
 * Reset Supabase session - clears all local storage and signs out
 * Use this when experiencing connection issues or stale session problems
 */
export async function resetSupabaseSession(): Promise<void> {
  console.log('[Supabase] Resetting session...');
  
  try {
    // Try to sign out (ignore errors - session might already be invalid)
    await supabase.auth.signOut().catch(() => {});
  } catch (e) {
    console.warn('[Supabase] signOut error (ignored):', e);
  }
  
  // Clear all Supabase-related localStorage keys
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
    console.log(`[Supabase] Removed localStorage key: ${key}`);
  });
  
  console.log('[Supabase] Session reset complete');
}

export type ConnectivityStatus = 'checking' | 'ok' | 'cors_blocked' | 'server_error' | 'network_error';

export interface ConnectivityResult {
  status: ConnectivityStatus;
  message: string;
  responseTime?: number;
}

/**
 * Check Supabase connectivity with a direct fetch (bypasses supabase-js)
 * This helps diagnose CORS vs network vs server issues
 */
export async function checkSupabaseConnectivity(): Promise<ConnectivityResult> {
  const startTime = Date.now();
  const testUrl = `${SUPABASE_PROJECT_URL}/rest/v1/`;
  
  console.log('[Supabase] Checking connectivity to:', testUrl);
  console.log('[Supabase] Origin:', window.location.origin);
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
    
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlaGNmZ3F2aWdmY2VraWlwcWtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0Nzk1NzgsImV4cCI6MjA3OTA1NTU3OH0.Rab8S7rX6c7N92CufTkaXKJh0jpS9ydHWSmJMaPMVtE',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;
    
    console.log('[Supabase] Connectivity check response:', response.status, 'in', responseTime, 'ms');
    
    // Any response (even 401/404) means network is working
    if (response.status >= 200 && response.status < 500) {
      return {
        status: 'ok',
        message: `Conectividade OK (${responseTime}ms)`,
        responseTime,
      };
    }
    
    return {
      status: 'server_error',
      message: `Servidor instável (HTTP ${response.status})`,
      responseTime,
    };
    
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error?.message || String(error);
    
    console.error('[Supabase] Connectivity check failed:', errorMessage);
    
    // Detect specific error types
    if (errorMessage.includes('abort') || errorMessage.includes('timeout')) {
      return {
        status: 'server_error',
        message: 'Servidor demorou para responder (timeout)',
        responseTime,
      };
    }
    
    if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
      // This is typically CORS or network block
      return {
        status: 'cors_blocked',
        message: 'Bloqueado por CORS ou rede. Verifique as configurações do Supabase.',
        responseTime,
      };
    }
    
    return {
      status: 'network_error',
      message: `Erro de rede: ${errorMessage}`,
      responseTime,
    };
  }
}

/**
 * Get diagnostic info for debugging
 */
export function getSupabaseDiagnostics(): Record<string, string> {
  return {
    origin: window.location.origin,
    supabaseUrl: SUPABASE_PROJECT_URL,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent.slice(0, 100),
  };
}
