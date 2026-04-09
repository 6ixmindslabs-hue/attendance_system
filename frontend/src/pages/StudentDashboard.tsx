import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
    CalendarDays,
    Download,
    Filter,
    LogOut,
    ShieldAlert,
    UserSquare2
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
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <div className="space-y-8">
                {/* Dashboard Header */}
                <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between border-b border-gray-200 pb-8">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600 mb-2">Student Portal</div>
                        <h2 className="text-2xl font-bold tracking-tight text-gray-900">Personal Attendance Dashboard</h2>
                        <p className="mt-2 text-sm text-gray-500">
                            Centralized view of your academic presence and institutional records.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={signOut}
                            className="h-10 px-5 inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            <LogOut size={16} /> Sign Out
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
                    {/* Profile Information */}
                    <div className="lg:col-span-3">
                        <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
                                <UserSquare2 className="text-gray-400" size={18} />
                                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900">Identity Profile</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-gray-200">
                                <ProfileItem label="Full Name" value={student.name} />
                                <ProfileItem label="Registry ID" value={student.register_number} highlight />
                                <ProfileItem label="Academic Dept" value={student.department_name} />
                                <ProfileItem label="Year / Semester" value={`${student.year || 'N/A'} / ${student.semester || 'N/A'}`} />
                                <ProfileItem label="Date of Birth" value={student.dob} />
                                <ProfileItem label="Blood Group" value={student.blood_group} />
                            </div>
                            <div className="p-6 border-t border-gray-100">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Residential Registry</p>
                                <p className="text-sm text-gray-700 leading-relaxed">{student.address || 'No address on file'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Today's Summary */}
                    <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
                            <CalendarDays className="text-gray-400" size={18} />
                            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900">Daily Status</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <StatusItem label="Morning Session" status={todayAttendance.morningStatus} />
                            <StatusItem label="Afternoon Session" status={todayAttendance.afternoonStatus} />
                            <div className="pt-4 border-t border-gray-100">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Last Sync</p>
                                <p className="text-xs font-medium text-gray-600">
                                    {todayAttendance.lastMarkedAt
                                        ? `${new Date(todayAttendance.lastMarkedAt).toLocaleTimeString()}`
                                        : 'No activity detected'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
                    <StatCard label="Present" value={summary.present} color="emerald" />
                    <StatCard label="Absent" value={summary.absent} color="red" />
                    <StatCard label="On Duty" value={summary.onDuty} color="blue" />
                    <StatCard label="Late" value={summary.late} color="orange" />
                    <StatCard label="Overall %" value={`${summary.overallPercentage}%`} color="indigo" />
                    <TargetCard needed={summary.neededForSeventyFive} />
                </div>

                {/* Attendance Log Section */}
                <div className="bg-white border border-gray-200 rounded-md shadow-sm">
                    <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between border-b border-gray-100">
                        <div className="flex items-center gap-3">
                            <Filter className="text-gray-400" size={18} />
                            <h3 className="text-base font-bold tracking-tight text-gray-900">Attendance Filter</h3>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => setFilters(defaultFilters)}
                                className="h-9 px-4 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors"
                            >
                                Clear
                            </button>
                            <button
                                type="button"
                                onClick={exportToExcel}
                                disabled={filteredReport.length === 0}
                                className="h-9 px-4 inline-flex items-center gap-2 rounded bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                            >
                                <Download size={14} /> Export Report
                            </button>
                        </div>
                    </div>

                    {/* Filter Inputs */}
                    <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-2 lg:grid-cols-4 bg-gray-50/30">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-widest text-gray-500">From Date</label>
                            <input
                                name="fromDate"
                                type="date"
                                value={filters.fromDate}
                                onChange={handleFilterChange}
                                className="block w-full h-10 border border-gray-300 rounded-md text-sm px-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-widest text-gray-500">To Date</label>
                            <input
                                name="toDate"
                                type="date"
                                value={filters.toDate}
                                onChange={handleFilterChange}
                                className="block w-full h-10 border border-gray-300 rounded-md text-sm px-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Period Scope</label>
                            <select
                                name="period"
                                value={filters.period}
                                onChange={handleFilterChange}
                                className="block w-full h-10 border border-gray-300 rounded-md text-sm px-3 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                            >
                                <option value="">All Periods</option>
                                <option value="Morning">Morning</option>
                                <option value="Afternoon">Afternoon</option>
                                <option value="General">General</option>
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Status Type</label>
                            <select
                                name="status"
                                value={filters.status}
                                onChange={handleFilterChange}
                                className="block w-full h-10 border border-gray-300 rounded-md text-sm px-3 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                            >
                                <option value="">All Status</option>
                                <option value="Present">Present</option>
                                <option value="Absent">Absent</option>
                                <option value="Late">Late</option>
                                <option value="On Duty">On Duty</option>
                            </select>
                        </div>
                    </div>

                    {/* Report Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 border-y border-gray-200">
                                <tr>
                                    <th className="px-6 py-3 font-bold text-gray-600 uppercase tracking-widest text-[10px]">Date</th>
                                    <th className="px-6 py-3 font-bold text-gray-600 uppercase tracking-widest text-[10px]">Day</th>
                                    <th className="px-6 py-3 font-bold text-gray-600 uppercase tracking-widest text-[10px]">Period / Session</th>
                                    <th className="px-6 py-3 font-bold text-gray-600 uppercase tracking-widest text-[10px]">Marked Time</th>
                                    <th className="px-6 py-3 font-bold text-gray-600 uppercase tracking-widest text-[10px]">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredReport.length > 0 ? filteredReport.map((log) => (
                                    <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-gray-900">{new Date(log.timestamp).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 text-gray-500">
                                            {new Date(log.timestamp).toLocaleDateString(undefined, { weekday: 'long' })}
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">{log.sessions?.subject || formatPeriodLabel(log.period)}</td>
                                        <td className="px-6 py-4 text-gray-600 font-mono text-xs">{new Date(log.timestamp).toLocaleTimeString()}</td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-tighter ${statusBadgeClasses[log.status] || statusBadgeClasses.Pending}`}>
                                                {log.status}
                                            </span>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500 bg-white">
                                            No attendance records established for currently selected filter criteria.
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

// --- Helper Components for Cleanliness ---

const ProfileItem = ({ label, value, highlight = false }: { label: string; value: string | null | undefined; highlight?: boolean }) => (
    <div className="p-6 bg-white">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">{label}</p>
        <p className={`text-sm font-semibold ${highlight ? 'text-indigo-600' : 'text-gray-900'}`}>{value || 'N/A'}</p>
    </div>
);

const StatusItem = ({ label, status }: { label: string; status: string }) => (
    <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-600">{label}</span>
        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded ${statusBadgeClasses[status] || statusBadgeClasses.Pending}`}>
            {status}
        </span>
    </div>
);

const StatCard = ({ label, value, color }: { label: string; value: string | number; color: string }) => {
    const colorMap: Record<string, string> = {
        emerald: 'text-emerald-600',
        red: 'text-red-600',
        blue: 'text-sky-600',
        orange: 'text-amber-600',
        indigo: 'text-indigo-600',
    };
    
    return (
        <div className="bg-white border border-gray-200 p-5 rounded-md shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3 leading-none">{label}</p>
            <p className={`text-2xl font-bold tracking-tight ${colorMap[color] || 'text-gray-900'}`}>{value}</p>
        </div>
    );
};

const TargetCard = ({ needed }: { needed: number }) => (
    <div className={`p-5 rounded-md border shadow-sm ${needed > 0 ? 'bg-indigo-50 border-indigo-100' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center gap-2 mb-3">
            <ShieldAlert size={14} className={needed > 0 ? 'text-indigo-600' : 'text-gray-400'} />
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 leading-none">Institutional 75% Target</p>
        </div>
        <p className={`text-sm font-bold ${needed > 0 ? 'text-indigo-700' : 'text-emerald-600'}`}>
            {needed > 0 ? `${needed} more sessions required` : 'Met Requirements'}
        </p>
    </div>
);

export default StudentDashboard;
