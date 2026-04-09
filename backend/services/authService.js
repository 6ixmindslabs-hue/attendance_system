import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

dotenv.config();

const TOKEN_ISSUER = 'attendance-management-backend';
const TOKEN_AUDIENCE = 'attendance-management-app';
const DEFAULT_TOKEN_TTL = process.env.JWT_EXPIRES_IN || '12h';

const resolveJwtSecret = () => {
    const configuredSecret = process.env.JWT_SECRET?.trim();

    if (configuredSecret) {
        return configuredSecret;
    }

    if (process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET must be configured in production.');
    }

    return 'attendance-management-development-secret';
};

const decodeTokenExpiry = (token) => {
    const decoded = jwt.decode(token);
    if (!decoded?.exp) {
        return null;
    }

    return new Date(decoded.exp * 1000).toISOString();
};

const signToken = (subject, payload) => {
    const token = jwt.sign(payload, resolveJwtSecret(), {
        subject,
        expiresIn: DEFAULT_TOKEN_TTL,
        issuer: TOKEN_ISSUER,
        audience: TOKEN_AUDIENCE
    });

    return {
        token,
        expiresAt: decodeTokenExpiry(token)
    };
};

export const verifySessionToken = (token) => jwt.verify(token, resolveJwtSecret(), {
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE
});

export const buildAdminSession = ({ email, name = 'Admin' }) => {
    const payload = {
        role: 'ADMIN',
        name,
        email
    };
    const signed = signToken(email, payload);

    return {
        role: 'ADMIN',
        user: payload,
        ...signed
    };
};

export const buildStudentSession = (student) => {
    const payload = {
        role: 'STUDENT',
        name: student.name,
        studentId: student.id,
        registerNumber: student.register_number
    };
    const signed = signToken(student.id, payload);

    return {
        role: 'STUDENT',
        user: payload,
        student,
        ...signed
    };
};
