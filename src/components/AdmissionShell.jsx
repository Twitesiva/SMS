import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../store/auth";
import { supabase } from "../../supabaseClient";
import { logActivity } from "../lib/logger";
import logo from "../assets/media/images.png";
import "./AdmissionsPortalShell.css";

const admissionPortalNavGroups = [
    {
        title: 'Admissions Overview',
        static: true,
        items: [
            { to: '/admissions/overview', label: 'Admissions Overview', icon: 'bi-speedometer2' }
        ]
    },
    {
        title: 'Application Review',
        static: true,
        items: [
            { to: '/admissions/review', label: 'Application Review', icon: 'bi-file-earmark-check' }
        ]
    },
    {
        title: 'Student Application',
        static: true,
        items: [
            { to: '/admissions/application', label: 'Student Application', icon: 'bi-window-plus' }
        ]
    },
    {
        title: 'Admissions Enrolled',
        static: true,
        items: [
            { to: '/admissions/confirmed', label: 'Admissions Enrolled', icon: 'bi-person-check' }
        ]
    }
];

const SIDEBAR_SCROLL_KEY = "admission-shell-sidebar-scroll";
const isUuid = (value = "") =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        String(value)
    );

const isRouteActive = (pathname, to) => {
    return pathname === to || pathname.startsWith(`${to}/`)
}

export default function AdmissionShell({
    children,
    onSignOut,
    navGroups,
    brandTitle = "Admission Portal",
    brandSubtitle = "",
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
    const activeNavGroups = navGroups || admissionPortalNavGroups;

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
            className={`admission-shell ${customShellClass} d-grid ${className} ${collapsed ? 'collapsed' : ''}`.trim()}
            style={{ gridTemplateColumns: collapsed ? "88px 1fr" : "330px 1fr" }}
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
                                <div key={`static-${groupIndex}`} className="nav-group static">
                                    {!collapsed && (
                                        <Link
                                            to={item.to}
                                            title={item.label}
                                            className={`nav-group-header item-box fw-bold d-flex align-items-center user-select-none nav-item-modern ${isRouteActive(pathname, item.to) ? "active" : ""}`}
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
                                            className={`nav-item-modern ${isRouteActive(pathname, item.to) ? "active" : ""}`}
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

                        const isActiveGroup = group.items.some((item) => isRouteActive(pathname, item.to));
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

            <main className="admission-main p-4">
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
                <div className="admission-main-scroll">{children}</div>
            </main>
        </div>
    );
}
