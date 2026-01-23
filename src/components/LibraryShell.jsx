import { Outlet } from "react-router-dom";
import AdShellAdmin from "./AdShellAdmin";
import { libraryNavGroups } from "../pages/library/nav";

export default function LibraryShell({
  children,
  navGroups,
  brandTitle = "LIBRARY PORTAL",
}) {
  const activeNavGroups = navGroups || libraryNavGroups;

  return (
    <AdShellAdmin navGroups={activeNavGroups} brandTitle={brandTitle}>
      {children ?? <Outlet />}
    </AdShellAdmin>
  );
}
