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
      {/* Dashboard Header Actions */}
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between border-b border-gray-200 pb-8">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600 mb-2">Institutional Administration</div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">Attendance Dashboard</h2>
          <p className="mt-2 text-sm text-gray-500">
            Real-time biometric oversight and institutional presence monitoring.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/admin/register-student"
            className="h-10 px-5 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Register Student
          </Link>
          <Link
            to="/kiosk"
            target="_blank"
            className="h-10 px-5 inline-flex items-center justify-center gap-2 rounded-md bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
          >
            <ScanFace size={16} />
            Open Kiosk
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Students"
          value={loading ? '...' : summary.activeStudents}
          description="Total active student profiles"
          icon={<Users size={16} className="text-indigo-600" />}
        />
        <StatCard
          title="Total Scans"
          value={loading ? '...' : summary.todayScans}
          description="Recognition events today"
          icon={<MonitorSmartphone size={16} className="text-indigo-600" />}
        />
        <StatCard
          title="Present Marks"
          value={loading ? '...' : summary.presentRecords}
          description="Verified attendance entries"
          icon={<UserCheck size={16} className="text-indigo-600" />}
        />
        <StatCard
          title="Repeat Scans"
          value={loading ? '...' : summary.repeatedScans}
          description="Scans after cooldown"
          icon={<RefreshCcw size={16} className="text-indigo-600" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Attendance Windows */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-md overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock3 className="text-gray-400" size={18} />
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900">Attendance Windows</h3>
            </div>
            <span className="text-[10px] font-mono text-gray-400">CONFIG_LIVE</span>
          </div>
          
          <div className="p-8 flex-1 flex flex-col">
            <div className="grid gap-6 sm:grid-cols-2">
              <WindowCard label="Morning Session" value={loading ? '...' : summary.morningWindow} />
              <WindowCard label="Afternoon Session" value={loading ? '...' : summary.afternoonWindow} />
            </div>
            <div className="mt-8 border-t border-gray-100 pt-8">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded bg-indigo-50 flex items-center justify-center shrink-0">
                   <ChartColumnBig className="text-indigo-600" size={20} />
                </div>
                <div>
                   <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Automated Rules Engine</p>
                   <p className="text-sm text-gray-600 leading-relaxed">
                     The system accepts biometric signals throughout operational hours. Verified status is automatically 
                     cataloged based on these predefined institutional windows.
                   </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Actions */}
        <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900">Module Shortcuts</h3>
          </div>
          <div className="divide-y divide-gray-100">
            <ActionCard
              to="/admin/reports"
              title="Attendance Reports"
              description="Export data and audit logs"
              icon={<ArrowUpRight size={14} />}
            />
            <ActionCard
              to="/admin/settings"
              title="System Configuration"
              description="Biometric and scanning rules"
              icon={<ArrowUpRight size={14} />}
            />
            <ActionCard
              to="/admin/students"
              title="Student Registry"
              description="Global profile management"
              icon={<ArrowUpRight size={14} />}
            />
          </div>
          <div className="p-6 bg-gray-50/50 border-t border-gray-100">
             <p className="text-[11px] text-gray-500 font-medium italic">
               * Instantly sync with biometric terminals 
             </p>
          </div>
        </div>
      </div>

      {/* System Integrity Note */}
      <div className="bg-white border border-gray-200 rounded-md p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="max-w-3xl flex items-center gap-4">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded">
               <Settings2 size={24} />
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 mb-1">Autonomous Verification Integrity</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Matches are processed with recursive confidence validation. High-fidelity biometric signals 
                are logged immediately, bypassing manual review queues for maximum throughput.
              </p>
            </div>
          </div>
          <Link
            to="/admin/reports"
            className="shrink-0 h-10 px-5 inline-flex items-center justify-center gap-2 rounded-md border border-gray-200 bg-gray-50 text-sm font-bold uppercase tracking-widest text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Audit Logs
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, description, icon }: { title: string; value: string | number; description: string; icon: ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 p-6 rounded-md shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{title}</p>
        {icon}
      </div>
      <div className="text-3xl font-bold tracking-tight text-gray-900 tabular-nums">{value}</div>
      <p className="mt-3 text-[11px] font-medium text-gray-500">{description}</p>
    </div>
  );
}

function WindowCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-6 bg-gray-50/50 border border-gray-100 rounded">
      <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">{label}</div>
      <div className="text-xl font-bold tracking-tight text-indigo-600">{value}</div>
    </div>
  );
}

function ActionCard({ title, description, to, icon }: { title: string; description: string; to: string; icon: ReactNode }) {
  return (
    <Link to={to} className="group flex items-center justify-between p-6 hover:bg-gray-50 transition-colors">
      <div>
        <div className="text-sm font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">{title}</div>
        <div className="text-xs text-gray-500 mt-1">{description}</div>
      </div>
      <div className="text-gray-300 group-hover:text-indigo-600 transition-colors">
        {icon}
      </div>
    </Link>
  );
}
