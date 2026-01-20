import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

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
}

const TwilioContext = createContext<TwilioContextType | null>(null);

const TWILIO_TEST_ORIGIN_NAME = 'Twilio – Teste';

export function TwilioProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [device, setDevice] = useState<TwilioDevice | null>(null);
  const [currentCall, setCurrentCall] = useState<TwilioCall | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>('disconnected');
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [currentCallDealId, setCurrentCallDealId] = useState<string | null>(null);
  const [testPipelineId, setTestPipelineId] = useState<string | null>(null);
  const [durationInterval, setDurationInterval] = useState<NodeJS.Timeout | null>(null);
  
  // Qualification modal state (global)
  const [qualificationModalOpen, setQualificationModalOpen] = useState(false);
  const [qualificationDealId, setQualificationDealId] = useState<string | null>(null);
  const [qualificationContactName, setQualificationContactName] = useState<string | null>(null);

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

  const initializeDevice = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    
    // If already ready, return immediately
    if (deviceStatus === 'ready' && device) {
      return true;
    }
    
    try {
      setDeviceStatus('connecting');
      
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

      // Create and register device
      const twilioDevice = new Device(data.token, {
        logLevel: 1
      });

      // Return Promise that resolves when device is registered
      return new Promise<boolean>((resolve) => {
        twilioDevice.on('registered', () => {
          console.log('Twilio device registered');
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

  const makeCall = useCallback(async (
    phoneNumber: string, 
    dealId?: string, 
    contactId?: string,
    originId?: string
  ): Promise<string | null> => {
    if (!device || !user || deviceStatus !== 'ready') {
      console.error('Device not ready');
      return null;
    }

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
      
      const callId = insertResult.data.id;
      setCurrentCallId(callId);
      setCurrentCallDealId(dealId || null);

      // Make the call via Twilio
      const call = await device.connect({
        params: {
          To: phoneNumber,
          callRecordId: callId
        }
      });

      // Capture CallSid once available and update the database
      // The CallSid is in call.parameters after connection
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
        // Try to capture CallSid when ringing starts
        checkAndUpdateCallSid();
      });

      call.on('accept', () => {
        console.log('Call accepted');
        setCallStatus('in-progress');
        setDeviceStatus('busy');
        // Also try when call is accepted (backup)
        checkAndUpdateCallSid();
      });

      call.on('disconnect', () => {
        console.log('Call disconnected');
        setCallStatus('completed');
        setDeviceStatus('ready');
        setCurrentCall(null);
      });

      call.on('cancel', () => {
        console.log('Call cancelled');
        setCallStatus('idle');
        setDeviceStatus('ready');
        setCurrentCall(null);
      });

      call.on('error', (err: Error) => {
        console.error('Call error:', err);
        setCallStatus('failed');
        setDeviceStatus('ready');
        setCurrentCall(null);
      });

      setCurrentCall(call as unknown as TwilioCall);

      return callId;
    } catch (error) {
      console.error('Error making call:', error);
      setCallStatus('failed');
      return null;
    }
  }, [device, user, deviceStatus, testPipelineId]);

  const hangUp = useCallback(() => {
    if (currentCall) {
      currentCall.disconnect();
      setCurrentCall(null);
      setCallStatus('completed');
      setDeviceStatus('ready');
    }
  }, [currentCall]);

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
      closeQualificationModal
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
