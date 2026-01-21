import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTransportAuth } from "../store/transportAuth";
import logo from "../assets/media/images.png";
import AdminShell from "./AdminShell";
import "./AdminShell.css";
import "./TransportShell.css";

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

export default function TransportShell({ children, navGroups = defaultNavGroups, brandTitle = "Transport Portal" }) {
  const { pathname } = useLocation();
  const navTo = useNavigate();
  const { transportUser, signOut } = useTransportAuth();

  const handleSignOut = () => {
    signOut();
    navTo("/transport/login");
  };

  return (
    <AdminShell
      navGroups={navGroups}
      brandTitle={brandTitle}
      brandSubtitle=""
      customSidebarClass="sidebar-modern transport-sidebar-modern"
      customShellClass="transport-shell"
      onSignOut={handleSignOut}
    >
      {children}
    </AdminShell>
  );
}
