import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  ChartColumnBig,
  Clock3,
  MonitorSmartphone,
  RefreshCcw,
  ScanFace,
  Settings2,
  UserCheck,
  Users
} from 'lucide-react';
import { api, getApiErrorMessage } from '../lib/api';
import type { AttendanceRecord, AttendanceSettings, StudentProfile } from '../types/app';

const getTodayDateString = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

type DashboardSummary = {
  activeStudents: number;
  todayScans: number;
  presentRecords: number;
  repeatedScans: number;
  morningWindow: string;
  afternoonWindow: string;
};

const defaultSummary: DashboardSummary = {
  activeStudents: 0,
  todayScans: 0,
  presentRecords: 0,
  repeatedScans: 0,
  morningWindow: '08:30 - 10:00',
  afternoonWindow: '15:30 - 17:00'
};

const formatWindow = (start?: string, end?: string) => {
  if (!start || !end) return 'Not configured';
  return `${start.slice(0, 5)} - ${end.slice(0, 5)}`;
};

const getRepeatedScans = (records: AttendanceRecord[]) => {
  const presentRecords = records.filter((record) => record.status === 'Present');
  const uniqueScanKeys = new Set(
    presentRecords.map((record) => `${record.student_id}:${record.period || 'general'}:${record.timestamp.slice(0, 10)}`)
  );

  return Math.max(0, presentRecords.length - uniqueScanKeys.size);
};

export default function AdminDashboard() {
  const [summary, setSummary] = useState<DashboardSummary>(defaultSummary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const today = getTodayDateString();
      const [studentsResponse, reportResponse, settingsResponse] = await Promise.all([
        api.get<{ students: StudentProfile[] }>('/students?activeOnly=true'),
        api.get<{ report: AttendanceRecord[] }>(`/attendance/report?fromDate=${today}&toDate=${today}`),
        api.get<{ settings: AttendanceSettings }>('/settings/attendance')
      ]);

      const report = reportResponse.data.report || [];
      const settings = settingsResponse.data.settings;
      setSummary({
        activeStudents: studentsResponse.data.students?.length || 0,
        todayScans: report.length,
        presentRecords: report.filter((record) => record.status === 'Present').length,
        repeatedScans: getRepeatedScans(report),
        morningWindow: formatWindow(settings?.morning_start, settings?.morning_end),
        afternoonWindow: formatWindow(settings?.evening_start, settings?.evening_end)
      });
    } catch (requestError: unknown) {
      setError(getApiErrorMessage(requestError, 'Failed to load dashboard summary.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[36px] border border-white/70 bg-white/90 shadow-xl shadow-slate-200/60 backdrop-blur">
        <div className="bg-[linear-gradient(135deg,#0f172a_0%,#164e63_45%,#0f766e_100%)] px-6 py-7 text-white sm:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-100/80">Operations Overview</div>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">Attendance control center</h2>
              <p className="mt-3 text-sm leading-6 text-slate-200/85">
                Watch today&apos;s scan volume, keep the kiosk moving smoothly, and manage attendance windows from one place.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                to="/admin/register-student"
                className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/15"
              >
                Register Student
              </Link>
              <Link
                to="/kiosk"
                target="_blank"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-300"
              >
                <ScanFace size={18} />
                Open Kiosk
              </Link>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="mt-0 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Active Students"
              value={loading ? '...' : summary.activeStudents}
              icon={<Users className="text-cyan-700" size={20} />}
              description="Available for face recognition today."
            />
            <StatCard
              title="Total Scans Today"
              value={loading ? '...' : summary.todayScans}
              icon={<ScanFace className="text-teal-700" size={20} />}
              description="All recognition events recorded today."
            />
            <StatCard
              title="Present Marks"
              value={loading ? '...' : summary.presentRecords}
              icon={<UserCheck className="text-emerald-700" size={20} />}
              description="Successful attendance records."
            />
            <StatCard
              title="Repeat Scans"
              value={loading ? '...' : summary.repeatedScans}
              icon={<RefreshCcw className="text-amber-700" size={20} />}
              description="Additional scans accepted after cooldown."
            />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr,0.8fr]">
            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Attendance Windows</div>
                  <h3 className="mt-2 text-xl font-semibold text-slate-900">Today&apos;s recognition schedule</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    The kiosk accepts repeated scans after cooldown, but attendance still respects the configured morning and afternoon windows.
                  </p>
                </div>
                <div className="rounded-2xl bg-white p-3 text-slate-700 shadow-sm">
                  <Clock3 size={20} />
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <WindowCard label="Morning Window" value={loading ? '...' : summary.morningWindow} />
                <WindowCard label="Afternoon Window" value={loading ? '...' : summary.afternoonWindow} />
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Quick Actions</div>
              <div className="mt-4 space-y-3">
                <ActionCard
                  to="/admin/reports"
                  title="Attendance Reports"
                  description="Filter records, export Excel, and contact parents for absences."
                  icon={<ChartColumnBig size={18} className="text-emerald-700" />}
                />
                <ActionCard
                  to="/admin/settings"
                  title="Recognition Settings"
                  description="Adjust confidence, scan cooldown, and attendance windows."
                  icon={<Settings2 size={18} className="text-amber-700" />}
                />
                <ActionCard
                  to="/kiosk"
                  title="Launch Live Station"
                  description="Open the full-screen kiosk for front-desk or classroom use."
                  icon={<MonitorSmartphone size={18} className="text-cyan-700" />}
                />
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-[28px] border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Operations Note</div>
                <h3 className="mt-2 text-xl font-semibold text-slate-900">Recognition now completes instantly</h3>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  This build removes the manual review queue. If a face matches strongly enough, attendance is saved immediately. If the scan is unclear, the user is asked to retry instead.
                </p>
              </div>

              <Link
                to="/admin/reports"
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                View reports
                <ArrowUpRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

type StatCardProps = {
  title: string;
  value: string | number;
  icon: ReactNode;
  description: string;
};

function StatCard({ title, value, icon, description }: StatCardProps) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-slate-500">{title}</div>
          <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">{icon}</div>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}

function WindowCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{label}</div>
      <div className="mt-2 text-xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function ActionCard({ title, description, to, icon }: { title: string; description: string; to: string; icon: ReactNode }) {
  return (
    <Link to={to} className="flex items-start gap-4 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 transition hover:border-slate-300 hover:bg-slate-100">
      <div className="rounded-2xl bg-white p-3 shadow-sm">{icon}</div>
      <div>
        <div className="font-semibold text-slate-900">{title}</div>
        <div className="mt-1 text-sm leading-6 text-slate-600">{description}</div>
      </div>
    </Link>
  );
}
