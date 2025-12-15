import AdminShell from "../components/AdminShell";

const dashboardMetrics = [
  {
    label: "Active Exams",
    value: "12",
    detail: "2 starting this week",
    icon: "bi-calendar-event",
  },
  {
    label: "Pending Hall Tickets",
    value: "184",
    detail: "Synced with current timetable",
    icon: "bi-ticket-perforated",
  },
  {
    label: "Results Awaiting Review",
    value: "37",
    detail: "Marks entry in progress",
    icon: "bi-pencil-square",
  },
];

export default function Dashboard() {
  return (
    <AdminShell>
      <div className="dashboard-page">
        <div className="dashboard-header card-shadow">
          <div>
            <p className="text-uppercase text-secondary small mb-1">
              Dashboard / Overview
            </p>
            <h1 className="dashboard-heading mb-1">Exam Management Dashboard</h1>
            <p className="text-muted">
              A concise status summary of exams, hall tickets, and results workflows.
            </p>
          </div>
          <span className="dashboard-badge">Overview</span>
        </div>

        <div className="dashboard-cards">
          {dashboardMetrics.map((metric) => (
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
      </div>
    </AdminShell>
  );
}
