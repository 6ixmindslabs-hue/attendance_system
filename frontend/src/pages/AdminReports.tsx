import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Download,
  Filter,
  PhoneCall,
  RefreshCcw,
  SearchCheck,
  ShieldAlert,
  UserCheck,
  XCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { api, getApiErrorMessage } from '../lib/api';
import { formatPeriodLabel } from '../lib/attendance';
import type { AttendanceRecord, Department, RecognitionReview, StudentProfile } from '../types/app';

const YEAR_OPTIONS = ['1', '2', '3', '4'];
const SEMESTER_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', '8'];
const STATUS_BADGE_CLASSES: Record<string, string> = {
  Present: 'bg-green-100 text-green-700',
  Absent: 'bg-red-100 text-red-700',
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
  pendingReviews: number;
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

const formatSource = (source?: string | null) => !source ? 'Legacy' : source.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
const formatConfidence = (value?: number | null) => value === null || value === undefined || Number.isNaN(Number(value)) ? '—' : `${(Number(value) * 100).toFixed(1)}%`;
const getExportFileName = (filters: ReportFilters) => `attendance-report-${filters.fromDate || 'all'}-to-${filters.toDate || 'all'}.xlsx`;
const getReportDate = (timestamp?: string | null) => (timestamp ? timestamp.split('T')[0] : '');

const AdminReports: React.FC = () => {
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [reviews, setReviews] = useState<RecognitionReview[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [filters, setFilters] = useState<ReportFilters>(defaultFilters);
  const [reviewAssignments, setReviewAssignments] = useState<Record<string, string>>({});
  const [stats, setStats] = useState<ReportStats>({ present: 0, absent: 0, late: 0, onDuty: 0, total: 0, pendingReviews: 0 });
  const [loading, setLoading] = useState(true);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const selectedDepartmentName = useMemo(
    () => departments.find((department) => department.id === filters.departmentId)?.name || 'All Departments',
    [departments, filters.departmentId]
  );

  const updateStats = useCallback((data: AttendanceRecord[], pendingReviewsCount = reviews.length) => {
    const present = data.filter((record) => record.status === 'Present').length;
    const absent = data.filter((record) => record.status === 'Absent').length;
    const late = data.filter((record) => record.status === 'Late').length;
    const onDuty = data.filter((record) => record.status === 'On Duty').length;
    setStats({ present, absent, late, onDuty, total: data.length, pendingReviews: pendingReviewsCount });
  }, [reviews.length]);

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

  const fetchStudents = useCallback(async () => {
    const response = await api.get<{ students: StudentProfile[] }>('/students?activeOnly=true');
    setStudents(response.data.students || []);
  }, []);

  const fetchReports = useCallback(async (activeFilters: ReportFilters) => {
    setReportsLoading(true);
    try {
      setError('');
      const queryString = buildReportParams(activeFilters);
      const response = await api.get<{ report: AttendanceRecord[] }>(`/attendance/report${queryString ? `?${queryString}` : ''}`);
      const nextData = response.data.report || [];
      setAttendanceData(nextData);
      updateStats(nextData, reviews.length);
      return nextData;
    } catch (requestError: unknown) {
      setAttendanceData([]);
      updateStats([], reviews.length);
      setError(getApiErrorMessage(requestError, 'Failed to load reports.'));
      return [] as AttendanceRecord[];
    } finally {
      setReportsLoading(false);
    }
  }, [reviews.length, updateStats]);

  const fetchPendingReviews = useCallback(async (baseAttendanceData: AttendanceRecord[] = attendanceData) => {
    try {
      const response = await api.get<{ reviews: RecognitionReview[] }>('/reviews/pending');
      const nextReviews = response.data.reviews || [];
      setReviews(nextReviews);
      setReviewAssignments((prev) => {
        const nextAssignments = { ...prev };
        nextReviews.forEach((review) => {
          nextAssignments[review.id] = nextAssignments[review.id] || review.candidate_student_id || '';
        });
        return nextAssignments;
      });
      updateStats(baseAttendanceData, nextReviews.length);
    } catch (requestError: unknown) {
      setStatus(getApiErrorMessage(requestError, 'Failed to load pending reviews.'));
    }
  }, [attendanceData, updateStats]);

  const refreshReportsAndReviews = useCallback(async () => {
    const nextReports = await fetchReports(filters);
    await fetchPendingReviews(nextReports);
  }, [fetchPendingReviews, fetchReports, filters]);

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        await Promise.all([fetchDepartments(), fetchStudents()]);
        const nextReports = await fetchReports(defaultFilters);
        await fetchPendingReviews(nextReports);
      } finally {
        setLoading(false);
      }
    };

    void loadInitialData();
  }, [fetchDepartments, fetchPendingReviews, fetchReports, fetchStudents]);

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

  const approveReview = async (review: RecognitionReview) => {
    setActionKey(`review-approve-${review.id}`);
    setStatus('');
    try {
      const response = await api.post<{ message?: string }>(`/reviews/${review.id}/approve`, {
        studentId: reviewAssignments[review.id] || review.candidate_student_id || undefined,
        reviewer: 'admin-dashboard'
      });
      setStatus(response.data?.message || 'Review approved.');
      await refreshReportsAndReviews();
    } catch (requestError: unknown) {
      setStatus(getApiErrorMessage(requestError, 'Failed to approve review.'));
    } finally {
      setActionKey(null);
    }
  };

  const rejectReview = async (reviewId: string) => {
    setActionKey(`review-reject-${reviewId}`);
    setStatus('');
    try {
      const response = await api.post<{ message?: string }>(`/reviews/${reviewId}/reject`, { reviewer: 'admin-dashboard' });
      setStatus(response.data?.message || 'Review rejected.');
      await refreshReportsAndReviews();
    } catch (requestError: unknown) {
      setStatus(getApiErrorMessage(requestError, 'Failed to reject review.'));
    } finally {
      setActionKey(null);
    }
  };

  const assignReview = async (reviewId: string) => {
    const studentId = reviewAssignments[reviewId];
    if (!studentId) {
      window.alert('Choose a student before assigning this review.');
      return;
    }

    setActionKey(`review-assign-${reviewId}`);
    setStatus('');
    try {
      const response = await api.post<{ message?: string }>(`/reviews/${reviewId}/assign`, { studentId, reviewer: 'admin-dashboard' });
      setStatus(response.data?.message || 'Review assigned successfully.');
      await refreshReportsAndReviews();
    } catch (requestError: unknown) {
      setStatus(getApiErrorMessage(requestError, 'Failed to assign review.'));
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
      ['Pending Reviews', reviews.length],
      []
    ], { origin: 'A1' });
    XLSX.utils.sheet_add_json(worksheet, rows, { origin: 'A9', skipHeader: false });
    XLSX.writeFile(workbook, getExportFileName(filters));
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h2 className="flex items-center gap-2 text-3xl font-bold"><Calendar className="text-blue-600" /> Attendance Reports & Review Console</h2>
        <p className="text-gray-500">Filter attendance, export clean reports, review borderline scans, and trigger parent alerts for absent students.</p>
      </div>

      <form onSubmit={(event) => { event.preventDefault(); if (filters.fromDate && filters.toDate && filters.fromDate > filters.toDate) { setError('From date cannot be later than to date.'); return; } void fetchReports(filters); }} className="rounded-[32px] border border-white/70 bg-white/85 p-5 shadow-xl shadow-slate-200/50 backdrop-blur">
        <div className="mb-4 flex items-center gap-2"><Filter className="text-purple-600" size={18} /><h3 className="text-lg font-semibold">Filter Reports</h3></div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Department</label>
            <select name="departmentId" value={filters.departmentId} onChange={handleFilterChange} className="w-full rounded-2xl border px-3 py-2">
              <option value="">All Departments</option>
              {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Year</label>
            <select name="year" value={filters.year} onChange={handleFilterChange} className="w-full rounded-2xl border px-3 py-2">
              <option value="">All Years</option>
              {YEAR_OPTIONS.map((year) => <option key={year} value={year}>Year {year}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Semester</label>
            <select name="semester" value={filters.semester} onChange={handleFilterChange} className="w-full rounded-2xl border px-3 py-2">
              <option value="">All Semesters</option>
              {SEMESTER_OPTIONS.map((semester) => <option key={semester} value={semester}>Semester {semester}</option>)}
            </select>
          </div>
          <div><label className="mb-1 block text-sm font-medium text-gray-700">From Date</label><input name="fromDate" type="date" value={filters.fromDate} onChange={handleFilterChange} className="w-full rounded-2xl border px-3 py-2" /></div>
          <div><label className="mb-1 block text-sm font-medium text-gray-700">To Date</label><input name="toDate" type="date" value={filters.toDate} onChange={handleFilterChange} className="w-full rounded-2xl border px-3 py-2" /></div>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="submit" className="rounded-2xl bg-blue-600 px-5 py-2 font-semibold text-white hover:bg-blue-700">Apply Filters</button>
          <button type="button" onClick={() => { setFilters(defaultFilters); void fetchReports(defaultFilters); }} className="rounded-2xl bg-gray-100 px-5 py-2 font-semibold text-gray-700 hover:bg-gray-200">Reset</button>
          <button type="button" onClick={exportToExcel} disabled={reportsLoading || attendanceData.length === 0} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"><Download size={16} /> Export Excel</button>
          <button type="button" onClick={() => void refreshReportsAndReviews()} className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-5 py-2 font-semibold text-slate-700 hover:bg-slate-200"><RefreshCcw size={16} /> Refresh Live Data</button>
        </div>
      </form>

      {(error || status) && <div className={`rounded-2xl border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-blue-200 bg-blue-50 text-blue-800'}`}>{error || status}</div>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-[28px] border border-white/70 bg-white/85 p-6 shadow-lg shadow-slate-200/50 backdrop-blur"><div className="flex items-center gap-3"><CheckCircle className="text-green-600" /><div><p className="text-sm font-medium text-gray-500">Present Records</p><p className="mt-1 text-2xl font-bold">{stats.present}</p></div></div></div>
        <div className="rounded-[28px] border border-white/70 bg-white/85 p-6 shadow-lg shadow-slate-200/50 backdrop-blur"><div className="flex items-center gap-3"><AlertCircle className="text-red-600" /><div><p className="text-sm font-medium text-gray-500">Absent Records</p><p className="mt-1 text-2xl font-bold">{stats.absent}</p></div></div></div>
        <div className="rounded-[28px] border border-white/70 bg-white/85 p-6 shadow-lg shadow-slate-200/50 backdrop-blur"><div className="flex items-center gap-3"><AlertCircle className="text-amber-600" /><div><p className="text-sm font-medium text-gray-500">Late Records</p><p className="mt-1 text-2xl font-bold">{stats.late}</p></div></div></div>
        <div className="rounded-[28px] border border-white/70 bg-white/85 p-6 shadow-lg shadow-slate-200/50 backdrop-blur"><div className="flex items-center gap-3"><UserCheck className="text-sky-600" /><div><p className="text-sm font-medium text-gray-500">On Duty Records</p><p className="mt-1 text-2xl font-bold">{stats.onDuty}</p></div></div></div>
        <div className="rounded-[28px] border border-white/70 bg-white/85 p-6 shadow-lg shadow-slate-200/50 backdrop-blur"><div className="flex items-center gap-3"><ShieldAlert className="text-violet-600" /><div><p className="text-sm font-medium text-gray-500">Pending Reviews</p><p className="mt-1 text-2xl font-bold">{stats.pendingReviews}</p></div></div></div>
        <div className="rounded-[28px] border border-white/70 bg-white/85 p-6 shadow-lg shadow-slate-200/50 backdrop-blur"><div className="flex items-center gap-3"><Calendar className="text-blue-600" /><div><p className="text-sm font-medium text-gray-500">Filtered Records</p><p className="mt-1 text-2xl font-bold">{stats.total}</p></div></div></div>
      </div>

      <section className="overflow-hidden rounded-[32px] border border-white/70 bg-white/85 shadow-xl shadow-slate-200/50 backdrop-blur">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-violet-50 p-5">
          <div className="flex items-center gap-3"><ShieldAlert className="text-violet-600" /><div><h3 className="text-xl font-bold text-slate-900">Pending Recognition Reviews</h3><p className="text-sm text-slate-500">Approve strong borderline scans, reject bad captures, or assign them to the right student.</p></div></div>
          <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">{reviews.length} pending</span>
        </div>
        <div className="p-5">
          {loading ? (
            <p className="text-sm italic text-gray-400">Loading pending review queue...</p>
          ) : reviews.length === 0 ? (
            <p className="text-sm italic text-gray-400">No borderline scans are waiting for review right now.</p>
          ) : (
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              {reviews.map((review) => (
                <div key={review.id} className="grid grid-cols-[120px,1fr] gap-4 rounded-[28px] border border-violet-100 bg-violet-50/40 p-4">
                  {review.image_url ? <img src={review.image_url} alt="Review capture" className="h-[120px] w-[120px] rounded-xl border bg-white object-cover" /> : <div className="flex h-[120px] w-[120px] items-center justify-center rounded-xl border bg-white px-2 text-center text-xs text-gray-400">No review image stored</div>}
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-violet-700">Candidate</div>
                      <div className="text-lg font-bold text-slate-900">{review.candidate_student?.name || 'No candidate linked yet'}</div>
                      <div className="text-sm text-slate-500">{review.candidate_student?.register_number || 'Register number unavailable'}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-xl border bg-white px-3 py-2"><div className="text-xs font-semibold uppercase text-slate-400">Period</div><div className="font-semibold text-slate-800">{formatPeriodLabel(review.period)}</div></div>
                      <div className="rounded-xl border bg-white px-3 py-2"><div className="text-xs font-semibold uppercase text-slate-400">Confidence</div><div className="font-semibold text-slate-800">{formatConfidence(review.confidence)}</div></div>
                    </div>
                    <div className="text-sm text-slate-500">Captured on {new Date(review.created_at).toLocaleDateString()} at {new Date(review.created_at).toLocaleTimeString()}</div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Assign to student</label>
                      <select value={reviewAssignments[review.id] || ''} onChange={(event) => setReviewAssignments((prev) => ({ ...prev, [review.id]: event.target.value }))} className="w-full rounded-2xl border bg-white px-3 py-2">
                        <option value="">Select student</option>
                        {students.map((student) => <option key={student.id} value={student.id}>{student.name} ({student.register_number})</option>)}
                      </select>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => void approveReview(review)} disabled={actionKey === `review-approve-${review.id}`} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"><UserCheck size={14} /> {actionKey === `review-approve-${review.id}` ? 'Approving...' : 'Approve'}</button>
                      <button type="button" onClick={() => void assignReview(review.id)} disabled={actionKey === `review-assign-${review.id}`} className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"><SearchCheck size={14} /> {actionKey === `review-assign-${review.id}` ? 'Assigning...' : 'Assign Student'}</button>
                      <button type="button" onClick={() => void rejectReview(review.id)} disabled={actionKey === `review-reject-${review.id}`} className="inline-flex items-center gap-2 rounded-2xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"><XCircle size={14} /> {actionKey === `review-reject-${review.id}` ? 'Rejecting...' : 'Reject'}</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-[32px] border border-white/70 bg-white/85 shadow-xl shadow-slate-200/50 backdrop-blur">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1500px] text-left">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="p-4 font-semibold text-gray-600">Student Name</th>
                <th className="p-4 font-semibold text-gray-600">Register No</th>
                <th className="p-4 font-semibold text-gray-600">Department</th>
                <th className="p-4 font-semibold text-gray-600">Year</th>
                <th className="p-4 font-semibold text-gray-600">Semester</th>
                <th className="p-4 font-semibold text-gray-600">Date & Time</th>
                <th className="p-4 font-semibold text-gray-600">Period</th>
                <th className="p-4 font-semibold text-gray-600">Status</th>
                <th className="p-4 font-semibold text-gray-600">Source</th>
                <th className="p-4 font-semibold text-gray-600">Confidence</th>
                <th className="p-4 font-semibold text-gray-600">Notes</th>
                <th className="p-4 font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reportsLoading ? (
                <tr><td colSpan={12} className="p-10 text-center text-gray-400 italic">Loading attendance data...</td></tr>
              ) : attendanceData.length === 0 ? (
                <tr><td colSpan={12} className="p-10 text-center text-gray-400 italic">No attendance records found for the selected filters.</td></tr>
              ) : attendanceData.map((record) => (
                <tr key={record.id} className="align-top border-b border-slate-100 transition hover:bg-gray-50">
                  <td className="p-4 font-medium">{record.students?.name || 'N/A'}</td>
                  <td className="p-4 text-gray-600">{record.students?.register_number || 'N/A'}</td>
                  <td className="p-4 text-gray-600">{record.students?.department_name || 'N/A'}</td>
                  <td className="p-4 text-gray-600">{record.students?.year || 'N/A'}</td>
                  <td className="p-4 text-gray-600">{record.students?.semester || 'N/A'}</td>
                  <td className="p-4 text-gray-500">{new Date(record.timestamp).toLocaleDateString()}<br />{new Date(record.timestamp).toLocaleTimeString()}</td>
                  <td className="p-4 text-gray-600">{record.sessions?.subject || formatPeriodLabel(record.period)}</td>
                  <td className="p-4">
                    <div className="flex flex-col items-start gap-2">
                      <span className={`rounded-full px-2 py-1 text-xs font-bold ${STATUS_BADGE_CLASSES[record.status] || 'bg-gray-100 text-gray-700'}`}>{record.status}</span>
                      {(record.status === 'Absent' || record.status === 'On Duty') && record.period ? (
                        <button
                          type="button"
                          onClick={() => void toggleOnDutyStatus(record)}
                          disabled={actionKey === `status-${record.id}`}
                          className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold transition disabled:opacity-50 ${
                            record.status === 'Absent'
                              ? 'bg-sky-50 text-sky-700 hover:bg-sky-100'
                              : 'bg-red-50 text-red-700 hover:bg-red-100'
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
                  <td className="p-4 text-gray-600">{formatSource(record.source)}</td>
                  <td className="p-4 text-gray-600">{formatConfidence(record.confidence)}</td>
                  <td className="max-w-[220px] whitespace-pre-wrap p-4 text-gray-500">{record.notes || '—'}</td>
                  <td className="p-4">
                    {record.status === 'Absent' ? (
                      <button
                        type="button"
                        onClick={() => void sendAlert(record)}
                        disabled={actionKey === `alert-${record.id}`}
                        className="inline-flex items-center gap-2 rounded-2xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50"
                      >
                        <PhoneCall size={14} /> {actionKey === `alert-${record.id}` ? 'Sending...' : 'Send Alert'}
                      </button>
                    ) : (
                      <span className="font-medium text-gray-400">-</span>
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

export default AdminReports;
