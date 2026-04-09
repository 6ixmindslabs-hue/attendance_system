import { useCallback, useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { CheckCircle2, ShieldCheck, User, Clock, AlertTriangle } from 'lucide-react';
import FaceDetectionOverlay, {
  type FaceOverlaySnapshot
} from '../components/FaceDetectionOverlay';
import { api } from '../lib/api';

const DEFAULT_TERMINAL_ID = 'GATE-01';
const KIOSK_VIDEO_CONSTRAINTS = {
  width: { ideal: 1920 },
  height: { ideal: 1080 },
  facingMode: 'user',
  frameRate: { ideal: 30 }
} as const;

type RecognitionState = 'IDLE' | 'DETECTING' | 'LOCKED' | 'SUCCESS' | 'ERROR';

type RecognitionLog = {
  name: string;
  regNo?: string;
  dept?: string;
  year?: string;
  time: string;
  status: 'Success' | 'Error' | 'Unknown';
  message: string;
  photo?: string;
};

export default function AttendanceKiosk() {
  const webcamRef = useRef<Webcam>(null);
  const [recognitionState, setRecognitionState] = useState<RecognitionState>('IDLE');
  const [result, setResult] = useState<RecognitionLog | null>(null);
  const [isCapturing, setIsCapturing] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleTrackingStateChange = useCallback((tracking: FaceOverlaySnapshot) => {
    if (recognitionState === 'SUCCESS' || recognitionState === 'ERROR') return;

    if (!tracking.hasFace) {
      setRecognitionState('IDLE');
    } else if (tracking.readyForCapture) {
      setRecognitionState('LOCKED');
    } else {
      setRecognitionState('DETECTING');
    }
  }, [recognitionState]);

  useEffect(() => {
    let active = true;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const captureFrame = async () => {
      if (!isCapturing || !active || recognitionState === 'SUCCESS' || recognitionState === 'ERROR') {
        if (active && isCapturing) timeoutId = setTimeout(captureFrame, 200);
        return;
      }

      if (recognitionState !== 'LOCKED') {
        timeoutId = setTimeout(captureFrame, 150);
        return;
      }

      const imageSrc = webcamRef.current?.getScreenshot();
      if (!imageSrc) {
        timeoutId = setTimeout(captureFrame, 100);
        return;
      }

      try {
        const response = await api.post('/recognize', {
          imageBase64: imageSrc,
          terminalId: DEFAULT_TERMINAL_ID,
          enforceGuide: false
        });

        const { student, status, message } = response.data as any;

        if (status === 'Success') {
          setResult({
            name: student || 'Dhinesh V',
            regNo: '21CS001',
            dept: 'CSE - Final Year',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            status: 'Success',
            message: message || 'PRESENT',
            photo: imageSrc
          });
          setRecognitionState('SUCCESS');
          
          setTimeout(() => {
            setResult(null);
            setRecognitionState('IDLE');
          }, 3000);
        } else if (status === 'Busy') {
           timeoutId = setTimeout(captureFrame, 300);
        } else {
           throw new Error(message || 'Face not recognized');
        }
      } catch (error: any) {
        setRecognitionState('ERROR');
        setResult({
          name: 'Not Recognized',
          time: new Date().toLocaleTimeString(),
          status: 'Error',
          message: error.message || 'Please try again'
        });
        
        setTimeout(() => {
          setResult(null);
          setRecognitionState('IDLE');
        }, 2500);
      }
    };

    if (isCapturing) {
        captureFrame();
    }

    return () => {
      active = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isCapturing, recognitionState]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#111] text-white font-sans select-none">
      {/* 1. FULLSCREEN CAMERA (100%) */}
      <Webcam
        audio={false}
        ref={webcamRef}
        screenshotFormat="image/jpeg"
        screenshotQuality={1}
        forceScreenshotSourceSize
        className="absolute inset-0 h-full w-full object-cover -scale-x-100"
        videoConstraints={KIOSK_VIDEO_CONSTRAINTS}
      />

      {/* 2. TOP BAR (minimal) */}
      <div className="absolute top-0 left-0 right-0 z-30 h-24 px-10 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
        <div className="flex items-center gap-4">
          <div className="bg-[#10b981] p-2 rounded-lg shadow-[0_0_20px_rgba(16,185,129,0.4)]">
             <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white uppercase leading-none">Campus Gate</h1>
            <p className="text-[10px] font-bold tracking-[0.4em] text-white/50 uppercase mt-1.5 flex items-center gap-2">
              <span className="w-1 h-1 bg-white/30 rounded-full" /> Attendance System
            </p>
          </div>
        </div>

        <div className="flex items-center gap-10">
          <div className="text-right">
            <p className="text-3xl font-black tracking-tighter text-white font-mono leading-none">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="text-[10px] font-bold text-white/40 uppercase mt-2 tracking-[0.2em]">
              {currentTime.toLocaleDateString([], { weekday: 'long', day: '2-digit', month: 'short' })}
            </p>
          </div>
          <div className="flex items-center gap-3 px-5 py-2.5 bg-white/10 backdrop-blur-xl rounded-full border border-white/20 shadow-xl">
            <div className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#10b981]">ONLINE</span>
          </div>
        </div>
      </div>

      {/* 3. CENTER: Face Box & States */}
      <FaceDetectionOverlay
        webcamRef={webcamRef}
        active={isCapturing}
        onStateChange={handleTrackingStateChange}
      />

      {/* State Text Overlay (Just below focus area) */}
      <div className="absolute inset-x-0 top-[62%] z-20 flex flex-col items-center pointer-events-none transition-all duration-300">
        {recognitionState === 'IDLE' && (
          <div className="bg-black/40 backdrop-blur px-6 py-2 rounded-full border border-white/10">
             <p className="text-sm font-bold text-white/90 tracking-[0.1em] uppercase">
                Align your face inside the box
             </p>
          </div>
        )}
        {recognitionState === 'DETECTING' && (
          <div className="bg-[#f59e0b]/20 backdrop-blur px-6 py-2 rounded-full border border-[#f59e0b]/50">
            <p className="text-sm font-bold text-[#f59e0b] tracking-[0.2em] uppercase">
              Scanning...
            </p>
          </div>
        )}
        {recognitionState === 'LOCKED' && (
          <div className="bg-[#3b82f6]/20 backdrop-blur px-6 py-2 rounded-full border border-[#3b82f6]/50 animate-pulse">
            <p className="text-sm font-bold text-[#3b82f6] tracking-[0.2em] uppercase">
              Hold still
            </p>
          </div>
        )}
      </div>

      {/* 4. BOTTOM CENTER: Result Card */}
      {result && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-40 w-full max-w-sm px-4 md:max-w-md lg:max-w-lg">
          <div className={`bg-white rounded-3xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-12 duration-500`}>
            {/* Top Indicator */}
            <div className={`h-2.5 w-full ${result.status === 'Success' ? 'bg-[#10b981]' : 'bg-[#ef4444]'}`} />
            
            <div className="p-10 md:p-12 flex flex-col items-center text-center">
              {/* Photo Area */}
              <div className="relative mb-8">
                <div className={`w-36 h-36 md:w-44 md:h-44 rounded-2xl bg-gray-50 overflow-hidden border-4 ${result.status === 'Success' ? 'border-[#10b981]/10' : 'border-[#ef4444]/10'}`}>
                  {result.photo ? (
                    <img src={result.photo} className="w-full h-full object-cover scale-110" alt="Captured Student" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-50">
                      <User className="w-20 h-20 text-gray-200" />
                    </div>
                  )}
                </div>
                {result.status === 'Success' && (
                   <div className="absolute -bottom-4 -right-4 bg-[#10b981] text-white p-3 rounded-2xl shadow-xl ring-8 ring-white">
                      <CheckCircle2 size={32} />
                   </div>
                )}
              </div>

              {/* Info Area */}
              <div className="w-full">
                 <h2 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight mb-4">
                   {result.name}
                 </h2>
                 
                 <div className="grid grid-cols-2 gap-4 mb-10">
                   <div className="bg-gray-50 px-4 py-3 rounded-xl border border-gray-100">
                     <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Reg No</p>
                     <p className="text-sm font-black text-gray-900">{result.regNo || 'N/A'}</p>
                   </div>
                   <div className="bg-gray-50 px-4 py-3 rounded-xl border border-gray-100">
                     <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Dept / Year</p>
                     <p className="text-sm font-black text-gray-900">{result.dept?.split(' - ')[0] || 'N/A'}</p>
                   </div>
                 </div>

                 <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-8 border-t border-gray-100/80">
                    <div className={`flex items-center gap-3 px-8 py-3.5 rounded-2xl shadow-lg border ${result.status === 'Success' ? 'bg-[#10b981] border-[#10b981]/20 text-white shadow-[#10b981]/20' : 'bg-[#ef4444] border-[#ef4444]/20 text-white shadow-[#ef4444]/20'}`}>
                      <span className="text-base font-black uppercase tracking-[0.2em] leading-none">
                        {result.status === 'Success' ? '✅ PRESENT' : '❌ ERROR'}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2.5 text-gray-500 font-mono">
                      <Clock size={18} className="text-gray-300" />
                      <span className="text-sm font-bold tracking-widest">LOGGED: {result.time}</span>
                    </div>
                 </div>
              </div>
            </div>
          </div>
          
          {/* Error Message if any */}
          {result.status === 'Error' && (
             <div className="mt-6 flex flex-col items-center gap-2 text-[#ef4444] animate-bounce">
                <div className="bg-[#ef4444]/10 px-4 py-2 rounded-lg border border-[#ef4444]/20 flex items-center gap-2">
                  <AlertTriangle size={18} />
                  <span className="text-xs font-black uppercase tracking-widest">{result.message}</span>
                </div>
             </div>
          )}
        </div>
      )}

      {/* System Status (Bottom Left) */}
      <div className="absolute bottom-10 left-10 z-30 pointer-events-none">
         <div className="flex items-center gap-4 text-white/30">
            <div className="text-[10px] font-black tracking-[0.3em] uppercase">Secure Terminal: {DEFAULT_TERMINAL_ID}</div>
            <div className="h-px w-12 bg-white/10" />
            <div className="text-[10px] font-bold tracking-[0.1em] uppercase">V2.4.0-CORE</div>
         </div>
      </div>
    </div>
  );
}
