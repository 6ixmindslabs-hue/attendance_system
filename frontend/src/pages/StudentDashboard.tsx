import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
    CalendarDays,
    CheckCircle2,
    Clock3,
    Download,
    Filter,
    LogOut,
    ShieldAlert,
    UserSquare2,
    XCircle
} from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { api, getApiErrorMessage } from '../lib/api';
import { formatPeriodLabel, isAfternoonPeriod, matchesSelectedPeriod } from '../lib/attendance';
import type { AttendanceRecord, StudentProfile } from '../types/app';

const getTodayDateString = () => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
};

const formatDateForInput = (dateValue: string | Date) => {
    const date = new Date(dateValue);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
};

const statusBadgeClasses: Record<string, string> = {
    Present: 'bg-green-100 text-green-700',
    Absent: 'bg-red-100 text-red-700',
    Late: 'bg-amber-100 text-amber-700',
    'On Duty': 'bg-sky-100 text-sky-700',
    Pending: 'bg-gray-100 text-gray-700'
};

type DashboardFilters = {
    fromDate: string;
    toDate: string;
    period: string;
    status: string;
};

const defaultFilters: DashboardFilters = {
    fromDate: '',
    toDate: '',
    period: '',
    status: ''
};

const StudentDashboard: React.FC = () => {
    const navigate = useNavigate();
    const { logout, session, student: sessionStudent } = useAuth();
    const [student, setStudent] = useState<StudentProfile | null>(sessionStudent);
    const [report, setReport] = useState<AttendanceRecord[]>([]);
    const [filters, setFilters] = useState<DashboardFilters>(defaultFilters);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const studentId = session?.user?.studentId || sessionStudent?.id;

        if (!studentId) {
            setLoading(false);
            return;
        }

        const fetchDashboard = async () => {
            setLoading(true);
            try {
                const [profileRes, reportRes] = await Promise.all([
                    api.get<{ student: StudentProfile }>(`/students/${studentId}`),
                    api.get<{ report: AttendanceRecord[] }>(`/attendance/report?studentId=${studentId}`)
                ]);

                setStudent(profileRes.data.student || sessionStudent || null);
                setReport(reportRes.data.report || []);
                setError('');
            } catch (requestError: unknown) {
                setError(getApiErrorMessage(requestError, 'Failed to load student dashboard.'));
            } finally {
                setLoading(false);
            }
        };

        void fetchDashboard();
    }, [session?.user?.studentId, sessionStudent]);

    const filteredReport = useMemo(() => {
        return report.filter((log) => {
            const localDate = formatDateForInput(log.timestamp);
            const statusLabel = (log.status || '').toLowerCase();

            if (filters.fromDate && localDate < filters.fromDate) {
                return false;
            }

            if (filters.toDate && localDate > filters.toDate) {
                return false;
            }

            if (!matchesSelectedPeriod(log.period, filters.period)) {
                return false;
            }

            if (filters.status && statusLabel !== filters.status.toLowerCase()) {
                return false;
            }

            return true;
        });
    }, [filters, report]);

    const summary = useMemo(() => {
        const present = report.filter((log) => log.status === 'Present').length;
        const absent = report.filter((log) => log.status === 'Absent').length;
        const late = report.filter((log) => log.status === 'Late').length;
        const onDuty = report.filter((log) => log.status === 'On Duty').length;
        const total = report.length;
        const creditedAttendance = present + onDuty;
        const overallPercentage = total > 0 ? Math.round((creditedAttendance / total) * 100) : 0;
        const neededForSeventyFive = total > 0
            ? Math.max(0, Math.ceil((0.75 * total - creditedAttendance) / 0.25))
            : 0;

        return {
            present,
            absent,
            late,
            onDuty,
            total,
            overallPercentage,
            neededForSeventyFive
        };
    }, [report]);

    const todayAttendance = useMemo(() => {
        const today = getTodayDateString();
        const todayRows = report.filter((log) => formatDateForInput(log.timestamp) === today);
        const morning = todayRows.find((log) => (log.period || '').toLowerCase() === 'morning');
        const afternoon = todayRows.find((log) => isAfternoonPeriod(log.period));
        const latest = todayRows[0] || report[0] || null;

        return {
            morningStatus: morning?.status || 'Pending',
            afternoonStatus: afternoon?.status || 'Pending',
            lastMarkedAt: latest?.timestamp || null
        };
    }, [report]);

    const handleFilterChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = event.target;
        setFilters((prev) => ({ ...prev, [name]: value }));
    };

    const exportToExcel = () => {
        if (filteredReport.length === 0) {
            window.alert('No attendance records available to export.');
            return;
        }

        const exportRows = filteredReport.map((log, index) => ({
            'S.No': index + 1,
            Date: new Date(log.timestamp).toLocaleDateString(),
            Day: new Date(log.timestamp).toLocaleDateString(undefined, { weekday: 'long' }),
            Time: new Date(log.timestamp).toLocaleTimeString(),
            Period: formatPeriodLabel(log.period),
            Session: log.sessions?.subject || 'General',
            Status: log.status
        }));

        const worksheet = XLSX.utils.aoa_to_sheet([]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'My Attendance');

        XLSX.utils.sheet_add_aoa(worksheet, [
            ['Student Attendance Report'],
            ['Student Name', student?.name || 'N/A'],
            ['Register Number', student?.register_number || 'N/A'],
            ['Department', student?.department_name || 'N/A'],
            ['From Date', filters.fromDate || 'All'],
            ['To Date', filters.toDate || 'All'],
            ['Period', filters.period || 'All'],
            ['Status', filters.status || 'All'],
            []
        ], { origin: 'A1' });

        XLSX.utils.sheet_add_json(worksheet, exportRows, { origin: 'A10', skipHeader: false });

        worksheet['!cols'] = [
            { wch: 8 },
            { wch: 14 },
            { wch: 14 },
            { wch: 14 },
            { wch: 12 },
            { wch: 22 },
            { wch: 12 }
        ];

        XLSX.writeFile(workbook, `student-attendance-${student?.register_number || 'report'}.xlsx`);
    };

    const signOut = () => {
        logout();
        navigate('/', { replace: true });
    };

    if (loading) {
        return (
            <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
                <div className="rounded-[32px] border border-white/70 bg-white/85 p-8 shadow-xl shadow-slate-200/50 backdrop-blur">
                    <p className="text-gray-500 italic">Loading student dashboard...</p>
                </div>
            </div>
        );
    }

    if (!student) {
        return (
            <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
                <div className="rounded-[32px] border border-rose-200 bg-rose-50 p-8 text-rose-700 shadow-xl shadow-rose-100/60">
                    Student session could not be resolved. Please sign in again.
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="space-y-6">
                <div className="overflow-hidden rounded-[32px] border border-white/70 bg-white/85 shadow-2xl shadow-slate-200/60 backdrop-blur">
                    <div className="bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_28%)] px-6 py-8 sm:px-8">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                                <div className="text-xs font-black uppercase tracking-[0.24em] text-teal-700">Student Workspace</div>
                                <h2 className="mt-3 text-4xl font-black tracking-tight text-slate-950">Attendance Dashboard</h2>
                                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
                                    Review your attendance health, check today&apos;s status, and export your report whenever you need it.
                                </p>
                            </div>
                            <button
                                onClick={signOut}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-300 transition hover:bg-slate-900"
                            >
                                <LogOut size={16} /> Sign Out
                            </button>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 shadow-sm">
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <div className="rounded-[32px] border border-white/70 bg-white/85 p-6 shadow-xl shadow-slate-200/50 backdrop-blur lg:col-span-2">
                        <div className="mb-4 flex items-center gap-2">
                            <UserSquare2 className="text-blue-600" size={20} />
                            <h3 className="text-xl font-semibold">My Profile</h3>
                        </div>
                        <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
                            <div className="rounded-2xl bg-blue-50 p-4">
                                <p className="text-gray-500">Name</p>
                                <p className="font-semibold text-blue-900">{student.name || 'N/A'}</p>
                            </div>
                            <div className="rounded-2xl bg-blue-50 p-4">
                                <p className="text-gray-500">Register Number</p>
                                <p className="font-semibold text-blue-900">{student.register_number || 'N/A'}</p>
                            </div>
                            <div className="rounded-2xl bg-blue-50 p-4">
                                <p className="text-gray-500">Department</p>
                                <p className="font-semibold text-blue-900">{student.department_name || 'N/A'}</p>
                            </div>
                            <div className="rounded-2xl bg-blue-50 p-4">
                                <p className="text-gray-500">Year / Semester</p>
                                <p className="font-semibold text-blue-900">
                                    {student.year || 'N/A'} / {student.semester || 'N/A'}
                                </p>
                            </div>
                            <div className="rounded-2xl bg-blue-50 p-4">
                                <p className="text-gray-500">DOB</p>
                                <p className="font-semibold text-blue-900">{student.dob || 'N/A'}</p>
                            </div>
                            <div className="rounded-2xl bg-blue-50 p-4">
                                <p className="text-gray-500">Blood Group</p>
                                <p className="font-semibold text-blue-900">{student.blood_group || 'N/A'}</p>
                            </div>
                            <div className="rounded-2xl bg-blue-50 p-4 md:col-span-2">
                                <p className="text-gray-500">Address</p>
                                <p className="font-semibold text-blue-900">{student.address || 'N/A'}</p>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-[32px] border border-white/70 bg-white/85 p-6 shadow-xl shadow-slate-200/50 backdrop-blur">
                        <div className="mb-4 flex items-center gap-2">
                            <CalendarDays className="text-emerald-600" size={20} />
                            <h3 className="text-xl font-semibold">Today Status</h3>
                        </div>

                        <div className="space-y-3">
                            <div className="rounded-2xl border border-slate-200 p-4">
                                <p className="mb-1 text-sm text-gray-500">Morning</p>
                                <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${statusBadgeClasses[todayAttendance.morningStatus] || statusBadgeClasses.Pending}`}>
                                    {todayAttendance.morningStatus}
                                </span>
                            </div>

                            <div className="rounded-2xl border border-slate-200 p-4">
                                <p className="mb-1 text-sm text-gray-500">Afternoon</p>
                                <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${statusBadgeClasses[todayAttendance.afternoonStatus] || statusBadgeClasses.Pending}`}>
                                    {todayAttendance.afternoonStatus}
                                </span>
                            </div>

                            <div className="rounded-2xl border border-slate-200 p-4">
                                <p className="mb-1 text-sm text-gray-500">Last Marked</p>
                                <p className="font-semibold text-gray-800">
                                    {todayAttendance.lastMarkedAt
                                        ? `${new Date(todayAttendance.lastMarkedAt).toLocaleDateString()} ${new Date(todayAttendance.lastMarkedAt).toLocaleTimeString()}`
                                        : 'No attendance marked yet'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
                    <div className="rounded-[28px] border border-white/70 bg-white/85 p-5 shadow-lg shadow-slate-200/50 backdrop-blur">
                        <div className="mb-2 flex items-center gap-3">
                            <CheckCircle2 className="text-green-600" size={20} />
                            <p className="text-sm text-gray-500">Present</p>
                        </div>
                        <p className="text-3xl font-bold text-gray-900">{summary.present}</p>
                    </div>

                    <div className="rounded-[28px] border border-white/70 bg-white/85 p-5 shadow-lg shadow-slate-200/50 backdrop-blur">
                        <div className="mb-2 flex items-center gap-3">
                            <XCircle className="text-red-600" size={20} />
                            <p className="text-sm text-gray-500">Absent</p>
                        </div>
                        <p className="text-3xl font-bold text-gray-900">{summary.absent}</p>
                    </div>

                    <div className="rounded-[28px] border border-white/70 bg-white/85 p-5 shadow-lg shadow-slate-200/50 backdrop-blur">
                        <div className="mb-2 flex items-center gap-3">
                            <Clock3 className="text-amber-600" size={20} />
                            <p className="text-sm text-gray-500">Late</p>
                        </div>
                        <p className="text-3xl font-bold text-gray-900">{summary.late}</p>
                    </div>

                    <div className="rounded-[28px] border border-white/70 bg-white/85 p-5 shadow-lg shadow-slate-200/50 backdrop-blur">
                        <div className="mb-2 flex items-center gap-3">
                            <UserSquare2 className="text-sky-600" size={20} />
                            <p className="text-sm text-gray-500">On Duty</p>
                        </div>
                        <p className="text-3xl font-bold text-gray-900">{summary.onDuty}</p>
                    </div>

                    <div className="rounded-[28px] border border-white/70 bg-white/85 p-5 shadow-lg shadow-slate-200/50 backdrop-blur">
                        <div className="mb-2 flex items-center gap-3">
                            <CalendarDays className="text-blue-600" size={20} />
                            <p className="text-sm text-gray-500">Overall %</p>
                        </div>
                        <p className="text-3xl font-bold text-gray-900">{summary.overallPercentage}%</p>
                    </div>

                    <div className="rounded-[28px] border border-white/70 bg-white/85 p-5 shadow-lg shadow-slate-200/50 backdrop-blur">
                        <div className="mb-2 flex items-center gap-3">
                            <ShieldAlert className="text-violet-600" size={20} />
                            <p className="text-sm text-gray-500">75% Target</p>
                        </div>
                        <p className="text-lg font-bold text-gray-900">
                            {summary.neededForSeventyFive > 0 ? `${summary.neededForSeventyFive} more present needed` : 'Safe'}
                        </p>
                    </div>
                </div>

                <div className="rounded-[32px] border border-white/70 bg-white/85 p-6 shadow-xl shadow-slate-200/50 backdrop-blur">
                    <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-2">
                            <Filter className="text-purple-600" size={18} />
                            <h3 className="text-xl font-semibold">Attendance Filters</h3>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <button
                                type="button"
                                onClick={() => setFilters(defaultFilters)}
                                className="rounded-2xl bg-gray-100 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-200"
                            >
                                Reset Filters
                            </button>
                            <button
                                type="button"
                                onClick={exportToExcel}
                                disabled={filteredReport.length === 0}
                                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                                <Download size={16} /> Export Excel
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">From Date</label>
                            <input
                                name="fromDate"
                                type="date"
                                value={filters.fromDate}
                                onChange={handleFilterChange}
                                className="w-full rounded-2xl border px-3 py-2"
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">To Date</label>
                            <input
                                name="toDate"
                                type="date"
                                value={filters.toDate}
                                onChange={handleFilterChange}
                                className="w-full rounded-2xl border px-3 py-2"
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">Period</label>
                            <select
                                name="period"
                                value={filters.period}
                                onChange={handleFilterChange}
                                className="w-full rounded-2xl border px-3 py-2"
                            >
                                <option value="">All Periods</option>
                                <option value="Morning">Morning</option>
                                <option value="Afternoon">Afternoon</option>
                                <option value="General">General</option>
                            </select>
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
                            <select
                                name="status"
                                value={filters.status}
                                onChange={handleFilterChange}
                                className="w-full rounded-2xl border px-3 py-2"
                            >
                                <option value="">All Status</option>
                                <option value="Present">Present</option>
                                <option value="Absent">Absent</option>
                                <option value="Late">Late</option>
                                <option value="On Duty">On Duty</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="overflow-hidden rounded-[32px] border border-white/70 bg-white/85 shadow-xl shadow-slate-200/50 backdrop-blur">
                    <div className="border-b border-slate-200 px-6 py-4">
                        <h3 className="text-xl font-semibold">My Attendance Log</h3>
                        <p className="mt-1 text-sm text-gray-500">Showing {filteredReport.length} records</p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[760px] text-left">
                            <thead className="border-b bg-gray-50">
                                <tr>
                                    <th className="p-4 font-semibold text-gray-600">Date</th>
                                    <th className="p-4 font-semibold text-gray-600">Day</th>
                                    <th className="p-4 font-semibold text-gray-600">Period / Session</th>
                                    <th className="p-4 font-semibold text-gray-600">Marked Time</th>
                                    <th className="p-4 font-semibold text-gray-600">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredReport.length > 0 ? filteredReport.map((log) => (
                                    <tr key={log.id} className="border-b border-slate-100 hover:bg-gray-50">
                                        <td className="p-4">{new Date(log.timestamp).toLocaleDateString()}</td>
                                        <td className="p-4 text-gray-600">
                                            {new Date(log.timestamp).toLocaleDateString(undefined, { weekday: 'long' })}
                                        </td>
                                        <td className="p-4 text-gray-600">{log.sessions?.subject || formatPeriodLabel(log.period)}</td>
                                        <td className="p-4 text-gray-600">{new Date(log.timestamp).toLocaleTimeString()}</td>
                                        <td className="p-4">
                                            <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${statusBadgeClasses[log.status] || statusBadgeClasses.Pending}`}>
                                                {log.status}
                                            </span>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={5} className="p-6 text-center text-gray-500">
                                            No attendance records match the selected filters.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StudentDashboard;
