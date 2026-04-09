import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Hash, KeyRound, Mail, ShieldCheck } from 'lucide-react';

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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm lg:grid lg:grid-cols-2">
        {/* LEFT COLUMN: System Title & Description */}
        <section className="bg-slate-50 px-8 py-12 flex flex-col justify-center border-b lg:border-b-0 lg:border-r border-gray-200">
          <div className="flex flex-col gap-6 max-w-sm">
            <div className="flex items-center gap-2 text-indigo-600">
              <ShieldCheck size={28} className="text-indigo-600" />
              <span className="text-xl font-semibold text-gray-900">Attendance OS</span>
            </div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Professional Academic Operations
            </h1>
            <p className="text-base text-gray-600 leading-relaxed">
              Manage student check-ins, live kiosks, attendance reports, and campus schedules from a single, centralized system.
            </p>
          </div>
        </section>

        {/* RIGHT COLUMN: Login Form */}
        <section className="px-8 py-12 flex flex-col justify-center">
          <div className="w-full max-w-sm mx-auto">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Sign In</h2>
            <p className="text-sm text-gray-500 mb-8">
              Access the attendance workspace.
            </p>

            {/* Clean Tabs for Role Toggle */}
            <div className="flex border-b border-gray-200 mb-8">
              <button
                type="button"
                onClick={() => { setLoginType('student'); setStatus(''); }}
                className={`flex-1 pb-3 text-sm font-medium border-b-2 transition-colors ${
                  loginType === 'student'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Student
              </button>
              <button
                type="button"
                onClick={() => { setLoginType('institution'); setStatus(''); }}
                className={`flex-1 pb-3 text-sm font-medium border-b-2 transition-colors ${
                  loginType === 'institution'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Administrator
              </button>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              {loginType === 'student' ? (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Registration Number</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Hash size={16} className="text-gray-400" />
                    </div>
                    <input
                      type="text"
                      placeholder="Enter register no."
                      value={studentRegisterNumber}
                      onChange={(event) => setStudentRegisterNumber(event.target.value)}
                      required
                      className="block w-full pl-10 pr-3 h-10 border border-gray-300 rounded-md text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Username / Email</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail size={16} className="text-gray-400" />
                      </div>
                      <input
                        type="text"
                        placeholder="Admin account"
                        value={institutionForm.username}
                        onChange={(event) => setInstitutionForm((prev) => ({ ...prev, username: event.target.value }))}
                        required
                        className="block w-full pl-10 pr-3 h-10 border border-gray-300 rounded-md text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Password</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <KeyRound size={16} className="text-gray-400" />
                      </div>
                      <input
                        type="password"
                        placeholder="Enter password"
                        value={institutionForm.password}
                        onChange={(event) => setInstitutionForm((prev) => ({ ...prev, password: event.target.value }))}
                        required
                        className="block w-full pl-10 pr-3 h-10 border border-gray-300 rounded-md text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {status && (
                <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {status}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex justify-center items-center gap-2 h-10 rounded-md bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Authenticating...' : 'Sign in'}
                {!submitting && <ArrowRight size={16} />}
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
