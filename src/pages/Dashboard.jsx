import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
import { Doughnut, Bar } from "react-chartjs-2";
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

const stackedBarOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: "top",
    },
    tooltip: {
      callbacks: {
        label: (context) => `${context.dataset.label}: ${context.parsed.y}`,
      },
    },
  },
  scales: {
    x: {
      stacked: true,
      grid: {
        display: false,
      },
    },
    y: {
      stacked: true,
      beginAtZero: true,
      grid: {
        color: "rgba(15, 23, 42, 0.12)",
      },
    },
  },
};

const paymentBarOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: "top",
    },
    tooltip: {
      callbacks: {
        label: (context) => `${context.dataset.label}: ${context.parsed.y}`,
      },
    },
  },
  scales: {
    x: {
      stacked: false,
      grid: {
        display: false,
      },
    },
    y: {
      stacked: false,
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

const hallTicketStatusMeta = [
  { key: "Issued", note: "Hall tickets ready for printing" },
  { key: "Pending", note: "Awaiting hall ticket generation" },
  { key: "Escalated", note: "Requires administrative attention" },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [payments, setPayments] = useState([]); // Added payments state
  const [regSubjects, setRegSubjects] = useState([]);
  const [marks, setMarks] = useState([]);

  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [groups, setGroups] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paymentView, setPaymentView] = useState("group"); // 'group' or 'course'
  const [resultView, setResultView] = useState("group"); // 'group' or 'course'
  const [registrationView, setRegistrationView] = useState("group"); // 'group' or 'course'

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
        .select("id, status, exam_id, created_at, student_id, total_fee, group_name, course_name"), // Added group_name, course_name
      supabase.from("payments").select("exam_registration_id, amount_paid, payment_status"), // Added payments fetch with status
      supabase.from("exam_registration_subjects").select("id, exam_registration_id"),
      supabase.from("marks").select("id"),

      supabase
        .from("students")
        .select("id, course_name, group_name, hall_ticket_no"),
      supabase.from("courses").select("course_id, course_code, course_name"),
      supabase.from("groups").select("group_id, group_code, group_name"),
      supabase.from("results").select("student_id, result_status, exam_id, marks_obtained, max_marks"),
    ])
      .then(
        ([
          examsResult,
          registrationsResult,
          paymentsResult, // Added payments result
          subjectsResult,
          marksResult,

          studentsResult,
          coursesResult,
          groupsResult,
          resultsResult,
        ]) => {
          if (!active) return;
          const errors = [
            examsResult.error,
            registrationsResult.error,
            subjectsResult.error,
            marksResult.error,
            resultsResult.error,
          ].filter(Boolean);
          if (errors.length) {
            setError(errors.map((err) => err.message).join(" · "));
          }
          setExams(examsResult.data || []);
          setRegistrations(registrationsResult.data || []);
          setPayments(paymentsResult.data || []); // Set payments data
          setRegSubjects(subjectsResult.data || []);
          setMarks(marksResult.data || []);

          setStudents(studentsResult.data || []);
          setCourses(coursesResult.data || []);
          setGroups(groupsResult.data || []);
          setResults(resultsResult.data || []);
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

  const latestExam = useMemo(() => {
    return exams.length ? exams[0] : null;
  }, [exams]);


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

  const registrationStats = useMemo(() => {
    const targetExamId = latestExam?.id;
    const currentExamRegistrations = registrations.filter(
      (r) => r.exam_id === targetExamId
    );
    const registeredStudentIds = new Set(
      currentExamRegistrations.map((r) => r.student_id)
    );

    const groupStats = {};
    const courseStats = {};

    // Initialize stats
    groups.forEach((g) => {
      const label = g.group_name || g.group_code;
      if (label) groupStats[label] = { registered: 0, total: 0 };
    });
    courses.forEach((c) => {
      const label = c.course_name || c.course_code;
      if (label) courseStats[label] = { registered: 0, total: 0 };
    });

    students.forEach((student) => {
      const isRegistered = registeredStudentIds.has(student.id);

      // Group
      const rawGroup = student.group_name;
      const glabel = groupLabels[rawGroup] || rawGroup || "Unknown";
      if (!groupStats[glabel]) groupStats[glabel] = { registered: 0, total: 0 };
      groupStats[glabel].total += 1;
      if (isRegistered) groupStats[glabel].registered += 1;

      // Course
      const rawCourse = student.course_name;
      const clabel = courseLabels[rawCourse] || rawCourse || "Unknown";
      if (!courseStats[clabel]) courseStats[clabel] = { registered: 0, total: 0 };
      courseStats[clabel].total += 1;
      if (isRegistered) courseStats[clabel].registered += 1;
    });

    // Cleanup empty "Unknown"
    if (groupStats["Unknown"] && groupStats["Unknown"].total === 0) delete groupStats["Unknown"];
    if (courseStats["Unknown"] && courseStats["Unknown"].total === 0) delete courseStats["Unknown"];

    const formatChartData = (statsMap) => {
      const labels = Object.keys(statsMap).sort();
      const registered = labels.map((l) => statsMap[l].registered);
      const pending = labels.map((l) => statsMap[l].total - statsMap[l].registered);
      return {
        labels,
        datasets: [
          {
            label: "Registered",
            data: registered,
            backgroundColor: "rgba(59, 130, 246, 0.85)",
          },
          {
            label: "Pending",
            data: pending,
            backgroundColor: "rgba(209, 213, 219, 0.8)",
          },
        ],
      };
    };

    return {
      group: formatChartData(groupStats),
      course: formatChartData(courseStats)
    };
  }, [students, registrations, groups, courses, groupLabels, courseLabels, latestExam]);

  const studentLookupById = useMemo(() => {
    const lookup = {};
    students.forEach((student) => {
      if (student.id != null) {
        lookup[student.id] = student;
      }
    });
    return lookup;
  }, [students]);

  const paymentStats = useMemo(() => {
    const targetExamId = latestExam?.id;
    if (!targetExamId) return { group: null, course: null };

    const currentRegs = registrations.filter(r => r.exam_id === targetExamId);
    if (!currentRegs.length) return { group: null, course: null };

    // Map payments to registrations
    const paymentsMap = {};
    payments.forEach(p => {
      const status = (p.payment_status || "").toLowerCase();
      if (status === "success") {
        const rid = p.exam_registration_id;
        paymentsMap[rid] = (paymentsMap[rid] || 0) + (Number(p.amount_paid) || 0);
      }
    });

    const regStatus = {};
    currentRegs.forEach(r => {
      const paid = paymentsMap[r.id] || 0;
      const fee = Number(r.total_fee || 0);
      const isPaid = (fee > 0 && paid >= fee) || (fee === 0 && paid > 0);
      // Only consider Paid if (fee > 0 AND fully paid) OR (fee is 0 AND some payment made).
      // This handles cases where total_fee might be missing (0) but user has paid.
      regStatus[r.id] = isPaid;
    });

    const groupData = {};
    const courseData = {};

    currentRegs.forEach(r => {
      // Logic solely based on exam_registrations table (snapshot data), not students table
      const isPaid = regStatus[r.id];

      // Group
      const rawGroup = r.group_name;
      const glabel = groupLabels[rawGroup] || rawGroup || "Unknown";
      if (!groupData[glabel]) groupData[glabel] = { paid: 0, pending: 0 };
      if (isPaid) groupData[glabel].paid++;
      else groupData[glabel].pending++;

      // Course
      const rawCourse = r.course_name;
      const clabel = courseLabels[rawCourse] || rawCourse || "Unknown";
      if (!courseData[clabel]) courseData[clabel] = { paid: 0, pending: 0 };
      if (isPaid) courseData[clabel].paid++;
      else courseData[clabel].pending++;
    });

    const formatChartData = (dataMap) => {
      const labels = Object.keys(dataMap).sort();
      return {
        labels,
        datasets: [
          {
            label: "Paid",
            data: labels.map(l => dataMap[l].paid),
            backgroundColor: "rgba(16, 185, 129, 0.85)",
          },
          {
            label: "Unpaid",
            data: labels.map(l => dataMap[l].pending),
            backgroundColor: "rgba(239, 68, 68, 0.85)",
          }
        ]
      };
    };

    return {
      group: formatChartData(groupData),
      course: formatChartData(courseData)
    };
  }, [latestExam?.id, registrations, payments, groupLabels, courseLabels]);

  const resultStats = useMemo(() => {
    const targetExamId = latestPublishedExam?.id;
    if (!targetExamId || !results.length) return { group: null, course: null };

    // Accumulate total marks per group/course to calculate percentage
    const groupAcc = {}; // { obtained: 0, max: 0 }
    const courseAcc = {};

    results.forEach((row) => {
      if (row.exam_id !== targetExamId) return;

      const student = studentLookupById[row.student_id];
      if (!student) return;

      const obtained = Number(row.marks_obtained) || 0;
      const max = Number(row.max_marks) || 100;

      // Group
      const rawGroup = student.group_name;
      const glabel = groupLabels[rawGroup] || rawGroup || "Unknown";
      if (!groupAcc[glabel]) groupAcc[glabel] = { obtained: 0, max: 0 };
      groupAcc[glabel].obtained += obtained;
      groupAcc[glabel].max += max;

      // Course
      const rawCourse = student.course_name;
      const clabel = courseLabels[rawCourse] || rawCourse || "Unknown";
      if (!courseAcc[clabel]) courseAcc[clabel] = { obtained: 0, max: 0 };
      courseAcc[clabel].obtained += obtained;
      courseAcc[clabel].max += max;
    });

    const formatChartData = (accMap) => {
      const labels = Object.keys(accMap).sort();
      const percentages = labels.map(l => {
        const { obtained, max } = accMap[l];
        return max ? Math.round((obtained / max) * 100) : 0;
      });

      return {
        labels,
        datasets: [
          {
            label: "Overall Percentage",
            data: percentages,
            backgroundColor: "rgba(59, 130, 246, 0.85)",
          }
        ]
      };
    };

    return {
      group: formatChartData(groupAcc),
      course: formatChartData(courseAcc)
    };
  }, [results, latestPublishedExam?.id, studentLookupById, groupLabels, courseLabels]);



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

            <article
              className="dashboard-chart-card card-shadow cursor-pointer dashboard-card-link"
              style={{ minHeight: "420px", cursor: "pointer" }}
              onClick={() => navigate("/admin/reports")}
            >
              <div className="dashboard-chart-header">
                <div className="d-flex justify-content-between align-items-start w-100">
                  <div>
                    <h3>Exam Registration Status</h3>
                    <p className="text-muted mb-0">
                      {latestExam?.exam_name || "Upcoming exams"}
                    </p>
                  </div>
                  <div className="btn-group btn-group-sm" role="group">
                    <button
                      type="button"
                      className={`btn ${registrationView === "group" ? "btn-primary" : "btn-outline-primary"}`}
                      onClick={(e) => { e.stopPropagation(); setRegistrationView("group"); }}
                    >
                      Group
                    </button>
                    <button
                      type="button"
                      className={`btn ${registrationView === "course" ? "btn-primary" : "btn-outline-primary"}`}
                      onClick={(e) => { e.stopPropagation(); setRegistrationView("course"); }}
                    >
                      Course
                    </button>
                  </div>
                </div>
              </div>
              <div className="dashboard-chart-wrapper">
                {registrationStats && registrationStats[registrationView] ? (
                  <Bar data={registrationStats[registrationView]} options={stackedBarOptions} />
                ) : (
                  <div className="d-flex align-items-center justify-content-center h-100 text-muted">
                    No registration data available
                  </div>
                )}
              </div>
            </article>

            <article
              className="dashboard-chart-card card-shadow cursor-pointer dashboard-card-link"
              style={{ minHeight: "420px", cursor: "pointer" }}
              onClick={() => navigate("/admin/reports")}
            >
              <div className="dashboard-chart-header">
                <div className="d-flex justify-content-between align-items-start w-100">
                  <div>
                    <h3>Payment Status</h3>
                    <p className="text-muted mb-0">
                      {latestExam?.exam_name || "Payment overview"}
                    </p>
                  </div>
                  <div className="btn-group btn-group-sm" role="group">
                    <button
                      type="button"
                      className={`btn ${paymentView === "group" ? "btn-primary" : "btn-outline-primary"}`}
                      onClick={(e) => { e.stopPropagation(); setPaymentView("group"); }}
                    >
                      Group
                    </button>
                    <button
                      type="button"
                      className={`btn ${paymentView === "course" ? "btn-primary" : "btn-outline-primary"}`}
                      onClick={(e) => { e.stopPropagation(); setPaymentView("course"); }}
                    >
                      Course
                    </button>
                  </div>
                </div>
              </div>
              <div className="dashboard-chart-wrapper">
                {paymentStats && paymentStats[paymentView] ? (
                  <Bar data={paymentStats[paymentView]} options={paymentBarOptions} />
                ) : (
                  <div className="d-flex align-items-center justify-content-center h-100 text-muted">
                    No payment data available
                  </div>
                )}
              </div>
            </article>

            <article
              className="dashboard-chart-card card-shadow cursor-pointer dashboard-card-link"
              style={{ minHeight: "420px", cursor: "pointer" }}
              onClick={() => navigate("/admin/marks-reports")}
            >
              <div className="dashboard-chart-header">
                <div className="d-flex justify-content-between align-items-start w-100">
                  <div>
                    <h3>Exam result status</h3>
                    <p className="text-muted mb-0">
                      {latestPublishedExam?.exam_name || "Latest published exam"}
                    </p>
                  </div>
                  <div className="btn-group btn-group-sm" role="group">
                    <button
                      type="button"
                      className={`btn ${resultView === "group" ? "btn-primary" : "btn-outline-primary"}`}
                      onClick={(e) => { e.stopPropagation(); setResultView("group"); }}
                    >
                      Group
                    </button>
                    <button
                      type="button"
                      className={`btn ${resultView === "course" ? "btn-primary" : "btn-outline-primary"}`}
                      onClick={(e) => { e.stopPropagation(); setResultView("course"); }}
                    >
                      Course
                    </button>
                  </div>
                </div>
              </div>
              <div className="dashboard-chart-wrapper">
                {resultStats && resultStats[resultView] ? (
                  <Bar data={resultStats[resultView]} options={paymentBarOptions} />
                ) : (
                  <div className="d-flex align-items-center justify-content-center h-100 text-muted">
                    No result data available
                  </div>
                )}
              </div>
            </article>
          </div>

        </section>

      </div>
    </AdminShell>
  );
}
