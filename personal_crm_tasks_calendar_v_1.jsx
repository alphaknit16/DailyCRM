import React, { useEffect, useMemo, useState } from "react";
import { Plus, Calendar as CalendarIcon, X, Edit3, Trash2, Search, Filter, CheckCircle, ListFilter, LayoutGrid, Table as TableIcon, ChevronLeft, ChevronRight, Clock } from "lucide-react";

// -----------------------------
// Helpers & Types
// -----------------------------
const CATEGORIES = ["Dealership", "Family", "Business", "Spiritual", "Personal"] as const;
const STATUSES = ["Active", "Pending", "Completed"] as const;

type Category = typeof CATEGORIES[number];
type Status = typeof STATUSES[number];

type NextStep = {
  id: string;
  text: string;
  dueDate?: string; // ISO date (YYYY-MM-DD)
  done?: boolean;
};

type Task = {
  id: string;
  title: string;
  description?: string;
  category: Category;
  status: Status;
  dueDate?: string; // ISO date
  createdAt: string; // ISO
  nextSteps: NextStep[];
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function isOverdue(dateISO?: string) {
  if (!dateISO) return false;
  const today = new Date();
  const d = new Date(dateISO + "T23:59:59");
  return d.getTime() < today.getTime();
}

function isDueWithinDays(dateISO?: string, days = 3) {
  if (!dateISO) return false;
  const today = new Date();
  const future = new Date();
  future.setDate(today.getDate() + days);
  const d = new Date(dateISO);
  return d >= new Date(today.toDateString()) && d <= future;
}

function formatDateShort(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function classNames(...args: Array<string | false | null | undefined>) {
  return args.filter(Boolean).join(" ");
}

// Month utilities (no external deps)
function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
function addDays(date: Date, n: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
function startOfWeek(date: Date, weekStartsOn = 0) {
  const d = new Date(date);
  const diff = (d.getDay() + 7 - weekStartsOn) % 7;
  return addDays(d, -diff);
}
function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}
function isSameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

// -----------------------------
// Seed Data (can be removed)
// -----------------------------
const seedTasks: Task[] = [
  {
    id: uid(),
    title: "Follow up with BMW lead pipeline",
    description: "Prepare proposals and call top 5 prospects",
    category: "Dealership",
    status: "Active",
    dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    createdAt: new Date().toISOString(),
    nextSteps: [
      { id: uid(), text: "Call Grace re: X3 allocation", dueDate: new Date().toISOString().slice(0, 10) },
    ],
  },
  {
    id: uid(),
    title: "Date night plan",
    description: "Book dinner for Friday",
    category: "Family",
    status: "Pending",
    dueDate: new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10),
    createdAt: new Date().toISOString(),
    nextSteps: [
      { id: uid(), text: "Check babysitter availability", dueDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10) },
    ],
  },
  {
    id: uid(),
    title: "MG Capital deck tweaks",
    description: "Refine use-of-funds and roadmap",
    category: "Business",
    status: "Active",
    dueDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
    createdAt: new Date().toISOString(),
    nextSteps: [
      { id: uid(), text: "Add NDA step into next steps", dueDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10) },
    ],
  },
  {
    id: uid(),
    title: "Morning prayer & study",
    description: "Matthew 6 + journaling",
    category: "Spiritual",
    status: "Active",
    createdAt: new Date().toISOString(),
    nextSteps: [ { id: uid(), text: "Set 5:15am alarm" } ],
  },
  {
    id: uid(),
    title: "Gym – upper body",
    description: "50-minute workout (YMCA)",
    category: "Personal",
    status: "Pending",
    dueDate: new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10),
    createdAt: new Date().toISOString(),
    nextSteps: [ { id: uid(), text: "Pack gym bag tonight", dueDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10) } ],
  },
];

// -----------------------------
// Main Component
// -----------------------------
export default function PersonalCRM() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [query, setQuery] = useState("");
  const [activeCategories, setActiveCategories] = useState<Category[]>([...CATEGORIES]);
  const [statusFilter, setStatusFilter] = useState<Status | "All">("All");
  const [sortKey, setSortKey] = useState<"dueDate" | "createdAt" | "category">("dueDate");
  const [view, setView] = useState<"grid" | "table" | "calendar">("grid");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [calendarCursor, setCalendarCursor] = useState<Date>(new Date());
  const [calendarMode, setCalendarMode] = useState<"month" | "week" | "day">("month");

  // Load & persist
  useEffect(() => {
    const raw = localStorage.getItem("personal_crm_tasks_v1");
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Task[];
        setTasks(parsed);
        return;
      } catch {}
    }
    setTasks(seedTasks);
  }, []);

  useEffect(() => {
    localStorage.setItem("personal_crm_tasks_v1", JSON.stringify(tasks));
  }, [tasks]);

  // Derived
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = tasks.filter((t) => activeCategories.includes(t.category));
    if (statusFilter !== "All") list = list.filter((t) => t.status === statusFilter);
    if (q)
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description || "").toLowerCase().includes(q) ||
          t.nextSteps.some((n) => n.text.toLowerCase().includes(q))
      );

    const sorter: Record<typeof sortKey, (a: Task, b: Task) => number> = {
      dueDate: (a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999"),
      createdAt: (a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""),
      category: (a, b) => a.category.localeCompare(b.category),
    } as const;

    return [...list].sort(sorter[sortKey]);
  }, [tasks, activeCategories, statusFilter, query, sortKey]);

  const byCategory = useMemo(() => {
    const map: Record<Category, Task[]> = {
      Dealership: [], Family: [], Business: [], Spiritual: [], Personal: [],
    };
    filtered.forEach((t) => map[t.category].push(t));
    return map;
  }, [filtered]);

  const metrics = useMemo(() => {
    const total = tasks.length;
    const overdue = tasks.filter((t) => isOverdue(t.dueDate)).length;
    const dueSoon = tasks.filter((t) => isDueWithinDays(t.dueDate, 3)).length;
    const active = tasks.filter((t) => t.status !== "Completed").length;
    const counts = CATEGORIES.reduce(
      (acc, c) => ({ ...acc, [c]: tasks.filter((t) => t.category === c).length }),
      {} as Record<Category, number>
    );
    return { total, overdue, dueSoon, active, counts };
  }, [tasks]);

  function resetForm() {
    setEditing(null);
    setShowModal(false);
  }

  function upsertTask(task: Task) {
    setTasks((prev) => {
      const exists = prev.some((p) => p.id === task.id);
      return exists ? prev.map((p) => (p.id === task.id ? task : p)) : [task, ...prev];
    });
    resetForm();
  }

  function removeTask(id: string) {
    setTasks((prev) => prev.filter((p) => p.id !== id));
  }

  function toggleCategory(cat: Category) {
    setActiveCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  function nearestNextStep(task: Task) {
    if (!task.nextSteps?.length) return undefined;
    const withDates = task.nextSteps.filter((n) => !!n.dueDate);
    if (!withDates.length) return task.nextSteps[0];
    return withDates.sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""))[0];
  }

  // Calendar: tasks mapped by day
  const calendarMatrix = useMemo(() => {
    const first = startOfMonth(calendarCursor);
    const gridStart = startOfWeek(first, 0); // Sun
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) days.push(addDays(gridStart, i));
    return days;
  }, [calendarCursor]);

  function tasksOn(date: Date) {
    const iso = date.toISOString().slice(0, 10);
    return tasks.filter((t) => t.dueDate === iso || t.nextSteps.some((n) => n.dueDate === iso));
  }

  // -----------------------------
  // Render
  // -----------------------------
  return (
    <div className="min-h-screen w-full bg-neutral-50 text-neutral-900 p-4 md:p-6">
      {/* Header */}
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Personal CRM</h1>
            <p className="text-sm text-neutral-500">Tasks, next steps with dates, and a calendar view</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm hover:shadow"
              onClick={() => setView("grid")}
              title="Grid View"
            >
              <LayoutGrid className="h-4 w-4" /> <span className="hidden sm:inline">Grid</span>
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm hover:shadow"
              onClick={() => setView("table")}
              title="Table View"
            >
              <TableIcon className="h-4 w-4" /> <span className="hidden sm:inline">Table</span>
            </button>
            <button
              className={classNames(
                "inline-flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-sm shadow-sm hover:shadow",
                view === "calendar" ? "border-blue-500" : "border-neutral-200"
              )}
              onClick={() => setView("calendar")}
              title="Calendar View"
            >
              <CalendarIcon className="h-4 w-4" /> <span className="hidden sm:inline">Calendar</span>
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 text-white px-3 py-2 text-sm shadow-sm hover:bg-blue-700"
              onClick={() => {
                setEditing({
                  id: uid(),
                  title: "",
                  description: "",
                  category: "Dealership",
                  status: "Active",
                  dueDate: "",
                  createdAt: new Date().toISOString(),
                  nextSteps: [],
                });
                setShowModal(true);
              }}
            >
              <Plus className="h-4 w-4" /> Add Task
            </button>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
          <MetricBox label="Total Tasks" value={metrics.total} sub="All categories" />
          <MetricBox label="Active" value={metrics.active} sub="Not completed" />
          <MetricBox label="Due ≤ 3 Days" value={metrics.dueSoon} sub="Upcoming" />
          <MetricBox label="Overdue" value={metrics.overdue} sub="Past due" tone="danger" />
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 mb-6">
          <div className="flex items-center gap-2 flex-wrap">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => toggleCategory(c)}
                className={classNames(
                  "rounded-full px-3 py-1.5 text-xs font-medium border",
                  activeCategories.includes(c)
                    ? "bg-neutral-900 text-white border-neutral-900"
                    : "bg-white text-neutral-700 border-neutral-200"
                )}
              >
                {c} ({metrics.counts[c] || 0})
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-1">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <input
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-neutral-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300"
                placeholder="Search title, description, or next steps…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                className="px-3 py-2 text-sm rounded-xl border border-neutral-200 bg-white"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
              >
                <option value="All">All Statuses</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select
                className="px-3 py-2 text-sm rounded-xl border border-neutral-200 bg-white"
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as any)}
              >
                <option value="dueDate">Sort: Due Date</option>
                <option value="createdAt">Sort: Created</option>
                <option value="category">Sort: Category</option>
              </select>
            </div>
          </div>
        </div>

        {/* Views */}
        {view === "grid" && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            {CATEGORIES.map((cat) => (
              <div key={cat} className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{cat}</h3>
                  <span className="text-xs text-neutral-500">{byCategory[cat]?.length || 0} tasks</span>
                </div>
                <div className="p-3 space-y-3 min-h-[180px]">
                  {(byCategory[cat] || []).map((t) => (
                    <TaskCard key={t.id} task={t} onEdit={() => {setEditing(t); setShowModal(true);}} onRemove={() => removeTask(t.id)} onToggleComplete={() => {
                      const next: Task = { ...t, status: t.status === "Completed" ? "Active" : "Completed" };
                      upsertTask(next);
                    }} />
                  ))}
                  {!(byCategory[cat] || []).length && (
                    <p className="text-xs text-neutral-400">No tasks in this category.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {view === "table" && (
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-neutral-50 border-b border-neutral-200">
                  <tr className="text-left text-xs text-neutral-600">
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Due</th>
                    <th className="px-4 py-3">Next Step</th>
                    <th className="px-4 py-3">Next Step Due</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => {
                    const nn = nearestNextStep(t);
                    return (
                      <tr key={t.id} className="border-b last:border-0 hover:bg-neutral-50/70">
                        <td className="px-4 py-3 font-medium">{t.title}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs">
                            {t.category}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={classNames(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs",
                            t.status === "Completed"
                              ? "bg-green-100 text-green-700"
                              : t.status === "Pending"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-blue-100 text-blue-700"
                          )}>
                            <CheckCircle className="h-3.5 w-3.5" /> {t.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">{formatDateShort(t.dueDate)}</td>
                        <td className="px-4 py-3 truncate max-w-[240px]" title={nn?.text || "—"}>{nn?.text || "—"}</td>
                        <td className="px-4 py-3">{formatDateShort(nn?.dueDate)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button className="p-1 rounded hover:bg-neutral-100" onClick={() => {setEditing(t); setShowModal(true);}}><Edit3 className="h-4 w-4" /></button>
                            <button className="p-1 rounded hover:bg-neutral-100" onClick={() => removeTask(t.id)}><Trash2 className="h-4 w-4" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {view === "calendar" && (
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4">
            {/* Calendar header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <button className="p-2 rounded-xl border hover:bg-neutral-50" onClick={() => setCalendarCursor(new Date())}>Today</button>
                <div className="flex items-center gap-1">
                  <button className="p-2 rounded-xl border hover:bg-neutral-50" onClick={() => setCalendarCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}><ChevronLeft className="h-4 w-4" /></button>
                  <button className="p-2 rounded-xl border hover:bg-neutral-50" onClick={() => setCalendarCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}><ChevronRight className="h-4 w-4" /></button>
                </div>
                <div className="text-lg font-semibold ml-1">
                  {calendarCursor.toLocaleString(undefined, { month: "long", year: "numeric" })}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {(["month","week","day"] as const).map((m) => (
                  <button
                    key={m}
                    className={classNames(
                      "px-3 py-1.5 rounded-xl border text-sm",
                      calendarMode === m ? "border-neutral-900" : "border-neutral-200 bg-white"
                    )}
                    onClick={() => setCalendarMode(m)}
                  >
                    {m[0].toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Month Grid */}
            {calendarMode === "month" && (
              <div>
                <div className="grid grid-cols-7 text-xs text-neutral-500 mb-1">
                  {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
                    <div key={d} className="px-2 py-1">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-px bg-neutral-200 rounded-lg overflow-hidden">
                  {calendarMatrix.map((day, idx) => {
                    const dayTasks = tasksOn(day);
                    const inMonth = isSameMonth(day, calendarCursor);
                    const today = isSameDay(day, new Date());
                    return (
                      <div key={idx} className="min-h-[110px] bg-white p-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className={classNames("text-xs", inMonth ? "text-neutral-800" : "text-neutral-300")}>{day.getDate()}</span>
                          {today && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-600 text-white">Today</span>}
                        </div>
                        <div className="space-y-1">
                          {dayTasks.slice(0,3).map((t) => (
                            <div key={t.id} className="text-[11px] truncate px-2 py-1 rounded-md border"
                              title={`${t.title} (${t.category})`}>
                              <span className="font-medium">{t.title}</span>
                              <span className="ml-1 text-neutral-500">· {t.category}</span>
                            </div>
                          ))}
                          {dayTasks.length > 3 && (
                            <div className="text-[11px] text-neutral-500">+{dayTasks.length - 3} more…</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Week & Day (simple lists) */}
            {calendarMode === "week" && (
              <div className="space-y-2">
                {[...Array(7)].map((_, i) => {
                  const start = startOfWeek(calendarCursor, 0);
                  const d = addDays(start, i);
                  const dayTasks = tasksOn(d);
                  return (
                    <div key={i} className="border rounded-xl p-3">
                      <div className="text-sm font-semibold mb-2">{d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</div>
                      {dayTasks.length ? (
                        <ul className="space-y-1">
                          {dayTasks.map((t) => (
                            <li key={t.id} className="text-sm flex items-center gap-2">
                              <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]">{t.category}</span>
                              <span className="font-medium">{t.title}</span>
                              <span className="text-neutral-500 text-xs">({t.status})</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-sm text-neutral-400">No tasks</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {calendarMode === "day" && (
              <div className="border rounded-xl p-4">
                <div className="text-sm font-semibold mb-3">{calendarCursor.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" })}</div>
                {(() => {
                  const dayTasks = tasksOn(calendarCursor);
                  return dayTasks.length ? (
                    <ul className="space-y-2">
                      {dayTasks.map((t) => (
                        <li key={t.id} className="flex items-center gap-2 text-sm">
                          <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]">{t.category}</span>
                          <span className="font-medium">{t.title}</span>
                          {t.dueDate && (
                            <span className="inline-flex items-center gap-1 text-xs text-neutral-500"><Clock className="h-3 w-3"/>due {formatDateShort(t.dueDate)}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-sm text-neutral-400">No tasks for this date.</div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* Modal */}
        {showModal && editing && (
          <Modal onClose={resetForm}>
            <TaskForm
              key={editing.id}
              initial={editing}
              onCancel={resetForm}
              onSave={(task) => upsertTask(task)}
            />
          </Modal>
        )}

        {/* Utilities */}
        <div className="mt-6 flex items-center gap-2">
          <button
            className="px-3 py-2 text-sm rounded-xl border bg-white hover:bg-neutral-50"
            onClick={() => {
              const blob = new Blob([JSON.stringify(tasks, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `personal-crm-tasks-${new Date().toISOString().slice(0,10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Export JSON
          </button>
          <label className="px-3 py-2 text-sm rounded-xl border bg-white hover:bg-neutral-50 cursor-pointer">
            Import JSON
            <input type="file" accept="application/json" className="hidden" onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                try {
                  const data = JSON.parse(String(reader.result));
                  if (Array.isArray(data)) setTasks(data);
                } catch {}
              };
              reader.readAsText(file);
              e.currentTarget.value = "";
            }} />
          </label>
        </div>
      </div>
    </div>
  );
}

// -----------------------------
// Subcomponents
// -----------------------------
function MetricBox({ label, value, sub, tone }: { label: string; value: number; sub?: string; tone?: "danger" | "normal" }) {
  return (
    <div className={classNames(
      "rounded-2xl border shadow-sm p-4",
      tone === "danger" ? "border-red-200 bg-red-50" : "border-neutral-200 bg-white"
    )}>
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-2xl font-semibold leading-tight">{value}</div>
      {sub && <div className="text-[11px] text-neutral-400">{sub}</div>}
    </div>
  );
}

function TaskCard({ task, onEdit, onRemove, onToggleComplete }: {
  task: Task;
  onEdit: () => void;
  onRemove: () => void;
  onToggleComplete: () => void;
}) {
  const nn = (task.nextSteps && task.nextSteps.length) ? task.nextSteps.reduce((acc: NextStep | null, cur) => {
    if (!acc) return cur;
    if (!acc.dueDate) return cur.dueDate ? cur : acc;
    if (!cur.dueDate) return acc;
    return acc.dueDate <= cur.dueDate ? acc : cur;
  }, null) : null;

  return (
    <div className="rounded-xl border border-neutral-200 p-3 hover:shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-sm leading-snug">{task.title}</div>
          <div className="text-xs text-neutral-500 mt-0.5">{task.description || ""}</div>
        </div>
        <div className="flex items-center gap-1">
          <button className="p-1 rounded hover:bg-neutral-100" onClick={onEdit} title="Edit"><Edit3 className="h-4 w-4"/></button>
          <button className="p-1 rounded hover:bg-neutral-100" onClick={onRemove} title="Delete"><Trash2 className="h-4 w-4"/></button>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]">{task.category}</span>
        <span className={classNames(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]",
          task.status === "Completed" ? "bg-green-100 text-green-700" : task.status === "Pending" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-700"
        )}>
          <CheckCircle className="h-3.5 w-3.5" /> {task.status}
        </span>
        {task.dueDate && (
          <span className={classNames(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] border",
            isOverdue(task.dueDate) ? "border-red-300 text-red-700 bg-red-50" : isDueWithinDays(task.dueDate) ? "border-amber-300 text-amber-800 bg-amber-50" : "border-neutral-200 text-neutral-700"
          )}>
            <CalendarIcon className="h-3.5 w-3.5"/> due {formatDateShort(task.dueDate)}
          </span>
        )}
      </div>
      {nn && (
        <div className="mt-2 text-[12px]">
          <div className="text-neutral-500">Next step</div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{nn.text}</span>
            {nn.dueDate && <span className="text-neutral-500">· {formatDateShort(nn.dueDate)}</span>}
          </div>
        </div>
      )}
      <div className="mt-3 flex items-center gap-2">
        <button className="text-xs px-2 py-1 rounded-lg border hover:bg-neutral-50" onClick={onToggleComplete}>
          {task.status === "Completed" ? "Mark Active" : "Mark Completed"}
        </button>
      </div>
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    function handler(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="font-semibold">Task</div>
          <button className="p-2 rounded-lg hover:bg-neutral-100" onClick={onClose}><X className="h-4 w-4"/></button>
        </div>
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  );
}

function TaskForm({ initial, onSave, onCancel }: { initial: Task; onSave: (task: Task) => void; onCancel: () => void }) {
  const [task, setTask] = useState<Task>({ ...initial });
  const [nsText, setNsText] = useState("");
  const [nsDate, setNsDate] = useState<string>("");

  function addNextStep() {
    if (!nsText.trim()) return;
    const ns: NextStep = { id: uid(), text: nsText.trim(), dueDate: nsDate || undefined };
    setTask((t) => ({ ...t, nextSteps: [...(t.nextSteps || []), ns] }));
    setNsText("");
    setNsDate("");
  }

  function removeNextStep(id: string) {
    setTask((t) => ({ ...t, nextSteps: t.nextSteps.filter((n) => n.id !== id) }));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const clean: Task = {
          ...task,
          title: task.title.trim(),
          description: (task.description || "").trim(),
          dueDate: task.dueDate || undefined,
        };
        onSave(clean);
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-neutral-500">Title</label>
          <input
            className="w-full px-3 py-2 rounded-xl border border-neutral-200"
            value={task.title}
            onChange={(e) => setTask({ ...task, title: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="text-xs text-neutral-500">Category</label>
          <select
            className="w-full px-3 py-2 rounded-xl border border-neutral-200 bg-white"
            value={task.category}
            onChange={(e) => setTask({ ...task, category: e.target.value as Category })}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-neutral-500">Status</label>
          <select
            className="w-full px-3 py-2 rounded-xl border border-neutral-200 bg-white"
            value={task.status}
            onChange={(e) => setTask({ ...task, status: e.target.value as Status })}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-neutral-500">Due Date</label>
          <input
            type="date"
            className="w-full px-3 py-2 rounded-xl border border-neutral-200"
            value={task.dueDate || ""}
            onChange={(e) => setTask({ ...task, dueDate: e.target.value })}
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-neutral-500">Description</label>
        <textarea
          className="w-full px-3 py-2 rounded-xl border border-neutral-200 min-h-[80px]"
          value={task.description}
          onChange={(e) => setTask({ ...task, description: e.target.value })}
          placeholder="Notes, details, links…"
        />
      </div>

      {/* Next Steps */}
      <div className="border rounded-2xl p-3">
        <div className="text-sm font-semibold mb-2">Next steps</div>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
          <input
            className="md:col-span-4 px-3 py-2 rounded-xl border border-neutral-200"
            placeholder="Add a next step (e.g., Call Julie)"
            value={nsText}
            onChange={(e) => setNsText(e.target.value)}
          />
          <input
            type="date"
            className="md:col-span-1 px-3 py-2 rounded-xl border border-neutral-200"
            value={nsDate}
            onChange={(e) => setNsDate(e.target.value)}
          />
          <button type="button" onClick={addNextStep} className="md:col-span-1 px-3 py-2 rounded-xl border bg-white hover:bg-neutral-50 text-sm">Add</button>
        </div>
        <ul className="mt-3 space-y-2">
          {task.nextSteps.map((n) => (
            <li key={n.id} className="flex items-center justify-between text-sm bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2">
              <div>
                <div className="font-medium">{n.text}</div>
                <div className="text-xs text-neutral-500">{n.dueDate ? `Due ${formatDateShort(n.dueDate)}` : "No date"}</div>
              </div>
              <button className="p-1 rounded hover:bg-neutral-100" onClick={() => removeNextStep(n.id)}><Trash2 className="h-4 w-4"/></button>
            </li>
          ))}
          {!task.nextSteps.length && (
            <li className="text-xs text-neutral-400">No next steps yet.</li>
          )}
        </ul>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-2 rounded-xl border bg-white hover:bg-neutral-50 text-sm">Cancel</button>
        <button type="submit" className="px-3 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-sm">Save Task</button>
      </div>
    </form>
  );
}
