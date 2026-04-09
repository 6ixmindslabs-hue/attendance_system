import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

dotenv.config();

const TOKEN_ISSUER = 'attendance-management-backend';
const TOKEN_AUDIENCE = 'attendance-management-app';
const DEFAULT_TOKEN_TTL = process.env.JWT_EXPIRES_IN || '12h';

const resolveJwtSecret = () => (
    process.env.JWT_SECRET ||
    process.env.ADMIN_PASSWORD ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'attendance-management-development-secret'
);

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
