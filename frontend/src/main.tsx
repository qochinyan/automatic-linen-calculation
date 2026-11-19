import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, NavLink, Route, Routes } from "react-router-dom";
import { TaskDetailPage } from "./pages/TaskDetailPage";
import { TaskListPage } from "./pages/TaskListPage";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found");

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <div className="min-h-screen bg-slate-100 font-sans text-slate-900 antialiased">
        <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900 text-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-indigo-500 text-sm font-bold">LC</span>
              <div>
                <p className="text-sm font-semibold">Linen Calculator</p>
                <p className="text-xs text-slate-400">Housekeeping linen planner</p>
              </div>
            </div>
            <nav className="flex gap-1 text-sm">
              <NavLink
                to="/tasks"
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 font-medium transition ${
                    isActive ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
                  }`
                }
              >
                Tasks
              </NavLink>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">
          <Routes>
            <Route path="/" element={<Navigate to="/tasks" replace />} />
            <Route path="/tasks" element={<TaskListPage />} />
            <Route path="/tasks/:taskId" element={<TaskDetailPage />} />
            <Route path="*" element={<p className="text-sm text-slate-600">Page not found.</p>} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  </StrictMode>,
);
