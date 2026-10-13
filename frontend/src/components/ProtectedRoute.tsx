
// import { useEffect, useState } from "react";
// import { Navigate, Outlet } from "react-router-dom";
// import api from "../api/axios";

// export default function ProtectedRoute() {
//   const [authenticated, setAuthenticated] = useState(false);
//   const [checking, setChecking] = useState(true);

//   useEffect(() => {
//     async function checkSession() {
//       const token = sessionStorage.getItem("accessToken");

//       try {
//         if (!token) {
//           const response = await api.post<{ accessToken: string }>(
//             "/auth/refresh"
//           );
//           sessionStorage.setItem("accessToken", response.data.accessToken);
//         }

//         await api.get("/profile");
//         setAuthenticated(true);
//       } catch {
//         sessionStorage.removeItem("accessToken");
//         setAuthenticated(false);
//       } finally {
//         setChecking(false);
//       }
//     }

//     void checkSession();
//   }, []);

//   if (checking) return <p>Checking session...</p>;

//   return authenticated
//     ? <Outlet />
//     : <Navigate to="/login" replace />;
// }


import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute() {
  const { isAuthenticated, isChecking } = useAuth();

  if (isChecking) {
    return <p>Checking session...</p>;
  }

  return isAuthenticated
    ? <Outlet />
    : <Navigate to="/login" replace />;
}