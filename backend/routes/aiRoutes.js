import express from 'express';
import { recognizeFace } from '../services/aiService.js';
import { supabase } from '../utils/supabaseClient.js';
import {
    formatAttendancePeriodLabel,
    formatTimeLabel,
    getAttendanceSettings,
    getAttendanceWindow,
    getLocalDayOfWeek,
} from '../services/attendanceSettingsService.js';
import { isHoliday } from '../services/calendarService.js';

const router = express.Router();
const REJECTION_STATUS_MAP = {
    multiple_faces: 'MultipleFaces',
    no_face: 'NoFace',
    low_brightness: 'TooDark',
    low_sharpness: 'TooBlurry',
    face_too_small: 'MoveCloser',
    face_not_in_guide: 'CenterFace',
    face_not_centered: 'CenterFace',
    invalid_frame: 'FrameRetry'
};

const CONSENSUS_WINDOW_MS = 5 * 1000;
const REQUIRED_CONSENSUS_FRAMES = 1;
const terminalConsensus = new Map();
const terminalCooldowns = new Map();
const terminalProcessing = new Set();

const pruneRecognitionState = (nowMs = Date.now()) => {
    for (const [terminalId, state] of terminalConsensus.entries()) {
        if (nowMs - state.lastSeenAt > CONSENSUS_WINDOW_MS) {
            terminalConsensus.delete(terminalId);
        }
    }

    for (const [key, cooldownUntil] of terminalCooldowns.entries()) {
        if (cooldownUntil <= nowMs) {
            terminalCooldowns.delete(key);
        }
    }
};

const clearTerminalConsensus = (terminalId) => {
    terminalConsensus.delete(terminalId);
};

const resolveValidatedSessionId = async (sessionId) => {
    if (!sessionId) {
        return null;
    }

    const { data: session, error } = await supabase
        .from('sessions')
        .select('id')
        .eq('id', sessionId)
        .maybeSingle();

    if (error) {
        throw new Error(error.message);
    }

    return session?.id || null;
};

router.post('/', async (req, res) => {
    const {
        imageBase64,
        sessionId,
        terminalId = 'campus-gate-1',
        enforceGuide = false
    } = req.body || {};

    if (terminalProcessing.has(terminalId)) {
        return res.status(202).json({
            message: 'Processing another frame from this terminal...',
            status: 'Busy'
        });
    }

    try {
        terminalProcessing.add(terminalId);
        pruneRecognitionState();
        const requestNow = new Date();

        if (!imageBase64) {
            return res.status(400).json({ error: 'Image is required.' });
        }

        if (getLocalDayOfWeek(requestNow) === 0) {
            clearTerminalConsensus(terminalId);
            return res.json({
                message: 'Attendance cannot be marked on Sundays.',
                status: 'Blocked',
                reason: 'Sunday'
            });
        }

        const holidayInfo = await isHoliday(requestNow);

        if (holidayInfo.isHoliday) {
            clearTerminalConsensus(terminalId);
            return res.json({
                message: `Attendance is blocked today because it is marked as ${holidayInfo.reason || 'a holiday'}.`,
                status: 'Blocked',
                reason: 'Holiday'
            });
        }

        const settings = await getAttendanceSettings();
        const activeAttendanceWindow = getAttendanceWindow(settings, requestNow);

        if (!activeAttendanceWindow) {
            clearTerminalConsensus(terminalId);
            return res.json({
                message: `Attendance is only marked during Morning (${formatTimeLabel(settings.morning_start)}-${formatTimeLabel(settings.morning_end)}) and Afternoon (${formatTimeLabel(settings.evening_start)}-${formatTimeLabel(settings.evening_end)}).`,
                status: 'Blocked',
                reason: 'OutsideWindow'
            });
        }

        const validatedSessionId = await resolveValidatedSessionId(sessionId);
        const aiResponse = await recognizeFace(imageBase64, terminalId, enforceGuide);
        const activePeriodLabel = formatAttendancePeriodLabel(activeAttendanceWindow.period);
        const isCandidateMatch = aiResponse.status === 'recognized';

        if (!isCandidateMatch || !aiResponse.student_id) {
            clearTerminalConsensus(terminalId);
            return res.json({
                message: aiResponse.status === 'ambiguous'
                    ? 'Match is not distinct enough. Please face the camera clearly and try again.'
                    : aiResponse.message || 'Face not recognized',
                status: REJECTION_STATUS_MAP[aiResponse.status] || 'Unknown',
                details: aiResponse.reason || null
            });
        }

        const confidence = Number(aiResponse.confidence || 0);

        if (confidence < settings.auto_accept_threshold) {
            clearTerminalConsensus(terminalId);
            return res.json({
                message: 'Recognition confidence is too low. Please face the camera clearly and try again.',
                status: 'Unknown',
                confidence
            });
        }

        const nowMs = Date.now();
        const candidateKey = `${aiResponse.student_id}:${activeAttendanceWindow.period}`;
        const existingConsensus = terminalConsensus.get(terminalId);

        const nextConsensus = !existingConsensus ||
            existingConsensus.candidateKey !== candidateKey ||
            nowMs - existingConsensus.startedAt > CONSENSUS_WINDOW_MS ||
            nowMs - existingConsensus.lastSeenAt > CONSENSUS_WINDOW_MS
            ? {
                candidateKey,
                studentId: aiResponse.student_id,
                studentName: aiResponse.name,
                period: activeAttendanceWindow.period,
                confidence,
                frames: 1,
                startedAt: nowMs,
                lastSeenAt: nowMs
            }
            : {
                ...existingConsensus,
                confidence: Math.max(existingConsensus.confidence, confidence),
                frames: existingConsensus.frames + 1,
                lastSeenAt: nowMs
        };

        terminalConsensus.set(terminalId, nextConsensus);

        if (nextConsensus.frames < REQUIRED_CONSENSUS_FRAMES) {
            return res.status(202).json({
                message: `Hold steady for confirmation (${nextConsensus.frames}/${REQUIRED_CONSENSUS_FRAMES})`,
                student: aiResponse.name,
                confidence,
                status: 'Pending'
            });
        }

        clearTerminalConsensus(terminalId);

        const cooldownKey = `${terminalId}:${candidateKey}`;
        const cooldownUntil = terminalCooldowns.get(cooldownKey) || 0;

        if (cooldownUntil > nowMs) {
            const remainingSeconds = Math.max(1, Math.ceil((cooldownUntil - nowMs) / 1000));
            return res.json({
                message: `${activePeriodLabel} attendance was just captured. Please wait ${remainingSeconds}s and scan again.`,
                student: aiResponse.name,
                confidence,
                status: 'Recent'
            });
        }

        terminalCooldowns.set(cooldownKey, nowMs + (settings.cooldown_seconds * 1000));
        const { error: insertError } = await supabase
            .from('attendance')
            .insert([{
                student_id: aiResponse.student_id,
                session_id: validatedSessionId,
                status: 'Present',
                period: activeAttendanceWindow.period,
                source: 'face_auto',
                confidence,
                timestamp: requestNow.toISOString()
            }]);

        if (insertError) {
            throw new Error(insertError.message);
        }

        return res.json({
            message: `${activePeriodLabel} attendance marked successfully.`,
            student: aiResponse.name,
            confidence,
            status: 'Success'
        });
    } catch (error) {
        console.error('Recognition error:', error);
        return res.status(500).json({
            error: 'Recognition request failed',
            details: error.message
        });
    } finally {
        terminalProcessing.delete(terminalId);
    }
});

export default router;
