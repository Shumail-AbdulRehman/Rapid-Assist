import { Navigate, Route, Routes } from "react-router-dom";
import { useEffect, useState } from "react";
import api, { setToken } from "./api";
import { AuthPage } from "./components/AuthPage";
import { UserDashboard } from "./components/UserDashboard";
import { ProviderDashboard } from "./components/ProviderDashboard";

function readStoredSession() {
  const raw = localStorage.getItem("roadside-session");

  if (!raw) {
    return { token: "", user: null };
  }

  try {
    return JSON.parse(raw);
  } catch (_error) {
    return { token: "", user: null };
  }
}

export default function App() {
  const [session, setSession] = useState(readStoredSession);
  const [services, setServices] = useState([]);

  useEffect(() => {
    setToken(session.token);
    localStorage.setItem("roadside-session", JSON.stringify(session));
  }, [session]);

  useEffect(() => {
    api.get("/services").then((response) => setServices(response.data)).catch(() => setServices([]));
  }, []);

  return (
    <Routes>
      <Route
        path="/"
        element={
          session.user ? (
            session.user.role === "provider" ? (
              <Navigate to="/provider" replace />
            ) : (
              <Navigate to="/user" replace />
            )
          ) : (
            <AuthPage onSessionChange={setSession} />
          )
        }
      />
      <Route
        path="/user"
        element={
          session.user?.role === "user" ? (
            <UserDashboard session={session} services={services} />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
      <Route
        path="/provider"
        element={
          session.user?.role === "provider" ? (
            <ProviderDashboard session={session} services={services} />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
    </Routes>
  );
}
