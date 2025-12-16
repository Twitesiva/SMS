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
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Doughnut, Bar, PolarArea } from "react-chartjs-2";
import AdminShell from "../components/AdminShell";
import { supabase } from "../../supabaseClient";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend
);

const coverageChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: "bottom",
      labels: {
        boxWidth: 12,
      },
    },
    tooltip: {
      callbacks: {
        label: (context) => `${context.label}: ${context.parsed} students`,
      },
    },
  },
};

const resultChartOptions = {
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

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const formatCurrency = (value) => {
  const amount = Number(value || 0);
  if (Number.isNaN(amount)) return currencyFormatter.format(0);
  return currencyFormatter.format(amount);
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

const polarOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      callbacks: {
        label: (context) => `${context.label}: ${context.parsed?.r ?? context.parsed} students`,
      },
    },
  },
  scales: {
    r: {
      grid: {
        color: "rgba(15, 23, 42, 0.08)",
      },
      ticks: {
        beginAtZero: true,
      },
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

const hallTicketBarOptions = {
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
      ticks: {
        font: {
          weight: "600",
        },
      },
    },
    y: {
      beginAtZero: true,
      ticks: {
        stepSize: 1,
      },
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

const hallTicketStatusMeta = [
  { key: "Issued", note: "Hall tickets ready for printing" },
  { key: "Pending", note: "Awaiting hall ticket generation" },
];

export default function Dashboard() {
  const [exams, setExams] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [regSubjects, setRegSubjects] = useState([]);
  const [marks, setMarks] = useState([]);
  const [deadlines, setDeadlines] = useState([]);
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [groups, setGroups] = useState([]);
  const [payments, setPayments] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([
      supabase
        .from("exam_master")
        .select("id, exam_name, results_published, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("exam_registrations")
        .select("id, status, exam_id, created_at, student_id"),
      supabase.from("exam_registration_subjects").select("id, exam_registration_id"),
      supabase.from("marks").select("id"),
      supabase
        .from("exam_deadlines")
        .select("id, exam_id, last_date")
        .order("last_date", { ascending: true }),
      supabase
        .from("students")
        .select("id, course_name, group_name, hall_ticket_no"),
      supabase.from("courses").select("course_id, course_code, course_name"),
      supabase.from("groups").select("group_id, group_code, group_name"),
      supabase.from("results").select("student_id, result_status, exam_id"),
      supabase
        .from("payments")
        .select("id, exam_registration_id, amount_paid, payment_status"),
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
        resultsResult,
        paymentsResult,
      ]) => {
        if (!active) return;
        const errors = [
          examsResult.error,
          registrationsResult.error,
          subjectsResult.error,
          marksResult.error,
          resultsResult.error,
          paymentsResult.error,
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
        setResults(resultsResult.data || []);
        setPayments(paymentsResult.data || []);
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

  const registrationCoverage = useMemo(() => {
    const registered = registrations.length;
    const total = students.length;
    const unregistered = Math.max(total - registered, 0);
    const registeredPercent = total ? Math.round((registered / total) * 100) : 0;
    return {
      registered,
      unregistered,
      total,
      registeredPercent,
    };
  }, [registrations.length, students.length]);

  const registrationCoverageChartData = useMemo(() => {
    return {
      labels: ["Registered", "Unregistered"],
      datasets: [
        {
          data: [registrationCoverage.registered, registrationCoverage.unregistered],
          backgroundColor: ["rgba(59, 130, 246, 0.85)", "rgba(234, 179, 8, 0.85)"],
          hoverOffset: 8,
        },
      ],
    };
  }, [registrationCoverage.registered, registrationCoverage.unregistered]);

  const latestPublishedExam = useMemo(() => {
    const publishedExams = exams.filter((exam) => exam?.results_published);
    if (!publishedExams.length) return null;
    return publishedExams.reduce((latest, exam) => {
      if (!exam) return latest;
      if (!latest) return exam;
      const latestDate = new Date(latest.created_at || latest.date || 0).getTime();
      const currentDate = new Date(exam.created_at || exam.date || 0).getTime();
      return currentDate >= latestDate ? exam : latest;
    }, null);
  }, [exams]);

  const paymentCoverage = useMemo(() => {
    const amountParser = (value) => {
      const parsed = Number(value);
      return Number.isNaN(parsed) ? 0 : parsed;
    };
    const targetExamId = latestPublishedExam?.id;
    const targetedRegistrations = targetExamId
      ? registrations.filter((registration) => registration.exam_id === targetExamId)
      : registrations;
    const targetRegistrationIds = new Set(
      targetedRegistrations.map((registration) => registration.id).filter((id) => id != null)
    );
    const filteredPayments = payments.filter((payment) =>
      payment.exam_registration_id ? targetRegistrationIds.has(payment.exam_registration_id) : false
    );
    const paidPayments = filteredPayments.filter(
      (payment) => (payment.payment_status ?? "").toString().toLowerCase() === "success"
    );
    const pendingPayments = filteredPayments.filter(
      (payment) => (payment.payment_status ?? "").toString().toLowerCase() !== "success"
    );
    const paidAmount = paidPayments.reduce((sum, payment) => sum + amountParser(payment.amount_paid), 0);
    const pendingAmount = pendingPayments.reduce(
      (sum, payment) => sum + amountParser(payment.amount_paid),
      0
    );
    const paidRegistrations = new Set(
      paidPayments
        .map((payment) => payment.exam_registration_id)
        .filter((id) => id !== null && id !== undefined)
    ).size;
    const targetTotal = targetRegistrationIds.size;
    const unpaidRegistrations = Math.max(targetTotal - paidRegistrations, 0);
    return {
      paidRegistrations,
      unpaidRegistrations,
      totalRegistrations: targetTotal,
      paidAmount,
      pendingAmount,
    };
  }, [payments, registrations, latestPublishedExam]);

  const paymentCoverageChartData = useMemo(() => {
    return {
      labels: ["Paid", "Unpaid"],
      datasets: [
        {
          data: [paymentCoverage.paidRegistrations, paymentCoverage.unpaidRegistrations],
          backgroundColor: ["rgba(16, 185, 129, 0.85)", "rgba(249, 115, 22, 0.85)"],
          hoverOffset: 6,
        },
      ],
    };
  }, [paymentCoverage.paidRegistrations, paymentCoverage.unpaidRegistrations]);

  const passedArrearStats = useMemo(() => {
    const targetExamId = latestPublishedExam?.id;
    if (!results.length) {
      return { passed: 0, arrear: 0, total: 0 };
    }
    const map = new Map();
    results.forEach((row) => {
      if (targetExamId && row.exam_id !== targetExamId) {
        return;
      }
      if (!row.student_id) return;
      const status = (row.result_status ?? "").toString().toLowerCase();
      const entry = map.get(row.student_id) || { hasFail: false };
      if (status && !status.includes("pass")) {
        entry.hasFail = true;
      }
      entry.seen = true;
      map.set(row.student_id, entry);
    });
    let passed = 0;
    let arrear = 0;
    map.forEach((entry) => {
      if (entry.hasFail) {
        arrear += 1;
      } else {
        passed += 1;
      }
    });
    return { passed, arrear, total: map.size };
  }, [results, latestPublishedExam?.id]);

  const resultDistributionChartData = useMemo(() => {
    return {
      labels: ["Passed", "Arrear"],
      datasets: [
        {
          label: "Students",
          data: [passedArrearStats.passed, passedArrearStats.arrear],
          backgroundColor: ["rgba(16, 185, 129, 0.85)", "rgba(239, 68, 68, 0.85)"],
          borderRadius: 10,
          barThickness: 34,
        },
      ],
    };
  }, [passedArrearStats.passed, passedArrearStats.arrear]);

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

  const academicCounts = useMemo(
    () => ({
      students: students.length,
      courses: courses.length,
      groups: groups.length,
    }),
    [students.length, courses.length, groups.length]
  );

  const [activeGroup, setActiveGroup] = useState("");

  const courseLabels = useMemo(() => {
    const lookup = {};
    const register = (key, value) => {
      const normalized = key?.trim();
      if (!normalized) return;
      lookup[normalized] = value;
      lookup[normalized.toLowerCase()] = value;
    };
    courses.forEach((course) => {
      const code = course.course_code?.trim();
      const name = course.course_name?.trim();
      if (code) {
        register(code, name || code);
      }
      if (name) {
        register(name, name);
      }
    });
    return lookup;
  }, [courses]);

  const groupLabels = useMemo(() => {
    const lookup = {};
    const register = (key, value) => {
      const normalized = key?.trim();
      if (!normalized) return;
      lookup[normalized] = value;
      lookup[normalized.toLowerCase()] = value;
    };
    groups.forEach((group) => {
      const code = group.group_code?.trim();
      const name = group.group_name?.trim();
      if (code) {
        register(code, name || code);
      }
      if (name) {
        register(name, name);
      }
    });
    return lookup;
  }, [groups]);

  const studentLookupById = useMemo(() => {
    const lookup = {};
    students.forEach((student) => {
      if (student.id != null) {
        lookup[student.id] = student;
      }
    });
    return lookup;
  }, [students]);

  const groupEnrollments = useMemo(() => {
    const counts = {};
    students.forEach((student) => {
      const code = student.group_code?.trim();
      const inputName = student.group_name?.trim();
      const resolved =
        (code && groupLabels[code]) ||
        (inputName && groupLabels[inputName]) ||
        inputName ||
        code;
      if (!resolved) return;
      counts[resolved] = (counts[resolved] || 0) + 1;
    });
    const topWithData = Object.entries(counts)
      .map(([group, count]) => ({ group, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    if (topWithData.length) {
      return topWithData;
    }

    return (
      groups
        .map((group) => ({
          group: group.group_name?.trim() || group.group_code?.trim() || `Group ${group.group_id || "Unnamed"}`,
          count: 0,
        }))
        .filter((entry) => entry.group)
        .slice(0, 6)
    );
  }, [students, groups, groupLabels]);

  const groupCourseMap = useMemo(() => {
    const map = {};
    students.forEach((student) => {
      const code = student.group_code?.trim();
      const inputName = student.group_name?.trim();
      const resolvedGroup =
        (code && groupLabels[code]) ||
        (inputName && groupLabels[inputName]) ||
        inputName ||
        code;
      if (!resolvedGroup) return;
      const courseCode = student.course_code?.trim();
      const courseName = student.course_name?.trim();
      const resolvedCourse =
        (courseCode && courseLabels[courseCode]) ||
        (courseName && courseLabels[courseName]) ||
        courseName ||
        courseCode;
      if (!resolvedCourse) return;
      map[resolvedGroup] = map[resolvedGroup] || {};
      map[resolvedGroup][resolvedCourse] = (map[resolvedGroup][resolvedCourse] || 0) + 1;
    });
    return map;
  }, [students, groupLabels, courseLabels]);

  useEffect(() => {
    if (!groupEnrollments.length) {
      setActiveGroup("");
    }
  }, [groupEnrollments.length]);

  const activeGroupCourses = useMemo(() => {
    if (!activeGroup) return [];
    const coursesForGroup = groupCourseMap[activeGroup] || {};
    return Object.entries(coursesForGroup)
      .map(([course, count]) => ({ course, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [groupCourseMap, activeGroup]);

  const courseEnrollmentChartData = useMemo(() => {
    const colors = [
      "rgba(59, 130, 246, 0.85)",
      "rgba(16, 185, 129, 0.85)",
      "rgba(249, 115, 22, 0.85)",
      "rgba(234, 179, 8, 0.85)",
      "rgba(147, 51, 234, 0.85)",
      "rgba(236, 72, 153, 0.85)",
      "rgba(59, 78, 162, 0.85)",
      "rgba(236, 72, 153, 0.7)",
    ];
    const labels = activeGroupCourses.map((entry) => entry.course);
    const data = activeGroupCourses.map((entry) => entry.count);
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
  }, [activeGroupCourses]);

  const hallTicketStatusCounts = useMemo(() => {
    const counts = { Issued: 0, Pending: 0 };
    registrations.forEach((registration) => {
      const student = studentLookupById[registration.student_id];
      const hasHallTicket = Boolean(student?.hall_ticket_no?.trim());
      let status = hasHallTicket
        ? "Issued"
        : categorizeHallTicketStatus(registration.status);
      if (!["Issued", "Pending"].includes(status)) {
        status = "Pending";
      }
      counts[status] = (counts[status] || 0) + 1;
    });
    return counts;
  }, [registrations, studentLookupById]);

  const hallTicketIssuedPercent = useMemo(() => {
    const total = registrations.length;
    if (!total) return 0;
    const issued = hallTicketStatusCounts.Issued || 0;
    return Math.round((issued / total) * 100);
  }, [hallTicketStatusCounts, registrations.length]);

  const hallTicketStatusChartData = useMemo(() => {
    const colors = [
      "rgba(16, 185, 129, 0.85)",
      "rgba(249, 115, 22, 0.85)",
      "rgba(239, 68, 68, 0.85)",
    ];
    const labels = hallTicketStatusMeta.map((entry) => entry.key);
    const data = labels.map((label) => hallTicketStatusCounts[label] || 0);
    return {
      labels,
      datasets: [
        {
          label: "Hall ticket status",
          data,
          backgroundColor: data.map((_, index) => colors[index % colors.length]),
          borderRadius: 12,
          barThickness: 32,
        },
      ],
    };
  }, [hallTicketStatusCounts]);

  const groupEnrollmentChartData = useMemo(() => {
    return {
      labels: groupEnrollments.map((entry) => entry.group),
      datasets: [
        {
          label: "Students",
          data: groupEnrollments.map((entry) => entry.count),
          backgroundColor: "rgba(16, 185, 129, 0.85)",
          borderRadius: 12,
          barThickness: 24,
        },
      ],
    };
  }, [groupEnrollments]);
  const metrics = [
    {
      label: "Total Students",
      value: academicCounts.students,
      detail: "All enrolled learners",
      icon: "bi-people-fill",
      path: "/admin/reports",
    },
    {
      label: "Groups",
      value: academicCounts.groups,
      detail: "Academic groups",
      icon: "bi-building",
      path: "/admin/reports",
    },
    {
      label: "Total Courses",
      value: academicCounts.courses,
      detail: "Active academic programs",
      icon: "bi-book-half",
      path: "/admin/reports",
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

            <article className="dashboard-chart-card card-shadow dashboard-payment-card">
              <div className="dashboard-chart-header">
                <h3>Registration snapshot</h3>
                <p className="text-muted mb-0">How many students have registered for the upcoming exams</p>
              </div>
              <div className="dashboard-chart-wrapper">
                <Doughnut data={registrationCoverageChartData} options={coverageChartOptions} />
              </div>
              <div className="dashboard-coverage-grid">
                <div className="dashboard-coverage-item">
                  <span className="dashboard-coverage-label">Registered</span>
                  <span className="dashboard-coverage-value">{registrationCoverage.registered}</span>
                  <span className="dashboard-coverage-note">
                    {registrationCoverage.registeredPercent}% of {registrationCoverage.total} students
                  </span>
                </div>
                <div className="dashboard-coverage-item">
                  <span className="dashboard-coverage-label">Not registered</span>
                  <span className="dashboard-coverage-value">{registrationCoverage.unregistered}</span>
                  <span className="dashboard-coverage-note">Need to complete registration</span>
                </div>
              </div>
            </article>

            <article className="dashboard-chart-card card-shadow">
              <div className="dashboard-chart-header">
                <h3>Hall ticket overview</h3>
                <p className="text-muted mb-0">Issuance progress for current registrations</p>
              </div>
              <div className="dashboard-hallticket-chart">
                <Bar data={hallTicketStatusChartData} options={hallTicketBarOptions} />
              </div>
              <div className="dashboard-hallticket-grid">
                {hallTicketStatusMeta.map((status) => (
                  <div key={status.key} className="dashboard-hallticket-stat">
                    <div className="dashboard-hallticket-title">{status.key}</div>
                    <div className="dashboard-hallticket-count">
                      {hallTicketStatusCounts[status.key] || 0}
                    </div>
                    <div className="dashboard-hallticket-note">{status.note}</div>
                  </div>
                ))}
              </div>
              <div className="dashboard-hallticket-footer text-muted small">
                {registrations.length ? (
                  <>
                    {hallTicketIssuedPercent}% of registrations have issued hall tickets (
                    {hallTicketStatusCounts.Issued || 0} of {registrations.length})
                  </>
                ) : (
                  "No registration data yet."
                )}
              </div>
            </article>

            <article className="dashboard-chart-card card-shadow">
              <div className="dashboard-chart-header">
                <h3>Group Enrollment</h3>
                <p className="text-muted mb-0">Most represented academic groups</p>
              </div>
              <div className="dashboard-group-layout">
                <div className="dashboard-group-tabs">
                  {groupEnrollments.length ? (
                    groupEnrollments.map((group) => (
                      <button
                        key={group.group}
                        type="button"
                        className={`btn dashboard-group-tab ${
                          activeGroup === group.group ? "active" : ""
                        }`}
                        onClick={() => setActiveGroup(group.group)}
                      >
                        <span className="fw-semibold">{group.group}</span>
                        <small className="text-muted">{group.count} students</small>
                      </button>
                    ))
                  ) : (
                    <div className="text-muted small">No group data yet.</div>
                  )}
                </div>
                <div className="dashboard-chart-wrapper smaller">
                  {groupEnrollments.length ? (
                    <Bar data={groupEnrollmentChartData} options={barOptions} />
                  ) : (
                    <div className="text-muted text-center py-4">Waiting for group data.</div>
                  )}
                </div>
              </div>
            </article>
            <article className="dashboard-chart-card card-shadow">
              <div className="dashboard-chart-header">
                <h3>Course Enrollment</h3>
                <p className="text-muted mb-0">
                  {activeGroup
                    ? `Breakdown for ${activeGroup}`
                    : "Choose a group to explore course enrollments"}
                </p>
              </div>
              <div className="dashboard-chart-wrapper smaller">
                {activeGroup && activeGroupCourses.length ? (
                  <PolarArea data={courseEnrollmentChartData} options={polarOptions} />
                ) : (
                  <div className="text-center text-muted py-5">
                    {activeGroup
                      ? "No course data yet for this group."
                      : "Select a group above to view its courses."}
                  </div>
                )}
              </div>
              <div className="dashboard-course-summary">
                <div className="dashboard-enrollment-grid">
                  <div>
                    <div className="dashboard-enrollment-title">
                      {activeGroup ? `${activeGroup} courses` : "Select a group"}
                    </div>
                    {activeGroupCourses.length ? (
                      <ul className="dashboard-course-list">
                        {activeGroupCourses.map((course) => (
                          <li key={course.course} className="dashboard-course-item">
                            <span className="course-name">{course.course}</span>
                            <span className="course-count">{course.count} students</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted small mb-0">
                        {activeGroup
                          ? "No course data yet."
                          : "Select a group to see its courses."}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </article>
            <article className="dashboard-chart-card card-shadow">
              <div className="dashboard-chart-header">
                <h3>Exam results distribution</h3>
                <p className="text-muted mb-0">
                  {latestPublishedExam?.exam_name || "Latest published exam"}
                </p>
              </div>
              <div className="dashboard-results-chart">
                <Bar data={resultDistributionChartData} options={resultChartOptions} />
              </div>
              <div className="dashboard-results-grid">
                <div className="dashboard-results-item">
                  <span className="dashboard-results-label">Passed students</span>
                  <span className="dashboard-results-value">{passedArrearStats.passed}</span>
                  <span className="dashboard-results-note">
                    {passedArrearStats.total
                      ? `${Math.round((passedArrearStats.passed / passedArrearStats.total) * 100)}% cleared`
                      : "Waiting for results"}
                  </span>
                </div>
                <div className="dashboard-results-item">
                  <span className="dashboard-results-label">Arrear students</span>
                  <span className="dashboard-results-value">{passedArrearStats.arrear}</span>
                  <span className="dashboard-results-note">
                    {passedArrearStats.total
                      ? `${Math.round((passedArrearStats.arrear / passedArrearStats.total) * 100)}% need remediation`
                      : "Waiting for results"}
                  </span>
                </div>
              </div>
            </article>
            <article className="dashboard-chart-card card-shadow">
              <div className="dashboard-chart-header">
                <h3>Payment coverage</h3>
                <p className="text-muted mb-0">
                  {latestPublishedExam?.exam_name
                    ? `Registrations for ${latestPublishedExam.exam_name}`
                    : "Registrations paid vs not paid"}
                </p>
              </div>
              <div className="dashboard-chart-wrapper">
                <Doughnut data={paymentCoverageChartData} options={coverageChartOptions} />
              </div>
              <div className="dashboard-payment-grid">
                <div className="dashboard-payment-item">
                  <span className="dashboard-payment-label">Paid registrations</span>
                  <span className="dashboard-payment-value">{paymentCoverage.paidRegistrations}</span>
                  <span className="dashboard-payment-note">
                    {paymentCoverage.totalRegistrations
                      ? `${Math.round(
                          (paymentCoverage.paidRegistrations / paymentCoverage.totalRegistrations) * 100
                        )}% covered`
                      : "Awaiting data"}
                  </span>
                </div>
                <div className="dashboard-payment-item">
                  <span className="dashboard-payment-label">Unpaid registrations</span>
                  <span className="dashboard-payment-value">{paymentCoverage.unpaidRegistrations}</span>
                  <span className="dashboard-payment-note">
                    {paymentCoverage.totalRegistrations
                      ? `${Math.round(
                          (paymentCoverage.unpaidRegistrations / paymentCoverage.totalRegistrations) * 100
                        )}% remaining`
                      : "Awaiting data"}
                  </span>
                </div>
              </div>
            </article>
          </div>

        </section>

      </div>
    </AdminShell>
  );
}
