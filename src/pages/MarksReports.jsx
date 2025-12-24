import React, { useState, useEffect, useMemo } from "react";
import AdminShell from "../components/AdminShell";
import { supabase } from "../../supabaseClient";
import { trackPromise } from "../store/ui";
import * as XLSX from 'xlsx';
import { logActivity } from "../lib/logger";
import { useAuth } from "../store/auth";

export default function MarksReports() {
    const { user } = useAuth();
    const [results, setResults] = useState([]);
    const [filters, setFilters] = useState({
        academic_year: "",
        group_name: "",
        course_name: "",
        exam_name: "",
        current_semester: "",
    });
    const [years, setYears] = useState([]);
    const [groups, setGroups] = useState([]);
    const [courses, setCourses] = useState([]);
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);

    // Derived options for dropdowns
    const examOptions = useMemo(() => exams.map((e) => e.exam_name), [exams]);

    // Filtered Results based on selected filters
    const filteredResults = useMemo(() => {
        return results.filter(r => {
            const matchesExam = !filters.exam_name || r.exam_name === filters.exam_name;
            const matchesYear = !filters.academic_year || r.academic_year === filters.academic_year;
            const matchesGroup = !filters.group_name || r.group_code === filters.group_name;
            const matchesCourse = !filters.course_name || r.course_code === filters.course_name;
            const matchesSemester = !filters.current_semester || String(r.semester) === String(filters.current_semester);

            return matchesExam && matchesYear && matchesGroup && matchesCourse && matchesSemester;
        });
    }, [results, filters]);

    // Pivot the data: Group by Student + Exam
    const { pivotedData, distinctSubjects } = useMemo(() => {
        if (!filteredResults.length) return { pivotedData: [], distinctSubjects: [] };

        const subjectsMap = new Map(); // code -> name
        const grouped = {};

        filteredResults.forEach(r => {
            // Track globally unique subjects for columns
            if (r.subject_code && !subjectsMap.has(r.subject_code)) {
                subjectsMap.set(r.subject_code, `${r.subject_code}-${r.subject_name}`);
            }

            // Create a unique key for the row (Student + Exam)
            // If we strictly filter by Exam, student_id is enough, but to be safe:
            const key = `${r.hall_ticket_no}-${r.exam_name}`;

            if (!grouped[key]) {
                grouped[key] = {
                    key,
                    student_id: r.student_id,
                    hall_ticket_no: r.hall_ticket_no,
                    student_name: r.student_name,
                    group_code: r.group_code,
                    group_name: r.group_name,
                    course_code: r.course_code,
                    course_name: r.course_name,
                    academic_year: r.academic_year,
                    semester: r.semester,
                    exam_name: r.exam_name,
                    subjects: {}, // subject_code -> { marks, max, status }
                    overall_status: 'PASS' // Default to PASS, switch to FAIL if any subject fails
                };
            }

            // Add subject data
            grouped[key].subjects[r.subject_code] = {
                name: r.subject_name,
                marks: r.marks_obtained,
                max: r.max_marks,
                status: r.result_status
            };

            // Update overall status
            // If any subject is failed or missing result, we might consider it fail/pending, 
            // but usually just distinct FAIL check.
            if (r.result_status === 'FAIL') {
                grouped[key].overall_status = 'FAIL';
            }
        });

        // Convert grouped object to array
        const pivoted = Object.values(grouped).sort((a, b) =>
            a.student_name.localeCompare(b.student_name)
        );

        // Subjects list for columns
        const subjects = Array.from(subjectsMap.entries()).map(([code, name]) => ({
            code,
            name
        })).sort((a, b) => a.name.localeCompare(b.name));

        return { pivotedData: pivoted, distinctSubjects: subjects };
    }, [filteredResults]);

    const academicYearOptions = useMemo(() => {
        const values = new Set(years.map(y => y.academic_year || y.name));
        results.forEach(r => { if (r.academic_year) values.add(r.academic_year) });
        return Array.from(values).filter(Boolean).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    }, [years, results]);

    const groupOptions = useMemo(() => groups, [groups]);

    const courseOptions = useMemo(() => {
        if (!filters.group_name) return courses;

        // Filter courses based on the selected group (linked by group_name in DB)
        const selectedGroup = groups.find(g => g.group_code === filters.group_name);
        if (!selectedGroup) return [];

        return courses.filter(c => c.group_name === selectedGroup.group_name);
    }, [courses, groups, filters.group_name]);

    const semesterOptions = useMemo(() => {
        const values = new Set();
        results.forEach(r => {
            if (r.semester) values.add(String(r.semester));
        });
        if (values.size === 0) [1, 2, 3, 4, 5, 6].forEach(s => values.add(String(s)));
        return Array.from(values).sort((a, b) => Number(a) - Number(b));
    }, [results]);


    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                // Fetch Aux Data
                const { data: groupsData } = await supabase.from("groups").select("group_code, group_name").order("group_name");
                const { data: coursesData } = await supabase.from("courses").select("course_code, course_name, group_name").order("course_name");
                const { data: yearsData } = await supabase.from("academic_year").select("academic_year").order("academic_year", { ascending: false });
                const { data: examsData } = await supabase.from("exam_master").select("id, exam_name").order("created_at", { ascending: false });

                setGroups(groupsData || []);
                setCourses(coursesData || []);
                setYears(yearsData || []);
                setExams(examsData || []);

                // Fetch Results with Joins
                // We use a large range to ensure we get all records. 
                // For production with >10k rows, server-side filtering/pagination is recommended.
                const { data: resultsData, error: resultsError } = await supabase
                    .from("results")
                    .select(`
                        id,
                        marks_obtained,
                        max_marks,
                        result_status,
                        semester,
                        student_id,
                        exam_id,
                        subject_id,
                        exam:exam_master!results_exam_fkey (
                            exam_name
                        ),
                        subject:subjects!results_subject_fkey (
                            subject_code,
                            subject_name
                        ),
                        student:students!results_student_fkey (
                            full_name,
                            hall_ticket_no,
                            academic_year,
                            group_name,
                            group:groups!students_group_id_fkey(group_code, group_name),
                            course_name,
                            course:courses!fk_students_course(course_code, course_name)
                        )
                    `)
                    .range(0, 9999);

                if (resultsError) throw resultsError;

                const transformed = (resultsData || []).map(r => {
                    const student = r.student || {};
                    const groupRel = student.group;
                    const courseRel = student.course;

                    let groupName = groupRel?.group_name || student.group_name;
                    let groupCode = groupRel?.group_code;

                    // If no direct relation code, try to find it in the groups master list by name
                    if (!groupCode && groupName) {
                        const g = groupsData.find(g => g.group_name === groupName || g.group_name?.trim() === groupName?.trim());
                        if (g) groupCode = g.group_code;
                    }
                    // Fallback to name if still not found, although this might not match the filter if filter expects a code
                    if (!groupCode) groupCode = groupName;

                    let courseName = courseRel?.course_name || student.course_name;
                    let courseCode = courseRel?.course_code;

                    if (!courseCode && courseName) {
                        const c = coursesData.find(c => c.course_name === courseName || c.course_name?.trim() === courseName?.trim());
                        if (c) courseCode = c.course_code;
                    }
                    if (!courseCode) courseCode = courseName;

                    return {
                        ...r,
                        id: r.id, // Explicitly ensure ID is present
                        exam_name: r.exam?.exam_name,
                        subject_code: r.subject?.subject_code,
                        subject_name: r.subject?.subject_name,
                        student_name: student.full_name,
                        hall_ticket_no: student.hall_ticket_no,
                        academic_year: student.academic_year,

                        group_code: groupCode,
                        group_name: groupName,
                        course_code: courseCode,
                        course_name: courseName,
                    };
                });

                setResults(transformed);

            } catch (error) {
                console.error("Error loading marks data:", error);
            } finally {
                setLoading(false);
            }
        };
        trackPromise(loadData());
    }, []);

    // Helper to calculate grade
    const calculateGrade = (marks, maxMarks, status) => {
        if (status === 'FAIL') return 'F';
        if (!marks || !maxMarks) return '-';

        const percentage = (marks / maxMarks) * 100;
        if (percentage >= 90) return 'O';
        if (percentage >= 80) return 'A+';
        if (percentage >= 70) return 'A';
        if (percentage >= 60) return 'B+';
        if (percentage >= 50) return 'B';
        if (percentage >= 40) return 'C';
        return 'F';
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({
            ...prev,
            [name]: value,
            // Reset course selection when group changes to avoid invalid states
            ...(name === "group_name" ? { course_name: "" } : {})
        }));
    };

    const downloadExcel = () => {
        const dataToExport = pivotedData.map(row => {
            const flatRow = {
                "Hall Ticket": row.hall_ticket_no,
                "Student Name": row.student_name,
                "Exam Name": row.exam_name,
                "Group": row.group_name,
                "Course": row.course_name,
                "Semester": row.semester,
            };

            // Add columns for each subject
            distinctSubjects.forEach(sub => {
                const subData = row.subjects[sub.code];
                flatRow[`${sub.name}`] = subData ? calculateGrade(subData.marks, subData.max, subData.status) : "-";
            });

            return flatRow;
        });

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Marks Report");
        XLSX.writeFile(wb, "Marks_Report.xlsx");

        logActivity(supabase, {
            description: `${user?.role || 'User'} downloaded Marks Report excel for ${filters.exam_name || 'All Exams'}`,
            action: 'DOWNLOAD',
            page: 'Marks Reports',
            user: user,
            role: user?.role
        });
    };

    return (
        <AdminShell>
            <div className="container-fluid p-4">
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <h2 className="fw-bold mb-0">Marks Reports</h2>
                    <button
                        className="btn btn-success d-flex align-items-center gap-2"
                        onClick={downloadExcel}
                        disabled={!pivotedData.length}
                    >
                        <i className="bi bi-file-earmark-spreadsheet"></i> Export to Excel
                    </button>
                </div>

                {/* Filters */}
                <div className="card shadow-sm border-0 rounded-4 mb-4">
                    <div className="card-body p-4">
                        <div className="row g-3">
                            <div className="col-md-3">
                                <label className="form-label fw-bold small text-uppercase text-muted">Exam Name</label>
                                <select className="form-select" name="exam_name" value={filters.exam_name} onChange={handleChange}>
                                    <option value="">All Exams</option>
                                    {examOptions.map(e => <option key={e} value={e}>{e}</option>)}
                                </select>
                            </div>
                            <div className="col-md-2">
                                <label className="form-label fw-bold small text-uppercase text-muted">Academic Year</label>
                                <select className="form-select" name="academic_year" value={filters.academic_year} onChange={handleChange}>
                                    <option value="">All Years</option>
                                    {academicYearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                            <div className="col-md-2">
                                <label className="form-label fw-bold small text-uppercase text-muted">Group</label>
                                <select className="form-select" name="group_name" value={filters.group_name} onChange={handleChange}>
                                    <option value="">All Groups</option>
                                    {groupOptions.map(g => <option key={g.group_code} value={g.group_code}>{g.group_name}</option>)}
                                </select>
                            </div>
                            <div className="col-md-3">
                                <label className="form-label fw-bold small text-uppercase text-muted">Course</label>
                                <select className="form-select" name="course_name" value={filters.course_name} onChange={handleChange}>
                                    <option value="">All Courses</option>
                                    {courseOptions.map(c => <option key={c.course_code} value={c.course_code}>{c.course_name}</option>)}
                                </select>
                            </div>
                            <div className="col-md-2">
                                <label className="form-label fw-bold small text-uppercase text-muted">Semester</label>
                                <select className="form-select" name="current_semester" value={filters.current_semester} onChange={handleChange}>
                                    <option value="">All Semesters</option>
                                    {semesterOptions.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>
                        {loading && (
                            <div className="text-center mt-4">
                                <div className="spinner-border text-primary" role="status">
                                    <span className="visually-hidden">Loading...</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Empty State / Prompt */}
                {!loading && !filters.exam_name && (
                    <div className="card shadow-sm border-0 rounded-4 animate__animated animate__fadeIn">
                        <div className="card-body py-5 text-center">
                            <i className="bi bi-search fs-1 text-muted mb-3 d-block opacity-50"></i>
                            <h5 className="text-muted fw-normal">Please select an <span className="fw-bold text-dark">Exam Name</span> to view marks details.</h5>
                        </div>
                    </div>
                )}

                {/* Table View */}
                {!loading && filters.exam_name && (
                    <div className="card shadow-sm border-0 rounded-4 animate__animated animate__fadeIn">
                        <div className="card-header bg-white border-0 pt-4 px-4 pb-2 d-flex justify-content-between align-items-center">
                            <h5 className="fw-bold mb-0 text-secondary">Marks Details</h5>
                            <span className="badge bg-primary rounded-pill px-3 py-2">
                                Total Students: {pivotedData.length}
                            </span>
                        </div>
                        <div className="card-body p-0">
                            <div className="table-responsive">
                                <table className="table table-bordered border-dark align-middle table-nowrap mb-0">
                                    <thead className="bg-white">
                                        <tr className="text-dark fw-bold text-uppercase border-dark">
                                            <th className="ps-4 border-dark">S.No</th>
                                            <th className="border-dark">HT No</th>
                                            <th className="border-dark">Student Name</th>
                                            <th className="border-dark">Group/Course</th>
                                            <th className="border-dark">Sem</th>
                                            {/* Dynamic Subject Headers */}
                                            {distinctSubjects.map(sub => (
                                                <th key={sub.code} className="text-center border-dark" style={{ minWidth: '100px' }}>
                                                    {sub.name}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="border-top-0">
                                        {pivotedData.length > 0 ? (
                                            pivotedData.map((row, index) => (
                                                <tr key={row.key}>
                                                    <td className="ps-4 text-muted border-dark">{index + 1}</td>
                                                    <td className="fw-medium border-dark">{row.hall_ticket_no}</td>
                                                    <td className="border-dark">
                                                        <span className="fw-semibold text-dark">{row.student_name}</span>
                                                    </td>
                                                    <td className="border-dark">
                                                        <div className="d-flex flex-column small">
                                                            <span className="fw-medium text-dark">{row.group_name}</span>
                                                            <span className="text-muted">{row.course_name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="border-dark">
                                                        <span className="badge bg-light text-dark border border-dark">
                                                            Sem {row.semester}
                                                        </span>
                                                    </td>
                                                    {/* Dynamic Marks Cells */}
                                                    {distinctSubjects.map(sub => {
                                                        const subData = row.subjects[sub.code];
                                                        const grade = subData ? calculateGrade(subData.marks, subData.max, subData.status) : '-';

                                                        return (
                                                            <td key={sub.code} className="text-center border-dark">
                                                                {subData ? (
                                                                    grade === 'F' ? (
                                                                        <span className="badge bg-danger text-white rounded-pill px-3 py-2">
                                                                            {grade}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="fw-bold text-dark">
                                                                            {grade}
                                                                        </span>
                                                                    )
                                                                ) : (
                                                                    <span className="text-muted animate__animated animate__fadeIn">-</span>
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={5 + distinctSubjects.length} className="text-center py-5 text-muted">
                                                    <div className="d-flex flex-column align-items-center">
                                                        <i className="bi bi-inbox fs-1 mb-2 opacity-50"></i>
                                                        <p className="mb-0">No records found matching the filters.</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AdminShell>
    );
}
