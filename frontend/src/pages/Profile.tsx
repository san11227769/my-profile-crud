
import { useEffect, useState } from "react";
import api from "../api/axios";

type ProfileData = {
  id: string;
  name: string;
  email: string;
  bio: string;
};

export default function Profile() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [bio, setBio] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadProfile() {
      try {
        const { data } = await api.get("/profile");
        setProfile(data.profile);
        setName(data.profile.name);
        setBio(data.profile.bio ?? "");
      } catch {
        setMessage("Profile load failed. Please login again.");
      }
    }
    
    void loadProfile();
  }, []);

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const token = sessionStorage.getItem("accessToken");
      await api.put(
        "/profile",
        { name, bio },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage("Profile updated successfully!");
      setProfile(prev => prev ? { ...prev, name, bio } : prev);
    } catch {
      setMessage("Profile update failed.");
    }
  }

  if (!profile) return <p>{message || "Loading profile..."}</p>;

  return (
    <>
   
<form onSubmit={handleUpdate}>
      <h2>My Profile</h2>
      <p>Email: {profile.email}</p>
      <label>Name</label>
      <input value={name} onChange={e => setName(e.target.value)}
        required maxLength={100} />
      <label>Bio</label>
      <textarea value={bio} onChange={e => setBio(e.target.value)}
        maxLength={1000} />
      <button type="submit"  style={{width:'100%'}}>Update Profile</button>
      <p>{message}</p>
   
    </form>
    
    </>
    
  );
}
