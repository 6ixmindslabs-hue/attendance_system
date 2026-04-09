import React, { useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { api } from '../lib/api';

const DEFAULT_TERMINAL_ID = 'campus-gate-1';

type ScanStatus =
    | 'Success'
    | 'Duplicate'
    | 'ReviewRequired'
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
    if (status === 'TooDark') return 'Too Dark';
    if (status === 'TooBlurry') return 'Hold Camera Steady';
    if (status === 'MoveCloser') return 'Move Closer';
    if (status === 'CenterFace') return 'Center Your Face';
    if (status === 'FrameRetry') return 'Retrying Scan';
    if (status === 'Unknown') return 'Not Recognized';
    if (status === 'Error') return 'System Error';
    return 'Face scan';
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
                    const responseStatus = (response?.status === 'Unknown' ? 'Unknown' : 'Error') as ScanStatus;
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

    const getLogClasses = (status: ScanStatus) => {
        if (status === 'Success') return 'bg-green-100 border-green-200 text-green-800';
        if (status === 'Duplicate') return 'bg-yellow-100 border-yellow-200 text-yellow-800';
        if (status === 'ReviewRequired') return 'bg-blue-100 border-blue-200 text-blue-800';
        if (status === 'Pending') return 'bg-slate-100 border-slate-200 text-slate-700';
        if (status === 'Blocked') return 'bg-indigo-100 border-indigo-200 text-indigo-800';
        if (status === 'MultipleFaces') return 'bg-amber-100 border-amber-200 text-amber-800';
        if (status === 'NoFace') return 'bg-slate-100 border-slate-200 text-slate-700';
        if (status === 'TooDark') return 'bg-violet-100 border-violet-200 text-violet-800';
        if (status === 'TooBlurry') return 'bg-sky-100 border-sky-200 text-sky-800';
        if (status === 'MoveCloser') return 'bg-cyan-100 border-cyan-200 text-cyan-800';
        if (status === 'CenterFace') return 'bg-fuchsia-100 border-fuchsia-200 text-fuchsia-800';
        if (status === 'FrameRetry') return 'bg-slate-100 border-slate-200 text-slate-700';
        if (status === 'Unknown') return 'bg-orange-100 border-orange-200 text-orange-800';
        return 'bg-red-100 border-red-200 text-red-800';
    };

    return (
        <div className="mx-auto mt-8 max-w-5xl space-y-6 rounded-[32px] border border-white/70 bg-white/85 p-6 shadow-xl shadow-slate-200/50 backdrop-blur">
            <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-bold">Live Attendance Capture</h2>
                <p className="text-gray-500">This screen supports terminal-aware consensus, review-required matches, and more specific scan feedback.</p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-[1.1fr,0.9fr]">
                <div className="flex flex-col items-center justify-center rounded-[28px] border border-gray-300 bg-gray-100 p-4">
                    <Webcam
                        audio={false}
                        ref={webcamRef}
                        screenshotFormat="image/jpeg"
                        screenshotQuality={0.95}
                        forceScreenshotSourceSize
                        width={520}
                        height={390}
                        className="mb-4 rounded-2xl border"
                    />

                    <div className="mb-3 w-full max-w-xs">
                        <label className="mb-2 block text-sm font-medium text-gray-700">Terminal ID</label>
                        <input
                            value={terminalId}
                            onChange={(event) => setTerminalId(event.target.value)}
                            className="w-full rounded-2xl border px-3 py-2"
                            placeholder="campus-gate-1"
                        />
                    </div>

                    <button
                        onClick={() => setIsCapturing((prev) => !prev)}
                        className={`w-full max-w-xs rounded-2xl px-6 py-2 font-bold text-white ${isCapturing ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
                    >
                        {isCapturing ? 'Stop Capture' : 'Start Capture'}
                    </button>
                    <p className="mt-2 font-mono text-sm text-gray-500">Status: {isCapturing ? 'Active' : 'Idle'}</p>
                </div>

                <div className="max-h-[32rem] overflow-y-auto rounded-[28px] border bg-gray-50 p-4">
                    <h3 className="mb-3 border-b pb-2 font-semibold text-gray-700">Recognition Logs</h3>
                    <ul className="space-y-2 font-mono text-sm">
                        {logs.length === 0 ? (
                            <li className="italic text-gray-400">No logs yet...</li>
                        ) : (
                            logs.map((log) => (
                                <li key={log.id} className={`rounded-2xl border p-3 ${getLogClasses(log.status)}`}>
                                    [{new Date(log.id).toLocaleTimeString()}] {log.text}
                                </li>
                            ))
                        )}
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default AttendanceCapture;
