import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Shield, ArrowRight, ShieldCheck, Cpu, Mail, Key, Hash } from 'lucide-react';

import { useAuth } from '../auth/useAuth';
import { api, getApiErrorMessage } from '../lib/api';
import type { AppSession } from '../types/app';

type LoginMode = 'student' | 'institution';

type LoginResponse = {
    success: boolean;
    message: string;
    session: AppSession;
};

const initialInstitutionForm = {
    username: '',
    password: ''
};

export default function Login() {
    const [loginType, setLoginType] = useState<LoginMode>('student');
    const [studentRegisterNumber, setStudentRegisterNumber] = useState('');
    const [institutionForm, setInstitutionForm] = useState(initialInstitutionForm);
    const [status, setStatus] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSubmitting(true);
        setStatus('');

        try {
            if (loginType === 'institution') {
                const response = await api.post<LoginResponse>('/auth/login', {
                    username: institutionForm.username.trim(),
                    password: institutionForm.password
                });

                if (response.data.success && response.data.session) {
                    login(response.data.session);
                    navigate('/admin', { replace: true });
                }
            } else {
                const response = await api.post<LoginResponse>('/auth/student-login', {
                    register_number: studentRegisterNumber.trim()
                });

                if (response.data.success && response.data.session) {
                    login(response.data.session);
                    navigate('/student', { replace: true });
                }
            }
        } catch (error: unknown) {
            setStatus(getApiErrorMessage(
                error,
                loginType === 'institution' ? 'Admin login failed.' : 'Student login failed.'
            ));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-50 via-blue-50/50 to-white font-sans">
            <div className="w-full max-w-md sm:max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="p-6 sm:p-8 rounded-2xl shadow-lg bg-white/70 backdrop-blur-xl border border-white flex flex-col gap-5">
                    
                    {/* Header Group */}
                    <div className="flex flex-col gap-2">
                        <div className="text-xs font-bold uppercase tracking-widest text-blue-600">
                            Sign In
                        </div>
                        <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">
                            Attendify OS
                        </h1>
                        <p className="text-sm text-gray-500">
                            Smart, Secure, Automated Attendance
                        </p>
                    </div>

                    {/* Toggle */}
                    <div className="w-full flex rounded-full p-1 bg-gray-100 relative">
                        <div 
                            className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-full shadow transition-all duration-300 ease-out ${loginType === 'student' ? 'left-1' : 'left-[calc(50%+3px)]'}`}
                        />
                        <button 
                            type="button" 
                            onClick={() => { setLoginType('student'); setStatus(''); }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold transition-colors z-10 ${loginType === 'student' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <User size={16} className={loginType === 'student' ? 'text-blue-600' : 'text-gray-400'} />
                            Student
                        </button>
                        <button 
                            type="button" 
                            onClick={() => { setLoginType('institution'); setStatus(''); }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold transition-colors z-10 ${loginType === 'institution' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <Shield size={16} className={loginType === 'institution' ? 'text-blue-600' : 'text-gray-400'} />
                            Admin
                        </button>
                    </div>

                    <form onSubmit={handleLogin} className="flex flex-col gap-5">
                        {/* Inputs Container */}
                        <div className="flex flex-col gap-5 min-h-[140px]">
                            {loginType === 'student' ? (
                                <div className="flex flex-col gap-2 animate-in fade-in duration-300">
                                    <label className="text-sm font-medium text-gray-700">Registration Number</label>
                                    <div className="relative group w-full">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-500 transition-colors">
                                            <Hash size={18} />
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Enter your student ID"
                                            value={studentRegisterNumber}
                                            onChange={(event) => setStudentRegisterNumber(event.target.value)}
                                            required
                                            className="w-full h-12 pl-10 pr-4 bg-white/60 border border-gray-200 text-gray-900 rounded-xl outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-gray-400 font-medium text-sm"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-5 animate-in fade-in duration-300">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-sm font-medium text-gray-700">Email or Username</label>
                                        <div className="relative group w-full">
                                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-500 transition-colors">
                                                <Mail size={18} />
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="Admin account"
                                                value={institutionForm.username}
                                                onChange={(event) => setInstitutionForm((prev) => ({ ...prev, username: event.target.value }))}
                                                required
                                                className="w-full h-12 pl-10 pr-4 bg-white/60 border border-gray-200 text-gray-900 rounded-xl outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-gray-400 font-medium text-sm"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-sm font-medium text-gray-700">Password</label>
                                        <div className="relative group w-full">
                                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-500 transition-colors">
                                                <Key size={18} />
                                            </div>
                                            <input
                                                type="password"
                                                placeholder="Enter password"
                                                value={institutionForm.password}
                                                onChange={(event) => setInstitutionForm((prev) => ({ ...prev, password: event.target.value }))}
                                                required
                                                className="w-full h-12 pl-10 pr-4 bg-white/60 border border-gray-200 text-gray-900 rounded-xl outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-gray-400 font-medium text-sm"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Error Space Guarantee */}
                        <div className={`min-h-[44px] flex items-center w-full transition-opacity duration-300 ${status ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                            <div className="w-full p-2.5 rounded-lg bg-rose-50 border border-rose-100 text-rose-600 text-sm font-medium text-center shadow-sm">
                                {status || 'Error placeholder'}
                            </div>
                        </div>

                        {/* Button */}
                        <button
                            type="submit"
                            disabled={submitting}
                            className="group w-full h-12 mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-sm font-bold text-white shadow-lg shadow-blue-500/25 transition-all hover:scale-[1.02] hover:shadow-blue-500/40 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] disabled:scale-100 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {submitting 
                                ? 'Authenticating...' 
                                : loginType === 'student' ? 'Access Student Portal' : 'Open Admin Console'
                            }
                            {!submitting && <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />}
                        </button>
                    </form>

                    {/* Trust Elements */}
                    <div className="pt-5 mt-2 border-t border-gray-100 flex items-center justify-center gap-4 text-[11px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider w-full">
                        <div className="flex items-center gap-1.5">
                            <ShieldCheck size={14} className="text-emerald-500" />
                            Secure Login
                        </div>
                        <div className="w-1 h-1 rounded-full bg-gray-300"></div>
                        <div className="flex items-center gap-1.5">
                            <Cpu size={14} className="text-blue-500" />
                            AI Powered
                        </div>
                    </div>
                </div>

                {/* Footer Copyright */}
                <div className="mt-8 text-center text-[11px] sm:text-xs text-gray-400 font-medium">
                    &copy; {new Date().getFullYear()} Attendify OS. All rights reserved.
                </div>
            </div>
        </div>
    );
}
