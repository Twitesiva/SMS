import { useEffect, useState } from "react";
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
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState("");
  const [loadingExams, setLoadingExams] = useState(false);
  const [examSubjects, setExamSubjects] = useState([]);
  const [loadingExamSubjects, setLoadingExamSubjects] = useState(false);
  const [visibleDecodeNumbers, setVisibleDecodeNumbers] = useState({});

  // Fetch exams from exam_master table
  useEffect(() => {
    const fetchExams = async () => {
      setLoadingExams(true);
      try {
        const { data, error } = await supabase
          .from('exam_master')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setExams(data || []);
        console.log('Fetched exams:', data); // Debug log
      } catch (error) {
        console.error('Error fetching exams:', error);
      } finally {
        setLoadingExams(false);
      }
    };

    fetchExams();
  }, []);

  useEffect(() => {
    if (selectedExam || !exams.length) return;
    const firstExamId = exams[0]?.id;
    if (!firstExamId) return;
    setSelectedExam(String(firstExamId));
  }, [exams, selectedExam]);

  // Fetch subjects for selected exam
  useEffect(() => {
    const fetchExamSubjects = async () => {
      if (!selectedExam) {
        setExamSubjects([]);
        return;
      }

      setLoadingExamSubjects(true);
      try {
        // Get the exam details first
        const { data: examData, error: examError } = await supabase
          .from('exam_master')
          .select('*')
          .eq('id', selectedExam)
          .single();

        if (examError) throw examError;
        if (!examData) {
          setExamSubjects([]);
          return;
        }

        // First, get all exam registrations for this exam
        const { data: examRegistrations, error: regError } = await supabase
          .from('exam_registrations')
          .select('id, student_id, semester, exam_id')
          .eq('exam_id', selectedExam);

        if (regError) throw regError;
        if (!examRegistrations?.length) {
          setExamSubjects([]);
          return;
        }

        // First, get all subject registrations for these exam registrations
        const { data: subjectRegistrations, error: regSubjError } = await supabase
          .from('exam_registration_subjects')
          .select('id, subject_id, exam_registration_id')
          .in('exam_registration_id', examRegistrations.map(er => er.id));

        if (regSubjError) throw regSubjError;
        if (!subjectRegistrations?.length) {
          setExamSubjects([]);
          return;
        }

        // Get unique subject IDs
        const subjectIds = [...new Set(subjectRegistrations.map(sr => sr.subject_id))];

        // Get all subjects details
        const { data: subjects, error: subjectsError } = await supabase
          .from('subjects')
          .select('*')
          .in('subject_id', subjectIds);

        if (subjectsError) throw subjectsError;

        // Create a map of subject_id to subject details
        const subjectDetails = {};
        subjects.forEach(subj => {
          subjectDetails[subj.subject_id] = subj;
        });

        // Count subject occurrences
        const subjectCounts = {};
        subjectRegistrations.forEach(sr => {
          const subjId = sr.subject_id;
          subjectCounts[subjId] = (subjectCounts[subjId] || 0) + 1;
        });

        // Combine the data
        const result = Object.entries(subjectCounts).map(([subjectId, count]) => {
          const subject = subjectDetails[subjectId] || {};
          return {
            subject_id: subjectId,
            subject_code: subject.subject_code || '',
            subject_name: subject.subject_name || '',
            academic_year: subject.academic_year || '',
            semester_number: subject.semester_number || 0,
            count: count,
            exam_registration_subject_id: subjectRegistrations.find(sr => sr.subject_id === subjectId)?.id || ''
          };
        });

        // Sort by subject code
        const sortedSubjects = result.sort((a, b) => 
          a.subject_code.localeCompare(b.subject_code)
        );
        
        setExamSubjects(sortedSubjects);
      } catch (error) {
        console.error('Error fetching exam subjects:', error);
        setExamSubjects([]);
      } finally {
        setLoadingExamSubjects(false);
      }
    };

    fetchExamSubjects();
  }, [selectedExam]);

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
        .select("id, semester")
        .eq("student_id", studentInternalId)
        .eq("semester", Number(semesterValue));

      if (error) throw error;

      const examRegistrationIds = (data || [])
        .map((registration) => registration.id)
        .filter(Boolean);
      if (!examRegistrationIds.length) {
        setSubjectsError("No subjects found for this semester.");
        return;
      }

      const { data: examSubjectRows, error: subjectError } = await supabase
        .from("exam_registration_subjects")
        .select("id, exam_registration_id, subject_id, subjects(subject_name, subject_code)")
        .in("exam_registration_id", examRegistrationIds);
      if (subjectError) throw subjectError;

      const baseSubjectRows = [];
      const subjectIds = new Set();
      (examSubjectRows || []).forEach((subj) => {
        if (!subj || subj.id === undefined || subj.id === null) return;
        baseSubjectRows.push({
          exam_registration_subject_id: subj.id,
          subject_name: subj.subjects?.subject_name || "",
          subject_code: subj.subjects?.subject_code || "",
        });
        subjectIds.add(subj.id);
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
      console.log('Searching for subject code:', trimmed);
      
      // First, find the subject by code (exact match)
      const { data: subjectRecord, error: subjectError } = await supabase
        .from("subjects")
        .select("subject_id, subject_name, subject_code, academic_year, semester_number")
        .or(`subject_code.eq.${trimmed},subject_code.ilike.%${trimmed}%`)
        .maybeSingle();

      if (subjectError) {
        console.error('Error fetching subject:', subjectError);
        throw subjectError;
      }
      
      if (!subjectRecord?.subject_id) {
        console.log('No subject found with code:', trimmed);
        setSubjectSearchError("No subject found with that code.");
        return;
      }

      console.log('Found subject:', subjectRecord);

      // First, get all exam registrations for this exam (if selected)
      let examRegistrationsQuery = supabase
        .from('exam_registrations')
        .select('id, student_id, semester, academic_year, group_name, course_name, exam_id');

      if (selectedExam) {
        examRegistrationsQuery = examRegistrationsQuery.eq('exam_id', selectedExam);
      }

      const { data: examRegistrations, error: examRegsError } = await examRegistrationsQuery;
      
      if (examRegsError) {
        console.error('Error fetching exam registrations:', examRegsError);
        throw examRegsError;
      }

      if (!examRegistrations?.length) {
        const msg = selectedExam 
          ? 'No exam registrations found for the selected exam.' 
          : 'No exam registrations found.';
        console.log(msg);
        setSubjectSearchError(msg);
        return;
      }

      console.log('Found exam registrations:', examRegistrations.length);

      // Now find all subject registrations for these exam registrations and the subject
      const { data: subjectRegistrations, error: regError } = await supabase
        .from('exam_registration_subjects')
        .select('id, exam_registration_id, subject_id')
        .in('exam_registration_id', examRegistrations.map(er => er.id))
        .eq('subject_id', subjectRecord.subject_id);

      if (regError) {
        console.error('Error fetching subject registrations:', regError);
        throw regError;
      }
      
      if (!subjectRegistrations?.length) {
        console.log('No subject registrations found for subject ID:', subjectRecord.subject_id);
        setSubjectSearchError("No students registered for this subject" + (selectedExam ? " in the selected exam." : "."));
        return;
      }

      console.log('Found subject registrations:', subjectRegistrations.length);

      // Create a map of exam registration IDs to their details
      const examRegistrationsMap = new Map(
        examRegistrations.map(er => [er.id, er])
      );

      // Filter and map the subject registrations to include exam registration details
      const filteredRegistrations = subjectRegistrations
        .map(sr => ({
          ...sr,
          exam_registrations: examRegistrationsMap.get(sr.exam_registration_id)
        }))
        .filter(sr => sr.exam_registrations); // Only keep those with valid exam registrations

      if (filteredRegistrations.length === 0) {
        console.log('No valid exam registrations found after filtering');
        setSubjectSearchError("No valid student registrations found for this subject" + (selectedExam ? " in the selected exam." : "."));
        return;
      }

      // Get unique student IDs
      const studentIds = [...new Set(
        filteredRegistrations
          .map(reg => reg.exam_registrations?.student_id)
          .filter(Boolean)
      )];

      if (studentIds.length === 0) {
        console.log('No student IDs found in filtered registrations');
        setSubjectSearchError("No valid student registrations found for this subject.");
        return;
      }

      console.log('Student IDs to fetch:', studentIds);

      // Get student details
      const { data: students, error: studentsError } = await supabase
        .from("students")
      .select("id, student_id, full_name, academic_year, group_name, course_name, hall_ticket_no")
        .in("id", studentIds);

      if (studentsError) throw studentsError;

      // Get decode numbers for these registrations
      const registrationIds = filteredRegistrations.map(reg => reg.id);
      const { data: decodeNumbers, error: decodeError } = await supabase
        .from("decode_numbers")
        .select("id, decode_no, exam_registration_subject_id")
        .in("exam_registration_subject_id", registrationIds);

      if (decodeError) console.error("Error fetching decode numbers:", decodeError);

      // Create a map of registration ID to decode numbers
      const decodeMap = new Map();
      if (decodeNumbers) {
        decodeNumbers.forEach(dn => {
          if (!decodeMap.has(dn.exam_registration_subject_id)) {
            decodeMap.set(dn.exam_registration_subject_id, []);
          }
          decodeMap.get(dn.exam_registration_subject_id).push(dn.decode_no);
        });
      }

      // Combine the data
      const studentRecords = filteredRegistrations.map(reg => {
        const student = students?.find(s => s.id === reg.exam_registrations.student_id);
        const decodes = decodeMap.get(reg.id) || [];
        
        return {
          registration_id: reg.exam_registration_id,
          subject_code: subjectRecord.subject_code,
          subject_name: subjectRecord.subject_name,
          decode_no: decodes.length > 0 ? decodes[0] : null,
          student_id: student?.student_id || 'N/A',
          full_name: student?.full_name || 'Unknown',
          academic_year: reg.exam_registrations.academic_year || student?.academic_year || 'N/A',
          group_name: reg.exam_registrations.group_name || student?.group_name || 'N/A',
          course_name: reg.exam_registrations.course_name || student?.course_name || 'N/A',
          semester: reg.exam_registrations.semester || subjectRecord.semester_number || 'N/A',
          hall_ticket: student?.hall_ticket_no || 'N/A',
          all_decode_numbers: decodes
        };
      });

      if (studentRecords.length === 0) {
        setSubjectSearchError("No student records found for this subject.");
        return;
      }

      setSubjectStudents(studentRecords);
    } catch (e) {
      console.error("Error searching by subject code:", e);
      setSubjectSearchError("Failed to search students for this subject code. Please try again.");
    } finally {
      setSubjectSearchLoading(false);
    }
  };

  const handleStudentIdKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSearchStudent();
    }
  };

  const handleSubjectCodeKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSearchBySubjectCode();
    }
  };

  const toggleDecodeNumber = (studentId) => {
    setVisibleDecodeNumbers({
      [studentId]: true
    });
  };

  return (
    <AdminShell>
      <div className="card card-soft p-3 mb-4">
        <h5 className="mb-3">Search by Exam</h5>
        <div className="row g-3 align-items-end mb-4">
          <div className="col-12 col-sm-6 col-md-4">
            <label className="form-label">Exam Name</label>
            <select
              className="form-select"
              value={selectedExam}
              onChange={(e) => setSelectedExam(e.target.value)}
              disabled={loadingExams}
            >
              <option value="">Select Exam</option>
              {exams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.exam_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="row g-3 align-items-end mb-4">
          <div className="col-12 col-sm-6 col-md-4">
            <label className="form-label">Subject Code</label>
            <div className="input-group">
              <input
                type="text"
                className="form-control"
                value={subjectCodeInput}
                onChange={(e) => setSubjectCodeInput(e.target.value)}
                onKeyDown={handleSubjectCodeKeyDown}
                placeholder="Enter subject code"
                disabled={!selectedExam}
              />
              <button
                className="btn btn-primary"
                type="button"
                onClick={handleSearchBySubjectCode}
                disabled={subjectSearchLoading || !selectedExam || !subjectCodeInput.trim()}
              >
                {subjectSearchLoading ? 'Searching...' : 'Search'}
              </button>
            </div>
            {selectedExam ? (
              <div className="form-text text-muted">
                Enter a subject code to search for students
              </div>
            ) : (
              <div className="form-text text-muted">
                Please select an exam first
              </div>
            )}
          </div>
        </div>
        
        {/* Show loading indicator when searching */}
        {loadingExamSubjects && (
          <div className="text-center py-3">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading subjects...</span>
            </div>
          </div>
        )}
        
        {/* Show subjects after search */}
        {!loadingExamSubjects && subjectCodeInput && subjectStudents.length > 0 && (
          <div className="mb-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="mb-0">Search Results</h5>
              <span className="badge bg-primary fw-bold">
                {subjectStudents.length} student{subjectStudents.length !== 1 ? 's' : ''} found
              </span>
            </div>
            
            {/* Show subject details */}
            {subjectStudents[0]?.subject_name && (
              <div className="mb-3 p-3 bg-light rounded">
                <div className="fw-bold">
                  {subjectStudents[0].subject_name} ({subjectStudents[0].subject_code})
                </div>
                <div className="text-muted small">
                  {subjectStudents.length} student{subjectStudents.length !== 1 ? 's' : ''} registered for this subject
                </div>
              </div>
            )}
            
            {/* Students list */}
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead>
                  <tr>
                    <th>Subject Name</th>
                    <th>Hall Ticket No.</th>
                    <th>Decode No</th>
                  </tr>
                </thead>
                <tbody>
                  {subjectStudents.map((student) => (
                    <tr key={student.student_id}>
                      <td>
                        <div className="fw-semibold">
                          {student.subject_name || "-"}
                        </div>
                        <div className="text-muted small">
                          {student.subject_code || "-"}
                        </div>
                      </td>
                      <td>{student.hall_ticket || "N/A"}</td>
                      <td>
                        {student.decode_no ? (
                          <div className="position-relative d-inline-block">
                            {visibleDecodeNumbers[student.student_id] ? (
                              <span className="badge bg-primary">{student.decode_no}</span>
                            ) : (
                              <button
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => toggleDecodeNumber(student.student_id)}
                              >
                                View
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {/* Show no results message only after search */}
        {!loadingExamSubjects && subjectCodeInput && subjectStudents.length === 0 && (
          <div className="alert alert-info mb-4">
            No students found for the selected subject code.
          </div>
        )}
        {subjectSearchError && (
          <p className="text-danger small mt-2 mb-0">{subjectSearchError}</p>
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
