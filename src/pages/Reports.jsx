import React, { useState, useEffect, useMemo } from "react";
import AdminShell from "../components/AdminShell";
import { supabase } from "../../supabaseClient";
import { trackPromise } from "../store/ui";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
} from "chart.js";
import { Bar, Pie } from "react-chartjs-2";

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
);

export default function Reports() {
    const [students, setStudents] = useState([]);
    const [filters, setFilters] = useState({
        academic_year: "",
        group_name: "",
        course_name: "",
        exam_name: "",
        current_semester: "",
        payment_status: "",
    });
    const [years, setYears] = useState([]);
    const [groups, setGroups] = useState([]);
    const [courses, setCourses] = useState([]);
    const [exams, setExams] = useState([]);
    const [registrations, setRegistrations] = useState([]);
    const [loading, setLoading] = useState(true);

    const examOptions = useMemo(() => {
        return exams.map((exam) => exam.exam_name);
    }, [exams]);

    const studentsForExam = useMemo(() => {
        if (!filters.exam_name) return students;

        // Find registrations matching the exam name
        const relevantStudentIds = new Set();
        registrations.forEach((reg) => {
            if (reg.exam_master?.exam_name === filters.exam_name) {
                relevantStudentIds.add(reg.student_id);
            }
        });

        return students.filter((student) => relevantStudentIds.has(student.id));
    }, [students, filters.exam_name, registrations]);

    const academicYearOptions = useMemo(() => {
        const values = new Set();
        const addLabel = (label) => {
            const normalized = (label ?? "").toString().trim();
            if (normalized) values.add(normalized);
        };
        const sourceStudents =
            filters.exam_name && filters.exam_name !== ""
                ? studentsForExam
                : students;

        years.forEach((year) => {
            addLabel(year.academic_year ?? year.name);
        });

        sourceStudents.forEach((student) => {
            addLabel(student.academic_year ?? student.year?.academic_year);
        });

        return Array.from(values).sort((a, b) =>
            a.localeCompare(b, undefined, { numeric: true })
        );
    }, [years, students, studentsForExam, filters.exam_name]);

    const semesterOptions = useMemo(() => {
        const values = new Set();
        const sourceStudents =
            filters.exam_name && filters.exam_name !== ""
                ? studentsForExam
                : students;
        sourceStudents.forEach((student) => {
            const rawSemester =
                student.current_semester ??
                student.semester ??
                student.semester_number ??
                student.semesterNo ??
                student.semesterNumber;
            if (
                rawSemester === undefined ||
                rawSemester === null ||
                rawSemester === ""
            ) {
                return;
            }
            values.add(String(rawSemester));
        });
        if (values.size === 0) {
            [1, 2, 3, 4, 5, 6].forEach((sem) => values.add(String(sem)));
        }
        return Array.from(values).sort((a, b) => {
            const numA = Number(a);
            const numB = Number(b);
            if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
                return numA - numB;
            }
            return a.localeCompare(b);
        });
    }, [students, studentsForExam, filters.exam_name]);

    const filteredGroupOptions = useMemo(() => {
        // If we filter by exam, we strictly show groups present in the filtered students
        if (!filters.exam_name) return groups;

        const presentGroupCodes = new Set(studentsForExam.map(s => s.group_code));
        return groups.filter(g => presentGroupCodes.has(g.group_code));
    }, [groups, studentsForExam, filters.exam_name]);

    const filteredCourseOptions = useMemo(() => {
        if (!filters.exam_name && !filters.group_name) return courses;
        const relevantStudents = studentsForExam.filter((student) => {
            if (filters.group_name) {
                const groupMatch =
                    student.group_code === filters.group_name ||
                    student.group_name === filters.group_name ||
                    student.group === filters.group_name;
                return groupMatch;
            }
            return true;
        });
        if (!relevantStudents.length) return courses;
        const codes = new Set();
        const names = new Set();
        relevantStudents.forEach((student) => {
            if (student.course_code) codes.add(student.course_code);
            const courseName =
                student.course?.course_name ||
                student.course_name ||
                student.course ||
                "";
            if (courseName) names.add(courseName);
        });
        if (!codes.size && !names.size) return courses;
        return courses.filter(
            (course) =>
                (!!course.course_code && codes.has(course.course_code)) ||
                (!!course.course_name && names.has(course.course_name))
        );
    }, [
        courses,
        studentsForExam,
        filters.exam_name,
        filters.group_name,
    ]);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const { data: studentsData, error: studentsError } = await supabase
                    .from("students")
                    .select(
                        `
            *,
            group:groups!students_group_id_fkey(group_code, group_name),
            course:courses!fk_students_course(course_code, course_name),
            year:academic_year!students_academic_year_fkey(academic_year)
          `
                    )
                    .order("full_name");

                if (studentsError) throw studentsError;

                const { data: groupsData, error: groupsError } = await supabase
                    .from("groups")
                    .select("group_id, group_code, group_name, Category")
                    .order("group_name");

                if (groupsError) throw groupsError;

                const { data: coursesData, error: coursesError } = await supabase
                    .from("courses")
                    .select("course_id, course_code, course_name")
                    .order("course_name");

                if (coursesError) throw coursesError;

                const { data: yearsData, error: yearsError } = await supabase
                    .from("academic_year")
                    .select("id, academic_year")
                    .order("academic_year", { ascending: false });

                if (yearsError) throw yearsError;

                const { data: examsData, error: examsError } = await supabase
                    .from("exam_master")
                    .select("id, exam_name")
                    .order("created_at", { ascending: false });

                if (examsError) throw examsError;

                const transformedStudents = studentsData.map((student) => ({
                    ...student,
                    group_name: student.group?.group_name || student.group_name,
                    group_code: student.group?.group_code,
                    course_name: student.course?.course_name || student.course_name,
                    course_code: student.course?.course_code,
                    academic_year: student.year?.academic_year || student.academic_year,
                    category: student.Category || student.category,
                }));

                setStudents(transformedStudents);
                setYears(yearsData || []);
                setGroups(groupsData || []);
                setCourses(coursesData || []);
                setExams(examsData || []);

                const { data: regData, error: regError } = await supabase
                    .from("exam_registrations")
                    .select(`
                        id,
                        student_id, 
                        academic_year, 
                        semester, 
                        status,
                        total_fee,
                        exam_id,
                        exam_master (
                            exam_name
                        ),
                        payments (
                            amount_paid,
                            payment_status
                        )
                    `);

                if (regError) throw regError;
                setRegistrations(regData || []);

            } catch (error) {
                console.error("Error loading data:", error);
            } finally {
                setLoading(false);
            }
        };
        trackPromise(loadData());
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFilters((prev) => {
            const next = { ...prev, [name]: value };

            if (name === "exam_name") {
                next.academic_year = "";
                next.group_name = "";
                next.course_name = "";
                next.current_semester = "";
            } else if (name === "academic_year") {
                next.group_name = "";
                next.course_name = "";
                next.current_semester = "";
            } else if (name === "group_name") {
                next.course_name = "";
                next.current_semester = "";
            } else if (name === "course_name") {
                next.current_semester = "";
            }

            return next;
        });
    };

    const calculatePaymentStatus = (student) => {
        let reg;

        if (filters.exam_name) {
            reg = registrations.find(r =>
                r.student_id === student.id &&
                r.exam_master?.exam_name === filters.exam_name
            );
        }

        if (!reg && filters.academic_year) {
            const targetSem = filters.current_semester || student.current_semester;
            reg = registrations.find(r =>
                r.student_id === student.id &&
                r.academic_year === filters.academic_year &&
                String(r.semester) === String(targetSem)
            );
        }

        if (!reg) return 'Not Registered';

        const totalPaid = (reg.payments || []).reduce((sum, p) => {
            const status = (p.payment_status || '').toLowerCase();
            return status === 'success' ? sum + Number(p.amount_paid || 0) : sum;
        }, 0);

        const fee = Number(reg.total_fee || 0);
        const isPaid = (fee > 0 && totalPaid >= fee) || (fee === 0 && totalPaid > 0);

        return isPaid ? 'Paid' : 'Pending';
    };

    const filteredStudentsList = useMemo(() => {
        if (!filters.academic_year) return [];

        return studentsForExam.filter((s) => {
            const matchesYear = s.academic_year === filters.academic_year;
            const matchesGroup = !filters.group_name || s.group_code === filters.group_name;
            const matchesCourse = !filters.course_name || s.course_code === filters.course_name;
            const matchesSemester = !filters.current_semester || String(s.current_semester) === String(filters.current_semester);

            let matchesPayment = true;
            if (filters.payment_status) {
                const status = calculatePaymentStatus(s);
                if (filters.payment_status === 'not_registered') {
                    matchesPayment = status === 'Not Registered';
                } else {
                    matchesPayment = status.toLowerCase() === filters.payment_status.toLowerCase();
                }
            }

            return matchesYear && matchesGroup && matchesCourse && matchesSemester && matchesPayment;
        });
    }, [studentsForExam, filters, registrations]);

    // List of students filtered by everything EXCEPT Group Name
    // This allows the Group chart to show all groups (context) while highlighting the selected one.
    const studentsForGroupChart = useMemo(() => {
        if (!filters.academic_year) return [];

        return studentsForExam.filter((s) => {
            const matchesYear = s.academic_year === filters.academic_year;
            // Explicitly skip matchesGroup check here
            const matchesCourse = !filters.course_name || s.course_code === filters.course_name;
            const matchesSemester = !filters.current_semester || String(s.current_semester) === String(filters.current_semester);

            return matchesYear && matchesCourse && matchesSemester;
        });
    }, [studentsForExam, filters.academic_year, filters.course_name, filters.current_semester]);

    // Education Themed Colors
    // Navy Blue, Academic Gold, Teal (was Green), Brick Red, Royal Purple, Slate
    const eduColors = [
        "rgba(0, 51, 102, 0.85)",   // Navy
        "rgba(255, 193, 7, 0.85)",  // Gold
        "rgba(32, 201, 151, 0.85)", // Teal (Replaced Green to avoid confusion with Paid status)
        "rgba(220, 53, 69, 0.85)",  // Brick Red
        "rgba(111, 66, 193, 0.85)", // Purple
        "rgba(108, 117, 125, 0.85)",// Slate
    ];

    // Distinct Course Colors (Different from eduColors)
    const courseColors = [
        "rgba(255, 87, 34, 0.85)",   // Deep Orange
        "rgba(233, 30, 99, 0.85)",   // Pink
        "rgba(3, 169, 244, 0.85)",   // Light Blue
        "rgba(139, 195, 74, 0.85)",  // Light Green
        "rgba(156, 39, 176, 0.85)",  // Deep Purple
        "rgba(121, 85, 72, 0.85)",   // Brown
        "rgba(96, 125, 139, 0.85)",  // Blue Grey
    ];

    const getSemesterColor = (semString) => {
        const match = (semString || "").match(/Semester\s+(\d+)/i);
        if (match) {
            const index = (parseInt(match[1], 10) - 1) % eduColors.length;
            // Handle negative index if semester is 0 for some reason, though unlikely
            const safeIndex = index < 0 ? 0 : index;
            return eduColors[safeIndex];
        }
        return eduColors[5]; // Default to Slate
    };

    const chartData = useMemo(() => {
        if (!filters.academic_year) return null;

        const filteredData = filteredStudentsList;
        const groupChartSource = studentsForGroupChart;

        // Group Counts (using the broader source)
        const groupCounts = {};
        groupChartSource.forEach((student) => {
            const group = student.group_name || "Unknown";
            groupCounts[group] = (groupCounts[group] || 0) + 1;
        });

        const rawGroups = Object.keys(groupCounts);
        const groupLabels = rawGroups.map(
            (group) => filters.group_name ? `${group} (${groupCounts[group]})` : group
        );
        const groupValues = Object.values(groupCounts);

        // Determine colors for groups based on selection
        const groupColors = rawGroups.map((groupName, i) => {
            const defaultColor = eduColors[i % eduColors.length];
            if (!filters.group_name) return defaultColor; // No filter, all colored

            // Find group code for this group name to compare with filter
            const groupObj = groups.find(g => g.group_name === groupName);
            const isSelected = groupObj && groupObj.group_code === filters.group_name;

            return isSelected ? defaultColor : "rgba(0, 0, 0, 0.1)"; // Highlight or Low Level
        });

        const groupBorders = groupColors.map(c => c.replace("0.85", "1").replace("0.1)", "0.2)"));

        // Course Counts (using the specific filtered list)
        const courseCounts = {};
        filteredData.forEach((student) => {
            const course = student.course_name || "Unknown";
            courseCounts[course] = (courseCounts[course] || 0) + 1;
        });

        const rawCourses = Object.keys(courseCounts);
        const courseLabels = rawCourses.map(
            (course) => (filters.course_name || filters.group_name) ? `${course} (${courseCounts[course]})` : course
        );
        const courseValues = Object.values(courseCounts);

        // Determine colors for courses (using courseColors palette)
        const currentCourseColors = rawCourses.map((courseName, i) => {
            const defaultColor = courseColors[i % courseColors.length];
            if (!filters.course_name) return defaultColor;

            const courseObj = courses.find(c => c.course_name === courseName);
            const isSelected = courseObj && courseObj.course_code === filters.course_name;

            return isSelected ? defaultColor : "rgba(0, 0, 0, 0.1)";
        });

        const courseBorders = currentCourseColors.map(c => c.replace("0.85", "1").replace("0.1", "0.2"));


        // Semester Counts (using the specific filtered list)
        const semesterCounts = {};
        filteredData.forEach((student) => {
            const sem = student.current_semester
                ? `Semester ${student.current_semester}`
                : "Unknown";
            semesterCounts[sem] = (semesterCounts[sem] || 0) + 1;
        });

        const sortedSemesterKeys = Object.keys(semesterCounts).sort((a, b) => {
            const matchA = a.match(/Semester\s+(\d+)/i);
            const matchB = b.match(/Semester\s+(\d+)/i);
            const numA = matchA ? parseInt(matchA[1], 10) : 999;
            const numB = matchB ? parseInt(matchB[1], 10) : 999;
            return numA - numB;
        });

        const semesterLabels = sortedSemesterKeys.map(
            (sem) => `${sem} (${semesterCounts[sem]})`
        );
        const semesterValues = sortedSemesterKeys.map(sem => semesterCounts[sem]);


        return {
            total: filteredData.length,
            rawGroups: rawGroups,
            rawCourses: rawCourses,
            rawSemesters: sortedSemesterKeys,
            groups: {
                labels: groupLabels,
                datasets: [
                    {
                        label: "Students per Group",
                        data: groupValues,
                        backgroundColor: groupColors,
                        borderColor: groupBorders,
                        borderWidth: 1,
                        borderRadius: 4,
                    },
                ],
            },
            courses: {
                labels: courseLabels,
                datasets: [
                    {
                        label: "Students per Course",
                        data: courseValues,
                        backgroundColor: currentCourseColors,
                        borderColor: courseBorders,
                        borderWidth: 1,
                        borderRadius: 4,
                    },
                ],
            },
            semesters: {
                labels: semesterLabels,
                datasets: [
                    {
                        label: "Students per Semester",
                        data: semesterValues,
                        backgroundColor: sortedSemesterKeys.map(s => getSemesterColor(s)),
                        borderColor: sortedSemesterKeys.map(s => getSemesterColor(s).replace("0.85", "1")),
                        borderWidth: 1,
                    },
                ],
            },
            paymentStatuses: {
                labels: ["Paid", "Pending"],
                datasets: [
                    {
                        label: "Payment Status",
                        data: (() => {
                            let paid = 0;
                            let pending = 0;
                            filteredData.forEach(s => {
                                const status = calculatePaymentStatus(s);
                                if (status === 'Paid') paid++;
                                else if (status === 'Pending') pending++;
                            });
                            return [paid, pending];
                        })(),
                        backgroundColor: [
                            "rgba(40, 167, 69, 0.85)",  // Green for Paid
                            "rgba(220, 53, 69, 0.85)",  // Red for Pending
                        ],
                        borderColor: [
                            "rgba(40, 167, 69, 1)",
                            "rgba(220, 53, 69, 1)",
                        ],
                        borderWidth: 1,
                    }
                ]
            }
        };
    }, [filteredStudentsList, studentsForGroupChart, filters.academic_year, filters.group_name, eduColors]);

    const handleChartHover = (event, chartElement) => {
        event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
    };

    const handleGroupClick = (event, elements) => {
        if (!elements || elements.length === 0) return;
        const index = elements[0].index;
        const groupName = chartData.rawGroups[index];
        if (!groupName) return;

        const groupObj = groups.find(g => g.group_name === groupName);
        if (groupObj) {
            setFilters(prev => ({
                ...prev,
                group_name: prev.group_name === groupObj.group_code ? "" : groupObj.group_code
            }));
        }
    };

    const handleCourseClick = (event, elements) => {
        if (!elements || elements.length === 0) return;
        const index = elements[0].index;
        const courseName = chartData.rawCourses[index];
        if (!courseName) return;

        const courseObj = courses.find(c => c.course_name === courseName);
        if (courseObj) {
            setFilters(prev => ({
                ...prev,
                course_name: prev.course_name === courseObj.course_code ? "" : courseObj.course_code
            }));
        }
    };

    const handleSemesterClick = (event, elements) => {
        if (!elements || elements.length === 0) return;
        const index = elements[0].index;
        const semesterLabel = chartData.rawSemesters[index];
        if (!semesterLabel) return;

        const match = semesterLabel.match(/Semester\s+(\d+)/i);
        if (match) {
            const semNumber = match[1];
            setFilters(prev => ({
                ...prev,
                current_semester: String(prev.current_semester) === String(semNumber) ? "" : semNumber
            }));
        }
    };



    return (
        <AdminShell>
            <div className="container-fluid p-4">
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <h2 className="fw-bold mb-0">Reports</h2>
                </div>

                <div className="card shadow-sm border-0 rounded-4 mb-4">
                    <div className="card-body p-4">
                        <div className="row g-3">
                            <div className="col-md-2">
                                <label className="form-label fw-bold small text-uppercase text-muted">
                                    Exam Name
                                </label>
                                <select
                                    className="form-select text-dark fw-medium py-2"
                                    name="exam_name"
                                    value={filters.exam_name}
                                    onChange={handleChange}
                                    disabled={loading}
                                >
                                    <option value="">All Exams</option>
                                    {examOptions.map((opt) => (
                                        <option key={opt} value={opt}>
                                            {opt}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-md-2">
                                <label className="form-label fw-bold small text-uppercase text-muted">
                                    Academic Year
                                </label>
                                <select
                                    className="form-select text-dark fw-medium py-2"
                                    name="academic_year"
                                    value={filters.academic_year}
                                    onChange={handleChange}
                                    disabled={loading}
                                >
                                    <option value="">Select Year</option>
                                    {academicYearOptions.map((year) => (
                                        <option key={year} value={year}>
                                            {year}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-md-3">
                                <label className="form-label fw-bold small text-uppercase text-muted">
                                    Group
                                </label>
                                <select
                                    className="form-select text-dark fw-medium py-2"
                                    name="group_name"
                                    value={filters.group_name}
                                    onChange={handleChange}
                                    disabled={loading}
                                >
                                    <option value="">Select Group</option>
                                    {filteredGroupOptions.map((group) => (
                                        <option key={group.group_code} value={group.group_code}>
                                            {group.group_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-md-3">
                                <label className="form-label fw-bold small text-uppercase text-muted">
                                    Course
                                </label>
                                <select
                                    className="form-select text-dark fw-medium py-2"
                                    name="course_name"
                                    value={filters.course_name}
                                    onChange={handleChange}
                                    disabled={loading}
                                >
                                    <option value="">Select Course</option>
                                    {filteredCourseOptions.map((course) => (
                                        <option key={course.course_code} value={course.course_code}>
                                            {course.course_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-md-2">
                                <label className="form-label fw-bold small text-uppercase text-muted">
                                    Semester
                                </label>
                                <select
                                    className="form-select text-dark fw-medium py-2"
                                    name="current_semester"
                                    value={filters.current_semester}
                                    onChange={handleChange}
                                    disabled={loading}
                                >
                                    <option value="">Select Sem</option>
                                    {semesterOptions.map((sem) => (
                                        <option key={sem} value={sem}>
                                            Semester {sem}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-md-2">
                                <label className="form-label fw-bold small text-uppercase text-muted">
                                    Payment Status
                                </label>
                                <select
                                    className="form-select text-dark fw-medium py-2"
                                    name="payment_status"
                                    value={filters.payment_status}
                                    onChange={handleChange}
                                    disabled={loading}
                                >
                                    <option value="">All Status</option>
                                    <option value="paid">Paid</option>
                                    <option value="pending">Pending</option>
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

                {!loading && filters.academic_year && chartData && (
                    <div className="d-flex flex-column gap-4 animate__animated animate__fadeIn">
                        <div className="row g-4">
                            {/* Summary Card */}
                            <div className="col-12">
                                <div className="card shadow-sm border-0 rounded-4 bg-primary text-white">
                                    <div className="card-body p-4 d-flex align-items-center justify-content-between">
                                        <div>
                                            <h5 className="mb-1 text-black text-uppercase small fw-bold">
                                                Total Students
                                            </h5>
                                            <h1 className="display-4 fw-bold mb-0">
                                                {chartData.total}
                                            </h1>
                                        </div>
                                        <div className="text-end">
                                            <p className="mb-0 h5 text-white-50">
                                                {filters.academic_year}
                                            </p>
                                            {filters.exam_name && (
                                                <span className="badge bg-white text-primary mt-2">
                                                    {filters.exam_name}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Group Distribution */}
                            <div className="col-md-6 col-lg-3">
                                <div className="card shadow-sm border-0 rounded-4 h-100">
                                    <div className="card-header bg-white border-0 pt-4 px-4 pb-0 d-flex justify-content-between align-items-start">
                                        <h5 className="fw-bold mb-0 text-secondary">
                                            Group
                                        </h5>
                                        <div className="d-flex flex-column align-items-end gap-1" style={{ maxWidth: '60%' }}>
                                            {// Use chartData.groups.datasets[0].backgroundColor array to match the legend colors
                                                chartData.rawGroups.map((g, i) => {
                                                    const color = chartData.groups.datasets[0].backgroundColor[i];
                                                    return (
                                                        <div key={g} className="d-flex align-items-center gap-2">
                                                            <div style={{ width: '10px', height: '10px', backgroundColor: color, borderRadius: '2px' }}></div>
                                                            <span className="fw-bold text-dark small" style={{ opacity: color.includes('0.1') ? 0.5 : 1 }}>
                                                                {g}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    </div>
                                    <div className="card-body p-4">
                                        <Bar
                                            data={chartData.groups}
                                            options={{
                                                responsive: true,
                                                plugins: { legend: { display: false } },
                                                onClick: handleGroupClick,
                                                onHover: handleChartHover
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Course Distribution */}
                            <div className="col-md-6 col-lg-3">
                                <div className="card shadow-sm border-0 rounded-4 h-100">
                                    <div className="card-header bg-white border-0 pt-4 px-4 pb-0 d-flex justify-content-between align-items-start">
                                        <h5 className="fw-bold mb-0 text-secondary">
                                            Course
                                        </h5>
                                        <div className="d-flex flex-column align-items-end gap-1" style={{ maxWidth: '60%' }}>
                                            {chartData.rawCourses.map((c, i) => {
                                                const color = chartData.courses.datasets[0].backgroundColor[i];
                                                return (
                                                    <div key={c} className="d-flex align-items-center gap-2">
                                                        <div style={{ width: '10px', height: '10px', backgroundColor: color, borderRadius: '2px' }}></div>
                                                        <span className="fw-bold text-dark small" style={{ opacity: color.includes('0.1') ? 0.5 : 1 }}>
                                                            {chartData.courses.labels[i]}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div className="card-body p-4">
                                        <Bar
                                            data={chartData.courses}
                                            options={{
                                                responsive: true,
                                                plugins: { legend: { display: false } },
                                                onClick: handleCourseClick,
                                                onHover: handleChartHover
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Semester Distribution */}
                            <div className="col-md-6 col-lg-3">
                                <div className="card shadow-sm border-0 rounded-4 h-100">
                                    <div className="card-header bg-white border-0 pt-4 px-4 pb-0 d-flex justify-content-between align-items-start">
                                        <h5 className="fw-bold mb-0 text-secondary">
                                            Semester
                                        </h5>
                                        <div className="d-flex flex-column align-items-end gap-1" style={{ maxWidth: '60%' }}>
                                            {chartData.rawSemesters.map((s) => (
                                                <div key={s} className="d-flex align-items-center gap-2">
                                                    <div style={{ width: '10px', height: '10px', backgroundColor: getSemesterColor(s), borderRadius: '2px' }}></div>
                                                    <span className="fw-bold text-dark small">
                                                        {s}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="card-body p-4 d-flex justify-content-center">
                                        <div style={{ maxWidth: "300px", width: "100%" }}>
                                            <Pie
                                                data={chartData.semesters}
                                                options={{
                                                    responsive: true,
                                                    plugins: { legend: { display: false } },
                                                    onClick: handleSemesterClick,
                                                    onHover: handleChartHover
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Payment Status Distribution */}
                            <div className="col-md-6 col-lg-3">
                                <div className="card shadow-sm border-0 rounded-4 h-100">
                                    <div className="card-header bg-white border-0 pt-4 px-4 pb-0 d-flex justify-content-between align-items-start">
                                        <h5 className="fw-bold mb-0 text-secondary">
                                            Payment Status
                                        </h5>
                                        <div className="d-flex flex-column align-items-end gap-1" style={{ maxWidth: '60%' }}>
                                            {chartData.paymentStatuses.labels.map((status, i) => (
                                                <div key={status} className="d-flex align-items-center gap-2">
                                                    <div style={{ width: '10px', height: '10px', backgroundColor: chartData.paymentStatuses.datasets[0].backgroundColor[i], borderRadius: '2px' }}></div>
                                                    <span className="fw-bold text-dark small">
                                                        {status}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="card-body p-4 d-flex justify-content-center">
                                        <div style={{ maxWidth: "300px", width: "100%" }}>
                                            <Pie
                                                data={chartData.paymentStatuses}
                                                options={{
                                                    responsive: true,
                                                    plugins: { legend: { display: false } },
                                                    onHover: handleChartHover
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Student List Table */}
                            <div className="col-12">
                                <div className="students-table-panel card card-soft p-4">
                                    <div className="students-table-panel-header mb-3">
                                        <div>
                                            <h5 className="students-table-panel-title fw-bold mb-1">
                                                Students
                                            </h5>
                                            <p className="students-table-panel-copy mb-0">
                                                Detailed list of students matching the current filters.
                                            </p>
                                        </div>
                                        <div className="students-table-panel-meta text-end small">
                                            {filteredStudentsList.length} students listed
                                        </div>
                                    </div>
                                    <div className="table-responsive">
                                        <table className="table table-borderless table-hover align-middle mb-0">
                                            <thead className="table-light">
                                                <tr>
                                                    <th>Student ID</th>
                                                    <th>Name</th>
                                                    <th>Hall Ticket</th>
                                                    <th>Group</th>
                                                    <th>Course</th>
                                                    <th>Academic Year</th>
                                                    <th>Semester</th>
                                                    <th>Payment Status</th>
                                                    <th>Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredStudentsList.length > 0 ? (
                                                    filteredStudentsList.map((student) => {
                                                        const paymentStatus = calculatePaymentStatus(student);
                                                        return (
                                                            <tr key={student.id}>
                                                                <td>{student.student_id}</td>
                                                                <td>{student.full_name}</td>
                                                                <td>{student.hall_ticket_no || "-"}</td>
                                                                <td>{student.group_name}</td>
                                                                <td>{student.course_name}</td>
                                                                <td>{student.academic_year}</td>
                                                                <td>
                                                                    {student.current_semester
                                                                        ? `Semester ${student.current_semester}`
                                                                        : "Semester N/A"}
                                                                </td>
                                                                <td>
                                                                    <span
                                                                        className={`badge rounded-pill ${paymentStatus === "Paid"
                                                                            ? "bg-success"
                                                                            : paymentStatus === "Not Registered"
                                                                                ? "bg-secondary"
                                                                                : "bg-danger"
                                                                            }`}
                                                                        style={{ minWidth: "80px", fontSize: "0.85em" }}
                                                                    >
                                                                        {paymentStatus}
                                                                    </span>
                                                                </td>
                                                                <td>
                                                                    <span
                                                                        className={`badge rounded-pill ${student.status === "DISCONTINUE"
                                                                            ? "bg-danger"
                                                                            : student.status === "HOLD"
                                                                                ? "bg-warning"
                                                                                : "bg-success"
                                                                            }`}
                                                                        style={{ minWidth: "80px", fontSize: "0.85em" }}
                                                                    >
                                                                        {student.status === "DISCONTINUE"
                                                                            ? "Discontinued"
                                                                            : student.status === "HOLD"
                                                                                ? "On Hold"
                                                                                : "Active"}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        )
                                                    })
                                                ) : (
                                                    <tr>
                                                        <td colSpan="9" className="text-center py-4 text-muted">
                                                            No students found matching the selected filters.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {!loading && !filters.academic_year && (
                    <div className="mt-5 text-center py-5 bg-light rounded-3 border border-dashed">
                        <p className="text-muted mb-0">
                            Select an Academic Year to view reports
                        </p>
                    </div>
                )}
            </div>
        </AdminShell>
    );
}
