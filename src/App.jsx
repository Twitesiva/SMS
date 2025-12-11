import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./store/auth";
import PublicApply from "./pages/PublicApply.jsx";
import Home from "./pages/Home.jsx";
import PublicResults from "./pages/PublicResults.jsx";
import PublicTimeTable from "./pages/PublicTimeTable.jsx";
import ApplicationManual from "./pages/ApplicationManual.jsx";
import AdminApplications from "./pages/AdminApplications.jsx";
import AdminLogin from "./pages/AdminLogin.jsx";
import Batches from "./pages/Batches.jsx";
import Courses from "./pages/Courses.jsx";
import Students from "./pages/Students.jsx";
import Promote from "./pages/Promote.jsx";
import Exams from "./pages/Exams.jsx";
import ExamNameCreation from "./pages/ExamNameCreation.jsx";
import CompleteRegistration from "./pages/CompleteRegistration.jsx";
import Payments from "./pages/Payments.jsx";
import HallTickets from "./pages/HallTickets.jsx";
import Results from "./pages/Results.jsx";
import ResultPublish from "./pages/ResultPublish.jsx";
import Setup from "./pages/Setup.jsx";
import Departments from "./pages/Departments.jsx";
import PaymentsOverview from "./pages/PaymentsOverview.jsx";
import GuardedRoute from "./components/GuardedRoute.jsx";
import Preloader from "./components/Preloader.jsx";
import ToastStack from "./components/ToastStack.jsx";
import StudentPayOverview from "./pages/StudentPayOverview.jsx";
import Reports from "./pages/Reports.jsx";


export default function App() {
  const { user, signOut } = useAuth();
  const isAuthed = !!user;
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/apply" element={<PublicApply />} />
        <Route path="/application" element={<ApplicationManual />} />
        <Route path="/public/results" element={<PublicResults />} />
        <Route path="/public/timetable" element={<PublicTimeTable />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route
          path="/admin"
          element={
            <GuardedRoute isAuthed={isAuthed}>
              <Navigate to="/admin/setup/years" replace />
            </GuardedRoute>
          }
        />
        <Route
          path="/admin/batches"
          element={
            <GuardedRoute isAuthed={isAuthed}>
              <Batches />
            </GuardedRoute>
          }
        />
        <Route
          path="/admin/courses"
          element={
            <GuardedRoute isAuthed={isAuthed}>
              <Courses />
            </GuardedRoute>
          }
        />
        <Route
          path="/admin/students"
          element={
            <GuardedRoute isAuthed={isAuthed}>
              <Students />
            </GuardedRoute>
          }
        />
        <Route
          path="/admin/exam-name-creation"
          element={
            <GuardedRoute isAuthed={isAuthed}>
              <ExamNameCreation />
            </GuardedRoute>
          }
        />
        <Route
          path="/admin/exams"
          element={
            <GuardedRoute isAuthed={isAuthed}>
              <Exams />
            </GuardedRoute>
          }
        />
        <Route
          path="/admin/payments"
          element={
            <GuardedRoute isAuthed={isAuthed}>
              <Payments />
            </GuardedRoute>
          }
        />
        <Route
          path="/admin/payments-overview"
          element={
            <GuardedRoute isAuthed={isAuthed}>
              <PaymentsOverview />
            </GuardedRoute>
          }
        />
        <Route
          path="/admin/complete-registration"
          element={
            <GuardedRoute isAuthed={isAuthed}>
              <CompleteRegistration />
            </GuardedRoute>
          }
        />
        <Route
          path="/admin/hall-tickets"
          element={
            <GuardedRoute isAuthed={isAuthed}>
              <HallTickets />
            </GuardedRoute>
          }
        />
        <Route
          path="/admin/results"
          element={
            <GuardedRoute isAuthed={isAuthed}>
              <Results />
            </GuardedRoute>
          }
        />
        <Route
          path="/admin/result-publish"
          element={
            <GuardedRoute isAuthed={isAuthed}>
              <ResultPublish />
            </GuardedRoute>
          }
        />
        <Route
          path="/admin/promote"
          element={
            <GuardedRoute isAuthed={isAuthed}>
              <Promote />
            </GuardedRoute>
          }
        />
        <Route
          path="/admin/departments"
          element={
            <GuardedRoute isAuthed={isAuthed}>
              <Departments />
            </GuardedRoute>
          }
        />
        <Route
          path="/admin/studentpayoverview"
          element={
            <GuardedRoute isAuthed={isAuthed}>
              <StudentPayOverview />
            </GuardedRoute>
          }
        />
        <Route
          path="/admin/setup"
          element={
            <GuardedRoute isAuthed={isAuthed}>
              <Navigate to="/admin/setup/years" replace />
            </GuardedRoute>
          }
        />
        <Route
          path="/admin/setup/:tab"
          element={
            <GuardedRoute isAuthed={isAuthed}>
              <Setup />
            </GuardedRoute>
          }
        />
        <Route
          path="/admin/reports"
          element={
            <GuardedRoute isAuthed={isAuthed}>
              <Reports />
            </GuardedRoute>
          }
        />
        <Route
          path="/admin/applications"
          element={
            <GuardedRoute isAuthed={isAuthed}>
              <AdminApplications />
            </GuardedRoute>
          }
        />
      </Routes>
      <Preloader />
      <ToastStack />
    </>
  );
}
