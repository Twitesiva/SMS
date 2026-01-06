import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./store/auth";
import { useStudentAuth } from "./store/studentAuth";
import { useStaffAuth } from "./store/staffAuth";
import PublicApply from "./pages/common/PublicApply.jsx";
import Home from "./pages/common/Home.jsx";
import Intro from "./pages/common/Intro.jsx";
import RoleSelection from "./pages/common/RoleSelection.jsx";
import AdmissionPortal from "./pages/common/AdmissionPortal.jsx";


import PublicResults from "./pages/common/PublicResults.jsx";
import PublicTimeTable from "./pages/common/PublicTimeTable.jsx";
import ApplicationManual from "./pages/common/ApplicationManual.jsx";
import ApplicationLogin from "./pages/common/ApplicationLogin.jsx";
import ApplicationTracker from "./pages/common/ApplicationTracker.jsx";
import Circulars from "./pages/admin/Circulars.jsx";
import AdminApplications from "./pages/admin/AdminApplications.jsx";
import AdmissionsLogin from "./pages/admissions/AdminLogin.jsx";
import AdminLogin from "./pages/admin/AdminLogin.jsx";
import ProfileCreation from "./pages/admin/ProfileCreation.jsx";
import FeesCreation from "./pages/admin/FeesCreation.jsx";
import AcademicYears from "./pages/admin/AcademicYears.jsx";
import GroupsCourses from "./pages/admin/GroupsCourses.jsx";
import Subjects from "./pages/admin/Subjects.jsx";
import FeesCollection from "./pages/admin/FeesCollection.jsx";
import ClassTimeTable from "./pages/admin/ClassTimeTable.jsx";
import ClassTimeTableCreation from "./pages/admin/ClassTimeTableCreation.jsx";
import LibraryLogin from "./pages/library/LibraryLogin.jsx";
import LibraryDashboard from "./pages/library/LibraryDashboard.jsx";
import LibraryBooks from "./pages/library/Books.jsx";
import LibraryAllBooks from "./pages/library/AllBooks.jsx";
import LibraryInventoryInsights from "./pages/library/InventoryInsights.jsx";
import LibraryCirculation from "./pages/library/Circulation.jsx";
import LibraryFines from "./pages/library/Fines.jsx";
import LibraryReports from "./pages/library/Reports.jsx";

import StaffSubjectMapping from "./pages/admin/StaffSubjectMapping.jsx";

import ExamLogin from "./pages/exam/ExamLogin.jsx";
import StudentLogin from "./pages/student/StudentLogin.jsx";
import StaffLogin from "./pages/staff/StaffLogin.jsx";
import StudentDashboard from "./pages/student/StudentDashboard.jsx";
import StaffDashboard from "./pages/staff/StaffDashboard.jsx";
import StudentAttendance from "./pages/staff/StudentAttendance.jsx";
import StudentRecords from "./pages/staff/StudentRecords.jsx";
import AcademicTimetable from "./pages/staff/AcademicTimetable.jsx";
import PerformanceFeedback from "./pages/staff/PerformanceFeedback.jsx";
import Announcements from "./pages/staff/Announcements.jsx";
import LearningMaterials from "./pages/staff/LearningMaterials.jsx";
import MyAttendance from "./pages/staff/MyAttendance.jsx";
import LeaveManagement from "./pages/staff/LeaveManagement.jsx";
import StudentSection from "./pages/student/StudentSection.jsx";


import StudentPersonalDetails from "./pages/student/StudentPersonalDetails.jsx";
import StudentSubjectList from "./pages/student/StudentSubjectList.jsx";
import StudentCertificate from "./pages/student/StudentCertificate.jsx";
import StudentFeePayment from "./pages/student/StudentFeePayment.jsx";
import StudentHostelDetails from "./pages/student/StudentHostelDetails.jsx";
import StudentTimeTable from "./pages/student/StudentTimeTable.jsx";
import StudentLeaveRequest from "./pages/student/StudentLeaveRequest.jsx";
import Batches from "./pages/exam/Batches.jsx";
import Courses from "./pages/exam/Courses.jsx";
import Students from "./pages/exam/Students.jsx";
import Promote from "./pages/exam/Promote.jsx";
import CreateExam from "./pages/exam/CreateExam.jsx";
import ExamNameCreation from "./pages/exam/ExamNameCreation.jsx";
import CompleteRegistration from "./pages/exam/CompleteRegistration.jsx";
import SubjectMapping from "./pages/exam/SubjectMapping.jsx";
import HallTickets from "./pages/exam/HallTickets.jsx";
import SeatAllocation from "./pages/exam/SeatAllocation.jsx";
import MarksEntry from "./pages/exam/MarksEntry.jsx";
import ResultPublish from "./pages/exam/ResultPublish.jsx";
import Setup from "./pages/exam/Setup.jsx";
import FeesGeneration from "./pages/exam/FeesGeneration.jsx";
import Decode from "./pages/exam/Decode.jsx";
import GuardedRoute from "./components/GuardedRoute.jsx";
import Preloader from "./components/Preloader.jsx";
import ToastStack from "./components/ToastStack.jsx";
import StudentPayOverview from "./pages/exam/StudentPayOverview.jsx";
import Reports from "./pages/exam/Reports.jsx";
import Dashboard from "./pages/exam/Dashboard.jsx";
import Revaluation from "./pages/exam/Revaluation.jsx";
import MarksReports from "./pages/exam/MarksReports.jsx";
import InternalMarks from "./pages/exam/InternalMarks.jsx";
import History from "./pages/exam/History.jsx";
import AdmissionsOverview from "./pages/admissions/AdmissionsOverview.jsx";
import ApplicationReview from "./pages/admissions/ApplicationReview";
import ConfirmedAdmissions from "./pages/admissions/ConfirmedAdmissions.jsx";
import AdmissionsApplication from "./pages/admissions/AdmissionsApplication.jsx";


export default function App() {
  const { user, signOut } = useAuth();
  const { student } = useStudentAuth();
  const { staff } = useStaffAuth();
  const isAuthed = !!user;
  const isStudentAuthed = !!student;
  const isStaffAuthed = !!staff;
  return (
    <>
      <Routes>
        <Route path="/" element={<Intro />} />
        <Route path="/home" element={<Home />} />
        <Route path="/roles" element={<RoleSelection />} />
        <Route path="/admission" element={<AdmissionPortal />} />



        <Route path="/apply" element={<PublicApply />} />
        <Route path="/admission/login" element={<ApplicationLogin />} />
        <Route path="/admission/tracker" element={<ApplicationTracker />} />
        <Route path="/application" element={<ApplicationManual />} />
        <Route path="/public/results" element={<PublicResults />} />
        <Route path="/public/timetable" element={<PublicTimeTable />} />
        <Route path="/admin/login" element={<ExamLogin />} />
        <Route path="/admin-portal/login" element={<AdminLogin />} />
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
          path="/admin-portal/applications"
          element={
            <GuardedRoute isAuthed={isAuthed} redirectTo="/admin-portal/login">
              <AdminApplications />
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
        <Route path="/admissions/login" element={<AdmissionsLogin />} />
        <Route path="/student/login" element={<StudentLogin />} />
        <Route path="/staff/login" element={<StaffLogin />} />
        <Route path="/library/login" element={<LibraryLogin />} />
        <Route path="/library" element={<LibraryDashboard />} />
        <Route path="/library/books" element={<LibraryBooks />} />
        <Route path="/library/books/all" element={<LibraryAllBooks />} />
        <Route path="/library/inventory" element={<LibraryInventoryInsights />} />
        <Route path="/library/circulation" element={<LibraryCirculation />} />
        <Route path="/library/fines" element={<LibraryFines />} />
        <Route path="/library/reports" element={<LibraryReports />} />
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
              <StudentAttendance />
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
          path="/staff/announcements"
          element={
            <GuardedRoute isAuthed={isStaffAuthed} redirectTo="/staff/login">
              <Announcements />
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
        <Route
          path="/admin/admissions-overview"
          element={
            <GuardedRoute isAuthed={isAuthed}>
              <Navigate to="/admissions/overview" replace />
            </GuardedRoute>
          }
        />
        <Route
          path="/admissions/overview"
          element={
            <GuardedRoute isAuthed={isAuthed} redirectTo="/admissions/login">
              <AdmissionsOverview />
            </GuardedRoute>
          }
        />
        <Route
          path="/admissions/review"
          element={
            <GuardedRoute isAuthed={isAuthed} redirectTo="/admissions/login">
              <ApplicationReview />
            </GuardedRoute>
          }
        />
        <Route
          path="/admissions/application"
          element={
            <GuardedRoute isAuthed={isAuthed} redirectTo="/admissions/login">
              <AdmissionsApplication />
            </GuardedRoute>
          }
        />
        <Route
          path="/admissions/confirmed"
          element={
            <GuardedRoute isAuthed={isAuthed} redirectTo="/admissions/login">
              <ConfirmedAdmissions />
            </GuardedRoute>
          }
        />
        <Route
          path="/student/dashboard"
          element={
            <GuardedRoute isAuthed={isStudentAuthed} redirectTo="/student/login">
              <StudentDashboard />
            </GuardedRoute>
          }
        />
        <Route
          path="/student/personal-details"
          element={
            <GuardedRoute isAuthed={isStudentAuthed} redirectTo="/student/login">
              <StudentPersonalDetails />
            </GuardedRoute>
          }
        />
        <Route
          path="/student/course-list"
          element={
            <GuardedRoute isAuthed={isStudentAuthed} redirectTo="/student/login">
              <StudentSubjectList />
            </GuardedRoute>
          }
        />
        <Route
          path="/student/certificate"
          element={
            <GuardedRoute isAuthed={isStudentAuthed} redirectTo="/student/login">
              <StudentCertificate />
            </GuardedRoute>
          }
        />
        <Route
          path="/student/leave-request"
          element={
            <GuardedRoute isAuthed={isStudentAuthed} redirectTo="/student/login">
              <StudentLeaveRequest />
            </GuardedRoute>
          }
        />
        <Route
          path="/student/fee-payment"
          element={
            <GuardedRoute isAuthed={isStudentAuthed} redirectTo="/student/login">
              <StudentFeePayment />
            </GuardedRoute>
          }
        />
        <Route
          path="/student/hostel-details"
          element={
            <GuardedRoute isAuthed={isStudentAuthed} redirectTo="/student/login">
              <StudentHostelDetails />
            </GuardedRoute>
          }
        />
        <Route
          path="/student/time-table"
          element={
            <GuardedRoute isAuthed={isStudentAuthed} redirectTo="/student/login">
              <StudentTimeTable />
            </GuardedRoute>
          }
        />
        <Route
          path="/student/:section"
          element={
            <GuardedRoute isAuthed={isStudentAuthed} redirectTo="/student/login">
              <StudentSection />
            </GuardedRoute>
          }
        />
      </Routes>
      <Preloader />
      <ToastStack />
    </>
  );
}
