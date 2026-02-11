import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useTransportAuth } from "../store/transportAuth";
import logo from "../assets/media/images.png";
import "./TransportPortalShell.css";

const defaultNavGroups = [
  {
    title: "Dashboard",
    static: true,
    items: [{ to: "/transport/dashboard", label: "Dashboard", icon: "bi-grid-fill" }],
  },
  {
    title: "Transport Management",
    items: [
      { to: "/transport/routes", label: "Routes", icon: "bi-map" },
      { to: "/transport/vehicles", label: "Vehicles", icon: "bi-truck" },
    ],
  },
  {
    title: "Student Transport",
    items: [
      { to: "/transport/passes", label: "Bus Passes", icon: "bi-card-heading" },
      { to: "/transport/allocation", label: "Route Allocation", icon: "bi-people" },
    ],
  },
  {
    title: "Reports",
    items: [
      { to: "/transport/reports", label: "Reports", icon: "bi-file-earmark-text" },
    ],
  },
];

const SIDEBAR_SCROLL_KEY = "transport-shell-sidebar-scroll";

const isRouteActive = (pathname, to) => {
  return pathname === to || pathname.startsWith(`${to}/`);
};

export default function TransportPortalShell({
  children,
  onSignOut,
  navGroups,
  brandTitle = "Transport Portal",
  brandSubtitle = "",
  className = "",
  customSidebarClass = "sidebar-modern transport-sidebar-modern",
  customShellClass = "transport-shell",
}) {
  const { pathname } = useLocation();
  const navTo = useNavigate();
  const { signOut } = useTransportAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({});
  const sidebarRef = useRef(null);

  const activeNavGroups = navGroups || defaultNavGroups;

  useEffect(() => {
    const activeGroupIndex = activeNavGroups.findIndex(
      (group) =>
        !group.static && group.items.some((item) => isRouteActive(pathname, item.to))
    );
    if (activeGroupIndex !== -1) {
      setExpandedGroups((prev) => ({ ...prev, [activeGroupIndex]: true }));
    } else {
      const staticGroupIndex = activeNavGroups.findIndex(
        (group) =>
          group.static && group.items.some((item) => isRouteActive(pathname, item.to))
      );
      if (staticGroupIndex !== -1) {
        setExpandedGroups((prev) => ({ ...prev, [staticGroupIndex]: true }));
      }
    }
  }, [pathname, activeNavGroups]);

  const toggleGroup = (index) => {
    if (activeNavGroups[index]?.static) return;
    setExpandedGroups((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const handleSignOut = () => {
    const handled = typeof onSignOut === "function" ? onSignOut() : false;
    if (!handled) {
      signOut();
      navTo("/transport/login");
    }
  };

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
      className={`admin-shell ${customShellClass} d-grid ${className} ${collapsed ? "collapsed" : ""
        }`.trim()}
    >
      <aside
        className={`${customSidebarClass || "sidebar-modern"} d-flex flex-column ${collapsed ? "collapsed" : ""
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
              const isActive = isRouteActive(pathname, item.to);
              return (
                <div key={`static-${groupIndex}`} className="nav-group static">
                  {!collapsed && (
                    <Link
                      to={item.to}
                      title={item.label}
                      className={`nav-group-header item-box fw-bold d-flex align-items-center user-select-none nav-item-modern ${isActive ? "active" : ""
                        }`}
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
                      className={`nav-item-modern ${isActive ? "active" : ""}`}
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

            const isActiveGroup = group.items.some((item) =>
              isRouteActive(pathname, item.to)
            );
            const isExpanded = expandedGroups[groupIndex];

            return (
              <div key={groupIndex} className="nav-group">
                {!collapsed && (
                  <div
                    className={`nav-group-header item-box fw-bold d-flex justify-content-between align-items-center user-select-none ${isActiveGroup ? "active-group" : ""
                      }`}
                    onClick={() => toggleGroup(groupIndex)}
                  >
                    <div className="d-flex align-items-center gap-2">
                      <i
                        className="bi bi-grid-fill"
                        style={{ fontSize: "0.9rem", opacity: 0.8 }}
                      ></i>
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
                      className={`nav-item-modern ${isRouteActive(pathname, item.to) ? "active" : ""
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

        <div className="sidebar-footer text-center mt-auto pb-3">
          <div style={{ color: "rgba(255,255,255,0.8)", fontSize: "1.1rem" }}>
            Made by{" "}
            <a
              href="https://www.twite.ai"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "#fff",
                textDecoration: "none",
                fontWeight: "bold",
              }}
            >
              Twite AI Technologies
            </a>
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
            <i className="bi bi-box-arrow-right me-2"></i><span className="d-none d-sm-inline">Sign out</span>
          </button>
        </div>
        <div className="admin-main-scroll">{children}</div>
      </main>
    </div>
  );
}
