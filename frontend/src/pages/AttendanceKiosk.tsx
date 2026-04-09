import { useCallback, useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { CheckCircle2, ScanFace } from 'lucide-react';
import FaceDetectionOverlay, {
  type FaceOverlaySnapshot
} from '../components/FaceDetectionOverlay';
import { api } from '../lib/api';

const DEFAULT_TERMINAL_ID = 'campus-gate-1';
const KIOSK_VIDEO_CONSTRAINTS = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
  facingMode: 'user',
  frameRate: { ideal: 24, max: 30 }
} as const;
const KIOSK_SCREENSHOT_QUALITY = 0.92;

type RecognitionStatus =
  | 'Success'
  | 'Recent'
  | 'Pending'
  | 'Unknown'
  | 'Blocked'
  | 'MultipleFaces'
  | 'NoFace'
  | 'TooDark'
  | 'TooBlurry'
  | 'MoveCloser'
  | 'MoveBack'
  | 'CenterFace'
  | 'FrameRetry'
  | 'Locked'
  | 'Loading'
  | 'Adjusting'
  | 'Error';

type RecognitionLog = {
  id: number;
  name: string;
  time: string;
  status: RecognitionStatus;
  message: string;
};

type LiveGuide = {
  status: RecognitionStatus | 'Idle';
  title: string;
  message: string;
  tone: 'neutral' | 'ready' | 'warning' | 'danger' | 'success';
  progressCurrent: number;
  progressTotal: number;
};

type RecognitionApiResponse = {
  student?: string | null;
  status?: RecognitionStatus | 'Busy';
  message?: string;
  error?: string;
  details?: string;
};

const DEFAULT_GUIDE: LiveGuide = {
  status: 'Idle',
  title: 'Face Tracking Ready',
  message: 'Look at the camera and hold still while the station confirms your scan.',
  tone: 'neutral',
  progressCurrent: 0,
  progressTotal: 1
};

const DEFAULT_FACE_TRACKING_STATE: FaceOverlaySnapshot = {
  status: 'loading',
  tone: 'yellow',
  message: 'Loading face detector...',
  readyForCapture: false,
  hasFace: false,
  faceCount: 0,
  confidence: null,
  brightness: null
};

const parsePendingProgress = (message?: string) => {
  const match = message?.match(/\((\d+)\/(\d+)\)/);
  if (!match) {
    return null;
  }

  return {
    current: Number(match[1]),
    total: Number(match[2])
  };
};

const getLogName = (status: RecognitionStatus, student?: string | null) => {
  if (student) return student;
  if (status === 'MultipleFaces') return 'Multiple People Detected';
  if (status === 'NoFace') return 'No Face Detected';
  if (status === 'TooDark') return 'Increase Lighting';
  if (status === 'TooBlurry') return 'Hold Camera Steady';
  if (status === 'MoveCloser') return 'Move Closer';
  if (status === 'MoveBack') return 'Step Back Slightly';
  if (status === 'CenterFace') return 'Center Your Face';
  if (status === 'FrameRetry') return 'Retrying Scan';
  if (status === 'Recent') return 'Recent Scan Saved';
  if (status === 'Unknown') return 'Not Recognized';
  if (status === 'Error') return 'System Error';
  return 'Face Scan';
};

const getCaptureDelay = (status?: string) => {
  if (status === 'Busy') return 300;
  if (status === 'Pending') return 700;
  if (status === 'Loading') return 300;
  if (status === 'Locked') return 250;
  if (status === 'Adjusting') return 600;
  if (status === 'MultipleFaces') return 1200;
  if (status === 'NoFace') return 900;
  if (status === 'TooDark' || status === 'TooBlurry' || status === 'MoveCloser' || status === 'MoveBack' || status === 'CenterFace') return 850;
  if (status === 'FrameRetry') return 450;
  if (status === 'Success' || status === 'Recent') return 1500;
  if (status === 'Blocked') return 2000;
  return 1200;
};

const shouldPromoteToLastScan = (status: RecognitionStatus) => (
  ['Success', 'Recent', 'Blocked', 'Unknown', 'Error'].includes(status)
);

const buildGuide = (status: RecognitionStatus | 'Idle', message?: string): LiveGuide => {
  const pendingProgress = parsePendingProgress(message);

  if (status === 'Loading') {
    return {
      status,
      title: 'Loading Detector',
      message: message || 'Starting real-time face tracking for this station.',
      tone: 'neutral',
      progressCurrent: 0,
      progressTotal: 1
    };
  }

  if (status === 'Locked') {
    return {
      status,
      title: 'Face Locked',
      message: message || 'Hold still while we capture the recognition frame.',
      tone: 'ready',
      progressCurrent: 1,
      progressTotal: 1
    };
  }

  if (status === 'Adjusting') {
    return {
      status,
      title: 'Adjusting Face Box',
      message: message || 'Tracking your face. Hold still for a tighter lock.',
      tone: 'warning',
      progressCurrent: 0,
      progressTotal: 1
    };
  }

  if (status === 'Pending') {
    return {
      status,
      title: 'Hold Steady',
      message: message || 'One clear face found. Keep still while we confirm the match.',
      tone: 'ready',
      progressCurrent: pendingProgress?.current || 1,
      progressTotal: pendingProgress?.total || 1
    };
  }

  if (status === 'MultipleFaces') {
    return {
      status,
      title: 'One Person Only',
      message: message || 'Only one face should be visible to the kiosk.',
      tone: 'danger',
      progressCurrent: 0,
      progressTotal: 1
    };
  }

  if (status === 'NoFace') {
    return {
      status,
      title: 'No Face Detected',
      message: message || 'Look at the camera so the detector can find your face.',
      tone: 'danger',
      progressCurrent: 0,
      progressTotal: 1
    };
  }

  if (status === 'MoveCloser') {
    return {
      status,
      title: 'Move Closer',
      message: message || 'Bring your face slightly closer to the camera.',
      tone: 'warning',
      progressCurrent: 0,
      progressTotal: 1
    };
  }

  if (status === 'MoveBack') {
    return {
      status,
      title: 'Step Back Slightly',
      message: message || 'Move back a little so your face fits comfortably in the frame.',
      tone: 'warning',
      progressCurrent: 0,
      progressTotal: 1
    };
  }

  if (status === 'CenterFace') {
    return {
      status,
      title: 'Center Your Face',
      message: message || 'Move your face toward the middle of the screen.',
      tone: 'warning',
      progressCurrent: 0,
      progressTotal: 1
    };
  }

  if (status === 'FrameRetry') {
    return {
      status,
      title: 'Reading Camera Frame',
      message: message || 'Retrying with a cleaner frame from the camera.',
      tone: 'neutral',
      progressCurrent: 0,
      progressTotal: 1
    };
  }

  if (status === 'TooDark') {
    return {
      status,
      title: 'Increase Lighting',
      message: message || 'Move toward better light so your face is easier to read.',
      tone: 'warning',
      progressCurrent: 0,
      progressTotal: 1
    };
  }

  if (status === 'TooBlurry') {
    return {
      status,
      title: 'Hold Still',
      message: message || 'Keep your face steady for a sharper capture.',
      tone: 'warning',
      progressCurrent: 0,
      progressTotal: 1
    };
  }

  if (status === 'Success') {
    return {
      status,
      title: 'Attendance Marked',
      message: message || 'Recognition completed successfully.',
      tone: 'success',
      progressCurrent: 1,
      progressTotal: 1
    };
  }

  if (status === 'Recent') {
    return {
      status,
      title: 'Please Wait',
      message: message || 'A recent scan was just saved. Try again after the short gap.',
      tone: 'warning',
      progressCurrent: 1,
      progressTotal: 1
    };
  }

  if (status === 'Blocked') {
    return {
      status,
      title: 'Attendance Blocked',
      message: message || 'Attendance cannot be marked right now.',
      tone: 'danger',
      progressCurrent: 0,
      progressTotal: 1
    };
  }

  if (status === 'Unknown') {
    return {
      status,
      title: 'Face Not Recognized',
      message: message || 'Try again with a clear front-facing pose.',
      tone: 'warning',
      progressCurrent: 0,
      progressTotal: 1
    };
  }

  if (status === 'Error') {
    return {
      status,
      title: 'System Error',
      message: message || 'Recognition service is unavailable. Please try again shortly.',
      tone: 'danger',
      progressCurrent: 0,
      progressTotal: 1
    };
  }

  return DEFAULT_GUIDE;
};

const mapTrackingStateToGuide = (trackingState: FaceOverlaySnapshot): RecognitionStatus => {
  if (trackingState.status === 'loading') return 'Loading';
  if (trackingState.status === 'locked') return 'Locked';
  if (trackingState.status === 'no_face') return 'NoFace';
  if (trackingState.status === 'multiple_faces') return 'MultipleFaces';
  if (trackingState.status === 'move_closer') return 'MoveCloser';
  if (trackingState.status === 'move_back') return 'MoveBack';
  if (trackingState.status === 'center_face') return 'CenterFace';
  if (trackingState.status === 'increase_lighting') return 'TooDark';
  if (trackingState.status === 'adjusting') return 'Adjusting';
  return 'Error';
};

export default function AttendanceKiosk() {
  const webcamRef = useRef<Webcam>(null);
  const trackingStateRef = useRef<FaceOverlaySnapshot>(DEFAULT_FACE_TRACKING_STATE);

  const [lastScan, setLastScan] = useState<RecognitionLog | null>(null);
  const [scanFeed, setScanFeed] = useState<RecognitionLog[]>([]);
  const [isCapturing, setIsCapturing] = useState(true);
  const [terminalId] = useState(DEFAULT_TERMINAL_ID);
  const [liveGuide, setLiveGuide] = useState<LiveGuide>(DEFAULT_GUIDE);
  const [, setTrackingState] = useState<FaceOverlaySnapshot>(DEFAULT_FACE_TRACKING_STATE);

  const pushLog = useCallback((log: RecognitionLog) => {
    setScanFeed((prev) => [log, ...prev].slice(0, 6));

    if (shouldPromoteToLastScan(log.status)) {
      setLastScan(log);
    }
  }, []);

  const handleTrackingStateChange = useCallback((nextState: FaceOverlaySnapshot) => {
    trackingStateRef.current = nextState;

    setTrackingState((currentState) => {
      if (
        currentState.status === nextState.status &&
        currentState.message === nextState.message &&
        currentState.readyForCapture === nextState.readyForCapture &&
        currentState.faceCount === nextState.faceCount &&
        currentState.confidence === nextState.confidence &&
        currentState.brightness === nextState.brightness
      ) {
        return currentState;
      }

      return nextState;
    });
  }, []);

  useEffect(() => {
    let active = true;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const scheduleNextCapture = (delay: number) => {
      if (!active) {
        return;
      }

      timeoutId = setTimeout(() => {
        void captureFrame();
      }, delay);
    };

    const captureFrame = async () => {
      if (!isCapturing || !active) {
        return;
      }

      const localTracking = trackingStateRef.current;

      if (!localTracking.readyForCapture) {
        const localGuideStatus = mapTrackingStateToGuide(localTracking);
        setLiveGuide(buildGuide(localGuideStatus, localTracking.message));
        scheduleNextCapture(getCaptureDelay(localGuideStatus));
        return;
      }

      const imageSrc = webcamRef.current?.getScreenshot();

      if (!imageSrc) {
        setLiveGuide(buildGuide('Loading', 'Waiting for a usable camera frame.'));
        scheduleNextCapture(300);
        return;
      }

      try {
        setLiveGuide(buildGuide('Locked', localTracking.message));

        const response = await api.post<RecognitionApiResponse>('/recognize', {
          imageBase64: imageSrc,
          terminalId,
          enforceGuide: false
        });

        const { student, status, message } = response.data;
        const scanStatus = (status || 'Pending') as RecognitionStatus;
        setLiveGuide(buildGuide(scanStatus, message));

        if (status !== 'Busy') {
          const log: RecognitionLog = {
            id: Date.now(),
            name: getLogName(scanStatus, student),
            time: new Date().toLocaleTimeString(),
            status: scanStatus,
            message: message || 'Scanning'
          };

          if (scanStatus === 'Blocked') {
            setIsCapturing(false);
          }

          pushLog(log);
        }

        scheduleNextCapture(getCaptureDelay(status));
      } catch (error: unknown) {
        const backend = (error as { response?: { data?: RecognitionApiResponse } }).response?.data || {};
        const scanStatus = (
          backend.status === 'MultipleFaces' ||
          backend.status === 'NoFace' ||
          backend.status === 'TooDark' ||
          backend.status === 'TooBlurry' ||
          backend.status === 'MoveCloser' ||
          backend.status === 'MoveBack' ||
          backend.status === 'CenterFace' ||
          backend.status === 'FrameRetry' ||
          backend.status === 'Unknown'
            ? backend.status
            : 'Error'
        ) as RecognitionStatus;

        setLiveGuide(buildGuide(scanStatus, backend.message));

        pushLog({
          id: Date.now(),
          name: getLogName(scanStatus),
          time: new Date().toLocaleTimeString(),
          status: scanStatus,
          message: [backend.message, backend.error, backend.details].filter(Boolean).join(' - ') || 'Service unavailable'
        });

        scheduleNextCapture(2500);
      }
    };

    if (isCapturing) {
      void captureFrame();
    }

    return () => {
      active = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isCapturing, pushLog, terminalId]);

  const toggleCapturing = useCallback(() => {
    setIsCapturing((currentValue) => {
      const nextValue = !currentValue;

      if (!nextValue) {
        setLiveGuide({
          status: 'Idle',
          title: 'Kiosk Paused',
          message: 'Resume the kiosk to restart live face tracking.',
          tone: 'neutral',
          progressCurrent: 0,
          progressTotal: 1
        });
      }

      return nextValue;
    });
  }, []);

  const progressWidth = `${Math.min(100, Math.round((liveGuide.progressCurrent / Math.max(1, liveGuide.progressTotal)) * 100))}%`;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black text-white font-sans">
      {/* Background Camera */}
      <Webcam
        audio={false}
        ref={webcamRef}
        screenshotFormat="image/jpeg"
        screenshotQuality={KIOSK_SCREENSHOT_QUALITY}
        forceScreenshotSourceSize
        className="absolute inset-0 h-full w-full object-cover -scale-x-100"
        videoConstraints={KIOSK_VIDEO_CONSTRAINTS}
      />

      {/* Dark Overlay for better text readability at edges */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80 pointer-events-none" />

      {/* Face Tracking Canvas */}
      <FaceDetectionOverlay
        webcamRef={webcamRef}
        active={isCapturing}
        onStateChange={handleTrackingStateChange}
      />

      {/* Top Navigation / Status Header */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-8">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 flex items-center justify-center bg-indigo-600 rounded">
            <ScanFace className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white uppercase">Station {terminalId}</h1>
            <p className="text-xs font-medium text-gray-400">INSTITUTIONAL ATTENDANCE PORTAL</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded border border-white/10 text-sm font-mono tracking-wider">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div className={`px-4 py-2 rounded text-xs font-bold uppercase tracking-widest border ${
            isCapturing ? 'bg-indigo-600/20 border-indigo-400 text-indigo-400' : 'bg-red-600/20 border-red-400 text-red-400'
          }`}>
            {isCapturing ? 'Online' : 'Paused'}
          </div>
        </div>
      </div>

      {/* Main Feedback Area (Lower Center) */}
      <div className="absolute bottom-24 left-0 right-0 z-20 flex flex-col items-center px-6 gap-6">
        
        {/* Instruction Banner */}
        <div className={`flex flex-col items-center text-center max-w-xl transition-all duration-300 ${
          liveGuide.tone === 'success' ? 'scale-110' : 'scale-100'
        }`}>
          <div className={`px-6 py-3 rounded-md border-2 mb-4 bg-black/60 backdrop-blur-lg ${
            liveGuide.tone === 'success' ? 'border-emerald-500 text-emerald-400' :
            liveGuide.tone === 'danger' ? 'border-red-500 text-red-500' :
            liveGuide.tone === 'warning' ? 'border-amber-500 text-amber-500' :
            'border-white/20 text-white'
          }`}>
            <h2 className="text-2xl font-black uppercase tracking-tight leading-none mb-1">
              {liveGuide.title}
            </h2>
            <p className="text-sm font-medium opacity-90">{liveGuide.message}</p>
          </div>
          
          {/* Progress Bar */}
          {liveGuide.status === 'Pending' && (
            <div className="w-64 h-1.5 bg-white/10 rounded-full overflow-hidden border border-white/5">
              <div 
                className="h-full bg-indigo-500 transition-all duration-300" 
                style={{ width: progressWidth }} 
              />
            </div>
          )}
        </div>

        {/* Big Success Notification */}
        {lastScan && (lastScan.status === 'Success' || lastScan.status === 'Recent') && (
          <div className={`flex items-center gap-6 px-10 py-6 rounded-lg text-white animate-in zoom-in slide-in-from-bottom-4 duration-500 ${
            lastScan.status === 'Success' ? 'bg-emerald-600 shadow-2xl' : 'bg-amber-600 shadow-xl'
          }`}>
            <CheckCircle2 size={48} className="text-white/80" />
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-white/70 mb-1">
                {lastScan.status === 'Success' ? 'Recognition Confirmed' : 'Scan Cooldown Active'}
              </p>
              <h3 className="text-3xl font-black">{lastScan.name}</h3>
              <p className="text-sm font-medium text-white/80 mt-1">{lastScan.time} • Attendance Logged</p>
            </div>
          </div>
        )}
      </div>

      {/* Kiosk Controls (Bottom Right) */}
      <div className="absolute bottom-10 right-10 z-30">
        <button
          onClick={toggleCapturing}
          className={`h-12 px-6 rounded text-sm font-bold uppercase tracking-wider transition-colors border-2 ${
            isCapturing
              ? 'bg-transparent border-white/20 text-white hover:bg-white/10'
              : 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          {isCapturing ? 'Pause Kiosk' : 'Start Kiosk'}
        </button>
      </div>

      {/* Small Logs (Bottom Left) -- Minimized */}
      <div className="absolute bottom-10 left-10 z-30 max-w-sm hidden md:block">
        <div className="space-y-2 opacity-60 hover:opacity-100 transition-opacity">
          {scanFeed.slice(0, 3).map((log) => (
            <div key={log.id} className="text-[10px] font-mono flex items-center gap-2 text-white/80">
              <span className="text-gray-500">[{log.time}]</span>
              <span className="truncate max-w-[120px] font-bold">{log.name}</span>
              <span className={`px-1 py-0.5 rounded-sm text-[8px] font-bold uppercase ${
                log.status === 'Success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-gray-400'
              }`}>
                {log.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
