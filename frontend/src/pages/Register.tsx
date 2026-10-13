
import { useState } from "react";
import api from "../api/axios";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post("/auth/register", { name, email, password });
      setMessage("Registration successful! Please log in.");
    } catch {
      setMessage("Registration failed. Check your details.");
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>Register</h2>
      <input placeholder="Name" value={name}
        onChange={e => setName(e.target.value)} required />
      <input type="email" placeholder="Email" value={email}
        onChange={e => setEmail(e.target.value)} required />
      <input type="password" placeholder="Password (10+ characters)"
        value={password} onChange={e => setPassword(e.target.value)}
        minLength={10} required />
      <button type="submit">Register</button>
      <p>{message}</p>
    </form>
  );
}

