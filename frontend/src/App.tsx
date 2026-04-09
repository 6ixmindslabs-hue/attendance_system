import { Suspense, lazy, type ReactNode } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { useAuth } from './auth/useAuth';
import AdminShell from './components/AdminShell';
import RequireAuth from './components/RequireAuth';

const Login = lazy(() => import('./pages/Login'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const StudentRegistration = lazy(() => import('./pages/StudentRegistration'));
const AttendanceCapture = lazy(() => import('./pages/AttendanceCapture'));
const StudentDashboard = lazy(() => import('./pages/StudentDashboard'));
const AdminReports = lazy(() => import('./pages/AdminReports'));
const AttendanceKiosk = lazy(() => import('./pages/AttendanceKiosk'));
const AdminSettings = lazy(() => import('./pages/AdminSettings'));
const AdminStudents = lazy(() => import('./pages/AdminStudents'));

function SessionRedirect() {
  const { role } = useAuth();

  if (role === 'ADMIN') {
    return <Navigate to="/admin" replace />;
  }

  if (role === 'STUDENT') {
    return <Navigate to="/student" replace />;
  }

  return <Navigate to="/" replace />;
}

function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <SessionRedirect />;
  }

  return <>{children}</>;
}

function AppLoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md rounded-[32px] border border-white/70 bg-white/85 p-8 text-center shadow-2xl shadow-slate-200/60 backdrop-blur">
        <div className="text-xs font-black uppercase tracking-[0.28em] text-teal-700">Attendance OS</div>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">Loading workspace</h1>
        <p className="mt-3 text-sm text-slate-600">Preparing secure attendance operations and live recognition tools.</p>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Suspense fallback={<AppLoadingScreen />}>
          <Routes>
            <Route path="/" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />

            <Route element={<RequireAuth roles={['ADMIN']} />}>
              <Route element={<AdminShell />}>
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/register-student" element={<StudentRegistration />} />
                <Route path="/admin/students" element={<AdminStudents />} />
                <Route path="/admin/reports" element={<AdminReports />} />
                <Route path="/admin/settings" element={<AdminSettings />} />
              </Route>
              <Route path="/capture" element={<AttendanceCapture />} />
              <Route path="/kiosk" element={<AttendanceKiosk />} />
            </Route>

            <Route element={<RequireAuth roles={['STUDENT']} />}>
              <Route path="/student" element={<StudentDashboard />} />
            </Route>

            <Route path="*" element={<SessionRedirect />} />
          </Routes>
        </Suspense>
      </Router>
    </AuthProvider>
  );
}

export default App;
