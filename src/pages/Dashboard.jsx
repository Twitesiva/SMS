import { useEffect, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line, Doughnut, Bar } from "react-chartjs-2";
import AdminShell from "../components/AdminShell";
import { supabase } from "../../supabaseClient";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const lineOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: "index",
    intersect: false,
  },
  plugins: {
    legend: {
      position: "bottom",
      labels: {
        boxWidth: 12,
        padding: 12,
      },
    },
    tooltip: {
      bodySpacing: 6,
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: {
        stepSize: 2,
      },
      grid: {
        color: "rgba(15, 23, 42, 0.12)",
      },
    },
    x: {
      grid: {
        display: false,
      },
    },
  },
};

const donutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: "bottom",
    },
  },
};

const barOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      callbacks: {
        label: (context) => `${context.dataset.label}: ${context.parsed.y}`,
      },
    },
  },
  scales: {
    x: {
      grid: {
        display: false,
      },
    },
    y: {
      beginAtZero: true,
      grid: {
        color: "rgba(15, 23, 42, 0.12)",
      },
    },
  },
};

const categorizeHallTicketStatus = (status) => {
  if (!status) return "Pending";
  const normalized = status.toString().toLowerCase();
  if (
    normalized.includes("issued") ||
    normalized.includes("generated") ||
    normalized.includes("printed") ||
    normalized.includes("hall ticket")
  ) {
    return "Issued";
  }
  if (
    normalized.includes("escalated") ||
    normalized.includes("flag") ||
    normalized.includes("hold")
  ) {
    return "Escalated";
  }
  return "Pending";
};

export default function Dashboard() {
  const [exams, setExams] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [regSubjects, setRegSubjects] = useState([]);
  const [marks, setMarks] = useState([]);
  const [deadlines, setDeadlines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const loadDashboardData = async () => {
      setLoading(true);
      setError("");
      try {
        const [
          examsResult,
          registrationsResult,
          subjectResult,
          marksResult,
          deadlinesResult,
        ] = await Promise.all([
          supabase
            .from("exam_master")
            .select("id, exam_name, results_published, created_at")
            .order("created_at", { ascending: false }),
          supabase
            .from("exam_registrations")
            .select("id, exam_id, status, created_at"),
          supabase
            .from("exam_registration_subjects")
            .select("id, exam_registration_id"),
          supabase.from("marks").select("id"),
          supabase
            .from("exam_deadlines")
            .select("id, exam_id, last_date, exam:exam_master(exam_name)")
            .order("last_date", { ascending: true })
            .limit(5),
        ]);

        if (!active) return;

        const responses = [
          examsResult,
          registrationsResult,
          subjectResult,
          marksResult,
          deadlinesResult,
        ];
        const errors = responses
          .map((result) => result.error?.message)
          .filter(Boolean);

        setExams(examsResult.data || []);
        setRegistrations(registrationsResult.data || []);
        setRegSubjects(subjectResult.data || []);
        setMarks(marksResult.data || []);
        setDeadlines(deadlinesResult.data || []);
        if (errors.length) {
          setError(errors.join("; "));
        }
      } catch (err) {
        console.error("Unable to load dashboard data:", err);
        if (active) {
          setError("Unable to reach the database");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadDashboardData();
    return () => {
      active = false;
    };
  }, []);

  const hallTicketStatusCounts = useMemo(() => {
    const counts = { Issued: 0, Pending: 0, Escalated: 0 };
    registrations.forEach((registration) => {
      const statusKey = categorizeHallTicketStatus(registration.status);
      counts[statusKey] = (counts[statusKey] || 0) + 1;
    });
    return counts;
  }, [registrations]);

  const readinessTrendData = useMemo(() => {
    const now = new Date();
    const buckets = [];
    for (let offset = 3; offset >= 0; offset -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      buckets.push({
        label: date.toLocaleString("en-US", { month: "short" }),
        month: date.getMonth(),
        year: date.getFullYear(),
        total: 0,
        issued: 0,
      });
    }

    registrations.forEach((registration) => {
      const createdAt = registration.created_at
        ? new Date(registration.created_at)
        : null;
      if (!createdAt || Number.isNaN(createdAt.getTime())) return;
      const bucket = buckets.find(
        (entry) => entry.month === createdAt.getMonth() && entry.year === createdAt.getFullYear()
      );
      if (!bucket) return;
      bucket.total += 1;
      if (categorizeHallTicketStatus(registration.status) === "Issued") {
        bucket.issued += 1;
      }
    });

    return {
      labels: buckets.map((entry) => entry.label),
      datasets: [
        {
          label: "Registrations",
          data: buckets.map((entry) => entry.total),
          borderColor: "rgba(76, 117, 242, 0.95)",
          backgroundColor: "rgba(76, 117, 242, 0.25)",
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointBackgroundColor: "#fff",
        },
        {
          label: "Hall tickets issued",
          data: buckets.map((entry) => entry.issued),
          borderColor: "rgba(39, 174, 96, 0.8)",
          backgroundColor: "rgba(39, 174, 96, 0.18)",
          fill: true,
          tension: 0.35,
          pointRadius: 3,
          pointBackgroundColor: "#fff",
        },
      ],
    };
  }, [registrations]);

  const hallTicketChartData = useMemo(
    () => ({
      labels: ["Issued", "Pending", "Escalated"],
      datasets: [
        {
          data: [
            hallTicketStatusCounts.Issued,
            hallTicketStatusCounts.Pending,
            hallTicketStatusCounts.Escalated,
          ],
          backgroundColor: ["#4c75f2", "#ffb347", "#d32f2f"],
          hoverOffset: 6,
        },
      ],
    }),
    [hallTicketStatusCounts]
  );

  const resultBreakdownData = useMemo(() => {
    const totalSubjects = regSubjects.length;
    const marksRecorded = marks.length;
    const publishedExams = exams.filter((exam) => exam.results_published).length;
    const awaitingPublication = Math.max(exams.length - publishedExams, 0);
    const draftRegistrations = Math.max(totalSubjects - marksRecorded, 0);

    const breakdown = [
      { label: "Draft registrations", value: draftRegistrations },
      { label: "Marks recorded", value: marksRecorded },
      { label: "Published exams", value: publishedExams },
      { label: "Awaiting publication", value: awaitingPublication },
    ];

    return {
      labels: breakdown.map((item) => item.label),
      datasets: [
        {
          label: "Result pipeline",
          data: breakdown.map((item) => item.value),
          backgroundColor: [
            "rgba(76, 117, 242, 0.85)",
            "rgba(79, 167, 250, 0.8)",
            "rgba(147, 197, 253, 0.9)",
            "rgba(15, 55, 99, 0.9)",
          ],
          borderRadius: 10,
          barThickness: 20,
        },
      ],
    };
  }, [regSubjects.length, marks.length, exams]);

  const latestExamName = exams[0]?.exam_name;

  const issuedPercent = useMemo(() => {
    const total = registrations.length;
    if (!total) return 0;
    return Math.round((hallTicketStatusCounts.Issued / total) * 100);
  }, [hallTicketStatusCounts.Issued, registrations.length]);

  const marksPercent = useMemo(() => {
    if (!regSubjects.length) return 0;
    return Math.round((marks.length / regSubjects.length) * 100);
  }, [marks.length, regSubjects.length]);

  const heroStats = useMemo(
    () => [
      {
        label: "Active Exams",
        value: exams.length,
        meta: latestExamName ? `Latest: ${latestExamName}` : "Create an exam session",
      },
      {
        label: "Hall Tickets Issued",
        value: hallTicketStatusCounts.Issued,
        meta: `${issuedPercent}% of registrations`,
      },
      {
        label: "Registrations",
        value: registrations.length,
        meta: "Captured across all sessions",
      },
      {
        label: "Result Entries",
        value: marks.length,
        meta: `${marksPercent}% coverage`,
      },
    ],
    [
      exams.length,
      hallTicketStatusCounts.Issued,
      issuedPercent,
      latestExamName,
      marks.length,
      marksPercent,
      registrations.length,
    ]
  );

  const insightTiles = useMemo(() => {
    const totalRegistrations = registrations.length;
    return [
      {
        title: "Hall Ticket Sync",
        value: `${issuedPercent}%`,
        detail: `${hallTicketStatusCounts.Issued}/${totalRegistrations || 0} registrations issued`,
        badge: issuedPercent >= 75 ? "On track" : "Follow up",
      },
      {
        title: "Subject Coverage",
        value: regSubjects.length,
        detail: "Registration-subject entries stored",
        badge: "Synced",
      },
      {
        title: "Result Entries",
        value: marks.length,
        detail: `${marksPercent}% of subject registrations have marks`,
        badge: marksPercent >= 60 ? "Review" : "Draft",
      },
    ];
  }, [
    hallTicketStatusCounts.Issued,
    issuedPercent,
    marks.length,
    marksPercent,
    regSubjects.length,
    registrations.length,
  ]);

  const upcomingActions = useMemo(() => {
    if (!deadlines.length) {
      return [
        {
          title: "Configure exam deadlines",
          time: "No deadlines set",
          detail:
            "Visit Departments → Exam Deadlines to log the registration cutoff.",
        },
      ];
    }

    return deadlines.slice(0, 3).map((deadline) => {
      const examName = deadline.exam?.exam_name || `Exam ${deadline.exam_id || "—"}`;
      const dueDate = deadline.last_date ? new Date(deadline.last_date) : null;
      return {
        title: examName,
        time: dueDate
          ? dueDate.toLocaleDateString(undefined, { day: "numeric", month: "short" })
          : "Date TBA",
        detail: "Registration cutoff",
      };
    });
  }, [deadlines]);

  return (
    <AdminShell>
      <div className="students-page-shell">
        <div className="students-hero mb-4">
          <div className="px-3 pt-3">
            <p className="students-hero-eyebrow text-uppercase mb-1">Dashboard</p>
            <h2 className="students-hero-title">Exam Control Center</h2>
            <p className="students-hero-copy mb-0">
              Track exam workflows, hall ticket progress, and result readiness in one polished area.
            </p>
          </div>
          <div className="students-stats-grid row g-3 px-3 pb-3">
            {heroStats.map((stat) => (
              <div className="col-6 col-md-3" key={stat.label}>
                <div className="students-hero-card h-100 p-3">
                  <div className="students-hero-stat-label small mb-1 text-white">
                    {stat.label}
                  </div>
                  <div className="fs-3 fw-bold students-hero-stat-value text-white">
                    {stat.value}
                  </div>
                  <div className="students-hero-stat-meta small text-white">
                    {stat.meta}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="row g-4 mb-3">
          <div className="col-12 col-xl-8">
            <div className="students-table-panel card card-soft p-4">
              <div className="students-table-panel-header mb-3">
                <div>
                  <p className="students-table-panel-title mb-1">
                    Exam Readiness Trend
                  </p>
                  <p className="students-table-panel-copy small mb-0">
                    Weekly registrations vs. hall tickets issued
                  </p>
                </div>
              </div>
              <div className="dashboard-chart-wrapper">
                <Line data={readinessTrendData} options={lineOptions} />
              </div>
            </div>
          </div>
          <div className="col-12 col-xl-4">
            <div className="students-supplementary-grid card card-soft d-flex flex-column p-3">
              <div>
                <h5 className="fw-bold mb-2">Hall Ticket Distribution</h5>
                <p className="text-muted small mb-3">
                  Status of issued, pending, and escalated tickets
                </p>
              </div>
              <div className="dashboard-chart-wrapper smaller flex-grow-1">
                <Doughnut data={hallTicketChartData} options={donutOptions} />
              </div>
              <div className="dashboard-chart-legend mt-3">
                <span>{hallTicketStatusCounts.Issued} issued</span>
                <span>{hallTicketStatusCounts.Pending} pending</span>
                <span>{hallTicketStatusCounts.Escalated} escalated</span>
              </div>
            </div>
          </div>
        </div>

        <div className="row g-4">
          <div className="col-12 col-xl-7">
            <div className="students-table-panel card card-soft p-4">
              <div className="students-table-panel-header mb-3">
                <div>
                  <p className="students-table-panel-title mb-1">
                    Result Status Breakdown
                  </p>
                  <p className="students-table-panel-copy small mb-0">
                    Draft, recorded, and published result stages
                  </p>
                </div>
              </div>
              <div className="dashboard-chart-wrapper">
                <Bar data={resultBreakdownData} options={barOptions} />
              </div>
            </div>
          </div>
          <div className="col-12 col-xl-5">
            <div className="students-table-panel card card-soft p-4">
              <h5 className="fw-bold mb-3">Actionable Insights</h5>
              <div className="insight-grid mb-3">
                {insightTiles.map((tile) => (
                  <div key={tile.title} className="insight-tile">
                    <div className="insight-tile-heading">
                      <span>{tile.title}</span>
                      <span className="insight-badge">{tile.badge}</span>
                    </div>
                    <div className="insight-value">{tile.value}</div>
                    <p className="text-muted mb-0">{tile.detail}</p>
                  </div>
                ))}
              </div>
              <div className="insight-actions">
                <h4 className="mb-2">Upcoming</h4>
                <div className="upcoming-stack">
                  {upcomingActions.map((item) => (
                    <div key={item.title + item.time} className="upcoming-item">
                      <div className="upcoming-item-title">{item.title}</div>
                      <div className="upcoming-item-time">{item.time}</div>
                      <p className="text-muted mb-0">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
