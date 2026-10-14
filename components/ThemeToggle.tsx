"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("lifestack-theme") || "light";
    setTheme(saved as "light" | "dark");
    if (saved === "dark") {
      document.documentElement.classList.add("dark-theme");
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.classList.remove("dark-theme");
      document.documentElement.setAttribute("data-theme", "light");
    }
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("lifestack-theme", next);
    if (next === "dark") {
      document.documentElement.classList.add("dark-theme");
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.classList.remove("dark-theme");
      document.documentElement.setAttribute("data-theme", "light");
    }
  };

  if (!mounted) return null;

  return (
    <button
      onClick={toggleTheme}
      className="global-theme-toggle"
      style={{
        position: "fixed",
        top: "18px",
        right: "18px",
        zIndex: 9999,
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "50%",
        width: "38px",
        height: "38px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        color: "var(--text)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
        transition: "all 0.2s"
      }}
      title="Toggle Dark Mode"
    >
      {theme === "light" ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
      )}
    </button>
  );
}
