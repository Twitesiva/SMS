import { useEffect, useState } from "react";
import Barcode from "react-barcode";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import AdminShell from "../components/AdminShell";
import { supabase } from "../../supabaseClient";
import { showToast } from "../store/ui";

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
  const [subjectSearchLoading, setSubjectSearchLoading] = useState(false);
  const [subjectSearchError, setSubjectSearchError] = useState("");
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState("");
  const [loadingExams, setLoadingExams] = useState(false);
  const [examSubjects, setExamSubjects] = useState([]);
  const [loadingExamSubjects, setLoadingExamSubjects] = useState(false);
  const [visibleDecodeNumbers, setVisibleDecodeNumbers] = useState({});
  const [examDates, setExamDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [loadingDates, setLoadingDates] = useState(false);
  const [subjectsByDate, setSubjectsByDate] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [loadingSubjectsByDate, setLoadingSubjectsByDate] = useState(false);
  const [subjectStudents, setSubjectStudents] = useState([]);
  const [loadingSubjectStudents, setLoadingSubjectStudents] = useState(false);
  const [showDecodePopup, setShowDecodePopup] = useState(false);
  const [selectedSubjectForDecode, setSelectedSubjectForDecode] = useState(null);
  const [isDecodeGenerated, setIsDecodeGenerated] = useState(false);

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
        console.log('Fetched exams:', data);
      } catch (error) {
        console.error('Error fetching exams:', error);
      } finally {
        setLoadingExams(false);
      }
    };

    fetchExams();
  }, []);

  // Fetch subjects for selected exam and date
  const fetchSubjectsByDate = async (examId, date) => {
    if (!examId || !date) {
      setSubjectsByDate([]);
      setSelectedSubject('');
      return;
    }

    setLoadingSubjectsByDate(true);
    try {
      // First get the subject codes for the selected date
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('exam_schedule')
        .select('subject_code')
        .eq('exam_master_id', examId)
        .eq('exam_date', date);

      if (scheduleError) throw scheduleError;

      if (!scheduleData || scheduleData.length === 0) {
        setSubjectsByDate([]);
        return;
      }

      const subjectCodes = scheduleData.map(item => item.subject_code);

      // Then get the full subject details
      const { data: subjectsData, error: subjectsError } = await supabase
        .from('subjects')
        .select('*')
        .in('subject_code', subjectCodes);

      if (subjectsError) throw subjectsError;



      // Check for barcode status for these subjects
      // We need to know if there are generated barcodes for these subjects for the CURRENT EXAM
      // We have examId and subjectCodes.

      const { data: subjectIdsData } = await supabase
        .from('subjects')
        .select('subject_id, subject_code')
        .in('subject_code', subjectCodes);

      if (subjectIdsData && subjectIdsData.length > 0) {
        const sIds = subjectIdsData.map(s => s.subject_id);

        // Get registrations
        const { data: regs } = await supabase
          .from('exam_registration_subjects')
          .select('id, subject_id, exam_registrations!inner(exam_id)')
          .in('subject_id', sIds)
          .eq('exam_registrations.exam_id', examId);

        if (regs && regs.length > 0) {
          const regIds = regs.map(r => r.id);
          const { data: bcs } = await supabase
            .from('barcodes')
            .select('exam_registration_subject_id')
            .in('exam_registration_subject_id', regIds)
            .eq('is_generated', true);

          const generatedSet = new Set(bcs?.map(b => b.exam_registration_subject_id));

          // Map back to subjects
          const subjectGeneratedMap = {};
          regs.forEach(r => {
            if (generatedSet.has(r.id)) {
              subjectGeneratedMap[r.subject_id] = true;
            }
          });

          // Merge into subjectsData
          if (subjectsData) {
            subjectsData.forEach(s => {
              s.isGenerated = subjectGeneratedMap[s.subject_id] || false;
            });
          }
        }
      }

      // Deduplicate subjects by subject_code
      const uniqueSubjectsMap = new Map();
      if (subjectsData) {
        subjectsData.forEach(s => {
          // Filter out subjects ending with 'P'
          if (s.subject_code && s.subject_code.trim().toUpperCase().endsWith('P')) {
            return;
          }

          if (uniqueSubjectsMap.has(s.subject_code)) {
            const existing = uniqueSubjectsMap.get(s.subject_code);
            // If the current duplicate has isGenerated=true, use it (or update existing)
            // Since we just want to ensure if ANY is generated, the resulting object has isGenerated=true
            if (s.isGenerated && !existing.isGenerated) {
              uniqueSubjectsMap.set(s.subject_code, s);
            }
          } else {
            uniqueSubjectsMap.set(s.subject_code, s);
          }
        });
      }

      setSubjectsByDate(Array.from(uniqueSubjectsMap.values()));
      setSelectedSubject('');
      setSubjectStudents([]);
    } catch (error) {
      console.error('Error fetching subjects by date:', error);
      setSubjectsByDate([]);
      setSelectedSubject('');
    } finally {
      setLoadingSubjectsByDate(false);
    }
  };

  // Handle subject selection
  const handleSubjectSelect = async (subjectCode) => {
    setSelectedSubject(subjectCode);
    const subject = subjectsByDate.find(s => s.subject_code === subjectCode);
    setSelectedSubjectForDecode(subject);
    setShowDecodePopup(true);
    setIsDecodeGenerated(false);
    setSubjectStudents([]);

    if (!subjectCode || !selectedExam || !selectedDate) {
      return;
    }

    setLoadingSubjectStudents(true);
    try {
      // Get all subject IDs for this subject code
      const { data: subjectsWithCode, error: subjCodeError } = await supabase
        .from('subjects')
        .select('subject_id')
        .eq('subject_code', subjectCode);

      if (subjCodeError) throw subjCodeError;

      const subjectIdsToCheck = subjectsWithCode?.map(s => s.subject_id) || [];

      if (subjectIdsToCheck.length === 0) {
        setSubjectStudents([]);
        return;
      }

      // Get all exam registrations for this exam and subject IDs
      const { data: regSubjects, error: subjError } = await supabase
        .from('exam_registration_subjects')
        .select(`
          id, 
          exam_registration_id, 
          subject_id,
          exam_registrations!inner(
            id,
            student_id,
            exam_id
          )
        `)
        .in('subject_id', subjectIdsToCheck)
        .eq('exam_registrations.exam_id', selectedExam);

      if (subjError) throw subjError;
      if (!regSubjects || regSubjects.length === 0) {
        setSubjectStudents([]);
        setShowDecodePopup(false);
        showToast("No students registered for this subject.", { type: "error" });
        return;
      }

      // Get unique student IDs from the registrations
      const studentIds = [...new Set(regSubjects.map(rs => rs.exam_registrations.student_id))];

      // Get decode numbers for these subject registrations
      const subjectRegIds = regSubjects.map(rs => rs.id);
      const { data: decodes, error: decodeError } = await supabase
        .from('barcodes')
        .select('id, exam_registration_subject_id, barcode, is_generated')
        .in('exam_registration_subject_id', subjectRegIds);

      if (decodeError) throw decodeError;

      // Check if any decode is generated to set initial state
      const anyGenerated = decodes?.some(d => d.is_generated) || false;
      setIsDecodeGenerated(anyGenerated);

      // Get student details
      const { data: students, error: studentErrorRef } = await supabase
        .from('students')
        .select('id, student_id, hall_ticket_no, full_name')
        .in('id', studentIds);

      if (studentErrorRef) throw studentErrorRef;

      // Combine all the data
      const studentData = regSubjects.map(regSubj => {
        const student = students.find(s => s.id === regSubj.exam_registrations.student_id);
        if (!student) return null;

        const decode = decodes?.find(d => d.exam_registration_subject_id === regSubj.id);

        return {
          examRegistrationSubjectId: regSubj.id,
          studentInternalId: student.id,
          studentId: student.student_id,
          hallTicketNo: student.hall_ticket_no,
          fullName: student.full_name,
          barcode: decode?.barcode || 'N/A'
        };
      }).filter(Boolean); // Filter out any null entries

      if (studentData.length === 0) {
        setSubjectStudents([]);
        setShowDecodePopup(false);
        showToast("No valid student records found for this subject.", { type: "error" });
        return;
      }

      setSubjectStudents(studentData);
    } catch (error) {
      console.error('Error fetching subject students:', error);
      setSubjectStudents([]);
    } finally {
      setLoadingSubjectStudents(false);
    }
  };



  // Handle date change
  const handleDateChange = async (date) => {
    setSelectedDate(date);
    setSelectedSubject('');
    setSubjectStudents([]);
    if (selectedExam && date) {
      await fetchSubjectsByDate(selectedExam, date);
    }
  };

  // Fetch exam dates when exam is selected
  useEffect(() => {
    const fetchExamDates = async () => {
      if (!selectedExam) {
        setExamDates([]);
        setSelectedDate('');
        return;
      };

      setLoadingDates(true);
      try {
        const { data, error } = await supabase
          .from('exam_schedule')
          .select('exam_date, subject_code')
          .eq('exam_master_id', selectedExam)
          .order('exam_date', { ascending: true });

        if (error) throw error;

        // Filter out dates that only have practical subjects (ending in 'P')
        // We do this by keeping only rows where subject_code does NOT end in 'P'
        // Then we get unique dates from those rows.
        const validRows = data.filter(item => {
          const code = item.subject_code || '';
          return !code.trim().toUpperCase().endsWith('P');
        });

        // Get unique dates and format them
        const uniqueDates = [...new Set(validRows.map(item => item.exam_date))];
        setExamDates(uniqueDates);

        // Reset selected date and clear related states
        setSelectedDate('');
        setSubjectsByDate([]);
        setSelectedSubject('');
        setSubjectStudents([]);
      } catch (error) {
        console.error('Error fetching exam dates:', error);
        setExamDates([]);
        setSelectedDate('');
        setSubjectsByDate([]);
        setSelectedSubject('');
      } finally {
        setLoadingDates(false);
      }
    };

    fetchExamDates();
  }, [selectedExam]);

  useEffect(() => {
    if (selectedExam || !exams.length) return;
    const firstExamId = exams[0]?.id;
    if (!firstExamId) return;
    setSelectedExam(String(firstExamId));
  }, [exams, selectedExam]);

  // Fetch subjects for selected exam and date
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
          .select('*')
          .in('subject_id', subjectIds);

        if (subjectsError) throw subjectsError;

        // Fetch barcodes status for these subjects
        const { data: barcodeData, error: barcodeCheckError } = await supabase
          .from('barcodes')
          .select('exam_registration_subject_id, is_generated')
          .in('exam_registration_subject_id', subjectRegistrations.map(sr => sr.id))
          .eq('is_generated', true);

        if (barcodeCheckError) console.error("Error fetching barcode status", barcodeCheckError);

        const generatedMap = new Set();
        (barcodeData || []).forEach(b => {
          generatedMap.add(b.exam_registration_subject_id);
        });

        // Get subjects for the selected date if a date is selected
        let filteredSubjects = [...subjects];
        if (selectedDate) {
          const { data: scheduledSubjects, error: scheduleError } = await supabase
            .from('exam_schedule')
            .select('subject_code')
            .eq('exam_date', selectedDate)
            .eq('exam_master_id', selectedExam);

          if (!scheduleError && scheduledSubjects?.length) {
            const scheduledSubjectCodes = scheduledSubjects.map(s => s.subject_code);
            filteredSubjects = subjects.filter(subj =>
              scheduledSubjectCodes.includes(subj.subject_code)
            );
          }
        }

        // Create a map of subject_id to subject details
        const subjectDetails = {};
        filteredSubjects.forEach(subj => {
          subjectDetails[subj.subject_id] = subj;
        });

        // Count subject occurrences
        const subjectCounts = {};
        subjectRegistrations.forEach(sr => {
          if (subjectDetails[sr.subject_id]) {
            const subjId = sr.subject_id;
            subjectCounts[subjId] = (subjectCounts[subjId] || 0) + 1;
          }
        });

        // Combine the data
        const result = Object.entries(subjectCounts).map(([subjectId, count]) => {
          const subject = subjectDetails[subjectId] || {};
          const regSubject = subjectRegistrations.find(sr => sr.subject_id === subjectId);
          const isGenerated = regSubject && generatedMap.has(regSubject.id);

          // Check if ANY registration for this subject has a generated barcode? 
          // Or all? The user interface groups by subject. 
          // Let's assume if we find any generated barcode for this subject in this exam batch, we show "View".
          // To be more precise, we should check if count matches generated count, but "isGenerated" for the subject row 
          // usually implies the batch is processed.
          // Let's verify based on the generatedMap. 

          // We need to know if this specific group of registrations (grouped by subject) has barcodes.
          // subjectRegistrations contains all IDs. 
          // We can count how many in this subject group are in generatedMap.
          const subjectRegIds = subjectRegistrations
            .filter(sr => sr.subject_id === subjectId)
            .map(sr => sr.id);

          const generatedCount = subjectRegIds.filter(id => generatedMap.has(id)).length;
          const totalCount = subjectRegIds.length;
          // We consider it generated if at least one is generated (or all? usually all). 
          // Let's say > 0.

          return {
            subject_id: subjectId,
            subject_code: subject.subject_code || '',
            subject_name: subject.subject_name || '',
            academic_year: subject.academic_year || '',
            semester_number: subject.semester_number || 0,
            count: count,
            exam_registration_subject_id: regSubject?.id || '',
            isGenerated: generatedCount > 0
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
  }, [selectedExam, selectedDate]);

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
          .from("barcodes")
          .select("exam_registration_subject_id, barcode")
          .in("exam_registration_subject_id", Array.from(subjectIds));

        if (decodeError) throw decodeError;

        decodeMap = new Map();
        (decodeData || []).forEach((row) => {
          if (!row) return;
          const key = row.exam_registration_subject_id;
          if (!decodeMap.has(key)) {
            decodeMap.set(key, []);
          }
          decodeMap.get(key).push(row.barcode);
        });
      }

      const subjectRows = [];
      baseSubjectRows.forEach((row) => {
        const decodes = decodeMap.get(row.exam_registration_subject_id) || [];
        decodes.forEach((decode_no) => {
          subjectRows.push({
            subject_name: row.subject_name,
            subject_code: row.subject_code,
            barcode: decode_no,
          });
        });
      });

      const seen = new Set();
      const uniqueSubjects = subjectRows.filter((row) => {
        const key = `${row.subject_name || ""}|${row.subject_code || ""}|${row.barcode || ""}`;
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
    if (!selectedSubject) {
      setSubjectSearchError("Please select a subject from the dropdown.");
      setSubjectStudents([]);
      return;
    }

    const subjectCodeToSearch = subjectCodeOverride || selectedSubject;

    setSubjectSearchLoading(true);
    setSubjectSearchError("");
    setSubjectStudents([]);

    try {
      console.log('Searching for subject code:', subjectCodeToSearch);

      // First, find the subject by code (exact match)
      const condition = `subject_code.eq.${subjectCodeToSearch},subject_code.ilike.%${subjectCodeToSearch}%`;
      const { data: subjectRecord, error: subjectError } = await supabase
        .from("subjects")
        .select("subject_id, subject_name, subject_code, academic_year, semester_number")
        .or(condition)
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
        .from("barcodes")
        .select("id, barcode, exam_registration_subject_id")
        .in("exam_registration_subject_id", registrationIds);

      if (decodeError) console.error("Error fetching decode numbers:", decodeError);

      // Create a map of registration ID to decode numbers
      const decodeMap = new Map();
      if (decodeNumbers) {
        decodeNumbers.forEach(dn => {
          if (!decodeMap.has(dn.exam_registration_subject_id)) {
            decodeMap.set(dn.exam_registration_subject_id, []);
          }
          decodeMap.get(dn.exam_registration_subject_id).push(dn.barcode);
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
          barcode: decodes.length > 0 ? decodes[0] : null,
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


  const toggleDecodeNumber = (studentId) => {
    setVisibleDecodeNumbers({
      [studentId]: true
    });
  };

  // State to track if decode is being generated
  const [isGenerating, setIsGenerating] = useState(false);

  // Handle Generate Decode button click
  const handleGenerateDecode = async () => {
    if (!selectedSubjectForDecode || isGenerating) return;

    // If decode is already generated, close the popup
    if (isDecodeGenerated) {
      setShowDecodePopup(false);
      return;
    }

    try {
      setIsGenerating(true);
      setLoadingSubjectStudents(true);

      // Generate barcodes for each student
      const updates = subjectStudents.map(student => {
        // If barcode exists, we update is_generated to true
        // If not, we generate a new one
        const exists = student.barcode && student.barcode !== 'N/A';
        const barcode = exists
          ? student.barcode
          : `BC${Date.now()}${Math.floor(Math.random() * 1000)}`;

        return {
          exam_registration_subject_id: student.examRegistrationSubjectId,
          student_id: student.studentInternalId,
          barcode: barcode,
          is_generated: true
        };
      });

      // Show progress
      console.log('Generating barcodes for', updates.length, 'students');

      // Simulate delay as requested
      await new Promise(resolve => setTimeout(resolve, 2000));

      const { data, error } = await supabase
        .from('barcodes')
        .upsert(updates, {
          onConflict: 'barcode',
          ignoreDuplicates: false
        })
        .select();

      if (error) {
        console.error("Upsert error", error);
        throw error;
      }

      // Update local state with new barcodes
      const updatedStudents = subjectStudents.map(student => {
        const update = updates.find(u => u.exam_registration_subject_id === student.examRegistrationSubjectId);
        return {
          ...student,
          barcode: update ? update.barcode : student.barcode
        };
      });

      setSubjectStudents(updatedStudents);
      setShowDecodePopup(false);
      showToast("Successfully Generated Barcode", { type: 'success' });

      // Refresh the subjects list to show the "View" button
      if (selectedExam && selectedDate) {
        await fetchSubjectsByDate(selectedExam, selectedDate);
      }

    } catch (error) {
      console.error('Error generating decode:', error);
      alert("Failed to generate barcodes. Please try again.");
    } finally {
      setLoadingSubjectStudents(false);
      setIsGenerating(false);
    }
  };

  // Handle PDF Download
  const handleDownloadPDF = async () => {
    // strict mode need to invoke raw element creation or use existing data to build a print-specific view
    // We will create a temporary container off-screen to render the print layout
    const printContainer = document.createElement('div');
    printContainer.style.position = 'absolute';
    printContainer.style.top = '-9999px';
    printContainer.style.left = '-9999px';
    printContainer.style.width = '210mm'; // A4 width
    printContainer.style.backgroundColor = '#fff';
    printContainer.style.padding = '20px';
    document.body.appendChild(printContainer);

    // Build the table HTML with 3 barcode columns
    // We need to render the Barcode component to SVG strings or similar, but since we are in React context, 
    // we can't easily render React components to HTML string with full lifecycle affecting imports like 'react-barcode'.
    // However, since we are already inside a component, we can perhaps use a state to show a "print mode" view?
    // A cleaner approach in a functional component without heavy refactoring:
    // We can render the Barcode components into the hidden container using standard React rendering if we had a portal, 
    // but simpler: Clone the visible table logic but modify the columns.

    // Actually, html2canvas works on DOM elements. Let's create a visible but hidden from user (e.g. z-index behind or covered) specific print view 
    // OR just modify the existing logic to conditionally render a printable table and capture that?
    // User wants "download" action.

    // Let's go with the "Create a temporary React-rendered structure" approach isn't easy here within one function.
    // Better: Render the specific download structure into a hidden div using standard DOM manipulation for the text parts, and for barcodes...
    // simpler: react-barcode renders an SVG/Canvas. We can clone the existing table rows and append 2 more barcode cells.

    // Let's try this: 
    // 1. Clone the decode-table-container node.
    // 2. Modify the cloned node to add 2 more barcode headers and 2 more barcode cells per row (cloning the existing barcode cell's content).
    // 3. Append clone to body (off-screen).
    // 4. Capture.
    // 5. Remove.

    const sourceTable = document.getElementById('decode-table-container');
    if (!sourceTable) return;

    const clonedContainer = sourceTable.cloneNode(true);
    // Be careful, clonenode might not capture canvas contents if they are canvas, but react-barcode usually uses SVG or Canvas. 
    // If it uses Canvas, we need to manually copy content. react-barcode default is SVG (renderer='svg').
    // Let's assume SVGs are fine.

    // Modify headers
    const theadRow = clonedContainer.querySelector('thead tr');
    if (theadRow) {
      // Append 2 more "Barcode" headers
      const barcodeHeader = theadRow.lastElementChild; // Assuming Barcode is last
      if (barcodeHeader) {
        theadRow.appendChild(barcodeHeader.cloneNode(true));
        theadRow.appendChild(barcodeHeader.cloneNode(true));
      }
    }

    // Modify body rows
    const tbodyRows = clonedContainer.querySelectorAll('tbody tr');
    tbodyRows.forEach(row => {
      const barcodeCell = row.lastElementChild;
      if (barcodeCell) {
        // We clone the cell. 
        // Note: If the barcode is a CANVAS, cloneNode won't copy the drawing context.
        // If SVG, it's fine.
        // Let's check typical usage. react-barcode uses jsbarcode which defaults to SVG usually in standard usage but can be canvas.
        // In the code: <Barcode value={student.barcode} ... />. 
        // We will assume SVG for now. If canvas, we'd need to re-draw.
        // But wait, the previous html2canvas worked on the visible table, so standard DOM capture works.
        row.appendChild(barcodeCell.cloneNode(true));
        row.appendChild(barcodeCell.cloneNode(true));
      }
    });

    // Style for capture
    clonedContainer.style.position = 'fixed';
    clonedContainer.style.top = '-10000px';
    clonedContainer.style.width = '1200px'; // Wide enough for 3 barcodes
    clonedContainer.style.backgroundColor = '#fff';
    clonedContainer.style.zIndex = '-1';
    document.body.appendChild(clonedContainer);

    try {
      const canvas = await html2canvas(clonedContainer, {
        scale: 2,
        backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${selectedSubjectForDecode?.subject_code || 'subject'}-barcodes.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
    } finally {
      document.body.removeChild(clonedContainer);
    }
  };

  // Close popup when clicking outside
  const closeDecodePopup = (e) => {
    if (e.target === e.currentTarget) {
      setShowDecodePopup(false);
      // Reset the decode generated state when closing the popup
      setIsDecodeGenerated(false);
    }
  };

  // Rest of the component...

  return (
    <AdminShell>
      {/* Decode Generation Modal */}
      {showDecodePopup && selectedSubjectForDecode && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-50 d-flex align-items-center justify-content-center z-3"
          style={{ backdropFilter: 'blur(2px)' }}
          onClick={closeDecodePopup}
        >
          {/* Modal content */}
          <div
            className="bg-white rounded-3 shadow-lg"
            style={{ width: '90%', maxWidth: '600px', maxHeight: '90vh', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center p-3 border-bottom">
              <div>
                <h5 className="mb-0 fw-bold">
                  Subject: {selectedSubjectForDecode.subject_code} - {selectedSubjectForDecode.subject_name}
                </h5>
              </div>
              <button
                type="button"
                className="btn-close"
                onClick={() => setShowDecodePopup(false)}
                aria-label="Close"
              ></button>
            </div>

            {/* Content */}
            <div className="p-3" style={{ overflowY: 'auto', maxHeight: 'calc(90vh - 120px)' }}>
              {loadingSubjectStudents ? (
                <div className="text-center py-4">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                </div>
              ) : isDecodeGenerated && subjectStudents.length > 0 ? (
                <div id="decode-table-container" className="table-responsive">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>S.NO</th>
                        <th>Subject</th>
                        <th>Hall Ticket No.</th>
                        <th>Barcode</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subjectStudents.map((student, index) => (
                        <tr key={`${student.studentId}-${index}`}>
                          <td className="text-muted">{index + 1}.</td>
                          <td>
                            {selectedSubjectForDecode
                              ? `${selectedSubjectForDecode.subject_code}-${selectedSubjectForDecode.subject_name}`
                              : "N/A"}
                          </td>
                          <td>{student.hallTicketNo || "N/A"}</td>
                          <td>
                            {student.barcode ? (
                              <Barcode value={student.barcode} height={25} width={1} displayValue={true} fontSize={10} margin={0} />
                            ) : (
                              <span className="text-muted">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-5">
                  <div className="mb-4">
                    <i className="bi bi-person-lines-fill fs-1 text-primary"></i>
                    <h4 className="mt-3">Generate Barcode</h4>
                    <p className="text-muted">Click the button below to view students for this subject</p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="d-flex justify-content-end gap-2 p-3 border-top">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => setShowDecodePopup(false)}
              >
                Cancel
              </button>
              {isDecodeGenerated && (
                <button
                  type="button"
                  className="btn btn-outline-primary"
                  onClick={handleDownloadPDF}
                >
                  <i className="bi bi-download me-2"></i>Download
                </button>
              )}
              {!isDecodeGenerated && (
                <button
                  type="button"
                  className="btn btn-primary px-4"
                  onClick={handleGenerateDecode}
                  disabled={loadingSubjectStudents || isGenerating}
                >
                  {loadingSubjectStudents || isGenerating ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      {isGenerating ? 'Processing...' : 'Generating...'}
                    </>
                  ) : (
                    'Generate Barcode'
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
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
            <label className="form-label">Exam Date</label>
            <select
              className="form-select mb-3"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              disabled={!selectedExam || loadingDates}
            >
              <option value="">Select Date</option>
              {examDates.map((date) => (
                <option key={date} value={date}>
                  {new Date(date).toLocaleDateString()}
                </option>
              ))}
            </select>
            {loadingDates && (
              <div className="text-muted small">Loading dates...</div>
            )}

            {selectedDate && (
              <div className="mb-3">
                <label className="form-label d-block">
                  Select Subject
                  {!loadingSubjectsByDate && selectedDate && subjectsByDate.length > 0 && (
                    <span className="text-muted ms-2">
                      ({subjectsByDate.length} subject{subjectsByDate.length !== 1 ? 's' : ''} available)
                    </span>
                  )}
                </label>

                {loadingSubjectsByDate ? (
                  <div className="d-flex align-items-center text-muted">
                    <div className="spinner-border spinner-border-sm me-2" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    Loading subjects...
                  </div>
                ) : !selectedDate ? (
                  <div className="alert alert-info mb-0">
                    Please select an exam date to view subjects
                  </div>
                ) : subjectsByDate.length === 0 ? (
                  <div className="alert alert-warning mb-0">
                    No subjects found for the selected date
                  </div>
                ) : (
                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {subjectsByDate.map((subject, index) => {
                      const isDisabled = subject.isGenerated;
                      return (
                        <div key={subject.subject_code} className="d-flex align-items-center mb-2">
                          <div
                            className={`flex-grow-1 p-2 border rounded d-flex align-items-center ${selectedSubject === subject.subject_code ? 'bg-primary text-white border-primary' : isDisabled ? 'bg-light border-secondary-subtle opacity-75' : 'bg-light border-secondary-subtle'}`}
                            onClick={() => !isDisabled && handleSubjectSelect(subject.subject_code)}
                            style={{ cursor: isDisabled ? 'default' : 'pointer' }}
                          >
                            <div className={`me-3 ${selectedSubject === subject.subject_code ? 'text-white-50' : 'text-muted'}`} style={{ minWidth: '24px', textAlign: 'right' }}>
                              {index + 1}.
                            </div>
                            <div className="flex-grow-1">
                              <div className="fw-semibold">
                                {subject.subject_code} - {subject.subject_name}
                                {subject.isGenerated && (
                                  <span className="ms-2 badge bg-success-subtle text-success border border-success-subtle rounded-pill" style={{ fontSize: '0.7em' }}>
                                    Generated Barcode
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          {subject.isGenerated && (
                            <button
                              className="btn btn-sm btn-outline-primary ms-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSubjectSelect(subject.subject_code);
                              }}
                            >
                              View
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}


            {!selectedExam ? (
              <div className="form-text text-muted">
                Please select an exam first
              </div>
            ) : !selectedDate ? (
              <div className="form-text text-muted">
                Please select an exam date
              </div>
            ) : (
              <div className="form-text text-muted">
                {examDates.length === 0 ? 'No dates found for this exam' : ''}
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

        {/* Show no results message only after search */}
        {!loadingExamSubjects && selectedSubject && subjectStudents.length === 0 && (
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
            <h5 className="mb-0">Subjects &amp; Barcodes</h5>
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
              No subjects or barcodes found for this semester.
            </p>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead>
                  <tr>
                    <th>Subject Name</th>
                    <th>Subject Code</th>
                    <th>Barcode</th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((row, index) => {
                    const key = `${row.subject_code || row.subject_name || ""}-${row.barcode || "none"}-${index}`;
                    const isVisible = !!visibleDecodeRows[key];
                    return (
                      <tr key={key}>
                        <td>{row.subject_name || "-"}</td>
                        <td>{row.subject_code || "-"}</td>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            {row.barcode && (
                              <div className="position-relative d-inline-block">
                                {isVisible && (
                                  <div className="position-absolute bottom-100 start-50 translate-middle-x mb-1 px-2 py-1 bg-white border rounded shadow-sm small" style={{ zIndex: 10 }}>
                                    <Barcode value={row.barcode} height={30} width={1} displayValue={true} fontSize={12} margin={0} />
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
