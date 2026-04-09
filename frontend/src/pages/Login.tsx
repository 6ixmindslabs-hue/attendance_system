import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Cpu, Hash, KeyRound, Mail, Shield, ShieldCheck, User } from 'lucide-react';

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
    <div className="min-h-screen bg-[linear-gradient(180deg,#f5fbff_0%,#edf7fb_42%,#eef2fa_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl overflow-hidden rounded-[40px] border border-white/80 bg-white/80 shadow-[0_40px_120px_rgba(15,23,42,0.12)] backdrop-blur-xl lg:grid-cols-[1.05fr,0.95fr]">
        <section className="relative overflow-hidden bg-[linear-gradient(140deg,#0f172a_0%,#164e63_50%,#0f766e_100%)] px-6 py-8 text-white sm:px-10 sm:py-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.22),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.2),transparent_34%)]" />
          <div className="relative flex h-full flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-cyan-100">
                <ShieldCheck size={16} />
                Attendance OS
              </div>
              <h1 className="mt-6 max-w-lg text-4xl font-semibold tracking-tight sm:text-5xl">
                Professional face-recognition attendance for campus operations
              </h1>
              <p className="mt-5 max-w-xl text-sm leading-7 text-slate-200/85 sm:text-base">
                Manage student check-ins, live kiosk scans, attendance reports, and schedule controls from a single streamlined workspace.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <FeatureCard title="Instant marking" description="Recognized faces are saved immediately without a manual review queue." icon={<Cpu size={18} />} />
              <FeatureCard title="Repeat scans" description="Attendance can be captured again after the short cooldown gap." icon={<Shield size={18} />} />
              <FeatureCard title="Cleaner UX" description="Student, admin, kiosk, and reports now share one polished interface." icon={<User size={18} />} />
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center px-6 py-8 sm:px-10 sm:py-10">
          <div className="w-full max-w-md">
            <div className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-700">Secure access</div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Sign in to continue</h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Choose student or admin access and continue into the attendance workspace.
            </p>

            <div className="mt-6 flex rounded-full bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => { setLoginType('student'); setStatus(''); }}
                className={`flex-1 rounded-full px-4 py-3 text-sm font-semibold transition ${
                  loginType === 'student'
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Student Access
              </button>
              <button
                type="button"
                onClick={() => { setLoginType('institution'); setStatus(''); }}
                className={`flex-1 rounded-full px-4 py-3 text-sm font-semibold transition ${
                  loginType === 'institution'
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Admin Access
              </button>
            </div>

            <form onSubmit={handleLogin} className="mt-6 space-y-5">
              {loginType === 'student' ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Registration Number</label>
                  <InputShell icon={<Hash size={18} className="text-slate-400" />}>
                    <input
                      type="text"
                      placeholder="Enter your student register number"
                      value={studentRegisterNumber}
                      onChange={(event) => setStudentRegisterNumber(event.target.value)}
                      required
                      className="h-12 w-full bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
                    />
                  </InputShell>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Email or Username</label>
                    <InputShell icon={<Mail size={18} className="text-slate-400" />}>
                      <input
                        type="text"
                        placeholder="Admin account"
                        value={institutionForm.username}
                        onChange={(event) => setInstitutionForm((prev) => ({ ...prev, username: event.target.value }))}
                        required
                        className="h-12 w-full bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
                      />
                    </InputShell>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Password</label>
                    <InputShell icon={<KeyRound size={18} className="text-slate-400" />}>
                      <input
                        type="password"
                        placeholder="Enter password"
                        value={institutionForm.password}
                        onChange={(event) => setInstitutionForm((prev) => ({ ...prev, password: event.target.value }))}
                        required
                        className="h-12 w-full bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
                      />
                    </InputShell>
                  </div>
                </div>
              )}

              {status ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {status}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 text-sm font-semibold text-white shadow-lg shadow-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting
                  ? 'Authenticating...'
                  : loginType === 'student'
                    ? 'Open Student Portal'
                    : 'Open Admin Workspace'}
                {!submitting ? <ArrowRight size={18} className="transition group-hover:translate-x-0.5" /> : null}
              </button>
            </form>

            <div className="mt-8 flex items-center gap-3 rounded-[28px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
              <ShieldCheck size={18} className="text-emerald-600" />
              Session tokens are protected on the backend and recognition runs through the configured attendance API.
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function FeatureCard({ title, description, icon }: { title: string; description: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-cyan-100">
        {icon}
      </div>
      <div className="mt-4 font-semibold text-white">{title}</div>
      <div className="mt-2 text-sm leading-6 text-slate-200/75">{description}</div>
    </div>
  );
}

function InputShell({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 shadow-sm">
      <div className="shrink-0">
        {icon}
      </div>
      {children}
    </div>
  );
}
