import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Filter, GraduationCap, RefreshCcw, Users } from 'lucide-react';
import * as XLSX from 'xlsx';
import { api, getApiErrorMessage } from '../lib/api';
import type { Department, StudentProfile } from '../types/app';

const YEAR_OPTIONS = ['1', '2', '3', '4'];
const SEMESTER_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', '8'];

type StudentFilters = {
  departmentId: string;
  year: string;
  semester: string;
};

const defaultFilters: StudentFilters = {
  departmentId: '',
  year: '',
  semester: ''
};

const getExportFileName = (filters: StudentFilters) => {
  const departmentPart = filters.departmentId || 'all-departments';
  const yearPart = filters.year || 'all-years';
  const semesterPart = filters.semester || 'all-semesters';
  return `student-data-${departmentPart}-${yearPart}-${semesterPart}.xlsx`;
};

const AdminStudents: React.FC = () => {
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [filters, setFilters] = useState<StudentFilters>(defaultFilters);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(true);
  const [error, setError] = useState('');

  const selectedDepartmentName = useMemo(
    () => departments.find((department) => department.id === filters.departmentId)?.name || 'All Departments',
    [departments, filters.departmentId]
  );

  const buildParams = (activeFilters: StudentFilters) => {
    const params = new URLSearchParams();
    params.append('activeOnly', 'true');
    if (activeFilters.departmentId) params.append('departmentId', activeFilters.departmentId);
    if (activeFilters.year) params.append('year', activeFilters.year);
    if (activeFilters.semester) params.append('semester', activeFilters.semester);
    return params.toString();
  };

  const fetchDepartments = useCallback(async () => {
    const response = await api.get<{ departments: Department[] }>('/students/departments');
    setDepartments(response.data.departments || []);
  }, []);

  const fetchStudents = useCallback(async (activeFilters: StudentFilters) => {
    setTableLoading(true);
    try {
      setError('');
      const queryString = buildParams(activeFilters);
      const response = await api.get<{ students: StudentProfile[] }>(`/students${queryString ? `?${queryString}` : ''}`);
      setStudents(response.data.students || []);
    } catch (requestError: unknown) {
      setStudents([]);
      setError(getApiErrorMessage(requestError, 'Failed to load student data.'));
    } finally {
      setTableLoading(false);
    }
  }, []);

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        await Promise.all([fetchDepartments(), fetchStudents(defaultFilters)]);
      } catch (requestError: unknown) {
        setError(getApiErrorMessage(requestError, 'Failed to load student page.'));
      } finally {
        setLoading(false);
      }
    };

    void loadInitialData();
  }, [fetchDepartments, fetchStudents]);

  const handleFilterChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const exportToExcel = () => {
    if (students.length === 0) {
      window.alert('No student data available to export.');
      return;
    }

    const rows = students.map((student, index) => ({
      'S.No': index + 1,
      Name: student.name || 'N/A',
      'Register Number': student.register_number || 'N/A',
      Department: student.department_name || 'N/A',
      Semester: student.semester || 'N/A',
      Year: student.year || 'N/A',
      DOB: student.dob || 'N/A',
      Address: student.address || 'N/A',
      'Parent Phone': student.parent_phone || 'N/A',
      'Blood Group': student.blood_group || 'N/A'
    }));

    const worksheet = XLSX.utils.aoa_to_sheet([]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Student Data');
    XLSX.utils.sheet_add_aoa(worksheet, [
      ['Student Data'],
      ['Department', selectedDepartmentName],
      ['Year', filters.year || 'All Years'],
      ['Semester', filters.semester || 'All Semesters'],
      ['Total Students', students.length],
      []
    ], { origin: 'A1' });
    XLSX.utils.sheet_add_json(worksheet, rows, { origin: 'A7', skipHeader: false });
    XLSX.writeFile(workbook, getExportFileName(filters));
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between border-b border-gray-200 pb-8">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600 mb-2">Registry Management</div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">Student Directory</h2>
          <p className="mt-2 text-sm text-gray-500">
            Institutional database of verified student biometric profiles and credentials.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={exportToExcel}
            disabled={tableLoading || students.length === 0}
            className="h-10 px-5 inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <Download size={16} /> Export Records
          </button>
          <button
            type="button"
            onClick={() => void fetchStudents(filters)}
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
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-900">Registry Search Parameters</h3>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void fetchStudents(filters);
          }}
          className="p-6 space-y-6"
        >
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Academic Dept</label>
              <select
                name="departmentId"
                value={filters.departmentId}
                onChange={handleFilterChange}
                className="block w-full h-10 border border-gray-200 rounded bg-white text-sm px-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              >
                <option value="">All Departments</option>
                {departments.map((dept) => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Year Level</label>
              <select
                name="year"
                value={filters.year}
                onChange={handleFilterChange}
                className="block w-full h-10 border border-gray-200 rounded bg-white text-sm px-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              >
                <option value="">All Years</option>
                {YEAR_OPTIONS.map((y) => <option key={y} value={y}>Year {y}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Current Semester</label>
              <select
                name="semester"
                value={filters.semester}
                onChange={handleFilterChange}
                className="block w-full h-10 border border-gray-200 rounded bg-white text-sm px-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              >
                <option value="">All Semesters</option>
                {SEMESTER_OPTIONS.map((s) => <option key={s} value={s}>Semester {s}</option>)}
              </select>
            </div>
          </div>

          <div className="flex gap-2 pt-2 border-t border-gray-100">
            <button
              type="submit"
              className="h-9 px-6 rounded bg-gray-900 text-xs font-bold uppercase tracking-widest text-white hover:bg-black transition-colors"
            >
              Filter Registry
            </button>
            <button
              type="button"
              onClick={() => { setFilters(defaultFilters); void fetchStudents(defaultFilters); }}
              className="h-9 px-6 rounded border border-gray-200 bg-white text-xs font-bold uppercase tracking-widest text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Reset
            </button>
          </div>
        </form>
      </section>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700 flex items-center gap-3">
          <Users size={14} />
          {error}
        </div>
      )}

      {/* Metric Row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard label="Enrolled Students" value={students.length} icon={<Users size={16} className="text-indigo-600" />} />
        <MetricCard label="Active Dept" value={selectedDepartmentName} icon={<GraduationCap size={16} className="text-indigo-600" />} />
        <MetricCard label="Academic Scope" value={`${filters.year ? `Year ${filters.year}` : 'All'} / ${filters.semester ? `Sem ${filters.semester}` : 'All'}`} />
      </div>

      {/* Table Section */}
      <section className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-900">Student Identity Registry</h3>
          <span className="text-[10px] font-bold text-gray-400 tabular-nums">SYNC_SUCCESS • {students.length} PROFILES</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-200">
                <th className="px-6 py-3 font-bold text-gray-600 uppercase tracking-widest text-[10px] w-12">S.No</th>
                <th className="px-6 py-3 font-bold text-gray-600 uppercase tracking-widest text-[10px]">Student Details</th>
                <th className="px-6 py-3 font-bold text-gray-600 uppercase tracking-widest text-[10px]">Academic ID</th>
                <th className="px-6 py-3 font-bold text-gray-600 uppercase tracking-widest text-[10px]">Placement Meta</th>
                <th className="px-6 py-3 font-bold text-gray-600 uppercase tracking-widest text-[10px]">Registry Metrics</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading || tableLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-xs font-medium text-gray-400 uppercase tracking-widest italic">
                    Accessing centralized student record storage...
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-xs font-medium text-gray-300 uppercase tracking-widest italic">
                    Query returned zero records.
                  </td>
                </tr>
              ) : (
                students.map((student, index) => (
                  <tr key={student.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-4 text-xs font-mono text-gray-400">{String(index + 1).padStart(3, '0')}</td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">{student.name || 'ERR_NAME'}</div>
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tight mt-0.5">{student.department_name}</div>
                    </td>
                    <td className="px-6 py-4">
                       <div className="text-xs font-bold text-gray-700 font-mono">{student.register_number}</div>
                       <div className="text-[10px] font-bold text-indigo-600 uppercase mt-0.5">Verified Profile</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs font-semibold text-gray-600 font-mono">Y{student.year} / S{student.semester}</div>
                      <div className="text-[10px] font-bold text-gray-400 uppercase mt-0.5">BOD: {student.dob || '—'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-2">
                        <div className="text-[10px] font-bold text-gray-500 truncate max-w-[240px]">ADDR: {student.address || 'UNDEFINED'}</div>
                        <div className="flex items-center gap-2">
                           <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 rounded tracking-tighter uppercase">TEL: {student.parent_phone}</span>
                           {student.blood_group && (
                             <span className="text-[10px] font-bold bg-red-50 text-red-600 px-2 rounded tracking-tighter uppercase">TYPE: {student.blood_group}</span>
                           )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

function MetricCard({ label, value, icon }: { label: string; value: string | number; icon?: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 p-5 rounded-md shadow-sm">
      <div className="flex items-center justify-between mb-3">
         <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 leading-none">{label}</span>
         {icon}
      </div>
      <div className="text-xl font-bold tracking-tight text-gray-900 truncate tabular-nums">{value}</div>
    </div>
  );
}

export default AdminStudents;
