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
    <div className="flex min-h-screen items-center justify-center bg-gray-50/50 px-6 font-sans">
      <div className="w-full max-w-sm rounded-md border border-gray-200 bg-white p-12 text-center shadow-sm">
        <div className="inline-flex items-center gap-2 mb-6">
           <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-ping" />
           <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Registry System</div>
        </div>
        <h1 className="text-xl font-bold tracking-tight text-gray-900">Synchronizing...</h1>
        <p className="mt-3 text-xs font-medium text-gray-500 leading-relaxed uppercase tracking-widest opacity-60">
          Establishing secure institutional baseline
        </p>
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
