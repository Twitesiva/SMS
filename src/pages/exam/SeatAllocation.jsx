import { useEffect, useState } from "react";
import AdminShell from "../../components/AdminShell";
import { api } from "../../lib/mockApi";
import { supabase } from "../../../supabaseClient";

import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import logo from "../../assets/media/images.png";
import { logActivity } from "../../lib/logger";
import { useAuth } from "../../store/auth";

export default function SeatAllocation() {
    const { user } = useAuth();
    const [filters, setFilters] = useState({
        exam: "",
        date: "",
        subject: "",
    });

    const [options, setOptions] = useState({
        exams: [],
        dates: [],
        subjects: [], // { code, name, id }
    });

    const [loading, setLoading] = useState(false);
    const [students, setStudents] = useState([]);
    const [fetchingStudents, setFetchingStudents] = useState(false);

    // Load Exams
    useEffect(() => {
        const loadExams = async () => {
            try {
                const exams = await api.listExams();
                setOptions((prev) => ({ ...prev, exams: exams || [] }));
            } catch (err) {
                console.error("Failed to load exams", err);
            }
        };
        loadExams();
    }, []);

    // Load Dates based on Exam
    useEffect(() => {
        if (!filters.exam) {
            setOptions((prev) => ({ ...prev, dates: [], subjects: [] }));
            return;
        }

        const loadDates = async () => {
            try {
                const { data, error } = await supabase
                    .from("exam_schedule")
                    .select("exam_date")
                    .eq("exam_master_id", filters.exam)
                    .order("exam_date");

                if (error) throw error;

                // Unique dates
                const dates = [...new Set(data.map((d) => d.exam_date))];
                setOptions((prev) => ({ ...prev, dates, subjects: [] }));
                setFilters((prev) => ({ ...prev, date: "", subject: "" }));
            } catch (err) {
                console.error("Failed to load dates", err);
            }
        };
        loadDates();
    }, [filters.exam]);

    // Load Subjects based on Exam and Date
    useEffect(() => {
        if (!filters.exam || !filters.date) {
            setOptions((prev) => ({ ...prev, subjects: [] }));
            return;
        }

        const loadSubjects = async () => {
            try {
                // Get subject codes from schedule
                const { data: scheduleData, error: scheduleError } = await supabase
                    .from("exam_schedule")
                    .select("subject_code")
                    .eq("exam_master_id", filters.exam)
                    .eq("exam_date", filters.date);

                if (scheduleError) throw scheduleError;

                const subjectCodes = scheduleData.map((s) => s.subject_code);

                if (subjectCodes.length === 0) {
                    setOptions((prev) => ({ ...prev, subjects: [] }));
                    return;
                }

                // Get details (name, id) from subjects table
                // distinct subject_codes
                const uniqueCodes = [...new Set(subjectCodes)];

                const { data: subjectDetails, error: subjectError } = await supabase
                    .from("subjects")
                    .select("subject_id, subject_code, subject_name")
                    .in("subject_code", uniqueCodes);

                if (subjectError) throw subjectError;

                const normalizedSubjects = (subjectDetails || [])
                    .filter((sub) => sub?.subject_id && sub?.subject_code)
                    .map((sub) => ({
                        ...sub,
                        subject_code: String(sub.subject_code).trim(),
                        subject_name: String(sub.subject_name || '').trim()
                    }))
                    .filter((sub) => sub.subject_code)
                    .reduce((acc, sub) => {
                        if (!acc.some((item) => item.subject_code === sub.subject_code)) {
                            acc.push(sub);
                        }
                        return acc;
                    }, []);

                setOptions((prev) => ({ ...prev, subjects: normalizedSubjects }));
                setFilters((prev) => ({ ...prev, subject: "" }));

            } catch (err) {
                console.error("Failed to load subjects", err);
            }
        };
        loadSubjects();
    }, [filters.exam, filters.date]);

    // Fetch Students
    useEffect(() => {
        if (!filters.exam || !filters.date || !filters.subject) {
            setStudents([]);
            return;
        }

        const fetchStudents = async () => {
            setFetchingStudents(true);
            try {
                const selectedSubjectId = filters.subject;

                // Find exam registrations for this exam
                const { data: registrations, error: regError } = await supabase
                    .from("exam_registrations")
                    .select("id, student_id, semester")
                    .eq("exam_id", filters.exam);

                if (regError) throw regError;

                const regIds = registrations.map(r => r.id);

                if (regIds.length === 0) {
                    setStudents([]);
                    return;
                }

                // Find which registrations have this subject
                const { data: regSubjects, error: regSubError } = await supabase
                    .from("exam_registration_subjects")
                    .select("exam_registration_id")
                    .in("exam_registration_id", regIds)
                    .eq("subject_id", selectedSubjectId);

                if (regSubError) throw regSubError;

                const validRegIds = regSubjects.map(rs => rs.exam_registration_id);
                const validRegistrations = registrations.filter(r => validRegIds.includes(r.id));

                const validStudentIds = validRegistrations.map(r => r.student_id);

                const semesterMap = new Map();
                validRegistrations.forEach(r => semesterMap.set(r.student_id, r.semester));

                if (validStudentIds.length === 0) {
                    setStudents([]);
                    return;
                }

                // Fetch seat allocations
                const { data: seatData, error: seatError } = await supabase
                    .from("student_subject_seats")
                    .select("student_id, seat_number")
                    .eq("exam_id", filters.exam)
                    .eq("subject_id", selectedSubjectId)
                    .in("student_id", validStudentIds);

                if (seatError) throw seatError;

                const seatMap = new Map();
                seatData.forEach(s => seatMap.set(s.student_id, s.seat_number));

                // Fetch student details
                const { data: studentsData, error: studentsError } = await supabase
                    .from("students")
                    .select("*")
                    .in("id", validStudentIds)
                    .order("hall_ticket_no");

                if (studentsError) throw studentsError;

                const studentsWithSeats = studentsData.map(s => ({
                    ...s,
                    seat_number: seatMap.get(s.id) || "-",
                    semester: semesterMap.get(s.id)
                }));

                setStudents(studentsWithSeats);

            } catch (err) {
                console.error("Failed to fetch students", err);
            } finally {
                setFetchingStudents(false);
            }
        };

        fetchStudents();
    }, [filters.exam, filters.date, filters.subject]);



    const [showPreview, setShowPreview] = useState(false);
    const [printMetadata, setPrintMetadata] = useState(null);

    const formatTime = (timeStr) => {
        if (!timeStr) return "";
        const [h, m] = timeStr.split(":");
        const hour = parseInt(h);
        const ampm = hour >= 12 ? "PM" : "AM";
        const hour12 = hour % 12 || 12;
        return `${hour12}:${m} ${ampm}`;
    };

    const handlePreview = async () => {
        if (!students.length) return;
        try {
            // 1. Get schedule details for time
            const { data: scheduleData } = await supabase
                .from("exam_schedule")
                .select("exam_start_time, exam_end_time, subject_code")
                .eq("exam_master_id", filters.exam)
                .eq("exam_date", filters.date);

            const selectedSub = options.subjects.find(s => s.subject_id == filters.subject);
            const subjectCode = selectedSub?.subject_code;
            const schedule = scheduleData?.find(s => s.subject_code === subjectCode);

            const startTime = schedule?.exam_start_time ? formatTime(schedule.exam_start_time) : "";
            const endTime = schedule?.exam_end_time ? formatTime(schedule.exam_end_time) : "";

            const timeStr = (startTime && endTime) ? `${startTime} TO ${endTime}` : (startTime || endTime || "");

            // 2. Fetch extensive subject/course/group details
            const { data: subjectMeta } = await supabase
                .from("subjects")
                .select(`
                    subject_code,
                    subject_name,
                    courses:course_name (
                        course_name,
                        group_name
                    )
                `)
                .eq("subject_id", filters.subject)
                .single();

            const groupName = subjectMeta?.courses?.group_name || "";
            const courseName = subjectMeta?.courses?.course_name || "";

            const uniqueSemesters = [...new Set(students.map(s => s.semester))].filter(Boolean).join(", ");

            setPrintMetadata({
                examName: options.exams.find(e => e.id == filters.exam)?.exam_name,
                examDate: filters.date,
                examTime: timeStr,
                group: groupName,
                course: courseName,
                subjectTitle: `${subjectMeta?.subject_code} - ${subjectMeta?.subject_name}`,
                semester: uniqueSemesters ? `${uniqueSemesters} Semester` : "",
                students: students
            });

            setShowPreview(true);

        } catch (err) {
            console.error("Preview failed", err);
        }
    };

    const handleConfirmDownload = async () => {
        try {
            const printElement = document.getElementById("seat-allocation-print");
            if (!printElement) {
                console.error("Print element not found");
                return;
            }

            const canvas = await html2canvas(printElement, {
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

            if (imgHeight > pdfHeight) {
                let heightLeft = imgHeight;
                let position = 0;

                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
                heightLeft -= pdfHeight;

                while (heightLeft >= 0) {
                    position = heightLeft - imgHeight;
                    pdf.addPage();
                    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
                    heightLeft -= pdfHeight;
                }
            } else {
                pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, imgHeight);
            }

            pdf.save(`SeatAllocation_${filters.date}.pdf`);

            await logActivity(supabase, {
                description: `${user?.role || 'User'} downloaded seat allocation list for ${printMetadata?.subjectTitle} (${filters.date})`,
                action: 'DOWNLOAD',
                page: 'Seat Allocation',
                user: user,
                role: user?.role
            });

            setShowPreview(false); // Close after download

        } catch (err) {
            console.error("PDF generation failed", err);
            alert("Failed to generate PDF");
        }
    };

    const handleChange = (field, value) => {
        setFilters((prev) => ({ ...prev, [field]: value }));
    };

    // Helpes
    const selectedSubjectDetails = options.subjects.find(s => s.subject_id == filters.subject);

    return (
        <AdminShell>
            {/* Hidden Print Template */}
            {/* Preview Modal */}
            {showPreview && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
                    backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1050,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        padding: '1rem',
                        borderRadius: '8px',
                        marginBottom: '1rem',
                        maxHeight: '90vh',
                        overflow: 'auto',
                        width: 'auto'
                    }}>

                        <div id="seat-allocation-print" style={{ width: "210mm", background: "#fff", padding: "10mm", color: "#000", border: "1px solid #ddd" }}>
                            <div className="d-flex align-items-center mb-3">
                                <img src={logo} alt="Logo" style={{ width: 80, height: 80, objectFit: "contain", marginRight: "1rem" }} />
                                <div className="text-center flex-grow-1">
                                    <h4 className="fw-bold mb-1 text-uppercase" style={{ letterSpacing: '0.05em' }}>VIJAYAM ARTS & SCIENCE COLLEGE</h4>
                                    <h6 className="fw-bold mb-1 text-uppercase">UG DEGREE COURSES</h6>
                                    <h6 className="fw-bold mb-0 text-uppercase" style={{ textDecoration: "underline" }}>
                                        SIGNATURE STATEMENT FOR EXAMINATIONS
                                    </h6>
                                </div>
                            </div>

                            <div className="mb-3" style={{ fontSize: "0.9rem", lineHeight: "1.6" }}>
                                <div className="d-flex">
                                    <div style={{ width: "220px", fontWeight: "bold" }}>Exam Name</div>
                                    <div>: {printMetadata?.examName}</div>
                                </div>
                                <div className="d-flex">
                                    <div style={{ width: "220px", fontWeight: "bold" }}>Exam Date</div>
                                    <div>: {printMetadata?.examDate ? new Date(printMetadata.examDate).toLocaleDateString("en-GB") : ""}</div>
                                </div>
                                <div className="d-flex">
                                    <div style={{ width: "220px", fontWeight: "bold" }}>Exam Time</div>
                                    <div>: {printMetadata?.examTime}</div>
                                </div>
                                <div className="d-flex">
                                    <div style={{ width: "220px", fontWeight: "bold" }}>Group Name</div>
                                    <div>: {printMetadata?.group}</div>
                                </div>
                                <div className="d-flex">
                                    <div style={{ width: "220px", fontWeight: "bold" }}>Course Name</div>
                                    <div>: {printMetadata?.course}</div>
                                </div>
                                <div className="d-flex">
                                    <div style={{ width: "220px", fontWeight: "bold" }}>Subject Name</div>
                                    <div>: {printMetadata?.subjectTitle}</div>
                                </div>
                                <div className="d-flex">
                                    <div style={{ width: "220px", fontWeight: "bold" }}>Semester</div>
                                    <div>: {printMetadata?.semester}</div>
                                </div>
                            </div>

                            <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000" }}>
                                <thead>
                                    <tr className="text-center align-middle" style={{ backgroundColor: "#f2f2f2" }}>
                                        <th style={{ width: "50px", border: "1px solid #000", padding: "5px" }}>Sl. No.</th>
                                        <th style={{ width: "80px", border: "1px solid #000", padding: "5px" }}>Seat No</th>
                                        <th style={{ width: "60px", border: "1px solid #000", padding: "5px" }}>Photo</th>
                                        <th style={{ width: "120px", border: "1px solid #000", padding: "5px" }}>Hall Ticket No.</th>
                                        <th style={{ border: "1px solid #000", padding: "5px" }}>Name of the Student</th>
                                        <th style={{ width: "100px", border: "1px solid #000", padding: "5px" }}>Booklet No.</th>
                                        <th style={{ width: "100px", border: "1px solid #000", padding: "5px" }}>Signature</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {printMetadata?.students?.map((student, index) => (
                                        <tr key={student.id} className="align-middle">
                                            <td className="text-center" style={{ border: "1px solid #000", height: "50px", padding: "5px" }}>{index + 1}</td>
                                            <td className="text-center fw-bold" style={{ border: "1px solid #000", padding: "5px" }}>{student.seat_number}</td>
                                            <td className="text-center" style={{ border: "1px solid #000", padding: "2px" }}>
                                                {student.photo_url ? (
                                                    <img src={student.photo_url} alt="" style={{ width: "40px", height: "45px", objectFit: "cover", display: "block", margin: "0 auto" }} />
                                                ) : ""}
                                            </td>
                                            <td className="text-center fw-bold" style={{ border: "1px solid #000", padding: "5px" }}>{student.hall_ticket_no}</td>
                                            <td style={{ border: "1px solid #000", padding: "5px", textAlign: "left" }}>{student.full_name}</td>
                                            <td style={{ border: "1px solid #000", padding: "5px" }}></td>
                                            <td style={{ border: "1px solid #000", padding: "5px" }}></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="d-flex gap-2">
                        <button className="btn btn-secondary btn-lg" onClick={() => setShowPreview(false)}>
                            Cancel
                        </button>
                        <button className="btn btn-primary btn-lg" onClick={handleConfirmDownload}>
                            <i className="bi bi-download me-2"></i> Confirm Download
                        </button>
                    </div>

                </div>
            )}

            <div className="mb-4 d-flex justify-content-between align-items-center">
                <div>
                    <h3 className="fw-bold text-dark">Seat Allocation</h3>
                    <p className="text-muted">Manage exam seat allocations</p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={handlePreview}
                    disabled={students.length === 0}
                >
                    <i className="bi bi-file-earmark-pdf me-2"></i> Download PDF
                </button>
            </div>

            <div className="card shadow-sm border-0 mb-4">
                <div className="card-body">
                    <div className="row g-3">
                        <div className="col-md-4">
                            <label className="form-label fw-semibold">Exam Name</label>
                            <select
                                className="form-select"
                                value={filters.exam}
                                onChange={(e) => handleChange("exam", e.target.value)}
                            >
                                <option value="">Select Exam</option>
                                {options.exams.map((exam) => (
                                    <option key={exam.id} value={exam.id}>
                                        {exam.exam_name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="col-md-4">
                            <label className="form-label fw-semibold">Date</label>
                            <select
                                className="form-select"
                                value={filters.date}
                                onChange={(e) => handleChange("date", e.target.value)}
                                disabled={!filters.exam}
                            >
                                <option value="">Select Date</option>
                                {options.dates.map((date) => (
                                    <option key={date} value={date}>
                                        {new Date(date).toLocaleDateString("en-GB")}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="col-md-4">
                            <label className="form-label fw-semibold">Subject</label>
                            <select
                                className="form-select"
                                value={filters.subject}
                                onChange={(e) => handleChange("subject", e.target.value)}
                                disabled={!filters.date}
                            >
                                <option value="">Select Subject</option>
                                {options.subjects.map((sub) => (
                                    <option key={sub.subject_id} value={sub.subject_id}>
                                        {sub.subject_code} - {sub.subject_name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <div className="card shadow-sm border-0">
                <div className="card-header bg-white py-3">
                    <div className="d-flex align-items-center justify-content-between">
                        <h5 className="mb-0 fw-bold">Applied Students</h5>
                        <span className="badge bg-primary rounded-pill">
                            Count: {students.length}
                        </span>
                    </div>
                </div>
                <div className="card-body p-0">
                    <div className="table-responsive">
                        <style>
                            {`
                                .seat-allocation-table {
                                    border-collapse: collapse;
                                    width: 100%;
                                }
                                .seat-allocation-table th,
                                .seat-allocation-table td {
                                    border: 1px solid #000 !important;
                                    vertical-align: middle;
                                }
                                .seat-allocation-table th {
                                    font-weight: 600;
                                    text-align: center;
                                }
                                .seat-allocation-table td {
                                    text-align: center;
                                }
                                /* Align Student Name and Hall Ticket to left if preferred, or keep center for grid look */
                                /* Let's keep Student Name left aligned as it looks better usually */
                                .seat-allocation-table td:nth-child(5) {
                                    text-align: left;
                                }
                            `}
                        </style>
                        <table className="table seat-allocation-table mb-0">
                            <thead className="activity-table-header">
                                <tr>
                                    <th scope="col" style={{ width: '5%' }}>S.No</th>
                                    <th scope="col" style={{ width: '10%' }}>Seat No</th>
                                    <th scope="col" style={{ width: '10%' }}>Photo</th>
                                    <th scope="col" style={{ width: '15%' }}>Hall Ticket No</th>
                                    <th scope="col" style={{ width: '30%' }}>Student Name</th>
                                    <th scope="col" style={{ width: '15%' }}>Booklet No.</th>
                                    <th scope="col" style={{ width: '15%' }}>Signature</th>
                                </tr>
                            </thead>
                            <tbody>
                                {fetchingStudents ? (
                                    <tr>
                                        <td colSpan="7" className="text-center py-5 text-muted">
                                            <div className="spinner-border spinner-border-sm me-2" role="status" />
                                            Loading data...
                                        </td>
                                    </tr>
                                ) : students.length > 0 ? (
                                    students.map((student, index) => (
                                        <tr key={student.id}>
                                            <td className="text-muted">{index + 1}</td>
                                            <td className="fw-bold text-primary">{student.seat_number}</td>
                                            <td>
                                                {student.photo_url ? (
                                                    <img
                                                        src={student.photo_url}
                                                        alt=""
                                                        className="rounded border"
                                                        style={{ width: 50, height: 55, objectFit: "cover" }}
                                                    />
                                                ) : (
                                                    <div
                                                        className="rounded bg-light d-inline-flex align-items-center justify-content-center text-muted border"
                                                        style={{ width: 50, height: 55 }}
                                                    >
                                                        <i className="bi bi-person-fill"></i>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="fw-semibold">{student.hall_ticket_no}</td>
                                            <td className="text-start">{student.full_name}</td>
                                            <td></td>
                                            <td></td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="7" className="text-center py-5 text-muted">
                                            {filters.subject
                                                ? "No students found for the selected criteria."
                                                : "Please select all filters to view students."}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AdminShell>
    );
}
