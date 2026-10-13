import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

type LoginResponse = {
  accessToken: string;
};

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const { data } = await api.post<LoginResponse>(
        "/auth/login",
        { email, password }
      );

      sessionStorage.setItem("accessToken", data.accessToken);
      navigate("/profile", { replace: true });
    } catch {
      setMessage("Login failed. Check email and password.");
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>Login</h2>
      <input type="email" placeholder="Email" value={email}
        onChange={e => setEmail(e.target.value)} required />
      <input type="password" placeholder="Password" value={password}
        onChange={e => setPassword(e.target.value)} required />
      <button type="submit">Login</button>
      <p>{message}</p>
    </form>
  );
}
