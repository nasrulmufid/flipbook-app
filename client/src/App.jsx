import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Library from './pages/Library.jsx';
import Viewer from './pages/Viewer.jsx';

const AdminApp = lazy(() => import('./pages/admin/AdminApp.jsx'));

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Library />} />
      <Route path="/book/:slug" element={<Viewer />} />
      <Route path="/embed/:slug" element={<Viewer embed />} />
      <Route
        path="/admin/*"
        element={
          <Suspense fallback={<div className="grid h-full place-items-center"><span className="spinner" /></div>}>
            <AdminApp />
          </Suspense>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
