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
      <div className="flex flex-col gap-2">
        <h2 className="flex items-center gap-2 text-3xl font-bold">
          <GraduationCap className="text-blue-600" />
          Student Data
        </h2>
        <p className="text-gray-500">
          Filter student records by department, year, and semester, then export the exact list you are viewing as Excel.
        </p>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void fetchStudents(filters);
        }}
        className="rounded-[32px] border border-white/70 bg-white/85 p-5 shadow-xl shadow-slate-200/50 backdrop-blur"
      >
        <div className="mb-4 flex items-center gap-2">
          <Filter className="text-blue-600" size={18} />
          <h3 className="text-lg font-semibold">Filter Students</h3>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Department</label>
            <select name="departmentId" value={filters.departmentId} onChange={handleFilterChange} className="w-full rounded-2xl border px-3 py-2">
              <option value="">All Departments</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Year</label>
            <select name="year" value={filters.year} onChange={handleFilterChange} className="w-full rounded-2xl border px-3 py-2">
              <option value="">All Years</option>
              {YEAR_OPTIONS.map((year) => (
                <option key={year} value={year}>
                  Year {year}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Semester</label>
            <select name="semester" value={filters.semester} onChange={handleFilterChange} className="w-full rounded-2xl border px-3 py-2">
              <option value="">All Semesters</option>
              {SEMESTER_OPTIONS.map((semester) => (
                <option key={semester} value={semester}>
                  Semester {semester}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button type="submit" className="rounded-2xl bg-blue-600 px-5 py-2 font-semibold text-white hover:bg-blue-700">
            Apply Filters
          </button>
          <button
            type="button"
            onClick={() => {
              setFilters(defaultFilters);
              void fetchStudents(defaultFilters);
            }}
            className="rounded-2xl bg-gray-100 px-5 py-2 font-semibold text-gray-700 hover:bg-gray-200"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={exportToExcel}
            disabled={tableLoading || students.length === 0}
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Download size={16} />
            Export Excel
          </button>
          <button
            type="button"
            onClick={() => void fetchStudents(filters)}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-5 py-2 font-semibold text-slate-700 hover:bg-slate-200"
          >
            <RefreshCcw size={16} />
            Refresh Data
          </button>
        </div>
      </form>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-[28px] border border-white/70 bg-white/85 p-6 shadow-lg shadow-slate-200/50 backdrop-blur">
          <div className="flex items-center gap-3">
            <Users className="text-blue-600" />
            <div>
              <p className="text-sm font-medium text-gray-500">Filtered Students</p>
              <p className="mt-1 text-2xl font-bold">{students.length}</p>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/70 bg-white/85 p-6 shadow-lg shadow-slate-200/50 backdrop-blur">
          <div className="flex items-center gap-3">
            <GraduationCap className="text-violet-600" />
            <div>
              <p className="text-sm font-medium text-gray-500">Department</p>
              <p className="mt-1 text-lg font-bold">{selectedDepartmentName}</p>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/70 bg-white/85 p-6 shadow-lg shadow-slate-200/50 backdrop-blur">
          <div className="flex items-center gap-3">
            <Filter className="text-amber-600" />
            <div>
              <p className="text-sm font-medium text-gray-500">Academic Filter</p>
              <p className="mt-1 text-lg font-bold">
                {filters.year ? `Y${filters.year}` : 'All Years'} / {filters.semester ? `S${filters.semester}` : 'All Semesters'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <section className="overflow-hidden rounded-[32px] border border-white/70 bg-white/85 shadow-xl shadow-slate-200/50 backdrop-blur">
        <div className="border-b border-slate-200 bg-blue-50 p-5">
          <h3 className="text-xl font-bold text-slate-900">Registered Student Records</h3>
          <p className="mt-1 text-sm text-slate-500">All fields are linked directly from the live student records stored in Supabase.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1400px] text-left">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="p-4 font-semibold text-gray-600">S.No</th>
                <th className="p-4 font-semibold text-gray-600">Name</th>
                <th className="p-4 font-semibold text-gray-600">Register No.</th>
                <th className="p-4 font-semibold text-gray-600">Department</th>
                <th className="p-4 font-semibold text-gray-600">Semester</th>
                <th className="p-4 font-semibold text-gray-600">Year</th>
                <th className="p-4 font-semibold text-gray-600">DOB</th>
                <th className="p-4 font-semibold text-gray-600">Address</th>
                <th className="p-4 font-semibold text-gray-600">Parent No.</th>
                <th className="p-4 font-semibold text-gray-600">Blood Group</th>
              </tr>
            </thead>
            <tbody>
              {loading || tableLoading ? (
                <tr>
                  <td colSpan={10} className="p-10 text-center text-gray-400 italic">
                    Loading student records...
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-10 text-center text-gray-400 italic">
                    No student records found for the selected filters.
                  </td>
                </tr>
              ) : (
                students.map((student, index) => (
                  <tr key={student.id} className="align-top border-b border-slate-100 transition hover:bg-gray-50">
                    <td className="p-4 text-gray-500">{index + 1}</td>
                    <td className="p-4 font-medium">{student.name || 'N/A'}</td>
                    <td className="p-4 text-gray-600">{student.register_number || 'N/A'}</td>
                    <td className="p-4 text-gray-600">{student.department_name || 'N/A'}</td>
                    <td className="p-4 text-gray-600">{student.semester || 'N/A'}</td>
                    <td className="p-4 text-gray-600">{student.year || 'N/A'}</td>
                    <td className="p-4 text-gray-600">{student.dob || 'N/A'}</td>
                    <td className="whitespace-pre-line p-4 text-gray-600">{student.address || 'N/A'}</td>
                    <td className="p-4 text-gray-600">{student.parent_phone || 'N/A'}</td>
                    <td className="p-4 text-gray-600">{student.blood_group || 'N/A'}</td>
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

export default AdminStudents;
