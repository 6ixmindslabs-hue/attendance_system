import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChartColumnBig,
  MonitorSmartphone,
  Settings2,
  ShieldCheck,
  Users,
  UserCheck,
  UserX,
  ScanFace,
  ArrowUpRight
} from 'lucide-react';
import { api, getApiErrorMessage } from '../lib/api';
import type { AttendanceRecord, AttendanceSettings, RecognitionReview, StudentProfile } from '../types/app';

const getTodayDateString = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

type DashboardSummary = {
  activeStudents: number;
  pendingReviews: number;
  todaysRecords: number;
  morningWindow: string;
  afternoonWindow: string;
};

const defaultSummary: DashboardSummary = {
  activeStudents: 0,
  pendingReviews: 0,
  todaysRecords: 0,
  morningWindow: '08:30 - 10:00',
  afternoonWindow: '15:30 - 17:00'
};

const formatWindow = (start?: string, end?: string) => {
  if (!start || !end) return 'Not configured';
  return `${start.slice(0, 5)} - ${end.slice(0, 5)}`;
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
      const [studentsResponse, reviewsResponse, reportResponse, settingsResponse] = await Promise.all([
        api.get<{ students: StudentProfile[] }>('/students?activeOnly=true'),
        api.get<{ reviews: RecognitionReview[] }>('/reviews/pending'),
        api.get<{ report: AttendanceRecord[] }>(`/attendance/report?fromDate=${today}&toDate=${today}`),
        api.get<{ settings: AttendanceSettings }>('/settings/attendance')
      ]);

      const settings = settingsResponse.data.settings;
      setSummary({
        activeStudents: studentsResponse.data.students?.length || 0,
        pendingReviews: reviewsResponse.data.reviews?.length || 0,
        todaysRecords: reportResponse.data.report?.length || 0,
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
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Overview</h2>
          <p className="text-gray-500 mt-1">Today's attendance metrics and active sessions.</p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/admin/register-student"
            className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm transition-all shadow-sm flex items-center justify-center"
          >
            Register Student
          </Link>
          <Link
            to="/kiosk"
            target="_blank"
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm transition-all shadow-sm flex items-center justify-center gap-2"
          >
            <ScanFace size={18} />
            Open Kiosk
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <UserX size={18} /> {error}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard 
          title="Total Students" 
          value={loading ? '...' : summary.activeStudents} 
          icon={<Users className="text-indigo-600" size={20} />} 
          trend="Active enrolled" 
        />
        <StatCard 
          title="Today's Scans" 
          value={loading ? '...' : summary.todaysRecords} 
          icon={<UserCheck className="text-emerald-600" size={20} />} 
          trend="Total successful" 
        />
        <StatCard 
          title="Pending Reviews" 
          value={loading ? '...' : summary.pendingReviews} 
          icon={<ShieldCheck className="text-rose-600" size={20} />} 
          trend="Requires attention" 
          negative={summary.pendingReviews > 0} 
        />
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <p className="text-sm font-medium text-gray-500">Active Windows</p>
            <div className="p-2 bg-gray-50 rounded-lg"><MonitorSmartphone className="text-gray-600" size={20}/></div>
          </div>
          <div className="mt-4">
            <p className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-1 mb-1">M: {loading ? '...' : summary.morningWindow}</p>
            <p className="text-sm font-semibold text-gray-900">A: {loading ? '...' : summary.afternoonWindow}</p>
          </div>
        </div>
      </div>

      {/* Quick Actions / Navigation Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mt-8">
        <ActionCard 
          to="/admin/students" 
          title="Student Directory" 
          desc="Manage profiles & datasets" 
          icon={<Users size={20} className="text-blue-600"/>} 
          bg="bg-blue-50" 
        />
        <ActionCard 
          to="/admin/reports" 
          title="Reports & Logs" 
          desc="Export Excel attendance" 
          icon={<ChartColumnBig size={20} className="text-emerald-600"/>} 
          bg="bg-emerald-50" 
        />
        <ActionCard 
          to="/admin/settings" 
          title="System Settings" 
          desc="Configure threshold rules" 
          icon={<Settings2 size={20} className="text-amber-600"/>} 
          bg="bg-amber-50" 
        />
      </div>

      {/* Recent Activity Table Placeholder (can be replaced with an actual data table later) */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mt-8">
        <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center bg-white">
          <h3 className="font-semibold text-gray-900">Live Scans Preview</h3>
          <Link to="/admin/reports" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
            View All <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="p-6 text-center text-gray-500 py-12 flex flex-col items-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
             <ScanFace size={24} className="text-gray-400" />
          </div>
          <p className="font-medium text-gray-900">Ready to monitor</p>
          <p className="text-sm mt-1">Live scans will appear here when the kiosk is active.</p>
        </div>
      </div>
    </div>
  );
}

type StatCardProps = {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend: string;
  negative?: boolean;
};

function StatCard({ title, value, icon, trend, negative = false }: StatCardProps) {
  return (
    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
      <div className="flex justify-between items-start">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <div className="p-2 bg-gray-50 rounded-lg">{icon}</div>
      </div>
      <div className="mt-4">
        <h4 className="text-3xl font-bold text-gray-900 tracking-tight">{value}</h4>
        <p className={`text-xs mt-1 font-medium ${negative ? 'text-rose-500' : 'text-gray-500'}`}>
          {trend}
        </p>
      </div>
    </div>
  );
}

type ActionCardProps = {
  title: string;
  desc: string;
  to: string;
  icon: ReactNode;
  bg: string;
};

function ActionCard({ title, desc, to, icon, bg }: ActionCardProps) {
  return (
    <Link to={to} className="group bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all flex items-start gap-4">
       <div className={`p-3 rounded-xl ${bg} shrink-0 group-hover:scale-105 transition-transform`}>
         {icon}
       </div>
       <div>
         <h4 className="font-semibold text-gray-900 text-sm">{title}</h4>
         <p className="text-xs text-gray-500 mt-1">{desc}</p>
       </div>
    </Link>
  );
}
