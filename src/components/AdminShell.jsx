import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../store/auth";
import logo from "../assets/media/images.png";
import '../pages/staff/StaffPortal.css';

const examPortalNavGroups = [
  {
    title: "Dashboard",
    static: true,
    items: [{ to: "/admin/dashboard", label: "Dashboard", icon: "bi-speedometer2" }],
  },
  {
    title: "Student Portal",
    items: [
      { to: "/admin/setup/years", label: "Academic Years", icon: "bi-calendar3" },
      { to: "/admin/setup/groups", label: "Groups & Courses", icon: "bi-diagram-3" },
      { to: "/admin/setup/subjects", label: "Subjects", icon: "bi-journal-text" },
      { to: "/admin/students", label: "Students Details", icon: "bi-person-badge" },
      { to: "/admin/fees-generation", label: "Fees Generation", icon: "bi-mortarboard" },
    ],
  },
  {
    title: "Pre-Exam Portal",
    items: [
      { to: "/admin/exam-name-creation", label: "Exam name creation", icon: "bi-pencil-square" },
      { to: "/admin/subject-mapping", label: "Subject Mapping & Payments", icon: "bi-credit-card" },
      { to: "/admin/create-exam", label: "Create Exam timetable", icon: "bi-journal-check" },
      { to: "/admin/complete-registration", label: "Complete Registration & View Time table", icon: "bi-list-check" },
      { to: "/admin/hall-tickets", label: "Hall Ticket", icon: "bi-ticket-perforated" },
      { to: "/admin/practical", label: "Practical", icon: "bi-flask" },
      { to: "/admin/seat-allocation", label: "Seat Allocation", icon: "bi-grid-3x3-gap" },
    ],
  },
  {
    title: "Post-Exam Portal",
    items: [
      { to: "/admin/internal-marks", label: "Internal Marks Entry", icon: "bi-clipboard-check" },
      { to: "/admin/decode", label: "Decoding", icon: "bi-bar-chart" },
      { to: "/admin/marks-entry", label: "Marks Entry", icon: "bi-award" },
      { to: "/admin/result-publish", label: "Result Publish", icon: "bi-megaphone" },
      { to: "/admin/promote", label: "Promotion", icon: "bi-people" },
      { to: "/admin/revaluation", label: "Revaluation", icon: "bi-clipboard-check" },
    ],
  },
  {
    title: "Reports",
    items: [
      { to: "/admin/marks-reports", label: "Marks Reports", icon: "bi-file-earmark-bar-graph" },
      { to: "/admin/reports", label: "Reports", icon: "bi-file-earmark-text" },
    ],
  },
  {
    title: "Recent Activities",
    items: [
      { to: "/admin/history", label: "History", icon: "bi-clock-history" },
    ],
  },
];

export default function AdminShell({
  children,
  navGroups,
  brandTitle = "EXAM PORTAL",
}) {
  const { pathname } = useLocation();
  const navTo = useNavigate();
  const { signOut, user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({});

  // Determine which nav groups to use
  const activeNavGroups = navGroups || examPortalNavGroups;

  const isRouteActive = (pathname, to) => {
    return pathname === to || pathname.startsWith(`${to}/`);
  };

  const toggleGroup = (index) => {
    if (activeNavGroups[index]?.static) return;
    setExpandedGroups((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const handleLogout = () => {
    signOut();
    navTo("/");
  };

  // Automatically expand the group that contains the current active route
  useEffect(() => {
    const activeGroupIndex = activeNavGroups.findIndex(
      (group) => !group.static && group.items.some((item) => isRouteActive(pathname, item.to))
    );
    if (activeGroupIndex !== -1) {
      setExpandedGroups((prev) => ({
        ...prev,
        [activeGroupIndex]: true,
      }));
    }
  }, [pathname, activeNavGroups]);

  return (
    <div className={`staff-portal ${collapsed ? 'staff-portal--collapsed' : ''} ${mobileOpen ? 'staff-portal--mobile-open' : ''}`}>
      {/* Mobile Backdrop */}
      <div
        className="staff-portal__backdrop"
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      ></div>

      <aside className="staff-sidebar">
        <div className={`staff-sidebar__header d-flex align-items-center ${collapsed ? 'flex-column justify-content-center py-4 gap-3' : 'px-4 py-4'}`}>
          <img src={logo} alt="Vijayam crest" className="staff-header__logo" />
          <div className={`staff-sidebar__brand ms-3 ${collapsed ? 'd-none' : ''}`}>
            <div className="fw-bold text-white text-uppercase" style={{ fontSize: '1rem', letterSpacing: '0.05em', lineHeight: '1.2' }}>Vijayam</div>
            <div className="text-white-50 small text-uppercase" style={{ fontSize: '0.75rem', letterSpacing: '0.1em' }}>Arts & Science College</div>
          </div>

          <button
            type="button"
            className={`staff-sidebar__toggle ${collapsed ? '' : 'ms-auto'}`}
            onClick={() => setCollapsed((prev) => !prev)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <i className={`bi ${collapsed ? 'bi-chevron-double-right' : 'bi-chevron-double-left'}`} style={{ color: 'white' }}></i>
          </button>
        </div>

        <nav className="staff-sidebar__nav">
          {activeNavGroups.map((group, groupIndex) => {
            const isStatic = group.static;
            const isActiveGroup = group.items.some((item) => isRouteActive(pathname, item.to));
            const isExpanded = expandedGroups[groupIndex];

            if (isStatic) {
              const item = group.items[0];
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`staff-sidebar__link ${isRouteActive(pathname, item.to) ? 'active' : ''}`}
                >
                  <i className={`bi ${item.icon}`}></i>
                  <span>{item.label}</span>
                </Link>
              )
            }

            // Collapsible Groups
            return (
              <div key={groupIndex} className="nav-group-wrapper">
                <div
                  className={`staff-sidebar__link ${isActiveGroup ? 'group-active' : ''}`}
                  onClick={() => toggleGroup(groupIndex)}
                  style={{ cursor: 'pointer', justifyContent: 'space-between' }}
                >
                  <div className="d-flex align-items-center gap-2">
                    <i className={`bi ${group.icon || 'bi-grid-fill'}`} style={{ fontSize: "0.9rem", opacity: 0.8 }}></i>
                    <span>{group.title}</span>
                  </div>
                  <i
                    className={`bi bi-chevron-${isExpanded ? "up" : "down"} ms-auto`}
                    style={{ fontSize: "0.8rem", opacity: 0.7 }}
                  ></i>
                </div>

                {isExpanded && !collapsed && (
                  <div className="ps-3 pe-2 pb-2">
                    {group.items.map((item) => (
                      <Link
                        key={item.to}
                        to={item.to}
                        className={`staff-sidebar__link ${isRouteActive(pathname, item.to) ? 'active' : ''}`}
                        style={{ padding: '8px 12px', fontSize: '0.9rem', marginBottom: '2px', background: isRouteActive(pathname, item.to) ? 'rgba(255,255,255,0.15)' : 'transparent', border: 'none' }}
                      >
                        <i className={`bi ${item.icon}`} style={{ fontSize: '0.85rem' }}></i>
                        <span style={{ fontSize: '0.85rem' }}>{item.label}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        <div className="staff-sidebar__footer text-center mt-auto pb-3">
          <div style={{ color: "rgba(255,255,255,0.8)", fontSize: "1.1rem" }}>
            Made by <a href="https://www.twite.ai" target="_blank" rel="noopener noreferrer" style={{ color: "#fff", textDecoration: "none", fontWeight: "bold" }}>Twite AI Technologies</a>
          </div>
        </div>
      </aside>

      <div className="staff-main-wrapper">
        <header className="staff-header staff-header--global">
          <div className="staff-header__brand">
            <button
              type="button"
              className="staff-header__toggle staff-header__toggle--mobile"
              onClick={() => setMobileOpen((prev) => !prev)}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            >
              <i className={`bi ${mobileOpen ? 'bi-x-lg' : 'bi-list'}`}></i>
            </button>
            <div className="staff-header__portal">{brandTitle}</div>
          </div>

          <div className="staff-header__right">
            <div className="d-flex align-items-center gap-3 me-3 text-white border-end pe-3">
              <div className="text-end" style={{ lineHeight: '1.2', display: 'none' }}>
                <div className="fw-bold small">{user?.user_metadata?.full_name || user?.email || 'Admin User'}</div>
                <div className="small opacity-75">{user?.role ? (user.role.charAt(0).toUpperCase() + user.role.slice(1)) : 'Admin'}</div>
              </div>
              <div className="text-end small d-none d-md-block" style={{ lineHeight: '1.2', borderLeft: '1px solid rgba(255,255,255,0.2)', paddingLeft: '1rem' }}>
                <div>{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                <div className="opacity-75">{new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            </div>
            <button className="staff-header__logout" type="button" onClick={handleLogout}>
              <i className="bi bi-box-arrow-right"></i> Logout
            </button>
          </div>
        </header>

        <div className="staff-body">
          <div className="staff-main admin-content">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
