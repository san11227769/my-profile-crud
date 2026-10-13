import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  Navigate,
  useNavigate,
} from "react-router-dom";
import Register from "./pages/Register";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import Profile from "./pages/Profile";
import api from "./api/axios";

function Header() {
  const navigate = useNavigate();
  const isLoggedIn = Boolean(sessionStorage.getItem("accessToken"));

  async function handleLogout() {
    try {
      await api.post("/auth/logout");
    } finally {
      sessionStorage.removeItem("accessToken");
      navigate("/login", { replace: true });
      window.location.reload();
    }
  }

  return (
    <header className="app-header">
      <nav className="nav-links">
        {isLoggedIn ? (
          <>
            <Link to="/profile">My Profile</Link>
            <button onClick={handleLogout}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </nav>
    </header>
  );
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  return sessionStorage.getItem("accessToken")
    ? <Navigate to="/profile" replace />
    : children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Header />

      <Routes>
        <Route path="/" element={<Navigate to="/profile" replace />} />
        <Route path="/register" element={
          <PublicRoute><Register /></PublicRoute>
        } />
        <Route path="/login" element={
          <PublicRoute><Login /></PublicRoute>
        } />
        <Route element={<ProtectedRoute />}>
          <Route path="/profile" element={<Profile />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
