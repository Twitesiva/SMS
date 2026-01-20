import AdminShell from "../../components/AdminShell";
import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../../lib/mockApi";
import { showToast } from "../../store/ui";

const COLLEGE_NAME = "Vijayam College Arts & Science";

const getInitials = (name) => {
  if (!name) return "S";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export default function StudentPayOverview() {
  const location = useLocation();
  const navigate = useNavigate();
  // Accept either a full `student` object or just `studentId` in location.state
  const passedStudent = location.state?.student ?? null;
  const passedStudentId =
    location.state?.studentId ?? passedStudent?.student_id;
  const passedFilters = location.state?.selectedFilters ?? null;

  const [student, setStudent] = useState(passedStudent);
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState([]);
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (student) return;
      if (!passedStudentId) return;
      setLoading(true);
      try {
        const [students, groupsData, coursesData] = await Promise.all([
          api.listStudents?.(),
          api.listGroups?.(),
          api.listCourses?.(),
        ]);
        setGroups(groupsData || []);
        setCourses(coursesData || []);
        if (cancelled) return;
        const found = (students || []).find(
          (s) =>
            s.student_id === passedStudentId ||
            String(s.id) === String(passedStudentId)
        );
        if (found) setStudent(found);
        else setStudent({ student_id: passedStudentId });
      } catch (err) {
        console.error("Failed to load student:", err);
        showToast("Unable to load student details", { type: "error" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [passedStudentId, student]);

  const photoUrl = student?.photo_url || student?.photo || null;

  const resolveGroupName = () => {
    if (!student) return "N/A";
    const groupVal = student.group || student.group_name || "";
    const g = (groups || []).find(
      (x) =>
        x.code === groupVal ||
        x.group_code === groupVal ||
        x.name === groupVal ||
        x.group_name === groupVal
    );
    return g?.name || groupVal || "N/A";
  };

  const resolveCourseName = () => {
    if (!student) return "N/A";
    const courseVal =
      student.course_name || student.courseName || student.course_id || "";
    const c = (courses || []).find(
      (x) =>
        x.courseCode === courseVal ||
        x.course_code === courseVal ||
        x.courseName === courseVal ||
        x.course_name === courseVal
    );
    return c?.courseName || c?.course_name || courseVal || "N/A";
  };

  return (
    <AdminShell>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="fw-bold mb-0">Student Payment Overview</h2>
          {passedStudentId && (
            <p className="text-muted mb-0">Quick view for {passedStudentId}</p>
          )}
        </div>
        <button
          className="btn btn-outline-secondary"
          onClick={() => {
            if (passedStudentId) {
              if (passedFilters) {
                navigate("/admin/payments", {
                  state: {
                    selectedStudentId: passedStudentId,
                    selectedFilters: passedFilters,
                  },
                });
              } else {
                navigate("/admin/payments", {
                  state: { selectedStudentId: passedStudentId },
                });
              }
            } else {
              navigate(-1);
            }
          }}
        >
          Back to payments
        </button>
      </div>

      <div className="card card-soft p-4">
        {loading ? (
          <div>Loading student details...</div>
        ) : (
          <div className="row align-items-center justify-content-between">
            <div className="col-md-4 d-flex align-items-center gap-3">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={student?.full_name || "Student"}
                  className="rounded-circle"
                  style={{ width: 96, height: 96, objectFit: "cover" }}
                />
              ) : (
                <div
                  className="bg-secondary text-white rounded-circle d-inline-flex align-items-center justify-content-center"
                  style={{ width: 96, height: 96, fontSize: 20 }}
                >
                  {getInitials(student?.full_name)}
                </div>
              )}

              <div>
                <h5 className="mb-1">
                  {student?.full_name || "Unnamed Student"}
                </h5>
                <div className="text-muted">
                  ID: {student?.student_id || passedStudentId || "N/A"}
                </div>
                <div className="text-muted">{COLLEGE_NAME}</div>
              </div>
            </div>

            <div className="col-md-7 d-flex flex-column justify-content-center align-items-end text-end">
              <h5 className="fw-bold">About me</h5>
              <div className="d-flex flex-column gap-2 mt-3">
                <div className="fs-5">{resolveGroupName()}</div>
                <div className="fs-5">{resolveCourseName()}</div>
                <div className="fs-5">{student?.academic_year || "N/A"}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
