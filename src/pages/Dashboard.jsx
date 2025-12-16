import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
      supabase.from("courses").select("course_id, course_code, course_name"),
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
      groups: groups.length,
    }),
    [students.length, courses.length, groups.length]
  );

  const courseEnrollments = useMemo(() => {
    if (!students.length) return [];
    const counts = students.reduce((acc, student) => {
      const label = student.course_name || student.course_code || "Other";
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts)
      .map(([course, count]) => ({ course, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [students]);

  const courseEnrollmentChartData = useMemo(() => {
    const colors = [
      "rgba(59, 130, 246, 0.85)",
      "rgba(16, 185, 129, 0.85)",
      "rgba(249, 115, 22, 0.85)",
      "rgba(234, 179, 8, 0.85)",
      "rgba(147, 51, 234, 0.85)",
      "rgba(236, 72, 153, 0.85)",
    ];
    const labels = courseEnrollments.map((course) => course.course);
    const data = courseEnrollments.map((course) => course.count);
    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor: labels.map((_, index) => colors[index % colors.length]),
          hoverOffset: 8,
        },
      ],
    };
  }, [courseEnrollments]);
  const metrics = [
    {
      label: "Total Students",
      value: academicCounts.students,
      detail: "All enrolled learners",
      icon: "bi-people-fill",
      path: "/admin/students",
    },
    {
      label: "Groups",
      value: academicCounts.groups,
      detail: "Academic groups",
      icon: "bi-building",
      path: "/admin/setup/groups",
    },
    {
      label: "Total Courses",
      value: academicCounts.courses,
      detail: "Active academic programs",
      icon: "bi-book-half",
      path: "/admin/courses",
    },
  ];

  return (
    <AdminShell>
      <div className="dashboard-page">
        <div className="dashboard-cards">
          {metrics.map((metric) => (
            <Link
              key={metric.label}
              to={metric.path}
              className="dashboard-card card-shadow dashboard-card-link"
            >
              <div className="dashboard-card-icon">
                <i className={`bi ${metric.icon}`}></i>
              </div>
              <div>
                <div className="dashboard-card-value">{metric.value}</div>
                <div className="dashboard-card-label">{metric.label}</div>
                <p className="text-muted mb-0">{metric.detail}</p>
              </div>
            </Link>
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
                <h3>Active Roster</h3>
                <p className="text-muted mb-0">How many students choose each course</p>
              </div>
              <div className="dashboard-chart-wrapper smaller">
                <Doughnut data={courseEnrollmentChartData} options={donutOptions} />
              </div>
              <div className="dashboard-course-summary">
                {courseEnrollments.length ? (
                  <ul className="dashboard-course-list">
                    {courseEnrollments.map((course) => (
                      <li key={course.course} className="dashboard-course-item">
                        <span className="course-name">{course.course}</span>
                        <span className="course-count">{course.count} students</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted small mb-0">No enrollment data yet.</p>
                )}
              </div>
              <div className="dashboard-chart-legend">
                <span>{students.length} students</span>
                <span>{courses.length} courses</span>
                <span>{courseEnrollments.length} insights</span>
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

        </section>
      </div>
    </AdminShell>
  );
}
