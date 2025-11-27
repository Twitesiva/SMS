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

  const handleStudentIdKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSearchStudent();
    }
  };

  return (
    <AdminShell>
      <div className="card card-soft p-3 mb-4">
        <h5 className="mb-3">Search by Student ID</h5>
        <div className="row g-3 align-items-end">
          <div className="col-12 col-sm-6 col-md-4 col-lg-3">
            <label className="form-label">Student ID</label>
            <input
              type="text"
              className="form-control"
              value={studentIdInput}
              onChange={(e) => setStudentIdInput(e.target.value)}
              onKeyDown={handleStudentIdKeyDown}
              placeholder="Enter student ID"
            />
          </div>
          <div className="col-auto">
            <button
              type="button"
              className="btn btn-primary mt-2"
              onClick={handleSearchStudent}
              disabled={searchingStudent}
            >
              {searchingStudent ? "Searching..." : "Search"}
            </button>
          </div>
        </div>
        {studentError && (
          <p className="text-danger small mt-2 mb-0">{studentError}</p>
        )}
      </div>

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
