import { Link, useLocation, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../store/auth";
import logo from "../assets/media/images.png";
const navGroups = [
  {
    title: "Student Portal",
    items: [
      { to: "/admin/applications", label: "Exam Applications", icon: "bi-inboxes" },
      { to: "/admin/setup/years", label: "Create Academic Years", icon: "bi-calendar3" },
      { to: "/admin/setup/groups", label: "Create Groups & Courses", icon: "bi-diagram-3" },
      { to: "/admin/setup/subjects", label: "Create Subjects", icon: "bi-journal-text" },
      { to: "/admin/students", label: "Students Details", icon: "bi-person-badge" },
      { to: "/admin/departments", label: "Fees Generation", icon: "bi-mortarboard" },
    ],
  },
  {
    title: "Pre-Exam Portal",
    items: [
      { to: "/admin/exams", label: "Create Exam timetable", icon: "bi-journal-check" },
      { to: "/admin/payments", label: "Student Mapping & Payments", icon: "bi-credit-card" },
      { to: "/admin/payments-overview", label: "Decoding", icon: "bi-bar-chart" },
      { to: "/admin/hall-tickets", label: "Hall Ticket", icon: "bi-ticket-perforated" },
    ],
  },
  {
    title: "Post-Exam Portal",
    items: [
      { to: "/admin/results", label: "Marks Entry", icon: "bi-award" },
      { to: "/admin/result-publish", label: "Result Publish", icon: "bi-megaphone" },
    ],
  },
  {
    title: "Reports",
    items: [
      { to: "/admin/reports", label: "Reports", icon: "bi-file-earmark-text" },
    ],
  },
];

const SIDEBAR_SCROLL_KEY = "admin-shell-sidebar-scroll";

export default function AdminShell({ children, onSignOut }) {
  const { pathname } = useLocation();
  const navTo = useNavigate();
  const { signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({});
  const sidebarRef = useRef(null);

  // Automatically expand the group that contains the current active route
  useEffect(() => {
    const activeGroupIndex = navGroups.findIndex((group) =>
      group.items.some((item) => item.to === pathname)
    );
    if (activeGroupIndex !== -1) {
      setExpandedGroups((prev) => ({
        ...prev,
        [activeGroupIndex]: true,
      }));
    }
  }, [pathname]);

  const toggleGroup = (index) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const handleSignOut = () => {
    if (typeof onSignOut === "function") {
      onSignOut();
    } else {
      try {
        signOut();
      } catch { }
    }
    navTo("/");
  };

  // Restore the sidebar scroll position after navigation changes.
  useEffect(() => {
    const navElement = sidebarRef.current;
    if (!navElement) {
      return;
    }
    if (typeof window === "undefined" || !window.sessionStorage) {
      return;
    }
    const storedValue = window.sessionStorage.getItem(SIDEBAR_SCROLL_KEY);
    if (storedValue !== null) {
      const scrollTop = Number(storedValue);
      if (!Number.isNaN(scrollTop)) {
        navElement.scrollTop = scrollTop;
      }
    }
  }, []);

  // Save the scroll offsets so the same section stays visible on the next page.
  useEffect(() => {
    const navElement = sidebarRef.current;
    if (!navElement) {
      return;
    }

    const handleScroll = () => {
      if (typeof window !== "undefined" && window.sessionStorage) {
        window.sessionStorage.setItem(
          SIDEBAR_SCROLL_KEY,
          String(navElement.scrollTop)
        );
      }
    };

    navElement.addEventListener("scroll", handleScroll);
    return () => {
      navElement.removeEventListener("scroll", handleScroll);
    };
  }, [collapsed]);

  return (
    <div
      className="admin-shell d-grid"
      style={{ gridTemplateColumns: collapsed ? "92px 1fr" : "280px 1fr" }}
    >
      <aside
        className={`sidebar-modern d-flex flex-column ${collapsed ? "collapsed" : ""
          }`}
      >
        <div className="sidebar-header">
          <div className="sidebar-brand d-flex align-items-center gap-3">
            <img
              src={logo}
              alt="Vijayam Logo"
              className="brand-logo shadow-sm"
              style={{ width: 80, height: 80, objectFit: "contain" }}
            />
            <div className="sidebar-brand-info text-uppercase">
              <div
                className="heading-font fw-600"
                style={{ letterSpacing: "0.2em", fontSize: "0.95rem" }}
              >
                Vijayam College
              </div>
              <div
                className="sidebar-brand-subtitle fw-semibold"
                style={{ fontSize: "0.85rem", letterSpacing: "0.18em" }}
              >
                Arts & Science<span style={{ padding: "0 0.4rem" }}>&middot;</span>Chittoor
              </div>
            </div>
          </div>
          <button
            className="btn btn-sm btn-toggle"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Expand navigation" : "Collapse navigation"}
          >
            <i
              className={`bi ${collapsed ? "bi-chevron-double-right" : "bi-chevron-double-left"
                }`}
            ></i>
          </button>
        </div>

        <div className="sidebar-divider" />

        <nav
          ref={sidebarRef}
          className="sidebar-nav flex-grow-1 d-flex flex-column gap-1"
        >
          {navGroups.map((group, groupIndex) => {
            // Check if this group contains the active route to highlight the header if needed
            const isActiveGroup = group.items.some((item) => item.to === pathname);
            const isExpanded = expandedGroups[groupIndex];

            return (
              <div key={groupIndex} className="nav-group">
                {!collapsed && (
                  <div
                    className="nav-group-header item-box fw-bold d-flex justify-content-between align-items-center user-select-none"
                    style={{
                      margin: "10px 12px 4px",
                      padding: "12px 16px",
                      borderRadius: "12px",
                      background: "rgba(255, 255, 255, 0.08)",
                      border: "1px solid rgba(255, 255, 255, 0.05)",
                      fontSize: "0.9rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      color: isActiveGroup ? "#fff" : "rgba(255,255,255,0.75)",
                    }}
                    onClick={() => toggleGroup(groupIndex)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
                      e.currentTarget.style.color = "#fff";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                      e.currentTarget.style.color = isActiveGroup ? "#fff" : "rgba(255,255,255,0.75)";
                    }}
                  >
                    <div className="d-flex align-items-center gap-2">
                      <i className="bi bi-grid-fill" style={{ fontSize: "0.9rem", opacity: 0.8 }}></i>
                      {group.title}
                    </div>
                    <i
                      className={`bi bi-chevron-${isExpanded ? "up" : "down"}`}
                      style={{ fontSize: "0.85rem", opacity: 0.7 }}
                    ></i>
                  </div>
                )}
                {collapsed && (
                  <div className="nav-group-divider my-2 border-top mx-3 opacity-25"></div>
                )}
                <div className={!collapsed && !isExpanded ? "d-none" : ""}>
                  {group.items.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      title={item.label}
                      className={`nav-item-modern ${pathname === item.to ? "active" : ""
                        }`}
                    >
                      <span className="icon">
                        <i className={`bi ${item.icon}`}></i>
                      </span>
                      <span className="label">{item.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>


        <div className="sidebar-footer text-center small text-muted">
          <div style={{ color: "#4c75f2", letterSpacing: "0.15em" }}>
            Exam Management Studio
          </div>
          <div style={{ color: "#a569bd" }}>Crafted for Vijayam College</div>
        </div>
      </aside>

      <main className="admin-main p-4">
        <div className="brandbar rounded px-3 py-2 mb-3 d-flex align-items-center justify-content-between header-shadow">
          <div className="brandbar-title">Exam Management System</div>
          <button
            className="btn btn-outline-secondary modern-signout"
            onClick={handleSignOut}
            title="Sign out"
          >
            <i className="bi bi-box-arrow-right me-2"></i>Sign out
          </button>
        </div>
        <div className="admin-main-scroll">{children}</div>
      </main>
    </div>
  );
}
