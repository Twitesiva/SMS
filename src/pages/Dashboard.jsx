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
    normalized.includes("printed")
  ) {
    return "Issued";
  }
  if (normalized.includes("escalated") || normalized.includes("flag") || normalized.includes("hold")) {
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
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([
      supabase
        .from("exam_master")
        .select("id, exam_name, results_published")
        .order("created_at", { ascending: false }),
      supabase
        .from("exam_registrations")
        .select("id, status, exam_id, created_at"),
      supabase.from("exam_registration_subjects").select("id, exam_registration_id"),
      supabase.from("marks").select("id"),
      supabase
        .from("exam_deadlines")
        .select("id, exam_id, last_date")
        .order("last_date", { ascending: true }),
      supabase.from("students").select("id"),
      supabase.from("courses").select("id"),
      supabase.from("groups").select("group_id"),
    ])
      .then(
        ([
          examsResult,
          registrationsResult,
          subjectsResult,
          marksResult,
          deadlinesResult,
          studentsResult,
          coursesResult,
          groupsResult,
        ]) => {
        if (!active) return;
        const errors = [
          examsResult.error,
          registrationsResult.error,
          subjectsResult.error,
          marksResult.error,
        ].filter(Boolean);
        if (errors.length) {
          setError(errors.map((err) => err.message).join(" · "));
        }
        setExams(examsResult.data || []);
        setRegistrations(registrationsResult.data || []);
        setRegSubjects(subjectsResult.data || []);
          setMarks(marksResult.data || []);
          setDeadlines(deadlinesResult.data || []);
          setStudents(studentsResult.data || []);
          setCourses(coursesResult.data || []);
          setGroups(groupsResult.data || []);
      })
      .catch((err) => {
        if (active) {
          setError(err.message || "Unable to load dashboard data");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const activeExams = exams.length;
  const hallTicketCounts = useMemo(() => {
    return registrations.reduce(
      (acc, reg) => {
        const status = categorizeHallTicketStatus(reg.status);
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      },
      { Issued: 0, Pending: 0, Escalated: 0 }
    );
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
      const createdAt = registration.created_at ? new Date(registration.created_at) : null;
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
            hallTicketCounts.Issued,
            hallTicketCounts.Pending,
            hallTicketCounts.Escalated,
          ],
          backgroundColor: ["#4c75f2", "#ffb347", "#d32f2f"],
          hoverOffset: 6,
        },
      ],
    }),
    [hallTicketCounts]
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

  const resultsAwaitingReview = Math.max(regSubjects.length - marks.length, 0);

  const detailItems = {
    activeExams: exams[0]?.exam_name ? `Latest: ${exams[0].exam_name}` : "Create an exam session",
    pendingHallTickets: `Issued ${hallTicketCounts.Issued} · Escalated ${hallTicketCounts.Escalated}`,
    resultsAwaitingReview: `${Math.max(resultsAwaitingReview, 0)} pending mark entries`,
  };

  const metrics = [
    {
      label: "Active Exams",
      value: activeExams,
      detail: detailItems.activeExams,
      icon: "bi-calendar-event",
    },
    {
      label: "Pending Hall Tickets",
      value: hallTicketCounts.Pending,
      detail: detailItems.pendingHallTickets,
      icon: "bi-ticket-perforated",
    },
    {
      label: "Results Awaiting Review",
      value: resultsAwaitingReview,
      detail: detailItems.resultsAwaitingReview,
      icon: "bi-pencil-square",
    },
  ];

  const examRegistrationSummary = useMemo(() => {
    const counts = {};
    registrations.forEach((registration) => {
      counts[registration.exam_id] = (counts[registration.exam_id] || 0) + 1;
    });
    return exams
      .map((exam) => ({
        exam_id: exam.id,
        exam_name: exam.exam_name,
        registrations: counts[exam.id] || 0,
      }))
      .sort((a, b) => b.registrations - a.registrations)
      .slice(0, 3);
  }, [exams, registrations]);

  const nextDeadline = useMemo(() => {
    if (!deadlines.length) return null;
    const upcoming = deadlines
      .map((deadline) => ({
        ...deadline,
        last_date: deadline.last_date ? new Date(deadline.last_date) : null,
      }))
      .filter((deadline) => deadline.last_date)
      .sort((a, b) => a.last_date - b.last_date);
    return upcoming[0] || null;
  }, [deadlines]);

  const academicCounts = useMemo(
    () => ({
      students: students.length,
      courses: courses.length,
      batches: groups.length,
    }),
    [students.length, courses.length, groups.length]
  );

  const issuedPercent = useMemo(() => {
    const total = registrations.length;
    if (!total) return 0;
    return Math.round((hallTicketCounts.Issued / total) * 100);
  }, [hallTicketCounts.Issued, registrations.length]);

  const marksPercent = useMemo(() => {
    if (!regSubjects.length) return 0;
    return Math.round((marks.length / regSubjects.length) * 100);
  }, [marks.length, regSubjects.length]);

  return (
    <AdminShell>
      <div className="dashboard-page">
        <div className="dashboard-cards">
          {metrics.map((metric) => (
            <article key={metric.label} className="dashboard-card card-shadow">
              <div className="dashboard-card-icon">
                <i className={`bi ${metric.icon}`}></i>
              </div>
              <div>
                <div className="dashboard-card-value">{metric.value}</div>
                <div className="dashboard-card-label">{metric.label}</div>
                <p className="text-muted mb-0">{metric.detail}</p>
              </div>
            </article>
          ))}
        </div>

        {error && (
          <div className="alert alert-danger mt-3" role="alert">
            {error}
          </div>
        )}
        {loading && (
          <div className="text-center mt-3 text-muted">
            Loading live metrics…
          </div>
        )}
        <section className="dashboard-layout mt-4">
          <div className="dashboard-chart-row">
            <article className="dashboard-chart-card card-shadow">
              <div className="dashboard-chart-header">
                <h3>Registration Trend</h3>
                <p className="text-muted mb-0">New registrations per month</p>
              </div>
              <div className="dashboard-chart-wrapper">
                <Line data={readinessTrendData} options={lineOptions} />
              </div>
            </article>

            <article className="dashboard-chart-card card-shadow">
              <div className="dashboard-chart-header">
                <h3>Hall Ticket Status</h3>
                <p className="text-muted mb-0">Issued vs pending vs escalated</p>
              </div>
              <div className="dashboard-chart-wrapper smaller">
                <Doughnut data={hallTicketChartData} options={donutOptions} />
              </div>
              <div className="dashboard-chart-legend">
                <span>{hallTicketCounts.Issued} issued</span>
                <span>{hallTicketCounts.Pending} pending</span>
                <span>{hallTicketCounts.Escalated} escalated</span>
              </div>
            </article>
          </div>

          <div className="dashboard-chart-row">
            <article className="dashboard-chart-card card-shadow">
              <div className="dashboard-chart-header">
                <h3>Result Pipeline</h3>
                <p className="text-muted mb-0">Draft vs recorded vs published</p>
              </div>
              <div className="dashboard-chart-wrapper">
                <Bar data={resultBreakdownData} options={barOptions} />
              </div>
            </article>
          </div>
        </section>

        <section className="dashboard-detail-row">
          <article className="dashboard-detail-card card-shadow">
            <h4 className="mb-3">Upcoming Deadlines</h4>
            {nextDeadline ? (
              <div>
                <p className="mb-1 fw-semibold">{nextDeadline.exam_id ? `Exam ${nextDeadline.exam_id}` : "Untitled exam"}</p>
                <p className="text-muted mb-1">
                  {nextDeadline.last_date?.toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                  {" at "}
                  {nextDeadline.last_date?.toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                <p className="small text-muted">
                  Deadline applies to registered students — make sure hall tickets and entries are finalized before this date.
                </p>
              </div>
            ) : (
              <p className="text-muted small">No deadlines have been configured yet.</p>
            )}
          </article>

          <article className="dashboard-detail-card card-shadow">
            <h4 className="mb-3">Top Exam Registrations</h4>
            <ul className="list-unstyled m-0">
              {examRegistrationSummary.length ? (
                examRegistrationSummary.map((entry) => (
                  <li key={entry.exam_id} className="d-flex justify-content-between align-items-center mb-2">
                    <span>{entry.exam_name || `Exam ${entry.exam_id}`}</span>
                    <strong>{entry.registrations}</strong>
                  </li>
                ))
              ) : (
                <p className="text-muted small mb-0">No registration data available.</p>
              )}
            </ul>
          </article>

          <article className="dashboard-detail-card card-shadow">
            <h4 className="mb-3">Academic Inventory</h4>
            <div className="d-flex justify-content-between align-items-center">
              <span>Total Students</span>
              <strong>{academicCounts.students}</strong>
            </div>
            <div className="d-flex justify-content-between align-items-center">
              <span>Total Courses</span>
              <strong>{academicCounts.courses}</strong>
            </div>
            <div className="d-flex justify-content-between align-items-center">
              <span>Total Batches</span>
              <strong>{academicCounts.batches}</strong>
            </div>
          </article>
        </section>
      </div>
    </AdminShell>
  );
}
