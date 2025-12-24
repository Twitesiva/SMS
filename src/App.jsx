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
import CreateExam from "./pages/CreateExam.jsx";
import ExamNameCreation from "./pages/ExamNameCreation.jsx";
import CompleteRegistration from "./pages/CompleteRegistration.jsx";
import SubjectMapping from "./pages/SubjectMapping.jsx";
import HallTickets from "./pages/HallTickets.jsx";
import SeatAllocation from "./pages/SeatAllocation.jsx";
import MarksEntry from "./pages/MarksEntry.jsx";
import ResultPublish from "./pages/ResultPublish.jsx";
import Setup from "./pages/Setup.jsx";
import FeesGeneration from "./pages/FeesGeneration.jsx";
import Decode from "./pages/Decode.jsx";
import GuardedRoute from "./components/GuardedRoute.jsx";
import Preloader from "./components/Preloader.jsx";
import ToastStack from "./components/ToastStack.jsx";
import StudentPayOverview from "./pages/StudentPayOverview.jsx";
import Reports from "./pages/Reports.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Revaluation from "./pages/Revaluation.jsx";
import MarksReports from "./pages/MarksReports.jsx";
import InternalMarks from "./pages/InternalMarks.jsx";
import History from "./pages/History.jsx";


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
              <Navigate to="/admin/dashboard" replace />
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
          path="/admin/create-exam"
          element={
            <GuardedRoute isAuthed={isAuthed}>
              <CreateExam />
            </GuardedRoute>
          }
        />
        <Route
          path="/admin/subject-mapping"
          element={
            <GuardedRoute isAuthed={isAuthed}>
              <SubjectMapping />
            </GuardedRoute>
          }
        />
        <Route
          path="/admin/decode"
          element={
            <GuardedRoute isAuthed={isAuthed}>
              <Decode />
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
          path="/admin/seat-allocation"
          element={
            <GuardedRoute isAuthed={isAuthed}>
              <SeatAllocation />
            </GuardedRoute>
          }
        />
        <Route
          path="/admin/marks-entry"
          element={
            <GuardedRoute isAuthed={isAuthed}>
              <MarksEntry />
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
          path="/admin/internal-marks"
          element={
            <GuardedRoute isAuthed={isAuthed}>
              <InternalMarks />
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
          path="/admin/revaluation"
          element={
            <GuardedRoute isAuthed={isAuthed}>
              <Revaluation />
            </GuardedRoute>
          }
        />
        <Route
          path="/admin/fees-generation"
          element={
            <GuardedRoute isAuthed={isAuthed}>
              <FeesGeneration />
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
          path="/admin/marks-reports"
          element={
            <GuardedRoute isAuthed={isAuthed}>
              <MarksReports />
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
        <Route
          path="/admin/history"
          element={
            <GuardedRoute isAuthed={isAuthed}>
              <History />
            </GuardedRoute>
          }
        />
        <Route
          path="/admin/dashboard"
          element={
            <GuardedRoute isAuthed={isAuthed}>
              <Dashboard />
            </GuardedRoute>
          }
        />
      </Routes>
      <Preloader />
      <ToastStack />
    </>
  );
}
