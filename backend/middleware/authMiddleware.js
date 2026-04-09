import { verifySessionToken } from '../services/authService.js';

const extractBearerToken = (headerValue = '') => {
    const [scheme, token] = String(headerValue).split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
        return null;
    }

    return token.trim();
};

export const authenticateRequest = (req, res, next) => {
    const token = extractBearerToken(req.headers.authorization);

    if (!token) {
        return res.status(401).json({
            error: 'Authentication required.'
        });
    }

    try {
        req.auth = verifySessionToken(token);
        return next();
    } catch (error) {
        return res.status(401).json({
            error: 'Session has expired or is invalid.',
            details: error.message
        });
    }
};

export const requireAdmin = (req, res, next) => {
    if (req.auth?.role === 'ADMIN') {
        return next();
    }

    return res.status(403).json({
        error: 'Admin access is required for this action.'
    });
};

export const requireStudentSelf = (req, res, next) => {
    if (req.auth?.role === 'ADMIN') {
        return next();
    }

    if (req.auth?.role === 'STUDENT' && req.auth?.studentId === req.params.studentId) {
        return next();
    }

    return res.status(403).json({
        error: 'You can only access your own student profile.'
    });
};

export const scopeAttendanceReportAccess = (req, res, next) => {
    if (req.auth?.role === 'ADMIN') {
        return next();
    }

    if (req.auth?.role !== 'STUDENT' || !req.auth?.studentId) {
        return res.status(403).json({
            error: 'You are not allowed to access attendance reports.'
        });
    }

    req.query = {
        ...req.query,
        studentId: req.auth.studentId
    };
    delete req.query.departmentId;
    delete req.query.year;
    delete req.query.semester;

    return next();
};
