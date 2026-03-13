import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./store/auth";
import { useStaffAuth } from "./store/staffAuth";
import Home from "./pages/common/Home.jsx";
import Intro from "./pages/common/Intro.jsx";
import RoleSelection from "./pages/common/RoleSelection.jsx";
import GuardedRoute from "./components/GuardedRoute.jsx";
import Preloader from "./components/Preloader.jsx";
import ToastStack from "./components/ToastStack.jsx";

import AdminLogin from "./pages/admin/AdminLogin.jsx";
import ProfileCreation from "./pages/admin/ProfileCreation.jsx";
import FeesCreation from "./pages/admin/FeesCreation.jsx";
import AcademicYears from "./pages/admin/AcademicYears.jsx";
import GroupsCourses from "./pages/admin/GroupsCourses.jsx";
import Subjects from "./pages/admin/Subjects.jsx";
import FeesCollection from "./pages/admin/FeesCollection.jsx";
import PaymentReports from "./pages/admin/PaymentReports.jsx";
import ClassTimeTable from "./pages/admin/ClassTimeTable.jsx";
import ClassTimeTableCreation from "./pages/admin/ClassTimeTableCreation.jsx";
import Circulars from "./pages/admin/Circulars.jsx";
import AdminApplications from "./pages/admin/AdminApplications.jsx";
import MainDashboard from "./pages/admin/MainDashboard.jsx";
import AdminStudents from "./pages/admin/Students.jsx";
import AdminStaff from "./pages/admin/Staff.jsx";
import StaffSubjectMapping from "./pages/admin/StaffSubjectMapping.jsx";

import StaffLogin from "./pages/staff/StaffLogin.jsx";
import StaffDashboard from "./pages/staff/StaffDashboard.jsx";
import StaffStudentAttendance from "./pages/staff/StudentAttendance.jsx";
import StudentRecords from "./pages/staff/StudentRecords.jsx";
import AcademicTimetable from "./pages/staff/AcademicTimetable.jsx";
import PerformanceFeedback from "./pages/staff/PerformanceFeedback.jsx";
import LearningMaterials from "./pages/staff/LearningMaterials.jsx";
import MyAttendance from "./pages/staff/MyAttendance.jsx";
import LeaveManagement from "./pages/staff/LeaveManagement.jsx";
import StaffCirculars from "./pages/staff/StaffCirculars.jsx";

export default function App() {
  const { user } = useAuth();
  const { staff } = useStaffAuth();

  const isAuthed = !!user;
  const isStaffAuthed = !!staff;

  return (
    <>
      <Routes>
        <Route path="/" element={<Intro />} />
        <Route path="/home" element={<Home />} />
        <Route path="/roles" element={<RoleSelection />} />

        <Route path="/admin-portal/login" element={<AdminLogin />} />
        <Route
          path="/admin-portal"
          element={
            <GuardedRoute isAuthed={isAuthed} redirectTo="/admin-portal/login">
              <Navigate to="/admin-portal/main-dashboard" replace />
            </GuardedRoute>
          }
        />
        <Route
          path="/admin-portal/profile-creation"
          element={
            <GuardedRoute isAuthed={isAuthed} redirectTo="/admin-portal/login">
              <ProfileCreation />
            </GuardedRoute>
          }
        />
        <Route
          path="/admin-portal/fees-creation"
          element={
            <GuardedRoute isAuthed={isAuthed} redirectTo="/admin-portal/login">
              <FeesCreation />
            </GuardedRoute>
          }
        />
        <Route
          path="/admin-portal/fees-collection"
          element={
            <GuardedRoute isAuthed={isAuthed} redirectTo="/admin-portal/login">
              <FeesCollection />
            </GuardedRoute>
          }
        />
        <Route
          path="/admin-portal/payment-reports"
          element={
            <GuardedRoute isAuthed={isAuthed} redirectTo="/admin-portal/login">
              <PaymentReports />
            </GuardedRoute>
          }
        />
        <Route
          path="/admin-portal/academic-years"
          element={
            <GuardedRoute isAuthed={isAuthed} redirectTo="/admin-portal/login">
              <AcademicYears />
            </GuardedRoute>
          }
        />
        <Route
          path="/admin-portal/groups-courses"
          element={
            <GuardedRoute isAuthed={isAuthed} redirectTo="/admin-portal/login">
              <GroupsCourses />
            </GuardedRoute>
          }
        />
        <Route
          path="/admin-portal/subjects"
          element={
            <GuardedRoute isAuthed={isAuthed} redirectTo="/admin-portal/login">
              <Subjects />
            </GuardedRoute>
          }
        />
        <Route
          path="/admin-portal/class-time-table"
          element={
            <GuardedRoute isAuthed={isAuthed} redirectTo="/admin-portal/login">
              <ClassTimeTable />
            </GuardedRoute>
          }
        />
        <Route
          path="/admin-portal/class-time-table-creation"
          element={
            <GuardedRoute isAuthed={isAuthed} redirectTo="/admin-portal/login">
              <ClassTimeTableCreation />
            </GuardedRoute>
          }
        />
        <Route
          path="/admin-portal/circulars"
          element={
            <GuardedRoute isAuthed={isAuthed} redirectTo="/admin-portal/login">
              <Circulars />
            </GuardedRoute>
          }
        />
        <Route
          path="/admin-portal/main-dashboard"
          element={
            <GuardedRoute isAuthed={isAuthed} redirectTo="/admin-portal/login">
              <MainDashboard />
            </GuardedRoute>
          }
        />
        <Route
          path="/admin-portal/applications"
          element={
            <GuardedRoute isAuthed={isAuthed} redirectTo="/admin-portal/login">
              <AdminApplications />
            </GuardedRoute>
          }
        />
        <Route
          path="/admin-portal/students"
          element={
            <GuardedRoute isAuthed={isAuthed} redirectTo="/admin-portal/login">
              <AdminStudents />
            </GuardedRoute>
          }
        />
        <Route
          path="/admin-portal/staff"
          element={
            <GuardedRoute isAuthed={isAuthed} redirectTo="/admin-portal/login">
              <AdminStaff />
            </GuardedRoute>
          }
        />
        <Route
          path="/admin-portal/subject-mapping"
          element={
            <GuardedRoute isAuthed={isAuthed} redirectTo="/admin-portal/login">
              <StaffSubjectMapping />
            </GuardedRoute>
          }
        />

        <Route path="/staff/login" element={<StaffLogin />} />
        <Route
          path="/staff"
          element={
            <GuardedRoute isAuthed={isStaffAuthed} redirectTo="/staff/login">
              <Navigate to="/staff/dashboard" replace />
            </GuardedRoute>
          }
        />
        <Route
          path="/staff/dashboard"
          element={
            <GuardedRoute isAuthed={isStaffAuthed} redirectTo="/staff/login">
              <StaffDashboard />
            </GuardedRoute>
          }
        />
        <Route
          path="/staff/attendance"
          element={
            <GuardedRoute isAuthed={isStaffAuthed} redirectTo="/staff/login">
              <StaffStudentAttendance />
            </GuardedRoute>
          }
        />
        <Route
          path="/staff/students"
          element={
            <GuardedRoute isAuthed={isStaffAuthed} redirectTo="/staff/login">
              <StudentRecords />
            </GuardedRoute>
          }
        />
        <Route
          path="/staff/timetable"
          element={
            <GuardedRoute isAuthed={isStaffAuthed} redirectTo="/staff/login">
              <AcademicTimetable />
            </GuardedRoute>
          }
        />
        <Route
          path="/staff/performance"
          element={
            <GuardedRoute isAuthed={isStaffAuthed} redirectTo="/staff/login">
              <PerformanceFeedback />
            </GuardedRoute>
          }
        />
        <Route
          path="/staff/circulars"
          element={
            <GuardedRoute isAuthed={isStaffAuthed} redirectTo="/staff/login">
              <StaffCirculars />
            </GuardedRoute>
          }
        />
        <Route
          path="/staff/materials"
          element={
            <GuardedRoute isAuthed={isStaffAuthed} redirectTo="/staff/login">
              <LearningMaterials />
            </GuardedRoute>
          }
        />
        <Route
          path="/staff/my-attendance"
          element={
            <GuardedRoute isAuthed={isStaffAuthed} redirectTo="/staff/login">
              <MyAttendance />
            </GuardedRoute>
          }
        />
        <Route
          path="/staff/leave"
          element={
            <GuardedRoute isAuthed={isStaffAuthed} redirectTo="/staff/login">
              <LeaveManagement />
            </GuardedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/roles" replace />} />
      </Routes>
      <Preloader />
      <ToastStack />
    </>
  );
}
