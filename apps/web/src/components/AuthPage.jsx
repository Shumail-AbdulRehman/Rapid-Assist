import { useState } from "react";
import api from "../api";
import { uploadImage } from "../utils/upload";

const initialRegisterState = {
  role: "user",
  name: "",
  phone: "",
  password: "",
  profilePicture: "",
  workshopPicture: "",
  cnic: "",
  certificates: "",
  previousWorkHistory: "",
  reviewsSummary: "",
  latitude: "24.8607",
  longitude: "67.0011",
};

export function AuthPage({ onSessionChange }) {
  const [mode, setMode] = useState("register");
  const [role, setRole] = useState("user");
  const [registerForm, setRegisterForm] = useState(initialRegisterState);
  const [loginForm, setLoginForm] = useState({ phone: "", password: "" });
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState("");

  async function handleImageUpload(field, file) {
    if (!file) {
      return;
    }

    try {
      setUploading(field);
      const fileUrl = await uploadImage(file);
      setRegisterForm((current) => ({ ...current, [field]: fileUrl }));
      setMessage("Image uploaded");
    } catch (error) {
      setMessage(error.response?.data?.message || "Image upload failed");
    } finally {
      setUploading("");
    }
  }

  async function handleRegister(event) {
    event.preventDefault();

    try {
      await api.post("/auth/register", { ...registerForm, role });
      setMode("login");
      setMessage("Registration complete. Please log in.");
    } catch (error) {
      setMessage(error.response?.data?.message || "Registration failed");
    }
  }

  async function handleLogin(event) {
    event.preventDefault();

    try {
      const response = await api.post("/auth/login", loginForm);
      onSessionChange(response.data);
    } catch (error) {
      setMessage(error.response?.data?.message || "Login failed");
    }
  }

  return (
    <div className="shell auth-shell">
      <section className="hero-card">
        <p className="eyebrow">Roadside Assistance Platform</p>
        <h1>Emergency help with the InDrive offer model.</h1>
        <p className="hero-copy">
          Users submit the issue, nearby providers bid with a price, and accepted providers can be
          tracked on the map.
        </p>
      </section>

      <section className="panel">
        <div className="segmented">
          <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>
            Register
          </button>
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
            Login
          </button>
        </div>

        <div className="segmented role-switch">
          <button className={role === "user" ? "active" : ""} onClick={() => setRole("user")}>
            Go to User Side
          </button>
          <button className={role === "provider" ? "active" : ""} onClick={() => setRole("provider")}>
            Go to Provider Side
          </button>
        </div>

        {mode === "register" ? (
          <form className="form-grid" onSubmit={handleRegister}>
            <input
              placeholder="Full name"
              value={registerForm.name}
              onChange={(event) => setRegisterForm({ ...registerForm, name: event.target.value })}
            />
            <input
              placeholder="Phone number"
              value={registerForm.phone}
              onChange={(event) => setRegisterForm({ ...registerForm, phone: event.target.value })}
            />
            <input
              placeholder="Password"
              type="password"
              value={registerForm.password}
              onChange={(event) => setRegisterForm({ ...registerForm, password: event.target.value })}
            />
            <input
              type="file"
              accept="image/*"
              onChange={(event) => handleImageUpload("profilePicture", event.target.files?.[0])}
            />
            {registerForm.profilePicture ? <p className="status">Profile image uploaded</p> : null}

            {role === "provider" && (
              <>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => handleImageUpload("workshopPicture", event.target.files?.[0])}
                />
                {registerForm.workshopPicture ? <p className="status">Workshop image uploaded</p> : null}
                <input
                  placeholder="CNIC"
                  value={registerForm.cnic}
                  onChange={(event) => setRegisterForm({ ...registerForm, cnic: event.target.value })}
                />
                <textarea
                  placeholder="Certificates"
                  value={registerForm.certificates}
                  onChange={(event) => setRegisterForm({ ...registerForm, certificates: event.target.value })}
                />
                <textarea
                  placeholder="Previous work history"
                  value={registerForm.previousWorkHistory}
                  onChange={(event) =>
                    setRegisterForm({ ...registerForm, previousWorkHistory: event.target.value })
                  }
                />
                <textarea
                  placeholder="Reviews summary"
                  value={registerForm.reviewsSummary}
                  onChange={(event) => setRegisterForm({ ...registerForm, reviewsSummary: event.target.value })}
                />
              </>
            )}

            <button className="primary-button" type="submit">
              {uploading ? "Uploading..." : "Create account"}
            </button>
          </form>
        ) : (
          <form className="form-grid" onSubmit={handleLogin}>
            <input
              placeholder="Phone number"
              value={loginForm.phone}
              onChange={(event) => setLoginForm({ ...loginForm, phone: event.target.value })}
            />
            <input
              placeholder="Password"
              type="password"
              value={loginForm.password}
              onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })}
            />
            <button className="primary-button" type="submit">
              Continue
            </button>
          </form>
        )}

        {message ? <p className="status">{message}</p> : null}
      </section>
    </div>
  );
}
