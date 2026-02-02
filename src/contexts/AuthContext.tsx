import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

type AppRole = 'admin' | 'manager' | 'viewer' | 'sdr' | 'closer' | 'coordenador' | 'closer_sombra' | 'financeiro' | 'rh';

const ROLE_PRIORITY: Record<string, number> = {
  admin: 1,
  manager: 2,
  coordenador: 3,
  closer: 4,
  closer_sombra: 5,
  financeiro: 6,
  rh: 7,
  sdr: 8,
  viewer: 9,
};

// Timeout constants
const AUTH_TIMEOUT_MS = 5000; // 5s for session check
const ROLE_TIMEOUT_MS = 8000; // 8s for role fetching
const WATCHDOG_TIMEOUT_MS = 10000; // 10s absolute max

interface AuthState {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  allRoles: AppRole[];
  loading: boolean; // This is now authLoading (session only)
  roleLoading: boolean;
}

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (...roles: AppRole[]) => boolean;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper: Promise with timeout
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))
  ]);
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [allRoles, setAllRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true); // authLoading - only session
  const [roleLoading, setRoleLoading] = useState(false);
  const navigate = useNavigate();
  
  const roleLoadVersion = useRef(0);
  const initialSessionHandled = useRef(false);
  const initStartTime = useRef(Date.now());
  const hasLoadedRoles = useRef(false);

  // Fetch roles with timeout
  const fetchUserRoles = async (userId: string): Promise<{ primaryRole: AppRole | null; roles: AppRole[] }> => {
    const startTime = Date.now();
    console.log('[Auth] Fetching roles for user:', userId);
    
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      console.log(`[Auth] Roles query took ${Date.now() - startTime}ms`);

      if (error) {
        console.error('[Auth] Error fetching user roles:', error);
        return { primaryRole: null, roles: [] };
      }

      if (!data || data.length === 0) {
        return { primaryRole: null, roles: [] };
      }

      const roles = data.map(r => r.role as AppRole);
      const sortedRoles = [...roles].sort((a, b) => 
        (ROLE_PRIORITY[a] || 99) - (ROLE_PRIORITY[b] || 99)
      );
      
      return { primaryRole: sortedRoles[0], roles };
    } catch (err) {
      console.error('[Auth] Exception fetching roles:', err);
      return { primaryRole: null, roles: [] };
    }
  };

  // Check if user is blocked - with timeout
  const checkUserBlocked = async (userId: string): Promise<boolean> => {
    const startTime = Date.now();
    console.log('[Auth] Checking blocked status for:', userId);
    
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('access_status, blocked_until')
        .eq('id', userId)
        .maybeSingle();

      console.log(`[Auth] Profile query took ${Date.now() - startTime}ms`);

      if (error) {
        console.warn('[Auth] Error checking profile:', error);
        return false; // Allow access on error (fail-open for UX, security handled by RLS)
      }

      if (!profile) return false;

      const isBlocked = profile.access_status === 'bloqueado' || 
                       profile.access_status === 'desativado' ||
                       (profile.blocked_until && new Date(profile.blocked_until) > new Date());
      
      return isBlocked;
    } catch (err) {
      console.warn('[Auth] Exception checking blocked:', err);
      return false;
    }
  };

  // Load roles in background (non-blocking)
  const loadRolesInBackground = async (userId: string, version: number) => {
    setRoleLoading(true);
    
    try {
      // Check blocked status with timeout
      const isBlocked = await withTimeout(
        checkUserBlocked(userId),
        ROLE_TIMEOUT_MS,
        false
      );

      if (version !== roleLoadVersion.current) return;

      if (isBlocked) {
        console.log('[Auth] User is blocked, signing out');
        await supabase.auth.signOut();
        setUser(null);
        setSession(null);
        setRole(null);
        setAllRoles([]);
        toast.error('Sua conta foi bloqueada ou desativada.');
        return;
      }

      // Fetch roles with timeout - null indicates timeout occurred
      const roleResult = await withTimeout(
        fetchUserRoles(userId),
        ROLE_TIMEOUT_MS,
        null // fallback: null means timeout
      );

      if (version !== roleLoadVersion.current) return;

      // If timeout occurred, use viewer BUT don't mark as loaded
      // This allows roles to be reloaded on next event (TOKEN_REFRESHED, etc.)
      if (roleResult === null) {
        console.warn('[Auth] Role fetch timed out, using viewer temporarily');
        setRole('viewer');
        setAllRoles(['viewer']);
        // Do NOT set hasLoadedRoles.current = true here!
        return;
      }

      const { primaryRole, roles } = roleResult;

      if (roles.length === 0) {
        setRole('viewer');
        setAllRoles(['viewer']);
      } else {
        setRole(primaryRole);
        setAllRoles(roles);
      }
      
      // Only mark as loaded if we actually fetched from database
      hasLoadedRoles.current = true;
      console.log('[Auth] Roles loaded:', { primaryRole, roles });
    } catch (error) {
      console.error('[Auth] Error in loadRolesInBackground:', error);
      if (version === roleLoadVersion.current) {
        setRole('viewer');
        setAllRoles(['viewer']);
        // Don't mark as loaded on error - allow retry
      }
    } finally {
      if (version === roleLoadVersion.current) {
        setRoleLoading(false);
      }
    }
  };

  // Handle session - FAST path (no blocking DB calls)
  const handleSession = (newSession: Session | null) => {
    const myVersion = ++roleLoadVersion.current;
    const elapsed = Date.now() - initStartTime.current;
    console.log(`[Auth] handleSession called after ${elapsed}ms, session:`, !!newSession);
    
    if (!newSession?.user) {
      setSession(null);
      setUser(null);
      setRole(null);
      setAllRoles([]);
      setLoading(false);
      setRoleLoading(false);
      console.log('[Auth] No session, auth complete');
      return;
    }

    // IMMEDIATELY update session and user - this unblocks ProtectedRoute
    setSession(newSession);
    setUser(newSession.user);
    setLoading(false); // Auth is done! User has valid session
    console.log('[Auth] Session set, authLoading=false');

    // Apply default role while loading real roles
    setRole('viewer');
    setAllRoles(['viewer']);

    // Set roleLoading=true BEFORE scheduling background load to prevent race condition
    // This ensures guards wait for roles instead of evaluating with default 'viewer'
    setRoleLoading(true);

    // Load roles in background (non-blocking) using setTimeout(0)
    setTimeout(() => {
      loadRolesInBackground(newSession.user.id, myVersion);
    }, 0);
  };

  useEffect(() => {
    initStartTime.current = Date.now();
    console.log('[Auth] Initializing auth...');

    // WATCHDOG: Force loading=false after absolute max time
    const watchdogTimer = setTimeout(() => {
      if (loading) {
        console.warn('[Auth] Watchdog triggered! Forcing loading=false');
        setLoading(false);
        // If we have no user by now, they'll be redirected to /auth
      }
    }, WATCHDOG_TIMEOUT_MS);

    // Setup auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        console.log(`[Auth] onAuthStateChange: ${event}`);
        
        if (event === 'INITIAL_SESSION') {
          if (initialSessionHandled.current) {
            return;
          }
          initialSessionHandled.current = true;
        }
        
        // Preserve roles during token refresh - don't reset if same user
        // BUT: if roles weren't properly loaded (timeout occurred), try again
        if ((event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') && 
            user && 
            newSession?.user?.id === user.id) {
          
          if (!hasLoadedRoles.current) {
            // Previous load timed out - retry now
            console.log('[Auth] Token refreshed but roles not loaded, reloading...');
            const myVersion = ++roleLoadVersion.current;
            setRoleLoading(true);
            setTimeout(() => {
              loadRolesInBackground(newSession.user.id, myVersion);
            }, 0);
          } else {
            console.log('[Auth] Token refreshed, keeping existing roles');
          }
          setSession(newSession);
          return;
        }
        
        handleSession(newSession);
      }
    );

    // Also try getSession (with timeout) as backup
    const getSessionWithTimeout = async () => {
      try {
        const result = await withTimeout(
          supabase.auth.getSession(),
          AUTH_TIMEOUT_MS,
          { data: { session: null }, error: null }
        );
        
        if (!initialSessionHandled.current) {
          initialSessionHandled.current = true;
          handleSession(result.data.session);
        }
      } catch (err) {
        console.error('[Auth] getSession error:', err);
        if (!initialSessionHandled.current) {
          initialSessionHandled.current = true;
          setLoading(false);
        }
      }
    };

    getSessionWithTimeout();

    return () => {
      clearTimeout(watchdogTimer);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    const LOGIN_TIMEOUT_MS = 15000; // 15s timeout for login
    
    try {
      // Login with timeout to prevent infinite hang
      const authResult = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        LOGIN_TIMEOUT_MS,
        null // fallback: null means timeout occurred
      );

      // Handle timeout
      if (!authResult) {
        throw new Error('Servidor não respondeu. Tente novamente.');
      }

      if (authResult.error) {
        // Detect network errors
        const errMsg = authResult.error.message || '';
        if (errMsg.includes('fetch') || errMsg.includes('network') || errMsg.includes('Failed to fetch')) {
          throw new Error('Erro de conexão. Verifique sua internet e tente novamente.');
        }
        throw new Error(authResult.error.message);
      }
      
      if (!authResult.data?.user) {
        throw new Error('Falha na autenticação. Tente novamente.');
      }

      const userId = authResult.data.user.id;
      
      // Quick blocked check with short timeout (don't block login for too long)
      const isBlocked = await withTimeout(
        checkUserBlocked(userId),
        3000,
        false // fallback: assume not blocked if timeout
      );
      
      if (isBlocked) {
        await supabase.auth.signOut();
        throw new Error('Sua conta está bloqueada. Entre em contato com o administrador.');
      }

      // SUCCESS - navigate immediately, do secondary tasks in background
      toast.success('Login realizado com sucesso!');
      
      // Fetch role quickly to determine redirect
      const { primaryRole: userRole, roles } = await withTimeout(
        fetchUserRoles(userId),
        3000,
        { primaryRole: 'viewer' as AppRole, roles: ['viewer' as AppRole] }
      );
      setAllRoles(roles.length > 0 ? roles : ['viewer']);
      
      // Navigate based on role - SDRs go to their meetings, everyone else to /home
      if (userRole === 'sdr') {
        navigate('/sdr/minhas-reunioes');
      } else {
        navigate('/home');
      }

      // Background: update last_login_at (non-blocking)
      setTimeout(async () => {
        try {
          await supabase
            .from('profiles')
            .update({ last_login_at: new Date().toISOString() })
            .eq('id', userId);
          console.log('[Auth] last_login_at updated');
        } catch (err) {
          console.warn('[Auth] Failed to update last_login_at:', err);
        }
      }, 0);
      
    } catch (error: any) {
      const errMsg = error.message || 'Erro ao fazer login';
      // Better network error detection
      if (errMsg.includes('fetch') || errMsg.includes('network') || errMsg.includes('Failed')) {
        toast.error('Erro de conexão. Verifique sua internet.');
      } else {
        toast.error(errMsg);
      }
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    setLoading(true);
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) throw error;
      
      toast.success('Conta criada com sucesso! Verifique seu email para confirmar.');
      navigate('/');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar conta');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    hasLoadedRoles.current = false;
    try {
      const { error } = await supabase.auth.signOut();
      if (error && !error.message.includes('session missing') && 
          !error.message.includes('session_not_found')) {
        console.warn('Logout warning:', error.message);
      }
    } catch (error: any) {
      console.warn('Logout error (ignored):', error.message);
    } finally {
      setUser(null);
      setSession(null);
      setRole(null);
      setAllRoles([]);
      toast.success('Logout realizado com sucesso!');
      navigate('/auth');
    }
  };

  const hasRole = (requiredRole: AppRole): boolean => {
    if (allRoles.length === 0) return false;
    if (allRoles.includes('admin')) return true;
    if (allRoles.includes('manager') && requiredRole === 'viewer') return true;
    return allRoles.includes(requiredRole);
  };

  const hasAnyRole = (...roles: AppRole[]): boolean => {
    if (allRoles.length === 0) return false;
    if (allRoles.includes('admin')) return true;
    return roles.some(r => allRoles.includes(r));
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      
      if (error) throw error;
      
      toast.success('Email de recuperação enviado! Verifique sua caixa de entrada.');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao enviar email de recuperação');
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        role,
        allRoles,
        loading,
        roleLoading,
        signIn,
        signUp,
        signOut,
        hasRole,
        hasAnyRole,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
