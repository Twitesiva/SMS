import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../store/auth";
import { supabase } from "../../supabaseClient";
import { logActivity } from "../lib/logger";
import logo from "../assets/media/images.png";
import "./AdminShell.css";

const examPortalNavGroups = [
  {
    title: "Dashboard",
    static: true,
    items: [{ to: "/admin/dashboard", label: "Dashboard", icon: "bi-grid-fill" }],
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
      { to: "/admin/internal-marks", label: "Internal Marks Entry", icon: "bi-clipboard-check" },
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

const SIDEBAR_SCROLL_KEY = "admin-shell-sidebar-scroll";
const isUuid = (value = "") =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value)
  );

export default function AdminShell({
  children,
  onSignOut,
  navGroups,
  brandTitle = "Exam Management System",
  brandSubtitle = "Arts & Science·Chittoor",
  className = "",
  customSidebarClass = "",
  customShellClass = "",
}) {
  const { pathname } = useLocation();
  const navTo = useNavigate();
  const { signOut, user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({});
  const sidebarRef = useRef(null);

  // Determine which nav groups to use
  const activeNavGroups = navGroups || examPortalNavGroups;

  // Automatically expand the group that contains the current active route
  useEffect(() => {
    const activeGroupIndex = activeNavGroups.findIndex(
      (group) => !group.static && group.items.some((item) => item.to === pathname)
    );
    if (activeGroupIndex !== -1) {
      setExpandedGroups((prev) => ({
        ...prev,
        [activeGroupIndex]: true,
      }));
    } else {
      // Handle static groups effectively
      const staticGroupIndex = activeNavGroups.findIndex(
        (group) => group.static && group.items.some((item) => item.to === pathname)
      );
      if (staticGroupIndex !== -1) {
        setExpandedGroups((prev) => ({
          ...prev,
          [staticGroupIndex]: true,
        }));
      }
    }

    // Log page view
    if (user?.id && isUuid(user.id)) {
      // Find the human-readable label for the current page
      let pageLabel = pathname;
      for (const group of activeNavGroups) {
        const found = group.items.find(item => item.to === pathname);
        if (found) {
          pageLabel = found.label;
          break;
        }
      }

      logActivity(supabase, {
        user,
        role: user.role,
        action: 'VIEW',
        page: pageLabel,
        description: `${(user.role || 'User').charAt(0).toUpperCase() + (user.role || 'user').slice(1).toLowerCase()} viewed page ${pageLabel}`
      });
    }
  }, [pathname, user, activeNavGroups]);

  const toggleGroup = (index) => {
    if (activeNavGroups[index]?.static) return;
    setExpandedGroups((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const handleSignOut = () => {
    const handled = typeof onSignOut === "function" ? onSignOut() : false;
    if (!handled) {
      try {
        signOut();
      } catch { }
      navTo("/");
    }
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
      className={`${customShellClass || 'admin-shell'} d-grid ${className} ${collapsed ? 'collapsed' : ''}`.trim()}
    >
      <aside
        className={`${customSidebarClass || 'sidebar-modern'} d-flex flex-column ${collapsed ? "collapsed" : ""
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
            <div className="sidebar-brand-info">
              <div className="sidebar-brand-title">
                <span className="sidebar-brand-title__main">Vijayam</span>
                <span className="sidebar-brand-title__sub">
                  Arts & Science College
                </span>
              </div>
              {brandSubtitle ? (
                <div
                  className="sidebar-brand-subtitle fw-semibold"
                  style={{ fontSize: "0.85rem", letterSpacing: "0.18em" }}
                >
                  {brandSubtitle}
                </div>
              ) : null}
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
          {activeNavGroups.map((group, groupIndex) => {
            const isStatic = group.static;
            if (isStatic) {
              const item = group.items[0];
              return (
                <div key={`static-${groupIndex}`} className="nav-group">
                  {!collapsed && (
                    <Link
                      to={item.to}
                      title={item.label}
                      className={`nav-group-header item-box fw-bold d-flex align-items-center user-select-none nav-item-modern ${pathname === item.to ? "active" : ""}`}
                      style={{
                        margin: "10px 12px 4px",
                        padding: "12px 16px",
                        borderRadius: "12px",
                        background: "rgba(255, 255, 255, 0.08)",
                        border: "1px solid rgba(255, 255, 255, 0.05)",
                        fontSize: "0.9rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      <div className="d-flex align-items-center gap-2">
                        <i
                          className={`bi ${item.icon}`}
                          style={{ fontSize: "0.9rem", opacity: 0.8 }}
                        ></i>
                        <span className="nav-group-title">{group.title}</span>
                      </div>
                    </Link>
                  )}
                  {collapsed && (
                    <Link
                      to={item.to}
                      title={item.label}
                      className={`nav-item-modern ${pathname === item.to ? "active" : ""}`}
                    >
                      <span className="icon">
                        <i className={`bi ${item.icon}`}></i>
                      </span>
                      <span className="label">{item.label}</span>
                    </Link>
                  )}
                </div>
              );
            }

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
                      <span className="nav-group-title">{group.title}</span>
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
                      className={`nav-item-modern ${pathname === item.to ? "active" : ""}`}
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

        <div className="sidebar-footer text-center mt-auto pb-3">
          <div style={{ color: "rgba(255,255,255,0.8)", fontSize: "1.1rem" }}>
            Made by <a href="https://www.twite.ai" target="_blank" rel="noopener noreferrer" style={{ color: "#fff", textDecoration: "none", fontWeight: "bold" }}>Twite AI Technologies</a>
          </div>
        </div>
      </aside>

      <main className="admin-main p-4">
        <div className="brandbar rounded px-3 py-2 mb-3 d-flex align-items-center justify-content-between header-shadow">
          <div className="brandbar-title">{brandTitle}</div>
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
