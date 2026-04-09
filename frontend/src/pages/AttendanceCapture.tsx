import React, { useEffect, useMemo, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { PlayCircle, ScanFace, Square, TerminalSquare } from 'lucide-react';
import { api } from '../lib/api';

const DEFAULT_TERMINAL_ID = 'campus-gate-1';

type ScanStatus =
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
  | 'CenterFace'
  | 'FrameRetry'
  | 'Error';

type LogItem = {
  id: number;
  text: string;
  status: ScanStatus;
};

type RecognitionResponse = {
  student?: string | null;
  status?: ScanStatus | 'Busy';
  message?: string;
  error?: string;
  details?: string;
};

const getScanLabel = (status: ScanStatus, student?: string | null) => {
  if (student) return student;
  if (status === 'MultipleFaces') return 'Multiple People Detected';
  if (status === 'NoFace') return 'No Face Detected';
  if (status === 'TooDark') return 'Increase Lighting';
  if (status === 'TooBlurry') return 'Hold Camera Steady';
  if (status === 'MoveCloser') return 'Move Closer';
  if (status === 'CenterFace') return 'Center Your Face';
  if (status === 'FrameRetry') return 'Retrying Scan';
  if (status === 'Recent') return 'Repeat Scan Cooling Down';
  if (status === 'Unknown') return 'Not Recognized';
  if (status === 'Error') return 'System Error';
  return 'Face scan';
};

const getLogClasses = (status: ScanStatus) => {
  if (status === 'Success') return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  if (status === 'Recent') return 'border-amber-200 bg-amber-50 text-amber-900';
  if (status === 'Pending') return 'border-slate-200 bg-slate-50 text-slate-700';
  if (status === 'Blocked') return 'border-rose-200 bg-rose-50 text-rose-900';
  if (status === 'MultipleFaces') return 'border-orange-200 bg-orange-50 text-orange-900';
  if (status === 'NoFace') return 'border-slate-200 bg-slate-50 text-slate-700';
  if (status === 'TooDark') return 'border-violet-200 bg-violet-50 text-violet-900';
  if (status === 'TooBlurry') return 'border-sky-200 bg-sky-50 text-sky-900';
  if (status === 'MoveCloser') return 'border-cyan-200 bg-cyan-50 text-cyan-900';
  if (status === 'CenterFace') return 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900';
  if (status === 'FrameRetry') return 'border-slate-200 bg-slate-50 text-slate-700';
  if (status === 'Unknown') return 'border-yellow-200 bg-yellow-50 text-yellow-900';
  return 'border-rose-200 bg-rose-50 text-rose-900';
};

const AttendanceCapture: React.FC = () => {
  const webcamRef = useRef<Webcam>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [terminalId, setTerminalId] = useState(DEFAULT_TERMINAL_ID);
  const [logs, setLogs] = useState<LogItem[]>([]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;

    if (isCapturing) {
      interval = setInterval(async () => {
        const imageSrc = webcamRef.current?.getScreenshot();
        if (!imageSrc) {
          return;
        }

        try {
          const response = await api.post<RecognitionResponse>('/recognize', {
            imageBase64: imageSrc,
            terminalId
          });
          const { student, status, message } = response.data;
          const scanStatus = (status || 'Pending') as ScanStatus;

          if (scanStatus === 'Blocked') {
            setIsCapturing(false);
          }

          setLogs((prev) => [{
            id: Date.now(),
            text: `${getScanLabel(scanStatus, student)} - ${message}`,
            status: scanStatus
          }, ...prev].slice(0, 12));
        } catch (requestError: unknown) {
          const response = (requestError as { response?: { data?: RecognitionResponse } }).response?.data;
          const responseStatus = (
            response?.status === 'Unknown' ||
            response?.status === 'NoFace' ||
            response?.status === 'MultipleFaces' ||
            response?.status === 'TooDark' ||
            response?.status === 'TooBlurry' ||
            response?.status === 'MoveCloser' ||
            response?.status === 'CenterFace' ||
            response?.status === 'FrameRetry'
              ? response.status
              : 'Error'
          ) as ScanStatus;
          const errorMessage = [response?.message, response?.error, response?.details].filter(Boolean).join(' - ') || 'Error communicating with AI';
          setLogs((prev) => [{ id: Date.now(), text: errorMessage, status: responseStatus }, ...prev].slice(0, 12));
        }
      }, 1500);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isCapturing, terminalId]);

  const latestLog = logs[0] || null;
  const successCount = useMemo(() => logs.filter((item) => item.status === 'Success').length, [logs]);
  const issueCount = useMemo(() => logs.filter((item) => item.status === 'Unknown' || item.status === 'Error' || item.status === 'Blocked').length, [logs]);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between border-b border-gray-200 pb-8">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600 mb-2">Internal Operations</div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">Attendance Capture Engine</h2>
          <p className="mt-2 text-sm text-gray-500 max-w-2xl">
            Live monitoring and biometric signal processing station. 
            Real-time verification against the institutional database.
          </p>
        </div>

        <div className="flex flex-wrap gap-4">
          <StatusMetric label="Mode" value={isCapturing ? 'ACTIVE' : 'IDLE'} highlight={isCapturing} />
          <StatusMetric label="Verified" value={successCount} />
          <StatusMetric label="Anomalies" value={issueCount} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1.2fr,0.8fr]">
        {/* Main Interface: Camera & Controls */}
        <div className="space-y-6">
          <div className="bg-gray-900 rounded-md border border-gray-800 overflow-hidden shadow-sm relative">
             {/* Industrial Camera Overlay */}
             <div className="absolute inset-x-0 top-0 h-12 bg-black/40 backdrop-blur-sm px-6 flex items-center justify-between z-10 border-b border-white/5">
                <div className="flex items-center gap-3">
                   <div className={`w-2 h-2 rounded-full ${isCapturing ? 'bg-red-500 animate-pulse' : 'bg-gray-600'}`} />
                   <span className="text-[10px] font-bold uppercase tracking-widest text-white opacity-80">
                     LIVE FEED - {terminalId}
                   </span>
                </div>
                <span className="text-[10px] font-mono text-white/50 tracking-widest uppercase">
                   {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
             </div>

             <div className="aspect-video w-full bg-black flex items-center justify-center">
                <Webcam
                  audio={false}
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  screenshotQuality={0.95}
                  forceScreenshotSourceSize
                  className={`w-full h-full object-cover transition-opacity duration-300 ${isCapturing ? 'opacity-100' : 'opacity-40'}`}
                />
                
                {!isCapturing && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                     <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white opacity-40">System Standby</p>
                  </div>
                )}
             </div>

             {/* Interface Overlay Bounds */}
             {isCapturing && (
               <div className="absolute inset-0 border-[60px] border-black/20 pointer-events-none">
                  <div className="absolute inset-12 border border-indigo-500/30">
                     <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-indigo-500" />
                     <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-indigo-500" />
                     <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-indigo-500" />
                     <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-indigo-500" />
                  </div>
               </div>
             )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr,240px] gap-6 p-1 bg-white border border-gray-200 rounded-md shadow-sm">
             <div className="p-5 flex flex-col justify-center">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Station Config (Terminal ID)</label>
                <div className="flex items-center gap-3">
                   <TerminalSquare size={16} className="text-gray-400" />
                   <input
                    value={terminalId}
                    onChange={(event) => setTerminalId(event.target.value)}
                    className="flex-1 bg-transparent border-b border-gray-200 focus:border-indigo-600 outline-none h-8 text-sm font-semibold text-gray-900 transition-colors"
                    placeholder="campus-gate-1"
                   />
                </div>
                <p className="mt-4 text-[11px] text-gray-500 leading-relaxed italic">
                  Note: Biometric repeat cooling periods are enforced per terminal identity.
                </p>
             </div>

             <button
               onClick={() => setIsCapturing((prev) => !prev)}
               className={`w-full flex items-center justify-center gap-3 text-sm font-bold uppercase tracking-widest text-white transition-colors h-24 md:h-auto rounded-r-md md:rounded-l-none ${
                 isCapturing
                   ? 'bg-red-600 hover:bg-red-700'
                   : 'bg-indigo-600 hover:bg-indigo-700'
               }`}
             >
               {isCapturing ? <><Square size={16} /> Terminate</> : <><PlayCircle size={16} /> Activate</>}
             </button>
          </div>
        </div>

        {/* Live Logs & Telemetry */}
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
             <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                   <ScanFace size={16} className="text-gray-400" />
                   <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-900">Current Output</h3>
                </div>
                <span className="text-[10px] font-mono text-gray-400 uppercase">TELEMETRY_LIVE</span>
             </div>

             <div className="p-6">
                <div className={`p-5 rounded border ${latestLog ? getLogClasses(latestLog.status) : 'border-gray-100 bg-gray-50/50 text-gray-400'}`}>
                  {latestLog ? (
                    <div className="space-y-4">
                       <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Result: {latestLog.status}</span>
                          <span className="text-[10px] font-mono tracking-tighter opacity-40">{new Date(latestLog.id).toLocaleTimeString()}</span>
                       </div>
                       <p className="text-sm font-semibold leading-relaxed tracking-tight">
                         {latestLog.text}
                       </p>
                    </div>
                  ) : (
                    <p className="text-[11px] italic leading-relaxed">
                      System offline. Initialize capture to begin institutional biometric analysis.
                    </p>
                  )}
                </div>
             </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-md overflow-hidden flex flex-col max-h-[500px]">
             <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between sticky top-0 z-10">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-900">Operational Log</h3>
                <span className="text-[10px] font-bold text-gray-400 tabular-nums">
                   {logs.length} EVENTS
                </span>
             </div>

             <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <ul className="space-y-3">
                  {logs.length === 0 ? (
                    <li className="py-12 text-center text-[11px] uppercase tracking-widest text-gray-300">
                      Empty registry
                    </li>
                  ) : (
                    logs.map((log) => (
                      <li key={log.id} className={`p-4 border rounded relative overflow-hidden group transition-all hover:bg-gray-50/50 ${getLogClasses(log.status)}`}>
                        <div className="flex items-center justify-between mb-2">
                           <span className="text-[9px] font-black uppercase tracking-widest opacity-40">{log.status}</span>
                           <span className="text-[9px] font-mono opacity-30">{new Date(log.id).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-xs font-medium leading-relaxed tracking-tight truncate group-hover:whitespace-normal">
                          {log.text}
                        </p>
                      </li>
                    ))
                  )}
                </ul>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatusMetric = ({ label, value, highlight = false }: { label: string; value: string | number; highlight?: boolean }) => (
  <div className="flex flex-col items-start px-5 py-2 min-w-[120px] bg-white border border-gray-200 rounded-md shadow-sm">
     <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">{label}</span>
     <span className={`text-base font-bold leading-none ${highlight ? 'text-indigo-600' : 'text-gray-900'}`}>{value}</span>
  </div>
);

export default AttendanceCapture;
