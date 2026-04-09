import { useCallback, useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { CheckCircle2, Clock, ScanFace, ShieldAlert } from 'lucide-react';
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

const getGuideToneClasses = (tone: LiveGuide['tone']) => {
  if (tone === 'ready') return 'border-cyan-400/50 bg-cyan-600/18 text-white';
  if (tone === 'warning') return 'border-amber-300/50 bg-amber-500/16 text-white';
  if (tone === 'danger') return 'border-rose-300/50 bg-rose-500/16 text-white';
  if (tone === 'success') return 'border-emerald-300/50 bg-emerald-500/16 text-white';
  return 'border-white/15 bg-slate-950/60 text-white';
};

const getTrackingBadgeClasses = (trackingState: FaceOverlaySnapshot) => {
  if (trackingState.tone === 'green') {
    return 'border-emerald-300 bg-emerald-500/15 text-emerald-100';
  }

  if (trackingState.tone === 'yellow') {
    return 'border-amber-300 bg-amber-500/15 text-amber-100';
  }

  return 'border-rose-300 bg-rose-500/15 text-rose-100';
};

const getFeedBadgeClasses = (status: RecognitionStatus) => {
  if (status === 'Success') return 'border-emerald-400/30 bg-emerald-500/15 text-emerald-100';
  if (status === 'Recent') return 'border-amber-400/30 bg-amber-500/15 text-amber-100';
  if (status === 'Blocked' || status === 'Error') return 'border-rose-400/30 bg-rose-500/15 text-rose-100';
  if (status === 'Unknown') return 'border-orange-400/30 bg-orange-500/15 text-orange-100';
  return 'border-white/15 bg-white/5 text-white/80';
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
  const [trackingState, setTrackingState] = useState<FaceOverlaySnapshot>(DEFAULT_FACE_TRACKING_STATE);

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
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-[#03111f] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.22),transparent_28%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.14),transparent_25%),linear-gradient(180deg,rgba(3,17,31,0.78),rgba(3,17,31,0.08)_26%,rgba(3,17,31,0.9))]" />

      <div className="absolute left-0 top-0 z-20 flex w-full items-center justify-between p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/90 shadow-[0_18px_40px_rgba(6,182,212,0.35)]">
            <ScanFace className="h-6 w-6 text-white" />
          </div>
          <div className="border-l border-white/15 pl-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-cyan-200/75">Attendance Station</div>
            <div className="text-lg font-semibold tracking-wide text-white">Live Recognition Kiosk</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {trackingState.hasFace && trackingState.confidence !== null ? (
            <div className={`rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] shadow-lg ${getTrackingBadgeClasses(trackingState)}`}>
              {trackingState.readyForCapture ? 'Locked' : 'Tracking'} {Math.round(trackingState.confidence * 100)}%
            </div>
          ) : null}

          <div className="flex items-center gap-3 rounded-full border border-white/10 bg-slate-950/45 px-4 py-2 text-sm font-medium text-white/80 shadow-lg backdrop-blur-md">
            <Clock size={16} />
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} | {terminalId}
          </div>
        </div>
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center">
        <Webcam
          audio={false}
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          screenshotQuality={KIOSK_SCREENSHOT_QUALITY}
          forceScreenshotSourceSize
          className="absolute inset-0 h-full w-full object-cover -scale-x-100"
          videoConstraints={KIOSK_VIDEO_CONSTRAINTS}
        />

        <div className="absolute inset-0 bg-black/24" />

        <FaceDetectionOverlay
          webcamRef={webcamRef}
          active={isCapturing}
          onStateChange={handleTrackingStateChange}
        />

        <div className="absolute left-6 top-24 z-20 hidden w-[320px] xl:block">
          <div className="rounded-[28px] border border-white/10 bg-slate-950/45 p-5 shadow-2xl backdrop-blur-xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-200/70">Session Guide</div>
            <h3 className="mt-2 text-2xl font-semibold text-white">Fast, touch-free attendance</h3>
            <p className="mt-2 text-sm leading-6 text-slate-200/75">
              Stand alone in the frame, keep your face centered, and hold still until the kiosk confirms your scan.
            </p>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.22em] text-slate-300/70">
                <span>Confirmation progress</span>
                <span>{liveGuide.progressCurrent}/{liveGuide.progressTotal}</span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-white/10">
                <div className="h-2 rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: progressWidth }} />
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-300/70">Camera status</div>
                <div className="mt-1 text-lg font-semibold text-white">{isCapturing ? 'Active' : 'Paused'}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-300/70">Live instruction</div>
                <div className="mt-1 text-base font-semibold text-white">{liveGuide.title}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute right-6 top-24 z-20 hidden w-[340px] xl:block">
          <div className="rounded-[28px] border border-white/10 bg-slate-950/45 p-5 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-200/70">Recent Activity</div>
                <h3 className="mt-2 text-xl font-semibold text-white">Scan timeline</h3>
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200/80">
                {scanFeed.length} items
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {scanFeed.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-300/65">
                  Recognition events will appear here once scanning begins.
                </div>
              ) : (
                scanFeed.map((log) => (
                  <div key={log.id} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-white">{log.name}</div>
                        <div className="mt-1 text-xs leading-5 text-slate-300/70">{log.message}</div>
                      </div>
                      <div className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] ${getFeedBadgeClasses(log.status)}`}>
                        {log.status}
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-slate-400">{log.time}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="absolute bottom-12 z-20 flex w-full flex-col items-center gap-4 px-6">
          <div className={`flex max-w-3xl items-center gap-4 rounded-[28px] border px-6 py-4 shadow-xl backdrop-blur-md transition-all ${getGuideToneClasses(liveGuide.tone)}`}>
            {liveGuide.tone === 'success' ? (
              <CheckCircle2 size={24} />
            ) : liveGuide.tone === 'danger' ? (
              <ShieldAlert size={24} />
            ) : liveGuide.tone === 'ready' ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <ScanFace size={24} />
            )}

            <div>
              <p className="text-lg font-bold text-white">{liveGuide.title}</p>
              <p className="text-sm text-white/80">{liveGuide.message}</p>
            </div>
          </div>

          {lastScan && (lastScan.status === 'Success' || lastScan.status === 'Recent') ? (
            <div className={`flex items-center gap-5 rounded-3xl px-8 py-5 text-white duration-300 ${
              lastScan.status === 'Success'
                ? 'bg-emerald-500 shadow-[0_10px_40px_rgba(16,185,129,0.4)]'
                : 'bg-amber-500 shadow-[0_10px_40px_rgba(245,158,11,0.35)]'
            }`}>
              <div className={`rounded-full p-2 ${lastScan.status === 'Success' ? 'bg-emerald-600' : 'bg-amber-600'}`}>
                <CheckCircle2 size={32} />
              </div>
              <div>
                <p className="text-sm font-medium uppercase tracking-wider text-white/85">
                  {lastScan.status === 'Success' ? 'Attendance Logged' : 'Repeat Scan Cooling Down'}
                </p>
                <p className="text-2xl font-black">{lastScan.name}</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="absolute bottom-6 right-6 z-30">
        <button
          onClick={toggleCapturing}
          className={`rounded-full border px-4 py-2 text-sm font-bold shadow-lg backdrop-blur-md transition-colors ${
            isCapturing
              ? 'border-white/20 bg-slate-950/45 text-white hover:bg-slate-950/65'
              : 'border-red-400 bg-red-500 text-white hover:bg-red-600'
          }`}
        >
          {isCapturing ? 'Pause Kiosk' : 'Resume Kiosk'}
        </button>
      </div>
    </div>
  );
}
