import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Download,
  Filter,
  PhoneCall,
  RefreshCcw,
  UserCheck
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { api, getApiErrorMessage } from '../lib/api';
import { formatPeriodLabel } from '../lib/attendance';
import type { AttendanceRecord, Department } from '../types/app';

const YEAR_OPTIONS = ['1', '2', '3', '4'];
const SEMESTER_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', '8'];
const STATUS_BADGE_CLASSES: Record<string, string> = {
  Present: 'bg-emerald-100 text-emerald-700',
  Absent: 'bg-rose-100 text-rose-700',
  Late: 'bg-amber-100 text-amber-700',
  'On Duty': 'bg-sky-100 text-sky-700'
};

type ReportFilters = {
  departmentId: string;
  year: string;
  semester: string;
  fromDate: string;
  toDate: string;
};

type ReportStats = {
  present: number;
  absent: number;
  late: number;
  onDuty: number;
  total: number;
};

const getTodayDateString = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const defaultFilters: ReportFilters = {
  departmentId: '',
  year: '',
  semester: '',
  fromDate: getTodayDateString(),
  toDate: getTodayDateString()
};

const formatSource = (source?: string | null) => !source
  ? 'Legacy'
  : source.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
const formatConfidence = (value?: number | null) => value === null || value === undefined || Number.isNaN(Number(value)) ? '-' : `${(Number(value) * 100).toFixed(1)}%`;
const getExportFileName = (filters: ReportFilters) => `attendance-report-${filters.fromDate || 'all'}-to-${filters.toDate || 'all'}.xlsx`;
const getReportDate = (timestamp?: string | null) => (timestamp ? timestamp.split('T')[0] : '');

const AdminReports: React.FC = () => {
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [filters, setFilters] = useState<ReportFilters>(defaultFilters);
  const [stats, setStats] = useState<ReportStats>({ present: 0, absent: 0, late: 0, onDuty: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const selectedDepartmentName = useMemo(
    () => departments.find((department) => department.id === filters.departmentId)?.name || 'All Departments',
    [departments, filters.departmentId]
  );

  const updateStats = useCallback((data: AttendanceRecord[]) => {
    const present = data.filter((record) => record.status === 'Present').length;
    const absent = data.filter((record) => record.status === 'Absent').length;
    const late = data.filter((record) => record.status === 'Late').length;
    const onDuty = data.filter((record) => record.status === 'On Duty').length;
    setStats({ present, absent, late, onDuty, total: data.length });
  }, []);

  const buildReportParams = (activeFilters: ReportFilters) => {
    const params = new URLSearchParams();
    if (activeFilters.departmentId) params.append('departmentId', activeFilters.departmentId);
    if (activeFilters.year) params.append('year', activeFilters.year);
    if (activeFilters.semester) params.append('semester', activeFilters.semester);
    if (activeFilters.fromDate) params.append('fromDate', activeFilters.fromDate);
    if (activeFilters.toDate) params.append('toDate', activeFilters.toDate);
    return params.toString();
  };

  const fetchDepartments = useCallback(async () => {
    const response = await api.get<{ departments: Department[] }>('/students/departments');
    setDepartments(response.data.departments || []);
  }, []);

  const fetchReports = useCallback(async (activeFilters: ReportFilters) => {
    setReportsLoading(true);
    try {
      setError('');
      const queryString = buildReportParams(activeFilters);
      const response = await api.get<{ report: AttendanceRecord[] }>(`/attendance/report${queryString ? `?${queryString}` : ''}`);
      const nextData = response.data.report || [];
      setAttendanceData(nextData);
      updateStats(nextData);
      return nextData;
    } catch (requestError: unknown) {
      setAttendanceData([]);
      updateStats([]);
      setError(getApiErrorMessage(requestError, 'Failed to load reports.'));
      return [] as AttendanceRecord[];
    } finally {
      setReportsLoading(false);
    }
  }, [updateStats]);

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        await Promise.all([fetchDepartments(), fetchReports(defaultFilters)]);
      } finally {
        setLoading(false);
      }
    };

    void loadInitialData();
  }, [fetchDepartments, fetchReports]);

  const handleFilterChange = (event: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const sendAlert = async (record: AttendanceRecord) => {
    const studentName = record.students?.name || 'Student';
    if (record.status !== 'Absent') {
      window.alert(`Parent alerts are only available for absent students. ${studentName} is marked ${record.status?.toLowerCase() || 'with no status'}.`);
      return;
    }

    setActionKey(`alert-${record.id}`);
    setStatus('');
    try {
      const response = await api.post<{ message?: string }>('/notifications/send', {
        studentId: record.student_id,
        status: record.status,
        period: record.period || 'attendance',
        attendanceDate: record.timestamp,
        type: 'SMS'
      });
      const nextMessage = response.data?.message || `SMS alert sent to parent of ${studentName}.`;
      setStatus(nextMessage);
      window.alert(nextMessage);
    } catch (requestError: unknown) {
      const nextMessage = getApiErrorMessage(requestError, 'Failed to send alert.');
      setStatus(nextMessage);
      window.alert(nextMessage);
    } finally {
      setActionKey(null);
    }
  };

  const toggleOnDutyStatus = async (record: AttendanceRecord) => {
    if (!record.student_id || !record.period) {
      setStatus('This record cannot be updated because the student or period is missing.');
      return;
    }

    const nextStatus = record.status === 'On Duty' ? 'Absent' : 'On Duty';
    const recordDate = getReportDate(record.timestamp);

    if (!recordDate) {
      setStatus('This record cannot be updated because its attendance date is unavailable.');
      return;
    }

    setActionKey(`status-${record.id}`);
    setStatus('');
    try {
      const response = await api.post<{ message?: string }>('/attendance/override', {
        studentId: record.student_id,
        date: recordDate,
        period: record.period,
        status: nextStatus
      });
      setStatus(response.data?.message || `${record.students?.name || 'Student'} marked as ${nextStatus}.`);
      await fetchReports(filters);
    } catch (requestError: unknown) {
      setStatus(getApiErrorMessage(requestError, `Failed to mark ${record.students?.name || 'student'} as ${nextStatus}.`));
    } finally {
      setActionKey(null);
    }
  };

  const exportToExcel = () => {
    if (attendanceData.length === 0) {
      window.alert('No attendance data available to export.');
      return;
    }

    const rows = attendanceData.map((record, index) => ({
      'S.No': index + 1,
      'Student Name': record.students?.name || 'N/A',
      'Register No': record.students?.register_number || 'N/A',
      Department: record.students?.department_name || 'N/A',
      Year: record.students?.year || 'N/A',
      Semester: record.students?.semester || 'N/A',
      Date: new Date(record.timestamp).toLocaleDateString(),
      Time: new Date(record.timestamp).toLocaleTimeString(),
      Period: record.sessions?.subject || formatPeriodLabel(record.period),
      Status: record.status || 'N/A',
      Source: formatSource(record.source),
      Confidence: formatConfidence(record.confidence),
      Notes: record.notes || ''
    }));

    const worksheet = XLSX.utils.aoa_to_sheet([]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance Report');
    XLSX.utils.sheet_add_aoa(worksheet, [
      ['Attendance Report'],
      ['Department', selectedDepartmentName],
      ['Year', filters.year || 'All'],
      ['Semester', filters.semester || 'All'],
      ['From Date', filters.fromDate || 'All'],
      ['To Date', filters.toDate || 'All'],
      []
    ], { origin: 'A1' });
    XLSX.utils.sheet_add_json(worksheet, rows, { origin: 'A8', skipHeader: false });
    XLSX.writeFile(workbook, getExportFileName(filters));
  };

  return (
    <div className="space-y-8">
      {/* Header with Actions */}
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between border-b border-gray-200 pb-8">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600 mb-2">Institutional Analytics</div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">Attendance Database</h2>
          <p className="mt-2 text-sm text-gray-500">
            Comprehensive audit logs and historical biometric records.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={exportToExcel}
            disabled={reportsLoading || attendanceData.length === 0}
            className="h-10 px-5 inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <Download size={16} /> Export CSV
          </button>
          <button
            type="button"
            onClick={() => void fetchReports(filters)}
            className="h-10 px-5 inline-flex items-center justify-center gap-2 rounded-md bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
          >
            <RefreshCcw size={16} /> Sync
          </button>
        </div>
      </div>

      {/* Filter Section */}
      <section className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
          <Filter className="text-gray-400" size={16} />
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-900">Query Parameters</h3>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (filters.fromDate && filters.toDate && filters.fromDate > filters.toDate) {
              setError('Temporal range error: Start date exceeds end date.');
              return;
            }
            void fetchReports(filters);
          }}
          className="p-6 space-y-6"
        >
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Department</label>
              <select
                name="departmentId"
                value={filters.departmentId}
                onChange={handleFilterChange}
                className="block w-full h-10 border border-gray-200 rounded bg-white text-sm px-3 focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
              >
                <option value="">All Departments</option>
                {departments.map((dept) => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Year</label>
              <select
                name="year"
                value={filters.year}
                onChange={handleFilterChange}
                className="block w-full h-10 border border-gray-200 rounded bg-white text-sm px-3 focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
              >
                <option value="">All Years</option>
                {YEAR_OPTIONS.map((y) => <option key={y} value={y}>Year {y}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Semester</label>
              <select
                name="semester"
                value={filters.semester}
                onChange={handleFilterChange}
                className="block w-full h-10 border border-gray-200 rounded bg-white text-sm px-3 focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
              >
                <option value="">All Semesters</option>
                {SEMESTER_OPTIONS.map((s) => <option key={s} value={s}>Semester {s}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">From</label>
              <input
                name="fromDate"
                type="date"
                value={filters.fromDate}
                onChange={handleFilterChange}
                className="block w-full h-10 border border-gray-200 rounded bg-white text-sm px-3 focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">To</label>
              <input
                name="toDate"
                type="date"
                value={filters.toDate}
                onChange={handleFilterChange}
                className="block w-full h-10 border border-gray-200 rounded bg-white text-sm px-3 focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2 border-t border-gray-100">
            <button
              type="submit"
              className="h-9 px-6 rounded bg-gray-900 text-xs font-bold uppercase tracking-widest text-white hover:bg-black transition-colors"
            >
              Apply Filter
            </button>
            <button
              type="button"
              onClick={() => { setFilters(defaultFilters); void fetchReports(defaultFilters); }}
              className="h-9 px-6 rounded border border-gray-200 bg-white text-xs font-bold uppercase tracking-widest text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Clear
            </button>
          </div>
        </form>
      </section>

      {(error || status) && (
        <div className={`rounded border p-4 text-xs font-medium flex items-center gap-3 ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
          <AlertCircle size={14} className="shrink-0" />
          {error || status}
        </div>
      )}

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <MetricCard label="Present" value={stats.present} colorClass="text-emerald-600" />
        <MetricCard label="Absent" value={stats.absent} colorClass="text-red-600" />
        <MetricCard label="Late" value={stats.late} colorClass="text-amber-600" />
        <MetricCard label="On Duty" value={stats.onDuty} colorClass="text-indigo-600" />
        <MetricCard label="Total Registry" value={stats.total} colorClass="text-gray-900" />
      </div>

      {/* Table Section */}
      <section className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
             <Calendar className="text-gray-400" size={16} />
             <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-900">Attendance Register</h3>
          </div>
          <span className="text-[10px] font-bold text-gray-400 uppercase tabular-nums">Registry Size: {attendanceData.length} entries</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50/50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 font-bold text-gray-600 uppercase tracking-widest text-[10px]">Student Identity</th>
                <th className="px-6 py-3 font-bold text-gray-600 uppercase tracking-widest text-[10px]">Academic Details</th>
                <th className="px-6 py-3 font-bold text-gray-600 uppercase tracking-widest text-[10px]">Temporal Data</th>
                <th className="px-6 py-3 font-bold text-gray-600 uppercase tracking-widest text-[10px]">Status</th>
                <th className="px-6 py-3 font-bold text-gray-600 uppercase tracking-widest text-[10px]">Biometric Auth</th>
                <th className="px-6 py-3 font-bold text-gray-600 uppercase tracking-widest text-[10px]">Operation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reportsLoading || loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-xs font-medium text-gray-400 uppercase tracking-widest italic">
                    Synchronizing database...
                  </td>
                </tr>
              ) : attendanceData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-xs font-medium text-gray-300 uppercase tracking-widest italic">
                    No matching records established.
                  </td>
                </tr>
              ) : attendanceData.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-gray-900">{record.students?.name || 'ERR_IDENTITY'}</div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mt-0.5">{record.students?.department_name || 'N/A'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs font-semibold text-gray-600 group-hover:text-indigo-600 transition-colors">{record.students?.register_number || 'REG_NONE'}</div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase mt-0.5">Y{record.students?.year} / S{record.students?.semester}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs font-bold text-gray-800">{new Date(record.timestamp).toLocaleDateString()}</div>
                    <div className="text-[10px] font-mono text-indigo-600 font-bold uppercase mt-0.5">
                       {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {record.sessions?.subject || formatPeriodLabel(record.period)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tighter ${
                        record.status === 'Present' ? 'bg-emerald-50 text-emerald-700' :
                        record.status === 'Absent' ? 'bg-red-50 text-red-700' :
                        record.status === 'Late' ? 'bg-amber-50 text-amber-700' :
                        'bg-indigo-50 text-indigo-700'
                      }`}>
                        {record.status}
                      </span>
                      {(record.status === 'Absent' || record.status === 'On Duty') && record.period && (
                        <button
                          type="button"
                          onClick={() => void toggleOnDutyStatus(record)}
                          disabled={actionKey === `status-${record.id}`}
                          className="text-[9px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800 disabled:opacity-50 text-left"
                        >
                          {actionKey === `status-${record.id}` ? '...' : record.status === 'Absent' ? 'Mark-OD' : 'Mark-Abs'}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{formatSource(record.source)}</div>
                    <div className="text-[10px] font-mono text-gray-400 mt-1">CONF: {formatConfidence(record.confidence)}</div>
                  </td>
                  <td className="px-6 py-4">
                    {record.status === 'Absent' ? (
                      <button
                        type="button"
                        onClick={() => void sendAlert(record)}
                        disabled={actionKey === `alert-${record.id}`}
                        className="inline-flex items-center gap-2 h-8 px-3 rounded border border-red-200 text-red-600 text-[10px] font-bold uppercase tracking-widest hover:bg-red-50 disabled:opacity-50 transition-colors"
                      >
                        <PhoneCall size={12} />
                        {actionKey === `alert-${record.id}` ? 'SENDING' : 'ALERT_PARENT'}
                      </button>
                    ) : (
                      <CheckCircle size={16} className="text-gray-200" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

function MetricCard({ label, value, colorClass }: { label: string; value: number; colorClass: string }) {
  return (
    <div className="bg-white border border-gray-200 p-5 rounded-md shadow-sm">
      <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 leading-none">{label}</div>
      <div className={`text-2xl font-bold tabular-nums tracking-tight ${colorClass}`}>{value}</div>
    </div>
  );
}

export default AdminReports;
