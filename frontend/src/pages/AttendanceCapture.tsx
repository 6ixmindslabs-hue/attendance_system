import React, { useEffect, useMemo, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { Camera, Clock3, PlayCircle, ScanFace, Square, TerminalSquare } from 'lucide-react';
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
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-white/70 bg-white/90 shadow-xl shadow-slate-200/50 backdrop-blur">
        <div className="bg-[linear-gradient(135deg,#0f172a_0%,#164e63_46%,#0f766e_100%)] px-6 py-7 text-white sm:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-100/80">Operator Console</div>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">Live Attendance Capture</h2>
              <p className="mt-3 text-sm leading-6 text-slate-200/85">
                Monitor the camera feed, trigger repeated scans with a short cooldown, and watch live recognition feedback without any manual review queue.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
                <div className="text-xs uppercase tracking-[0.22em] text-cyan-100/70">Status</div>
                <div className="mt-1 text-lg font-semibold">{isCapturing ? 'Capturing' : 'Idle'}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
                <div className="text-xs uppercase tracking-[0.22em] text-cyan-100/70">Successful scans</div>
                <div className="mt-1 text-lg font-semibold">{successCount}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
                <div className="text-xs uppercase tracking-[0.22em] text-cyan-100/70">Needs retry</div>
                <div className="mt-1 text-lg font-semibold">{issueCount}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 p-6 xl:grid-cols-[1.2fr,0.8fr]">
          <div className="space-y-4 rounded-[28px] border border-slate-200 bg-slate-950 p-4 shadow-[0_22px_60px_rgba(15,23,42,0.18)]">
            <div className="flex items-center justify-between gap-3 text-white">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-cyan-500/15 p-3 text-cyan-300">
                  <Camera size={22} />
                </div>
                <div>
                  <div className="text-lg font-semibold">Recognition Preview</div>
                  <div className="text-sm text-slate-400">Use this screen to validate the live station before opening kiosk mode.</div>
                </div>
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.22em] text-slate-300">
                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            <div className="overflow-hidden rounded-[24px] border border-white/10">
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                screenshotQuality={0.95}
                forceScreenshotSourceSize
                className="aspect-video w-full object-cover"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr,220px]">
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 text-white">
                <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-300">
                  <TerminalSquare size={16} />
                  Terminal ID
                </label>
                <input
                  value={terminalId}
                  onChange={(event) => setTerminalId(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none ring-0 placeholder:text-slate-500"
                  placeholder="campus-gate-1"
                />
                <p className="mt-3 text-xs leading-5 text-slate-400">
                  Repeated attendance scans are allowed after the configured cooldown time for this terminal.
                </p>
              </div>

              <button
                onClick={() => setIsCapturing((prev) => !prev)}
                className={`inline-flex h-full min-h-[120px] items-center justify-center gap-3 rounded-[24px] px-6 py-4 text-base font-semibold text-white transition ${
                  isCapturing
                    ? 'bg-rose-500 hover:bg-rose-600'
                    : 'bg-emerald-500 hover:bg-emerald-600'
                }`}
              >
                {isCapturing ? <Square size={20} /> : <PlayCircle size={20} />}
                {isCapturing ? 'Stop Capture' : 'Start Capture'}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
                  <ScanFace size={20} />
                </div>
                <div>
                  <div className="text-lg font-semibold text-slate-900">Latest response</div>
                  <div className="text-sm text-slate-500">The newest recognition event from this operator console.</div>
                </div>
              </div>

              <div className={`mt-4 rounded-[24px] border p-4 ${latestLog ? getLogClasses(latestLog.status) : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                {latestLog ? (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold">{latestLog.status}</div>
                      <div className="inline-flex items-center gap-1 text-xs font-medium">
                        <Clock3 size={14} />
                        {new Date(latestLog.id).toLocaleTimeString()}
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-6">{latestLog.text}</p>
                  </>
                ) : (
                  <p className="text-sm">No capture events yet. Start the console to begin receiving recognition feedback.</p>
                )}
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-slate-900">Recognition log</div>
                  <div className="text-sm text-slate-500">Newest events are shown first.</div>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {logs.length} items
                </div>
              </div>

              <ul className="mt-4 space-y-3">
                {logs.length === 0 ? (
                  <li className="rounded-[24px] border border-dashed border-slate-200 px-4 py-6 text-sm italic text-slate-400">
                    No logs yet.
                  </li>
                ) : (
                  logs.map((log) => (
                    <li key={log.id} className={`rounded-[24px] border p-4 ${getLogClasses(log.status)}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold uppercase tracking-[0.18em]">{log.status}</div>
                        <div className="text-xs font-medium">{new Date(log.id).toLocaleTimeString()}</div>
                      </div>
                      <p className="mt-2 text-sm leading-6">{log.text}</p>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AttendanceCapture;
