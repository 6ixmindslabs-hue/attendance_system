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
      <section className="overflow-hidden rounded-[36px] border border-white/70 bg-white/90 shadow-xl shadow-slate-200/60 backdrop-blur">
        <div className="bg-[linear-gradient(135deg,#0f172a_0%,#164e63_45%,#0f766e_100%)] px-6 py-7 text-white sm:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-100/80">Attendance Reports</div>
              <h2 className="mt-2 flex items-center gap-3 text-3xl font-semibold tracking-tight">
                <Calendar className="text-cyan-200" />
                Attendance records and exports
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-200/85">
                Filter attendance by department, year, semester, and date range. Recognition now saves instantly, so this page focuses on records, exports, and follow-up actions.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={exportToExcel}
                disabled={reportsLoading || attendanceData.length === 0}
                className="inline-flex items-center gap-2 rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-50"
              >
                <Download size={16} />
                Export Excel
              </button>
              <button
                type="button"
                onClick={() => void fetchReports(filters)}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/15"
              >
                <RefreshCcw size={16} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6 p-6 sm:p-8">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (filters.fromDate && filters.toDate && filters.fromDate > filters.toDate) {
                setError('From date cannot be later than to date.');
                return;
              }
              void fetchReports(filters);
            }}
            className="rounded-[28px] border border-slate-200 bg-slate-50 p-5"
          >
            <div className="mb-4 flex items-center gap-2">
              <Filter className="text-cyan-700" size={18} />
              <h3 className="text-lg font-semibold text-slate-900">Filter records</h3>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Department</label>
                <select name="departmentId" value={filters.departmentId} onChange={handleFilterChange} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-slate-900">
                  <option value="">All Departments</option>
                  {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Year</label>
                <select name="year" value={filters.year} onChange={handleFilterChange} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-slate-900">
                  <option value="">All Years</option>
                  {YEAR_OPTIONS.map((year) => <option key={year} value={year}>Year {year}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Semester</label>
                <select name="semester" value={filters.semester} onChange={handleFilterChange} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-slate-900">
                  <option value="">All Semesters</option>
                  {SEMESTER_OPTIONS.map((semester) => <option key={semester} value={semester}>Semester {semester}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">From Date</label>
                <input name="fromDate" type="date" value={filters.fromDate} onChange={handleFilterChange} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-slate-900" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">To Date</label>
                <input name="toDate" type="date" value={filters.toDate} onChange={handleFilterChange} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-slate-900" />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button type="submit" className="rounded-2xl bg-slate-950 px-5 py-3 font-semibold text-white hover:bg-slate-800">Apply Filters</button>
              <button type="button" onClick={() => { setFilters(defaultFilters); void fetchReports(defaultFilters); }} className="rounded-2xl bg-white px-5 py-3 font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">Reset</button>
            </div>
          </form>

          {(error || status) ? (
            <div className={`rounded-2xl border px-4 py-3 text-sm ${error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-cyan-200 bg-cyan-50 text-cyan-800'}`}>
              {error || status}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="Present" value={stats.present} icon={<CheckCircle className="text-emerald-700" size={20} />} />
            <MetricCard label="Absent" value={stats.absent} icon={<AlertCircle className="text-rose-700" size={20} />} />
            <MetricCard label="Late" value={stats.late} icon={<AlertCircle className="text-amber-700" size={20} />} />
            <MetricCard label="On Duty" value={stats.onDuty} icon={<UserCheck className="text-sky-700" size={20} />} />
            <MetricCard label="Filtered Records" value={stats.total} icon={<Calendar className="text-cyan-700" size={20} />} />
          </div>

          <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
              <h3 className="text-xl font-semibold text-slate-900">Attendance table</h3>
              <p className="mt-1 text-sm text-slate-500">
                Repeated scans are shown as separate records whenever the kiosk cooldown has passed.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1300px] text-left">
                <thead className="border-b bg-white">
                  <tr>
                    <th className="p-4 font-semibold text-slate-600">Student Name</th>
                    <th className="p-4 font-semibold text-slate-600">Register No</th>
                    <th className="p-4 font-semibold text-slate-600">Department</th>
                    <th className="p-4 font-semibold text-slate-600">Year</th>
                    <th className="p-4 font-semibold text-slate-600">Semester</th>
                    <th className="p-4 font-semibold text-slate-600">Date & Time</th>
                    <th className="p-4 font-semibold text-slate-600">Period</th>
                    <th className="p-4 font-semibold text-slate-600">Status</th>
                    <th className="p-4 font-semibold text-slate-600">Source</th>
                    <th className="p-4 font-semibold text-slate-600">Confidence</th>
                    <th className="p-4 font-semibold text-slate-600">Notes</th>
                    <th className="p-4 font-semibold text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reportsLoading || loading ? (
                    <tr><td colSpan={12} className="p-10 text-center text-slate-400 italic">Loading attendance data...</td></tr>
                  ) : attendanceData.length === 0 ? (
                    <tr><td colSpan={12} className="p-10 text-center text-slate-400 italic">No attendance records found for the selected filters.</td></tr>
                  ) : attendanceData.map((record) => (
                    <tr key={record.id} className="align-top border-b border-slate-100 transition hover:bg-slate-50/70">
                      <td className="p-4 font-medium text-slate-900">{record.students?.name || 'N/A'}</td>
                      <td className="p-4 text-slate-600">{record.students?.register_number || 'N/A'}</td>
                      <td className="p-4 text-slate-600">{record.students?.department_name || 'N/A'}</td>
                      <td className="p-4 text-slate-600">{record.students?.year || 'N/A'}</td>
                      <td className="p-4 text-slate-600">{record.students?.semester || 'N/A'}</td>
                      <td className="p-4 text-slate-500">
                        {new Date(record.timestamp).toLocaleDateString()}
                        <br />
                        {new Date(record.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="p-4 text-slate-600">{record.sessions?.subject || formatPeriodLabel(record.period)}</td>
                      <td className="p-4">
                        <div className="flex flex-col items-start gap-2">
                          <span className={`rounded-full px-2 py-1 text-xs font-bold ${STATUS_BADGE_CLASSES[record.status] || 'bg-slate-100 text-slate-700'}`}>{record.status}</span>
                          {(record.status === 'Absent' || record.status === 'On Duty') && record.period ? (
                            <button
                              type="button"
                              onClick={() => void toggleOnDutyStatus(record)}
                              disabled={actionKey === `status-${record.id}`}
                              className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold transition disabled:opacity-50 ${
                                record.status === 'Absent'
                                  ? 'bg-sky-50 text-sky-700 hover:bg-sky-100'
                                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                              }`}
                            >
                              {actionKey === `status-${record.id}`
                                ? 'Saving...'
                                : record.status === 'Absent'
                                  ? 'Mark On Duty'
                                  : 'Mark Absent'}
                            </button>
                          ) : null}
                        </div>
                      </td>
                      <td className="p-4 text-slate-600">{formatSource(record.source)}</td>
                      <td className="p-4 text-slate-600">{formatConfidence(record.confidence)}</td>
                      <td className="max-w-[220px] whitespace-pre-wrap p-4 text-slate-500">{record.notes || '-'}</td>
                      <td className="p-4">
                        {record.status === 'Absent' ? (
                          <button
                            type="button"
                            onClick={() => void sendAlert(record)}
                            disabled={actionKey === `alert-${record.id}`}
                            className="inline-flex items-center gap-2 rounded-2xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-100 disabled:opacity-50"
                          >
                            <PhoneCall size={14} /> {actionKey === `alert-${record.id}` ? 'Sending...' : 'Send Alert'}
                          </button>
                        ) : (
                          <span className="font-medium text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
};

function MetricCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-slate-500">{label}</div>
          <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          {icon}
        </div>
      </div>
    </div>
  );
}

export default AdminReports;
