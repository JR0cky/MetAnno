import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
import { LogOut, LayoutDashboard, ClipboardList, Download, ShieldAlert, Pen } from "lucide-react";

export const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [projects, setProjects] = useState([]);
  const [selectedProjId, setSelectedProjId] = useState("");

  useEffect(() => {
    if (user) {
      api.getProjects()
        .then((data) => {
          setProjects(data);
          const savedId = localStorage.getItem("metanno_current_project_id");
          if (savedId && data.some(p => p.id === savedId)) {
            setSelectedProjId(savedId);
          } else if (data.length > 0) {
            setSelectedProjId(data[0].id);
            localStorage.setItem("metanno_current_project_id", data[0].id);
          }
        })
        .catch(err => console.error("Error loading projects:", err));
    }
  }, [user]);

  const handleProjectChange = (e) => {
    const newId = e.target.value;
    setSelectedProjId(newId);
    localStorage.setItem("metanno_current_project_id", newId);
    window.dispatchEvent(new Event("projectChanged"));
    if (location.pathname !== "/dashboard") {
      navigate("/dashboard");
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  if (!user) return <>{children}</>;

  const isActive = (path) => location.pathname === path;

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans text-slate-800">
      {/* Sticky Header with Backdrop Blur */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/70 backdrop-blur-lg">
        <div className="mx-auto max-w-[1800px] px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            
            {/* Logo Group */}
            <div className="flex items-center gap-8">
              <Link to="/dashboard" className="flex items-center gap-2 group">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/10 group-hover:scale-105 transition-transform">
                  <Pen className="h-5 w-5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-lg font-black tracking-tight bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                    MetAnno
                  </span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                    Workplace
                  </span>
                </div>
              </Link>

              {/* Header Navigation Link Items */}
              <nav className="hidden md:flex items-center gap-1 text-sm font-semibold text-slate-600">
                <Link
                  to="/dashboard"
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                    isActive("/dashboard")
                      ? "bg-indigo-50 text-indigo-600"
                      : "hover:bg-slate-100/70 hover:text-slate-900"
                  }`}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Link>
                <Link
                  to="/review"
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                    isActive("/review")
                      ? "bg-indigo-50 text-indigo-600"
                      : "hover:bg-slate-100/70 hover:text-slate-900"
                  }`}
                >
                  <ClipboardList className="h-4 w-4" />
                  Review
                </Link>
                {user.role === "admin" && (
                  <>
                    <Link
                      to="/admin"
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                        isActive("/admin")
                          ? "bg-indigo-50 text-indigo-600"
                          : "hover:bg-slate-100/70 hover:text-slate-900"
                      }`}
                    >
                      <ShieldAlert className="h-4 w-4" />
                      Admin
                    </Link>
                    <Link
                      to="/export"
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                        isActive("/export")
                          ? "bg-indigo-50 text-indigo-600"
                          : "hover:bg-slate-100/70 hover:text-slate-900"
                      }`}
                    >
                      <Download className="h-4 w-4" />
                      Export
                    </Link>
                  </>
                )}
              </nav>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-4">

              {/* Dataset/Project Selector */}
              {projects.length > 1 && (
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-xl px-2.5 py-1.5 shadow-sm">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                    Dataset:
                  </span>
                  <select
                    value={selectedProjId}
                    onChange={handleProjectChange}
                    className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer border-none p-0 pr-1.5"
                  >
                    {projects.map((proj) => (
                      <option key={proj.id} value={proj.id}>
                        {proj.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* User Identity badge */}
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-sm font-bold text-slate-800">{user.name}</span>
                </div>
                <button
                  onClick={() => api.exportData()}
                  className="group relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 focus:outline-none"
                >
                  <Download className="h-4.5 w-4.5" />
                  <span className="absolute top-12 left-1/2 -translate-x-1/2 scale-0 rounded bg-slate-800 p-2 text-xs text-white opacity-0 transition-all group-hover:scale-100 group-hover:opacity-100 whitespace-nowrap">
                    Export JSON
                  </span>
                </button>
                <button
                  onClick={handleLogout}
                  className="group relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 focus:outline-none"
                >
                  <LogOut className="h-4.5 w-4.5" />
                  <span className="absolute top-12 left-1/2 -translate-x-1/2 scale-0 rounded bg-slate-800 p-2 text-xs text-white opacity-0 transition-all group-hover:scale-100 group-hover:opacity-100 whitespace-nowrap">
                    Logout
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 mx-auto w-full max-w-[1800px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="bg-white/40 rounded-3xl p-1 shadow-sm border border-slate-100">
          <div className="bg-white rounded-[1.25rem] p-6 sm:p-8 shadow-sm">
            {children}
          </div>
        </div>
      </main>


    </div>
  );
};
