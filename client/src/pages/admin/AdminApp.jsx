import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '../../lib/auth.jsx';
import { ToastProvider } from '../../lib/toast.jsx';
import Login from './Login.jsx';
import Layout from './Layout.jsx';
import Dashboard from './Dashboard.jsx';
import Books from './Books.jsx';
import BookEditor from './BookEditor.jsx';
import Account from './Account.jsx';

function Guard({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid h-full place-items-center"><span className="spinner" /></div>;
  if (!user) return <Navigate to="/admin/login" replace />;
  return children;
}

export default function AdminApp() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          <Route path="login" element={<Login />} />
          <Route element={<Guard><Layout /></Guard>}>
            <Route index element={<Dashboard />} />
            <Route path="books" element={<Books />} />
            <Route path="books/new" element={<BookEditor />} />
            <Route path="books/:id" element={<BookEditor />} />
            <Route path="account" element={<Account />} />
          </Route>
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  );
}
