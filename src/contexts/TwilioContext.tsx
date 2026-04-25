import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { toast } from '@/hooks/use-toast';

// Call record interface (matches the calls table)
interface CallRecord {
  id: string;
  deal_id: string | null;
  contact_id: string | null;
  user_id: string;
  origin_id: string | null;
  twilio_call_sid: string | null;
  direction: string;
  from_number: string | null;
  to_number: string | null;
  status: string;
  started_at: string | null;
  answered_at: string | null;
  ended_at: string | null;
  duration_seconds: number;
  outcome: string | null;
  notes: string | null;
  recording_url: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// Twilio SDK types
interface TwilioDevice {
  register: () => Promise<void>;
  unregister: () => Promise<void>;
  connect: (params: { params: Record<string, string> }) => Promise<TwilioCall>;
  on: (event: string, handler: (...args: any[]) => void) => void;
  state: string;
  destroy: () => void;
}

interface TwilioCall {
  disconnect: () => void;
  mute: (muted: boolean) => void;
  isMuted: () => boolean;
  on: (event: string, handler: (...args: any[]) => void) => void;
  parameters: Record<string, string>;
  status: () => string;
}

type DeviceStatus = 'disconnected' | 'connecting' | 'ready' | 'busy' | 'error';
type CallStatus = 'idle' | 'connecting' | 'ringing' | 'in-progress' | 'completed' | 'failed';

interface TwilioContextType {
  device: TwilioDevice | null;
  currentCall: TwilioCall | null;
  deviceStatus: DeviceStatus;
  callStatus: CallStatus;
  callDuration: number;
  isMuted: boolean;
  currentCallId: string | null;
  currentCallDealId: string | null;
  initializeDevice: () => Promise<boolean>;
  makeCall: (phoneNumber: string, dealId?: string, contactId?: string, originId?: string) => Promise<string | null>;
  hangUp: () => void;
  toggleMute: () => void;
  isTestPipeline: (originId: string | null | undefined) => boolean;
  testPipelineId: string | null;
  // Qualification modal control (global)
  qualificationModalOpen: boolean;
  qualificationDealId: string | null;
  qualificationContactName: string | null;
  openQualificationModal: (dealId: string, contactName?: string) => void;
  closeQualificationModal: () => void;
  // Drawer state for inline call controls
  isDrawerOpen: boolean;
  drawerDealId: string | null;
  setDrawerState: (open: boolean, dealId: string | null) => void;
}

const TwilioContext = createContext<TwilioContextType | null>(null);

const TWILIO_TEST_ORIGIN_NAME = 'Twilio – Teste';

export function TwilioProvider({ children }: { children: ReactNode }) {
  const { user, hasAnyRole } = useAuth();
  const [device, setDevice] = useState<TwilioDevice | null>(null);
  const [currentCall, setCurrentCall] = useState<TwilioCall | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>('disconnected');
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [currentCallDealId, setCurrentCallDealId] = useState<string | null>(null);
  const [testPipelineId, setTestPipelineId] = useState<string | null>(null);
  const [durationInterval, setDurationInterval] = useState<ReturnType<typeof setInterval> | null>(null);
  const tokenCreatedAt = useRef<number | null>(null);

  const TOKEN_MAX_AGE_MS = 50 * 60 * 1000; // 50 minutes
  
  // Qualification modal state (global)
  const [qualificationModalOpen, setQualificationModalOpen] = useState(false);
  const [qualificationDealId, setQualificationDealId] = useState<string | null>(null);
  const [qualificationContactName, setQualificationContactName] = useState<string | null>(null);
  
  // Drawer state for inline call controls
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerDealId, setDrawerDealId] = useState<string | null>(null);

  // Fetch test pipeline ID on mount
  useEffect(() => {
    async function fetchTestPipeline() {
      const { data } = await supabase
        .from('crm_origins')
        .select('id')
        .eq('name', TWILIO_TEST_ORIGIN_NAME)
        .maybeSingle();
      
      if (data) {
        setTestPipelineId(data.id);
      }
    }
    fetchTestPipeline();
  }, []);

  // Clean up duration interval
  useEffect(() => {
    return () => {
      if (durationInterval) {
        clearInterval(durationInterval);
      }
    };
  }, [durationInterval]);

  // Start duration timer when call is in progress
  useEffect(() => {
    if (callStatus === 'in-progress') {
      const interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
      setDurationInterval(interval);
    } else if (callStatus === 'idle' || callStatus === 'completed' || callStatus === 'failed') {
      if (durationInterval) {
        clearInterval(durationInterval);
        setDurationInterval(null);
      }
    }
  }, [callStatus]);

  const initializeDevice = useCallback(async (forceRefresh = false): Promise<boolean> => {
    if (!user) return false;
    
    // If already ready and not forcing refresh, return immediately
    if (deviceStatus === 'ready' && device && !forceRefresh) {
      return true;
    }
    
    try {
      setDeviceStatus('connecting');
      
      // Destroy existing device before creating new one
      if (device) {
        try { device.destroy(); } catch (e) { /* ignore */ }
        setDevice(null);
      }
      
      // Load Twilio Voice SDK dynamically
      const { Device } = await import('@twilio/voice-sdk');
      
      // Get access token from our edge function
      const { data, error } = await supabase.functions.invoke('twilio-token', {
        body: { identity: user.email || user.id }
      });

      if (error || !data?.token) {
        console.error('Failed to get Twilio token:', error);
        setDeviceStatus('error');
        return false;
      }

      // Record token creation time
      tokenCreatedAt.current = Date.now();

      // Create and register device
      const twilioDevice = new Device(data.token, {
        logLevel: 1,
        codecPreferences: ['opus', 'pcmu'] as any,
        edge: 'sao-paulo',
        closeProtection: true,
      } as any);

      // Auto-refresh token before expiry during active calls
      twilioDevice.on('tokenWillExpire', async () => {
        console.log('Twilio token will expire soon, refreshing...');
        try {
          const { data: refreshData } = await supabase.functions.invoke('twilio-token', {
            body: { identity: user?.email || user?.id }
          });
          if (refreshData?.token) {
            twilioDevice.updateToken(refreshData.token);
            tokenCreatedAt.current = Date.now();
            console.log('Twilio token refreshed successfully');
          }
        } catch (err) {
          console.error('Failed to refresh Twilio token:', err);
        }
      });

      // Return Promise that resolves when device is registered
      return new Promise<boolean>((resolve) => {
        twilioDevice.on('registered', () => {
          console.log('Twilio device registered (edge: south-america, codec: opus)');
          setDeviceStatus('ready');
          setDevice(twilioDevice as unknown as TwilioDevice);
          resolve(true);
        });

        twilioDevice.on('unregistered', () => {
          console.log('Twilio device unregistered');
          setDeviceStatus('disconnected');
        });

        twilioDevice.on('error', (err: Error) => {
          console.error('Twilio device error:', err);
          setDeviceStatus('error');
          resolve(false);
        });

        twilioDevice.register();
      });
      
    } catch (error) {
      console.error('Error initializing Twilio device:', error);
      setDeviceStatus('error');
      return false;
    }
  }, [user, deviceStatus, device]);

  // Ciclo de vida do Twilio atrelado ao login/logout:
  //  - Loga (SDR/Closer/Coordenador/etc.) → auto-inicializa o device em background
  //  - Desloga → derruba chamada ativa, destrói o device, reseta estado
  // Inicialização manual via QuickDialer continua funcionando como fallback.
  const autoInitTriedRef = useRef(false);
  const prevUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const prevUserId = prevUserIdRef.current;
    const currentUserId = user?.id ?? null;

    // LOGOUT (ou troca de usuário): derruba o device
    if (prevUserId && prevUserId !== currentUserId) {
      console.log('[Twilio] Logout detectado, desligando telefone...');
      try {
        if (currentCall) {
          try { currentCall.disconnect(); } catch { /* ignore */ }
        }
        if (device) {
          try { device.destroy(); } catch { /* ignore */ }
        }
      } finally {
        setDevice(null);
        setCurrentCall(null);
        setDeviceStatus('disconnected');
        setCallStatus('idle');
        setCallDuration(0);
        setIsMuted(false);
        setCurrentCallId(null);
        setCurrentCallDealId(null);
        tokenCreatedAt.current = null;
        autoInitTriedRef.current = false;
      }
    }

    prevUserIdRef.current = currentUserId;

    // LOGIN: auto-inicializa para perfis elegíveis (uma vez por sessão)
    if (!user) return;
    if (autoInitTriedRef.current) return;
    if (deviceStatus === 'ready' || deviceStatus === 'connecting') return;
    const eligible = hasAnyRole('sdr', 'closer', 'coordenador', 'admin', 'manager', 'closer_sombra');
    if (!eligible) return;
    autoInitTriedRef.current = true;
    console.log('[Twilio] Login detectado, inicializando telefone em background...');
    initializeDevice().catch((err) => {
      console.warn('[Twilio] Auto-init falhou (silencioso, será reativado on-demand):', err);
    });
  }, [user, deviceStatus, hasAnyRole, initializeDevice, currentCall, device]);

  // Desmontagem do provider (refresh / fechar aba): garante destruição do device
  useEffect(() => {
    return () => {
      if (device) {
        try { device.destroy(); } catch { /* ignore */ }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check if token needs refresh
  const ensureValidToken = useCallback(async (): Promise<boolean> => {
    const tokenAge = tokenCreatedAt.current ? Date.now() - tokenCreatedAt.current : Infinity;
    if (tokenAge > TOKEN_MAX_AGE_MS) {
      console.log(`Twilio token expired (${Math.round(tokenAge / 60000)}min old), refreshing...`);
      toast({
        title: 'Reconectando telefone...',
        description: 'Sessão expirada, renovando conexão.',
      });
      return await initializeDevice(true);
    }
    return deviceStatus === 'ready' && !!device;
  }, [initializeDevice, deviceStatus, device]);

  // Helper to update call record in DB
  const updateCallInDb = useCallback(async (
    callId: string | null,
    updates: Record<string, any>
  ) => {
    if (!callId) return;
    try {
      const { error } = await supabase
        .from('calls')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', callId);
      if (error) console.error('Error updating call in DB:', error);
    } catch (e) {
      console.error('Failed to update call in DB:', e);
    }
  }, []);

  const makeCall = useCallback(async (
    phoneNumber: string, 
    dealId?: string, 
    contactId?: string,
    originId?: string
  ): Promise<string | null> => {
    if (!user) {
      console.error('User not authenticated');
      return null;
    }

    // Ensure token is valid before proceeding
    const tokenValid = await ensureValidToken();
    if (!tokenValid) {
      console.error('Device not ready after token refresh');
      toast({
        title: 'Erro de conexão',
        description: 'Não foi possível conectar ao telefone. Recarregue a página.',
        variant: 'destructive',
      });
      return null;
    }

    let callId: string | null = null;

    try {
      setCallStatus('connecting');
      setCallDuration(0);

      // Create call record in database using direct insert
      const insertResult = await (supabase as any)
        .from('calls')
        .insert({
          user_id: user.id,
          deal_id: dealId || null,
          contact_id: contactId || null,
          origin_id: originId || testPipelineId,
          to_number: phoneNumber,
          direction: 'outbound',
          status: 'initiated',
          started_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (insertResult.error) {
        console.error('Error creating call record:', insertResult.error);
        setCallStatus('failed');
        return null;
      }
      
      callId = insertResult.data.id;
      setCurrentCallId(callId);
      setCurrentCallDealId(dealId || null);

      // Attempt to connect via Twilio
      let call: any;
      try {
        call = await device!.connect({
          params: {
            To: phoneNumber,
            callRecordId: callId
          }
        });
      } catch (connectError) {
        console.error('device.connect() failed, retrying with fresh token:', connectError);
        
        // Retry once with fresh token
        const refreshed = await initializeDevice(true);
        if (!refreshed) {
          throw new Error('Failed to reconnect after token refresh');
        }

        toast({
          title: 'Reconectado',
          description: 'Sessão renovada, tentando ligar novamente...',
        });

        call = await device!.connect({
          params: {
            To: phoneNumber,
            callRecordId: callId
          }
        });
      }

      // Capture CallSid once available and update the database
      const checkAndUpdateCallSid = async () => {
        const callSid = (call as any).parameters?.CallSid;
        if (callSid) {
          console.log(`Updating twilio_call_sid: ${callSid} for call ${callId}`);
          await supabase
            .from('calls')
            .update({ twilio_call_sid: callSid })
            .eq('id', callId);
        }
      };

      call.on('ringing', () => {
        console.log('Call ringing');
        setCallStatus('ringing');
        checkAndUpdateCallSid();
      });

      call.on('accept', () => {
        console.log('Call accepted');
        setCallStatus('in-progress');
        setDeviceStatus('busy');
        checkAndUpdateCallSid();
      });

      call.on('disconnect', () => {
        console.log('Call disconnected');
        setCallStatus('completed');
        setDeviceStatus('ready');
        setCurrentCall(null);
        // Persist to DB as safety net (webhook may also update)
        updateCallInDb(callId, {
          status: 'completed',
          ended_at: new Date().toISOString(),
        });
      });

      call.on('cancel', () => {
        console.log('Call cancelled');
        setCallStatus('idle');
        setDeviceStatus('ready');
        setCurrentCall(null);
        // Persist canceled status to DB
        updateCallInDb(callId, {
          status: 'canceled',
          ended_at: new Date().toISOString(),
          duration_seconds: 0,
        });
      });

      call.on('error', (err: Error) => {
        console.error('Call error:', err);
        setCallStatus('failed');
        setDeviceStatus('ready');
        setCurrentCall(null);
        // Persist failed status to DB
        updateCallInDb(callId, {
          status: 'failed',
          ended_at: new Date().toISOString(),
          duration_seconds: 0,
        });
      });

      setCurrentCall(call as unknown as TwilioCall);

      return callId;
    } catch (error) {
      console.error('Error making call:', error);
      setCallStatus('failed');
      
      // Update DB record to 'failed' so it doesn't stay as 'initiated' forever
      if (callId) {
        updateCallInDb(callId, {
          status: 'failed',
          ended_at: new Date().toISOString(),
          duration_seconds: 0,
        });
      }

      toast({
        title: 'Erro ao ligar',
        description: 'Não foi possível realizar a chamada. Tente novamente.',
        variant: 'destructive',
      });
      
      return null;
    }
  }, [device, user, deviceStatus, testPipelineId, updateCallInDb, ensureValidToken, initializeDevice]);

  const hangUp = useCallback(() => {
    if (currentCall) {
      currentCall.disconnect();
      setCurrentCall(null);
      setCallStatus('completed');
      setDeviceStatus('ready');
      // Persist to DB with duration from local timer
      updateCallInDb(currentCallId, {
        status: 'completed',
        ended_at: new Date().toISOString(),
        duration_seconds: callDuration,
      });
    }
  }, [currentCall, currentCallId, callDuration, updateCallInDb]);

  const toggleMute = useCallback(() => {
    if (currentCall) {
      const newMuted = !isMuted;
      currentCall.mute(newMuted);
      setIsMuted(newMuted);
    }
  }, [currentCall, isMuted]);

  const isTestPipeline = useCallback((originId: string | null | undefined): boolean => {
    if (!originId || !testPipelineId) return false;
    return originId === testPipelineId;
  }, [testPipelineId]);

  // Qualification modal functions
  const openQualificationModal = useCallback((dealId: string, contactName?: string) => {
    setQualificationDealId(dealId);
    setQualificationContactName(contactName || null);
    setQualificationModalOpen(true);
  }, []);

  const closeQualificationModal = useCallback(() => {
    setQualificationModalOpen(false);
    // Don't clear the dealId immediately to allow for animations
    setTimeout(() => {
      setQualificationDealId(null);
      setQualificationContactName(null);
    }, 300);
  }, []);

  // Drawer state setter
  const setDrawerState = useCallback((open: boolean, dealId: string | null) => {
    setIsDrawerOpen(open);
    setDrawerDealId(dealId);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (device) {
        device.destroy();
      }
    };
  }, [device]);

  return (
    <TwilioContext.Provider value={{
      device,
      currentCall,
      deviceStatus,
      callStatus,
      callDuration,
      isMuted,
      currentCallId,
      currentCallDealId,
      initializeDevice,
      makeCall,
      hangUp,
      toggleMute,
      isTestPipeline,
      testPipelineId,
      // Qualification modal
      qualificationModalOpen,
      qualificationDealId,
      qualificationContactName,
      openQualificationModal,
      closeQualificationModal,
      // Drawer state
      isDrawerOpen,
      drawerDealId,
      setDrawerState
    }}>
      {children}
    </TwilioContext.Provider>
  );
}

export function useTwilio() {
  const context = useContext(TwilioContext);
  if (!context) {
    throw new Error('useTwilio must be used within a TwilioProvider');
  }
  return context;
}
