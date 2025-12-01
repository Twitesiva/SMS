import { useEffect, useMemo, useState } from "react";
import AdminShell from "../components/AdminShell";
import { supabase } from "../../supabaseClient";

export default function PaymentsOverview() {
  const [studentIdInput, setStudentIdInput] = useState("");
  const [searchingStudent, setSearchingStudent] = useState(false);
  const [studentError, setStudentError] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [availableSemesters, setAvailableSemesters] = useState([]);
  const [selectedSemester, setSelectedSemester] = useState("");
  const [subjects, setSubjects] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [subjectsError, setSubjectsError] = useState("");
  const [visibleDecodeRows, setVisibleDecodeRows] = useState({});
  const [subjectCodeInput, setSubjectCodeInput] = useState("");
  const [subjectSearchLoading, setSubjectSearchLoading] = useState(false);
  const [subjectSearchError, setSubjectSearchError] = useState("");
  const [subjectStudents, setSubjectStudents] = useState([]);

  const handleSearchStudent = async () => {
    const trimmed = studentIdInput.trim();
    if (!trimmed) {
      setStudentError("Enter a student ID.");
      setSelectedStudent(null);
      setAvailableSemesters([]);
      setSelectedSemester("");
      setSubjects([]);
      return;
    }

    setSearchingStudent(true);
    setStudentError("");
    setSelectedStudent(null);
    setAvailableSemesters([]);
    setSelectedSemester("");
    setSubjects([]);

    try {
      const { data: student, error } = await supabase
        .from("students")
        .select("*")
        .eq("student_id", trimmed)
        .maybeSingle();

      if (error) throw error;
      if (!student) {
        setStudentError("No student found for this ID.");
        return;
      }

      setSelectedStudent(student);
      await loadSemestersForStudent(student.id);
    } catch (e) {
      console.error("Error searching student:", e);
      setStudentError("Failed to search student. Please try again.");
    } finally {
      setSearchingStudent(false);
    }
  };

  const loadSemestersForStudent = async (studentInternalId) => {
    try {
      const { data, error } = await supabase
        .from("exam_registrations")
        .select("semester")
        .eq("student_id", studentInternalId);

      if (error) throw error;

      const values = new Set();
      (data || []).forEach((row) => {
        if (row && row.semester !== null && row.semester !== undefined) {
          values.add(String(row.semester));
        }
      });
      const sorted = Array.from(values).sort((a, b) => {
        const numA = Number(a);
        const numB = Number(b);
        if (!Number.isNaN(numA) && !Number.isNaN(numB)) return numA - numB;
        return a.localeCompare(b, undefined, { numeric: true });
      });
      setAvailableSemesters(sorted);
    } catch (e) {
      console.error("Error loading semesters:", e);
      setStudentError("Failed to load semesters for this student.");
    }
  };

  const handleSemesterChange = async (value) => {
    setSelectedSemester(value);
    setSubjects([]);
    setSubjectsError("");
    if (!value || !selectedStudent) return;
    await loadSubjectsForStudentAndSemester(selectedStudent.id, value);
  };

  const loadSubjectsForStudentAndSemester = async (studentInternalId, semesterValue) => {
    setLoadingSubjects(true);
    setSubjectsError("");
    try {
      const { data, error } = await supabase
        .from("exam_registrations")
        .select("id, semester, exam_registration_subjects(id, subject_name, subject_code)")
        .eq("student_id", studentInternalId)
        .eq("semester", Number(semesterValue));

      if (error) throw error;

      const baseSubjectRows = [];
      const subjectIds = new Set();

      (data || []).forEach((registration) => {
        (registration.exam_registration_subjects || []).forEach((subj) => {
          if (!subj || subj.id === undefined || subj.id === null) return;
          baseSubjectRows.push({
            exam_registration_subject_id: subj.id,
            subject_name: subj.subject_name,
            subject_code: subj.subject_code,
          });
          subjectIds.add(subj.id);
        });
      });

      let decodeMap = new Map();
      if (subjectIds.size > 0) {
        const { data: decodeData, error: decodeError } = await supabase
          .from("decode_numbers")
          .select("exam_registration_subject_id, decode_no")
          .in("exam_registration_subject_id", Array.from(subjectIds));

        if (decodeError) throw decodeError;

        decodeMap = new Map();
        (decodeData || []).forEach((row) => {
          if (!row) return;
          const key = row.exam_registration_subject_id;
          if (!decodeMap.has(key)) {
            decodeMap.set(key, []);
          }
          decodeMap.get(key).push(row.decode_no);
        });
      }

      const subjectRows = [];
      baseSubjectRows.forEach((row) => {
        const decodes = decodeMap.get(row.exam_registration_subject_id) || [null];
        decodes.forEach((decode_no) => {
          subjectRows.push({
            subject_name: row.subject_name,
            subject_code: row.subject_code,
            decode_no,
          });
        });
      });

      const seen = new Set();
      const uniqueSubjects = subjectRows.filter((row) => {
        const key = `${row.subject_name || ""}|${row.subject_code || ""}|${row.decode_no || ""}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setSubjects(uniqueSubjects);
    } catch (e) {
      console.error("Error loading subjects/decode numbers:", e);
      setSubjectsError("Failed to load subjects and decode numbers.");
    } finally {
      setLoadingSubjects(false);
    }
  };

  const handleSearchBySubjectCode = async () => {
    const trimmed = subjectCodeInput.trim();
    if (!trimmed) {
      setSubjectSearchError("Enter a subject code.");
      setSubjectStudents([]);
      return;
    }

    setSubjectSearchLoading(true);
    setSubjectSearchError("");
    setSubjectStudents([]);

    try {
      const { data: subjectRows, error: subjectError } = await supabase
        .from("exam_registration_subjects")
        .select("id, exam_registration_id, subject_name, subject_code")
        .eq("subject_code", trimmed);

      if (subjectError) throw subjectError;

      const examRegistrationIds = Array.from(
        new Set((subjectRows || []).map((row) => row.exam_registration_id).filter(Boolean))
      );

      if (!examRegistrationIds.length) {
        setSubjectSearchError("No students found for this subject code.");
        return;
      }

      const { data: registrations, error: registrationsError } = await supabase
        .from("exam_registrations")
        .select("id, student_id, academic_year, group_name, course_name")
        .in("id", examRegistrationIds);

      if (registrationsError) throw registrationsError;

      const studentInternalIds = Array.from(
        new Set((registrations || []).map((row) => row.student_id).filter(Boolean))
      );

      if (!studentInternalIds.length) {
        setSubjectSearchError("No students found for this subject code.");
        return;
      }

      const { data: studentsData, error: studentsError } = await supabase
        .from("students")
        .select("id, student_id, full_name, academic_year, group_name, course_name")
        .in("id", studentInternalIds);

      if (studentsError) throw studentsError;

      const studentMap = new Map();
      (studentsData || []).forEach((student) => {
        if (!student) return;
        studentMap.set(student.id, student);
      });

      const groupCodeSet = new Set(
        (studentsData || [])
          .map((s) => s.group_name)
          .filter((code) => code !== null && code !== undefined)
      );
      const courseCodeSet = new Set(
        (studentsData || [])
          .map((s) => s.course_name)
          .filter((code) => code !== null && code !== undefined)
      );

      const groupNameMap = new Map();
      if (groupCodeSet.size > 0) {
        const { data: groupsData, error: groupsError } = await supabase
          .from("groups")
          .select("group_code, group_name");

        if (groupsError) throw groupsError;

        (groupsData || []).forEach((g) => {
          if (!g || g.group_code === null || g.group_code === undefined) return;
          groupNameMap.set(g.group_code, g.group_name);
        });
      }

      const courseNameMap = new Map();
      if (courseCodeSet.size > 0) {
        const { data: coursesData, error: coursesError } = await supabase
          .from("courses")
          .select("course_code, course_name");

        if (coursesError) throw coursesError;

        (coursesData || []).forEach((c) => {
          if (!c || c.course_code === null || c.course_code === undefined) return;
          courseNameMap.set(c.course_code, c.course_name);
        });
      }

      const registrationMap = new Map();
      (registrations || []).forEach((reg) => {
        if (!reg) return;
        registrationMap.set(reg.id, reg);
      });

      const subjectIds = new Set(
        (subjectRows || [])
          .map((row) => row.id)
          .filter((id) => id !== null && id !== undefined)
      );

      let decodeMap = new Map();
      if (subjectIds.size > 0) {
        const { data: decodeRows, error: decodeError } = await supabase
          .from("decode_numbers")
          .select("exam_registration_subject_id, decode_no")
          .in("exam_registration_subject_id", Array.from(subjectIds));

        if (decodeError) throw decodeError;

        decodeMap = new Map();
        (decodeRows || []).forEach((row) => {
          if (!row) return;
          const key = row.exam_registration_subject_id;
          if (!decodeMap.has(key)) {
            decodeMap.set(key, []);
          }
          decodeMap.get(key).push(row.decode_no);
        });
      }

      const subjectStudentRows = [];
      (subjectRows || []).forEach((subj) => {
        if (!subj) return;
        const reg = registrationMap.get(subj.exam_registration_id);
        if (!reg) return;
        const student = studentMap.get(reg.student_id);
        if (!student) return;

        const decodes = decodeMap.get(subj.id) || [null];
        const groupDisplayName = groupNameMap.get(student.group_name) || student.group_name;
        const courseDisplayName = courseNameMap.get(student.course_name) || student.course_name;

        decodes.forEach((decode_no) => {
          subjectStudentRows.push({
            registration_id: reg.id,
            subject_code: trimmed,
            decode_no,
            student_id: student.student_id,
            full_name: student.full_name,
            academic_year: student.academic_year,
            group_name: groupDisplayName,
            course_name: courseDisplayName,
          });
        });
      });

      const seenStudentRows = new Map();
      subjectStudentRows.forEach((row) => {
        const key = row.student_id;
        if (!key) return;
        if (!seenStudentRows.has(key)) {
          seenStudentRows.set(key, row);
        }
      });

      const uniqueStudents = Array.from(seenStudentRows.values());

      if (!uniqueStudents.length) {
        setSubjectSearchError("No students found for this subject code.");
        return;
      }

      setSubjectStudents(uniqueStudents);
    } catch (e) {
      console.error("Error searching by subject code:", e);
      setSubjectSearchError("Failed to search students for this subject code. Please try again.");
    } finally {
      setSubjectSearchLoading(false);
    }
  };

  const handleSubjectCodeKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSearchBySubjectCode();
    }
  };

  const handleStudentIdKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSearchStudent();
    }
  };

  return (
    <AdminShell>
      <div className="card card-soft p-3 mb-4">
        <h5 className="mb-3">Search by Subject Code</h5>
        <div className="row g-3 align-items-end">
          <div className="col-12 col-sm-6 col-md-4 col-lg-3">
            <label className="form-label">Subject Code</label>
            <input
              type="text"
              className="form-control"
              value={subjectCodeInput}
              onChange={(e) => setSubjectCodeInput(e.target.value)}
              onKeyDown={handleSubjectCodeKeyDown}
              placeholder="Enter subject code"
            />
          </div>
          <div className="col-auto">
            <button
              type="button"
              className="btn btn-primary mt-2"
              onClick={handleSearchBySubjectCode}
              disabled={subjectSearchLoading}
            >
              {subjectSearchLoading ? "Searching..." : "Search"}
            </button>
          </div>
        </div>
        {subjectSearchError && (
          <p className="text-danger small mt-2 mb-0">{subjectSearchError}</p>
        )}
      </div>

      {subjectStudents.length > 0 && (
        <div className="card card-soft p-3 mb-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="mb-0">Students Applied for Subject</h5>
            <span className="text-muted fw-bold" style={{ fontSize: '1.05rem' }}>
              Total Students: {subjectStudents.length}
            </span>
          </div>
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th>Student ID</th>
                  <th>Student Name</th>
                  <th>Academic Year</th>
                  <th>Group Name</th>
                  <th>Course Name</th>
                  <th>Decode</th>
                </tr>
              </thead>
              <tbody>
                {subjectStudents.map((row) => (
                  <tr key={row.student_id}>
                    <td>{row.student_id || "-"}</td>
                    <td>{row.full_name || "-"}</td>
                    <td>{row.academic_year || "-"}</td>
                    <td>{row.group_name || "-"}</td>
                    <td>{row.course_name || "-"}</td>
                    <td>{row.decode_no || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedStudent && (
        <div className="card card-soft p-3 mb-4">
          <h5 className="mb-3">Student Details</h5>
          <div className="row g-3">
            <div className="col-12 col-md-6">
              <div className="fw-semibold">
                {selectedStudent.full_name || "Unnamed Student"}
              </div>
              <div className="text-muted small">
                ID: {selectedStudent.student_id}
              </div>
            </div>
            <div className="col-12 col-md-6">
              <div className="text-muted small">
                Academic Year: {selectedStudent.academic_year || "-"}
              </div>
              <div className="text-muted small">
                Group: {selectedStudent.group_name || selectedStudent.group_code || "-"}
              </div>
              <div className="text-muted small">
                Course: {selectedStudent.course_name || "-"}
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedStudent && (
        <div className="card card-soft p-3 mb-4">
          <h5 className="mb-3">Select Semester</h5>
          <div className="row g-3 align-items-end">
            <div className="col-12 col-sm-4 col-md-3 col-lg-2">
              <label className="form-label">Semester</label>
              <select
                className="form-select"
                value={selectedSemester}
                onChange={(e) => handleSemesterChange(e.target.value)}
              >
                <option value="">Select semester</option>
                {availableSemesters.map((sem) => (
                  <option key={sem} value={sem}>
                    {sem}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {!availableSemesters.length && (
            <p className="text-muted small mt-2 mb-0">
              No exam registrations found for this student.
            </p>
          )}
        </div>
      )}

      {selectedStudent && selectedSemester && (
        <div className="card card-soft p-3 mb-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="mb-0">Subjects &amp; Decode Numbers</h5>
            <span className="text-muted small">
              Semester {selectedSemester}
            </span>
          </div>
          {subjectsError && (
            <p className="text-danger small mb-2">{subjectsError}</p>
          )}
          {loadingSubjects ? (
            <p className="text-muted small mb-0">Loading subjects…</p>
          ) : subjects.length === 0 ? (
            <p className="text-muted small mb-0">
              No subjects or decode numbers found for this semester.
            </p>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead>
                  <tr>
                    <th>Subject Name</th>
                    <th>Subject Code</th>
                    <th>Decode No</th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((row, index) => {
                    const key = `${row.subject_code || row.subject_name || ""}-${row.decode_no || "none"}-${index}`;
                    const isVisible = !!visibleDecodeRows[key];
                    return (
                      <tr key={key}>
                        <td>{row.subject_name || "-"}</td>
                        <td>{row.subject_code || "-"}</td>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            {row.decode_no && (
                              <div className="position-relative d-inline-block">
                                {isVisible && (
                                  <div className="position-absolute bottom-100 start-50 translate-middle-x mb-1 px-2 py-1 bg-light border rounded shadow-sm small">
                                    <strong>{row.decode_no}</strong>
                                  </div>
                                )}
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  onClick={() =>
                                    setVisibleDecodeRows((prev) => ({
                                      ...prev,
                                      [key]: !prev[key],
                                    }))
                                  }
                                >
                                  {isVisible ? "Hide" : "View"}
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!selectedStudent && (
        <div className="d-flex flex-column align-items-center justify-content-center h-100">
        </div>
      )}
    </AdminShell>
  );
}
