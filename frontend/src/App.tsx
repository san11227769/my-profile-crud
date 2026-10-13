
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
import { AuthProvider, useAuth } from "./context/AuthContext";

function Header() {
  const navigate = useNavigate();
  const { isAuthenticated, setIsAuthenticated } = useAuth();

  async function handleLogout() {
    try {
      await api.post("/auth/logout");
    } catch (error) {
      console.error("Logout request failed:", error);
    } finally {
      sessionStorage.removeItem("accessToken");
      setIsAuthenticated(false);
      navigate("/login", { replace: true });
    }
  }

  return (
    <header className="app-header">
      <nav className="nav-links">
        {isAuthenticated ? (
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

function AppRoutes() {
  const { isAuthenticated, isChecking } = useAuth();

  if (isChecking) return <p>Checking session...</p>;

  return (
    <>
      <Header />
      <Routes>
        <Route
          path="/"
          element={
            <Navigate to={isAuthenticated ? "/profile" : "/login"} replace />
          }
        />
        <Route
          path="/register"
          element={
            isAuthenticated ? <Navigate to="/profile" replace /> : <Register />
          }
        />
        <Route
          path="/login"
          element={
            isAuthenticated ? <Navigate to="/profile" replace /> : <Login />
          }
        />
        <Route element={<ProtectedRoute />}>
          <Route path="/profile" element={<Profile />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}