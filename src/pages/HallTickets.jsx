import { useEffect, useMemo, useState } from "react";
import AdminShell from "../components/AdminShell";
import { api } from "../lib/mockApi";

import { supabase } from "../../supabaseClient";
import collegeLogo from "../assets/media/images.png";

import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const HallTicketTemplate = ({ student, papers, examLabel }) => (
  <div style={{ width: "210mm", backgroundColor: "#fff", padding: "10mm" }}>
    <div className="d-flex justify-content-between gap-3 flex-wrap align-items-start">
      <img
        src={collegeLogo}
        alt="College logo"
        style={{ width: 80, height: 80, objectFit: "contain" }}
        className="rounded border"
      />
      <div className="text-center flex-grow-1">
        <div className="text-uppercase text-muted fs-5 fw-bold">
          Vijayam Arts and Science College
        </div>
        <h6 className="fw-bold mb-1">
          {examLabel || "Exam Details"}
        </h6>
        <div className="fw-semibold fs-5">Hall Ticket</div>
      </div>
      <div className="text-end">
        <img
          src={
            student.photo ||
            "https://via.placeholder.com/80?text=Photo"
          }
          alt="Student"
          className="rounded border mt-1"
          style={{ width: 80, height: 80, objectFit: "cover" }}
        />
      </div>
    </div>
    <div className="d-flex flex-column gap-1 mt-3 text-start">
      {[
        {
          label: "Hall Ticket Number",
          value: student.hallTicket,
        },
        { label: "Student Name", value: student.name },
        { label: "Group Name", value: student.group },
        { label: "Course Name", value: student.course },
        { label: "Semester", value: student.semester },
      ].map((column) => (
        <div
          className="d-flex align-items-center gap-2"
          key={column.label}
        >
          <span
            className="text-muted fs-7"
            style={{ width: 140 }}
          >
            {column.label}
          </span>
          <span className="text-muted">:</span>
          <span className="fw-semibold text-body">
            {column.value}
          </span>
        </div>
      ))}
    </div>
    <div className="position-relative text-center my-2 mt-4">
      <hr className="my-2" />
      <span className="position-absolute top-50 start-50 translate-middle bg-white px-2 text-uppercase small text-muted fw-bold" style={{ fontSize: '10px' }}>
        Appearing Papers
      </span>
    </div>
    <div className="mb-2">
      {papers.length > 0 ? (
        <div className="table-responsive">
          <table className="table table-bordered align-middle mb-0 table-sm" style={{ borderColor: "#dee2e6" }}>
            <thead>
              <tr>
                <th>Seat No</th>
                <th>Date</th>
                <th>Time</th>
                <th>Subject</th>
              </tr>
            </thead>
            <tbody>
              {papers.map((paper) => (
                <tr
                  key={`${paper.subjectCode}-${paper.seatNumber}-${paper.time}`}
                >
                  <td>{paper.seatNumber}</td>
                  <td>{paper.date}</td>
                  <td>{paper.time}</td>
                  <td>{paper.subjectCode} - {paper.subjectName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-muted">No papers found.</div>
      )}
    </div>
    <div className="row text-center mt-3 align-items-end">
      {[
        "Signature of the Student",
        "Signature of the Principal",
        "Controller of Examination",
      ].map((label) => (
        <div
          className="col-4 mb-2 mb-md-0 d-flex flex-column align-items-center justify-content-end"
          key={label}
          style={{ minHeight: 80 }}
        >

          <p className="mb-0 fw-semibold text-dark text-uppercase small">
            {label}
          </p>
        </div>
      ))}
    </div>
    <p className="text-muted fw-bold small mt-2 mb-1" style={{ fontSize: '10px' }}>
      Note. The information furnished above is submitted by college.
    </p>
    <hr className="border-dark border-2 mt-0 mb-1" />
    <h6
      className="text-center fw-bold text-uppercase mb-0 mt-1"
      style={{ textDecoration: "underline", textDecorationThickness: "2px", fontSize: '12px' }}
    >
      Instructions to the candidates
    </h6>
    <div className="mt-2 text-start text-muted" style={{ fontSize: '10px', lineHeight: '1.2' }}>
      {[
        "Candidates should occupy their seats in the examination hall at least 30 minutes before the commencement of the examination.",
        "Write your answer on both sides of the answer booklet. No additional booklet will be issued.",
        "Candidates should bring their Hall Ticket and Identity Card for inspection by the Chief Superintendent/ Invigilator/Observer/Squad/ University authorities.",
        "Candidates are prohibited from writing anything on their Hall Tickets or Question Papers.",
        "No candidate will be allowed to leave the examination hall until completion of half of the time allotted for the examination.",
        "Candidates must use only blue/black pen for answering.",
        "Candidates are prohibited from writing their names or Registered Numbers on any part of answer booklet except noting their Registered Numbers. Code number of Question Paper and Title of the Paper in the space provided for on the cover page of the Main Answer Booklet.",
        "Candidates are prohibited from marking any identification marks including religious signs or symbols on the Main Answer Booklet which will be treated as a case of malpractice (SMP).",
        "Candidates are prohibited from communicating either orally and or exchanging forbidden materials with other candidates during the course of examination. Otherwise such candidates stand the risk of being debarred from appearing for the examination(s).",
        "Candidate should attend examination only at the examination centre allotted to him/her.",
        "Candidate is strictly prohibited from bringing mobiles, electronic gadgets, calculators (unless specified) and forbidden materials (such as printed, handwritten, xerox or typewritten) into the examination hall which will be treated as a case of malpractice (SMP).",
        "Mobiles and Handbags, if any, carried by candidates must be deposited voluntarily in the office of the Principal before the candidates present themselves in the examination hall.",
        "Candidates are advised to verify the Date and Time of all examinations from the Time Tables displayed by the Principal/Chief Superintendent in the notice board of the examination centre.",
        "Responsibility to handover the answer booklet to the invigilator is with you only.",
        "Suits against the University if any, shall be filled in courts with in the juridiction of Chittoor district only."
      ].map((text, index) => (
        <div key={index} className="d-flex gap-2 mb-1">
          <span className="fw-bold" style={{ minWidth: '15px' }}>{index + 1}.</span>
          <span>{text}</span>
        </div>
      ))}
    </div>
  </div>
);

export default function HallTickets() {
  const [filters, setFilters] = useState({
    exam: "",
    group: "",
    course: "",
    hallTicket: "",
  });
  const [options, setOptions] = useState({
    exams: [],
    groups: [],
    courses: [],
  });
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [registeredStudents, setRegisteredStudents] = useState([]);
  const [loadingRegistrations, setLoadingRegistrations] = useState(false);
  const [registrationsError, setRegistrationsError] = useState("");
  const [modalStudent, setModalStudent] = useState(null);
  const [appearingPapers, setAppearingPapers] = useState([]);
  const [papersLoading, setPapersLoading] = useState(false);
  const [papersError, setPapersError] = useState("");

  const [printData, setPrintData] = useState(null);
  const [isDownloading, setIsDownloading] = useState(null);
  const [bulkPrintQueue, setBulkPrintQueue] = useState(null);
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);

  const [selectedStudentIds, setSelectedStudentIds] = useState(new Set());

  // Clear selection when filters change or students reload
  useEffect(() => {
    setSelectedStudentIds(new Set());
  }, [registeredStudents]);

  const toggleSelectAll = () => {
    if (selectedStudentIds.size === registeredStudents.length) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(registeredStudents.map(s => s.studentRowId)));
    }
  };

  const toggleSelectStudent = (id) => {
    const newSelected = new Set(selectedStudentIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedStudentIds(newSelected);
  };

  useEffect(() => {
    if (printData) {
      const generatePDF = async () => {
        try {
          await new Promise((resolve) => setTimeout(resolve, 500));
          const element = document.getElementById("hall-ticket-print-view");
          if (!element) return;

          const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            logging: false,
            windowWidth: 1024
          });
          const imgData = canvas.toDataURL("image/png");
          const pdf = new jsPDF("p", "mm", "a4");
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = pdf.internal.pageSize.getHeight();
          const imgProps = pdf.getImageProperties(imgData);
          const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

          // Scale to fit if too tall
          let finalWidth = pdfWidth;
          let finalHeight = imgHeight;
          if (imgHeight > pdfHeight) {
            const scaleFactor = pdfHeight / imgHeight;
            finalWidth = pdfWidth * scaleFactor;
            finalHeight = pdfHeight;
          }

          // Center the image horizontally
          const x = (pdfWidth - finalWidth) / 2;

          pdf.addImage(imgData, "PNG", x, 0, finalWidth, finalHeight);

          if (printData.action === "print") {
            const blob = pdf.output("bloburl");
            window.open(blob, "_blank");
          } else {
            pdf.save(`HallTicket_${printData.student.hallTicket}.pdf`);
          }
        } catch (error) {
          console.error("PDF Generation failed", error);
        } finally {
          setIsDownloading(null);
          setPrintData(null);
        }
      };
      generatePDF();
    }
  }, [printData]);

  useEffect(() => {
    if (!bulkPrintQueue) return;

    const generateBulkPDF = async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 500)); // Wait for render
        const elements = document.getElementsByClassName("bulk-ticket-item");

        const pdf = new jsPDF("p", "mm", "a4");
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        for (let i = 0; i < elements.length; i++) {
          const element = elements[i];
          const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            logging: false,
            windowWidth: 1024
          });

          const imgData = canvas.toDataURL("image/png");
          const imgProps = pdf.getImageProperties(imgData);
          const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

          let finalWidth = pdfWidth;
          let finalHeight = imgHeight;
          if (imgHeight > pdfHeight) {
            const scaleFactor = pdfHeight / imgHeight;
            finalWidth = pdfWidth * scaleFactor;
            finalHeight = pdfHeight;
          }
          const x = (pdfWidth - finalWidth) / 2;

          if (i > 0) pdf.addPage();
          pdf.addImage(imgData, "PNG", x, 0, finalWidth, finalHeight);
        }

        pdf.save(`HallTickets_Batch_${new Date().toISOString().slice(0, 10)}.pdf`);

      } catch (error) {
        console.error("Bulk PDF Generation failed", error);
        alert("Failed to generate bulk PDF.");
      } finally {
        setIsBulkDownloading(false);
        setBulkPrintQueue(null);
      }
    }

    // Defer slightly to ensure state update renders 
    setTimeout(generateBulkPDF, 100);

  }, [bulkPrintQueue]);

  const handleBulkDownload = async (studentsToDownload) => {
    if (!studentsToDownload.length || !filters.exam) return;
    setIsBulkDownloading(true);
    try {
      const studentIds = studentsToDownload.map(s => s.studentRowId);

      // Fetch all seats for these students for this exam
      const { data: allSeats, error: seatError } = await supabase
        .from("student_subject_seats")
        .select("seat_number, subject_id, student_id")
        .eq("exam_id", filters.exam)
        .in("student_id", studentIds);

      if (seatError) throw seatError;

      const subjectIds = Array.from(new Set(allSeats.map(s => s.subject_id).filter(Boolean)));

      let subjectMap = new Map();
      if (subjectIds.length) {
        const { data: subjects } = await supabase
          .from("subjects")
          .select("subject_id, subject_code, subject_name")
          .in("subject_id", subjectIds);
        (subjects || []).forEach(s => subjectMap.set(s.subject_id, s));
      }

      const { data: scheduleRows } = await supabase
        .from("exam_schedule")
        .select("subject_code, exam_date, exam_start_time, exam_end_time")
        .eq("exam_master_id", filters.exam);

      const scheduleMap = new Map(
        (scheduleRows || []).map((row) => [
          row.subject_code?.toString().toUpperCase(),
          row,
        ])
      );

      const queue = studentsToDownload.map(student => {
        // Find seats for this student
        const studentSeats = allSeats.filter(s => s.student_id === student.studentRowId);
        const papers = studentSeats.map(row => {
          const subject = subjectMap.get(row.subject_id);
          const code = subject?.subject_code?.toString().toUpperCase();
          const schedule = scheduleMap.get(code);

          return {
            seatNumber: row.seat_number ?? "—",
            date: schedule?.exam_date ?? "—",
            time:
              formatScheduleTimeRange(
                schedule?.exam_start_time,
                schedule?.exam_end_time
              ) || "—",
            subjectCode: subject?.subject_code ?? "—",
            subjectName: subject?.subject_name ?? "—",
          };
        });
        return { student, papers };
      });

      setBulkPrintQueue(queue);

    } catch (error) {
      console.error("Bulk download failed", error);
      setIsBulkDownloading(false);
      alert("Failed to prepare bulk download.");
    }
  };

  const handleDownloadAll = () => handleBulkDownload(registeredStudents);

  const handleDownloadSelected = () => {
    const selected = registeredStudents.filter(s => selectedStudentIds.has(s.studentRowId));
    handleBulkDownload(selected);
  };

  const handleDownloadTicket = async (student, action = "download") => {
    if (!filters.exam) return;
    setIsDownloading({ studentId: student.studentId, action });
    try {
      // If triggered from modal where we already have data
      if (modalStudent?.studentId === student.studentId && appearingPapers.length > 0) {
        setPrintData({ student: modalStudent, papers: appearingPapers, action });
        return;
      }

      const { data: seatRows, error: seatError } = await supabase
        .from("student_subject_seats")
        .select("seat_number, subject_id")
        .eq("student_id", student.studentRowId)
        .eq("exam_id", filters.exam);
      if (seatError) throw seatError;

      const subjectIds = Array.from(
        new Set(
          (seatRows || [])
            .map((row) => row.subject_id)
            .filter((id) => id !== undefined && id !== null)
        )
      );
      let subjectRows = [];
      if (subjectIds.length) {
        const { data: subjects, error: subjectError } = await supabase
          .from("subjects")
          .select("subject_id, subject_code, subject_name")
          .in("subject_id", subjectIds);
        if (subjectError) throw subjectError;
        subjectRows = subjects || [];
      }

      const subjectMap = new Map(
        subjectRows.map((row) => [row.subject_id, row])
      );

      const { data: scheduleRows, error: scheduleError } = await supabase
        .from("exam_schedule")
        .select("subject_code, exam_date, exam_start_time, exam_end_time")
        .eq("exam_master_id", filters.exam);
      if (scheduleError) throw scheduleError;

      const scheduleMap = new Map(
        (scheduleRows || []).map((row) => [
          row.subject_code?.toString().toUpperCase(),
          row,
        ])
      );

      const papers = (seatRows || []).map((row) => {
        const subject = subjectMap.get(row.subject_id);
        const code = subject?.subject_code?.toString().toUpperCase();
        const schedule = scheduleMap.get(code);
        return {
          seatNumber: row.seat_number ?? "—",
          date: schedule?.exam_date ?? "—",
          time:
            formatScheduleTimeRange(
              schedule?.exam_start_time,
              schedule?.exam_end_time
            ) || "—",
          subjectCode: subject?.subject_code ?? "—",
          subjectName: subject?.subject_name ?? "—",
        };
      });

      setPrintData({ student, papers, action });
    } catch (error) {
      console.error("Error downloading ticket:", error);
      setIsDownloading(null);
      alert("Failed to download ticket data.");
    }
  };

  useEffect(() => {
    let active = true;
    const loadOptions = async () => {
      try {
        const [exams, groups, courses] = await Promise.all([
          api.listExams?.() ?? [],
          api.listGroups?.() ?? [],
          api.listCourses?.() ?? [],
        ]);
        if (!active) return;
        setOptions({
          exams: exams || [],
          groups: groups || [],
          courses: courses || [],
        });
      } catch (err) {
        console.error("Unable to load hall ticket metadata", err);
      } finally {
        if (active) setLoadingOptions(false);
      }
    };
    loadOptions();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!options.exams || !options.exams.length) return;
    setFilters((prev) => {
      const currentValue = (prev.exam || "").toString();
      const currentExam = options.exams.find(
        (exam) => getExamValue(exam) === currentValue
      );
      if (currentExam) {
        return prev;
      }

      const fallbackExam = options.exams[0];
      if (!fallbackExam) {
        if (!prev.exam) return prev;
        return { ...prev, exam: "" };
      }

      const fallbackValue = getExamValue(fallbackExam);
      if (!fallbackValue || fallbackValue === prev.exam) {
        return prev;
      }
      return { ...prev, exam: fallbackValue };
    });
  }, [options.exams]);

  const handleFilterChange = (field) => (event) => {
    setFilters((prev) => {
      const next = { ...prev, [field]: event.target.value };
      if (field === "group") {
        next.course = "";
      }
      return next;
    });
  };

  const formatTimeTo12Hour = (value) => {
    if (!value) return "";
    const [hours, minutes] = value.split(":");
    if (hours === undefined || minutes === undefined) return value;
    const parsedHours = Number(hours);
    if (Number.isNaN(parsedHours)) return value;
    const period = parsedHours >= 12 ? "PM" : "AM";
    const normalizedHour = parsedHours % 12 === 0 ? 12 : parsedHours % 12;
    return `${normalizedHour}:${minutes.padStart(2, "0")} ${period}`;
  };

  const formatScheduleTimeRange = (startTime, endTime) => {
    const formattedStart = formatTimeTo12Hour(startTime);
    const formattedEnd = formatTimeTo12Hour(endTime);
    if (formattedStart && formattedEnd) {
      return `${formattedStart} - ${formattedEnd}`;
    }
    return formattedStart || formattedEnd || "";
  };

  const formatExamLabel = (exam) =>
    exam?.title ?? exam?.name ?? exam?.exam_name ?? "Exam";
  const formatGroupLabel = (group) =>
    group?.name ??
    group?.group_name ??
    group?.label ??
    group?.code ??
    group?.groupCode ??
    "Group";
  const formatCourseLabel = (course) =>
    course?.name ??
    course?.course_name ??
    course?.courseName ??
    course?.courseCode ??
    "Course";

  const getExamValue = (exam) =>
    String(exam?.id ?? exam?.exam_id ?? exam?.value ?? "");
  const getGroupValue = (group) =>
    group?.group_name ??
    group?.name ??
    group?.groupName ??
    group?.group_code ??
    group?.groupCode ??
    group?.code ??
    group?.id ??
    "";
  const getCourseValue = (course) =>
    course?.course_name ??
    course?.courseName ??
    course?.courseCode ??
    course?.course_code ??
    course?.id ??
    "";

  const getCourseGroupValue = (course) =>
    course?.group_name ??
    course?.groupName ??
    course?.group_code ??
    course?.groupCode ??
    "";

  const filteredCourses = filters.group
    ? options.courses.filter((course) => {
      const groupValue = getCourseGroupValue(course);
      if (!groupValue) return true;
      return groupValue === filters.group;
    })
    : options.courses;

  const selectedExamLabel = useMemo(() => {
    if (!filters.exam) return "";
    const exam = options.exams.find(
      (item) => getExamValue(item) === String(filters.exam)
    );
    return formatExamLabel(exam);
  }, [filters.exam, options.exams]);

  const handleViewStudent = (student) => {
    setModalStudent(student);
  };

  const modalBackdropStyle = {
    backgroundColor: "rgba(0, 0, 0, 0.15)",
    zIndex: 1050,
    pointerEvents: "none",
  };

  const modalDialogStyle = {
    zIndex: 1060,
  };
  const hallTicketBoxStyle = {
    width: "min(95vw, 960px)",
    borderRadius: 28,
    border: "1.25px solid rgba(0, 0, 0, 0.15)",
    boxShadow: "0 30px 60px rgba(0, 0, 0, 0.12)",
    backgroundColor: "#fff",
    padding: "2.5rem",
  };

  useEffect(() => {
    if (!modalStudent) return;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setModalStudent(null);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [modalStudent]);

  useEffect(() => {
    const loadAppearingPapers = async () => {
      if (!modalStudent || !filters.exam || !modalStudent.studentRowId) {
        setAppearingPapers([]);
        setPapersError("");
        return;
      }
      setPapersLoading(true);
      setPapersError("");
      try {
        // fetch seat assignments with subject info
        const { data: seatRows, error: seatError } = await supabase
          .from("student_subject_seats")
          .select("seat_number, subject_id")
          .eq("student_id", modalStudent.studentRowId)
          .eq("exam_id", filters.exam);
        if (seatError) throw seatError;

        const subjectIds = Array.from(
          new Set(
            (seatRows || [])
              .map((row) => row.subject_id)
              .filter((id) => id !== undefined && id !== null)
          )
        );
        let subjectRows = [];
        if (subjectIds.length) {
          const { data: subjects, error: subjectError } = await supabase
            .from("subjects")
            .select("subject_id, subject_code, subject_name")
            .in("subject_id", subjectIds);
          if (subjectError) throw subjectError;
          subjectRows = subjects || [];
        }

        const subjectMap = new Map(
          subjectRows.map((row) => [row.subject_id, row])
        );

        const { data: scheduleRows, error: scheduleError } = await supabase
          .from("exam_schedule")
          .select("subject_code, exam_date, exam_start_time, exam_end_time")
          .eq("exam_master_id", filters.exam);
        if (scheduleError) throw scheduleError;

        const scheduleMap = new Map(
          (scheduleRows || []).map((row) => [
            row.subject_code?.toString().toUpperCase(),
            row,
          ])
        );

        const papers = (seatRows || []).map((row) => {
          const subject = subjectMap.get(row.subject_id);
          const code = subject?.subject_code?.toString().toUpperCase();
          const schedule = scheduleMap.get(code);
          return {
            seatNumber: row.seat_number ?? "�",
            date: schedule?.exam_date ?? "�",
            time:
              formatScheduleTimeRange(
                schedule?.exam_start_time,
                schedule?.exam_end_time
              ) || "�",
            subjectCode: subject?.subject_code ?? "�",
            subjectName: subject?.subject_name ?? "�",
          };
        });
        setAppearingPapers(papers);
      } catch (error) {
        console.error("Unable to load appearing papers", error);
        setPapersError(error.message || "Failed to load paper details.");
      } finally {
        setPapersLoading(false);
      }
    };

    loadAppearingPapers();
  }, [modalStudent, filters.exam]);

  useEffect(() => {
    let active = true;
    const shouldFetch =
      filters.exam && (filters.hallTicket || (filters.group && filters.course));
    if (!shouldFetch) {
      setRegisteredStudents([]);
      setRegistrationsError("");
      return;
    }

    const fetchRegistrations = async () => {
      setLoadingRegistrations(true);
      setRegistrationsError("");
      try {
        const { data: registrations, error: regError } = await supabase
          .from("exam_registrations")
          .select(
            "id, student_id, academic_year, semester, group_name, course_name, status, created_at"
          )
          .eq("exam_id", filters.exam)
          .order("created_at", { ascending: true });
        if (regError) throw regError;
        const normalized = (value) => value?.toString().trim();
        const filtered = (registrations || []).filter((reg) => {
          const matchesGroup = filters.group
            ? normalized(reg.group_name) === normalized(filters.group)
            : true;
          const matchesCourse = filters.course
            ? normalized(reg.course_name) === normalized(filters.course)
            : true;
          return matchesGroup && matchesCourse;
        });
        if (!filtered.length) {
          setRegisteredStudents([]);
          return;
        }

        const studentIds = Array.from(
          new Set(filtered.map((reg) => reg.student_id).filter(Boolean))
        );
        let studentRows = [];
        if (studentIds.length) {
          const { data: students, error: studentError } = await supabase
            .from("students")
            .select(
              "id, student_id, full_name, hall_ticket_no, group_name, course_name, gender, email, photo_url"
            )
            .in("id", studentIds);
          if (studentError) throw studentError;
          studentRows = students || [];
        }
        if (!active) return;
        const studentMap = new Map(studentRows.map((s) => [s.id, s]));
        const combined = filtered.map((reg) => {
          const student = studentMap.get(reg.student_id);
          return {
            registrationId: reg.id,
            studentId: student?.student_id ?? reg.student_id,
            name: student?.full_name ?? "Unnamed student",
            hallTicket: student?.hall_ticket_no ?? "—",
            group: reg.group_name || reg.group_code || "—",
            course: reg.course_name || reg.course_code || "—",
            semester: reg.semester ?? "—",
            status: reg.status ?? "—",
            email: student?.email ?? "",
            photo: student?.photo_url ?? "",
            studentRowId: student?.id ?? null,
          };
        });
        const hallTicketFilter = filters.hallTicket?.toString().trim().toLowerCase();
        const finalList = hallTicketFilter
          ? combined.filter((student) =>
            student.hallTicket
              .toString()
              .toLowerCase()
              .includes(hallTicketFilter)
          )
          : combined;
        setRegisteredStudents(finalList);
      } catch (error) {
        if (!active) return;
        console.error("Unable to load hall ticket registrations", error);
        setRegistrationsError(error.message || "Failed to load students.");
      } finally {
        active && setLoadingRegistrations(false);
      }
    };

    fetchRegistrations();
    return () => {
      active = false;
    };
  }, [filters]);

  const shouldShowStudents =
    filters.exam && (filters.hallTicket || (filters.group && filters.course));

  return (
    <AdminShell>
      <div className="container-fluid py-4">
        <div className="row mb-4">
          <div className="col-12">
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-start gap-3">
              <div>
                <h2 className="fw-bold mb-1">Hall Tickets</h2>
                <p className="text-muted mb-0">
                  Use the dropdowns below to filter by exam, group, and course.
                  The names are loaded from the database so they stay in sync.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="row gy-4">
          <div className="col-12">
            <div className="card card-soft shadow-sm">
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-md-4">
                    <label className="form-label">Exam name</label>
                    <select
                      className="form-select"
                      value={filters.exam}
                      onChange={handleFilterChange("exam")}
                    >
                      <option value="">
                        {loadingOptions ? "Loading exams…" : "Select Exam"}
                      </option>
                      {!loadingOptions &&
                        options.exams.map((option) => {
                          const value = getExamValue(option);
                          return (
                            <option
                              key={value || option.title || option.name}
                              value={value}
                            >
                              {formatExamLabel(option)}
                            </option>
                          );
                        })}
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Group</label>
                    <select
                      className="form-select"
                      value={filters.group}
                      onChange={handleFilterChange("group")}
                    >
                      <option value="">
                        {loadingOptions ? "Loading groups…" : "Select Group"}
                      </option>
                      {!loadingOptions &&
                        options.groups.map((option) => (
                          <option
                            key={getGroupValue(option) || option.name}
                            value={getGroupValue(option)}
                          >
                            {formatGroupLabel(option)}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Course</label>
                    <select
                      className="form-select"
                      value={filters.course}
                      onChange={handleFilterChange("course")}
                    >
                      <option value="">
                        {loadingOptions ? "Loading courses…" : "Select Course"}
                      </option>
                      {!loadingOptions && filteredCourses.length === 0 && filters.group && (
                        <option disabled value="">
                          No courses available for this group
                        </option>
                      )}
                      {!loadingOptions &&
                        filteredCourses.map((option) => (
                          <option
                            key={getCourseValue(option) || option.name}
                            value={getCourseValue(option)}
                          >
                            {formatCourseLabel(option)}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Hall ticket no.</label>
                    <input
                      type="text"
                      className="form-control"
                      value={filters.hallTicket}
                      onChange={handleFilterChange("hallTicket")}
                      placeholder="Start typing hall ticket no."
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {shouldShowStudents && (
            <div className="col-12">
              <div className="card card-soft shadow-sm">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center gap-3 mb-3 flex-wrap">
                    <h4 className="mb-0">Registered students</h4>
                    <div className="d-flex align-items-center gap-3">
                      {loadingRegistrations && (
                        <span className="text-muted small">Loading students…</span>
                      )}
                      {selectedStudentIds.size > 0 && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={handleDownloadSelected}
                          disabled={isBulkDownloading}
                        >
                          {isBulkDownloading ? "Preparing Selected..." : `Download Selected (${selectedStudentIds.size})`}
                        </button>
                      )}
                      {registeredStudents.length > 0 && (
                        <button
                          className="btn btn-outline-primary btn-sm"
                          onClick={handleDownloadAll}
                          disabled={isBulkDownloading}
                        >
                          {isBulkDownloading ? "Preparing All..." : "Download All Hall Tickets"}
                        </button>
                      )}
                    </div>
                  </div>
                  {registrationsError && (
                    <div className="alert alert-danger mb-3">
                      {registrationsError}
                    </div>
                  )}
                  {!loadingRegistrations && !registeredStudents.length && (
                    <div className="text-muted">No students registered yet.</div>
                  )}
                  {!loadingRegistrations && registeredStudents.length > 0 && (
                    <div className="table-responsive">
                      <table className="table mb-0">
                        <thead>
                          <tr>
                            <th style={{ width: '40px' }}>
                              <div className="form-check">
                                <input
                                  className="form-check-input"
                                  type="checkbox"
                                  checked={registeredStudents.length > 0 && selectedStudentIds.size === registeredStudents.length}
                                  onChange={toggleSelectAll}
                                />
                              </div>
                            </th>
                            <th>Student ID</th>
                            <th>Name</th>
                            <th>Hall ticket</th>
                            <th>Semester</th>
                            <th>Group</th>
                            <th>Course</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {registeredStudents.map((student) => (
                            <tr key={`${student.registrationId}-${student.studentId}`}>
                              <td>
                                <div className="form-check">
                                  <input
                                    className="form-check-input"
                                    type="checkbox"
                                    checked={selectedStudentIds.has(student.studentRowId)}
                                    onChange={() => toggleSelectStudent(student.studentRowId)}
                                  />
                                </div>
                              </td>
                              <td>{student.studentId}</td>
                              <td>{student.name}</td>
                              <td>{student.hallTicket}</td>
                              <td>{student.semester}</td>
                              <td>{student.group}</td>
                              <td>{student.course}</td>
                              <td>
                                <div className="d-flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-info"
                                    onClick={() => handleViewStudent(student)}
                                  >
                                    View
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-primary"
                                    onClick={() => handleDownloadTicket(student, "download")}
                                    disabled={isDownloading?.studentId === student.studentId}
                                  >
                                    {isDownloading?.studentId === student.studentId && isDownloading?.action === "download" ? "Downloading..." : "Download"}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-secondary"
                                    onClick={() => handleDownloadTicket(student, "print")}
                                    disabled={isDownloading?.studentId === student.studentId}
                                  >
                                    {isDownloading?.studentId === student.studentId && isDownloading?.action === "print" ? "Printing..." : "Print"}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        {modalStudent && (
          <div
            className="modal fade show d-block"
            tabIndex="-1"
            role="dialog"
            aria-modal="true"
          >
            <div
              className="modal-backdrop fade show"
              style={modalBackdropStyle}
            ></div>
            <div
              className="modal-dialog modal-xl modal-dialog-centered"
              style={modalDialogStyle}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="modal-content border-0 bg-transparent">
                <div className="mx-auto" style={hallTicketBoxStyle}>
                  <div className="d-flex justify-content-between gap-3 flex-wrap align-items-start">
                    <img
                      src={collegeLogo}
                      alt="College logo"
                      style={{ width: 96, height: 96, objectFit: "contain" }}
                      className="rounded border"
                    />
                    <div className="text-center flex-grow-1">
                      <div className="text-uppercase text-muted fs-4 fw-bold">
                        Vijayam Arts and Science College
                      </div>
                      <h5 className="fw-bold mb-1">
                        {selectedExamLabel || "Exam Details"}
                      </h5>
                      <div className="fw-semibold fs-4">Hall Ticket</div>
                    </div>
                    <div className="text-end">
                      <img
                        src={
                          modalStudent.photo ||
                          "https://via.placeholder.com/96?text=Photo"
                        }
                        alt="Student"
                        className="rounded border mt-2"
                        style={{ width: 96, height: 96, objectFit: "cover" }}
                      />
                    </div>
                  </div>
                  <div className="d-flex flex-column gap-2 mt-3 text-start">
                    {[
                      {
                        label: "Hall Ticket Number",
                        value: modalStudent.hallTicket,
                      },
                      { label: "Student Name", value: modalStudent.name },
                      { label: "Group Name", value: modalStudent.group },
                      { label: "Course Name", value: modalStudent.course },
                      { label: "Semester", value: modalStudent.semester },
                    ].map((column) => (
                      <div
                        className="d-flex align-items-center gap-2"
                        key={column.label}
                      >
                        <span
                          className="text-muted fs-7"
                          style={{ width: 150 }}
                        >
                          {column.label}
                        </span>
                        <span className="text-muted">:</span>
                        <span className="fw-semibold text-body">
                          {column.value}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="position-relative text-center my-4">
                    <hr />
                    <span className="position-absolute top-50 start-50 translate-middle bg-white px-3 text-uppercase small text-muted fw-bold">
                      Appearing Papers
                    </span>
                  </div>
                  <div className="mb-3">
                    {papersLoading && (
                      <div className="text-muted">Loading papers...</div>
                    )}
                    {papersError && (
                      <div className="alert alert-warning mb-2">
                        {papersError}
                      </div>
                    )}
                    {appearingPapers.length > 0 && (
                      <div className="table-responsive">
                        <table className="table table-bordered align-middle mb-0" style={{ borderColor: "#dee2e6" }}>
                          <thead>
                            <tr>
                              <th>Seat No</th>
                              <th>Date</th>
                              <th>Time</th>
                              <th>Subject</th>
                            </tr>
                          </thead>
                          <tbody>
                            {appearingPapers.map((paper) => (
                              <tr
                                key={`${paper.subjectCode}-${paper.seatNumber}-${paper.time}`}
                              >
                                <td>{paper.seatNumber}</td>
                                <td>{paper.date}</td>
                                <td>{paper.time}</td>
                                <td>{paper.subjectCode} - {paper.subjectName}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {!papersLoading &&
                      !papersError &&
                      appearingPapers.length === 0 && (
                        <div className="text-muted">No papers found.</div>
                      )}
                  </div>
                  <div className="row text-center mt-4 align-items-end">
                    {[
                      "Signature of the Student",
                      "Signature of the Principal",
                      "Controller of Examination",
                    ].map((label) => (
                      <div
                        className="col-12 col-md-4 mb-3 mb-md-0 d-flex flex-column align-items-center justify-content-end"
                        key={label}
                        style={{ minHeight: 150 }}
                      >

                        <p className="mb-0 fw-semibold text-dark text-uppercase">
                          {label}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="text-muted fw-bold small mt-3">
                    Note. The information furnished above is submitted by college.
                  </p>
                  <hr className="border-dark border-2 mt-0" />
                  <h6
                    className="text-center fw-bold text-uppercase mb-0 mt-2"
                    style={{ textDecoration: "underline", textDecorationThickness: "3px" }}
                  >
                    Instructions to the candidates
                  </h6>
                  <div className="mt-3 text-start small text-muted">
                    <ol className="ps-3 mb-0">
                      <li>Candidates should occupy their seats in the examination hall at least 30 minutes before the commencement of the examination.</li>
                      <li>Write your answer on both sides of the answer booklet. No additional booklet will be issued.</li>
                      <li>Candidates should bring their Hall Ticket and Identity Card for inspection by the Chief Superintendent/ Invigilator/Observer/Squad/ University authorities.</li>
                      <li>Candidates are prohibited from writing anything on their Hall Tickets or Question Papers.</li>
                      <li>No candidate will be allowed to leave the examination hall until completion of half of the time allotted for the examination.</li>
                      <li>Candidates must use only blue/black pen for answering.</li>
                      <li>Candidates are prohibited from writing their names or Registered Numbers on any part of answer booklet except noting their Registered Numbers. Code number of Question Paper and Title of the Paper in the space provided for on the cover page of the Main Answer Booklet.</li>
                      <li>Candidates are prohibited from marking any identification marks including religious signs or symbols on the Main Answer Booklet which will be treated as a case of malpractice (SMP).</li>
                      <li>Candidates are prohibited from communicating either orally and or exchanging forbidden materials with other candidates during the course of examination. Otherwise such candidates stand the risk of being debarred from appearing for the examination(s).</li>
                      <li>Candidate should attend examination only at the examination centre allotted to him/her.</li>
                      <li>Candidate is strictly prohibited from bringing mobiles, electronic gadgets, calculators (unless specified) and forbidden materials (such as printed, handwritten, xerox or typewritten) into the examination hall which will be treated as a case of malpractice (SMP).</li>
                      <li>Mobiles and Handbags, if any, carried by candidates must be deposited voluntarily in the office of the Principal before the candidates present themselves in the examination hall.</li>
                      <li>Candidates are advised to verify the Date and Time of all examinations from the Time Tables displayed by the Principal/Chief Superintendent in the notice board of the examination centre.</li>
                      <li>Responsibility to handover the answer booklet to the invigilator is with you only.</li>
                      <li>Suits against the University if any, shall be filled in courts with in the juridiction of Chittoor district only.</li>
                    </ol>
                  </div>
                  <div className="mt-3 d-flex justify-content-end gap-2">
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => handleDownloadTicket(modalStudent, "print")}
                      disabled={isDownloading?.studentId === modalStudent.studentId}
                    >
                      {isDownloading?.studentId === modalStudent.studentId && isDownloading?.action === "print" ? "Printing..." : "Print"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => handleDownloadTicket(modalStudent, "download")}
                      disabled={isDownloading?.studentId === modalStudent.studentId}
                    >
                      {isDownloading?.studentId === modalStudent.studentId && isDownloading?.action === "download" ? "Downloading..." : "Download"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-dark"
                      onClick={() => setModalStudent(null)}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {printData && (
          <div style={{ position: "absolute", top: "-10000px", left: "-10000px" }}>
            <div id="hall-ticket-print-view">
              <HallTicketTemplate
                student={printData.student}
                papers={printData.papers}
                examLabel={selectedExamLabel}
              />
            </div>
          </div>
        )}
        {bulkPrintQueue && (
          <div style={{ position: "absolute", top: "-10000px", left: "-10000px" }}>
            {bulkPrintQueue.map((item, idx) => (
              <div className="bulk-ticket-item" key={idx}>
                <HallTicketTemplate
                  student={item.student}
                  papers={item.papers}
                  examLabel={selectedExamLabel}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
