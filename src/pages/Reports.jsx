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
        category: "",
        current_semester: "",
    });
    const [years, setYears] = useState([]);
    const [groups, setGroups] = useState([]);
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);

    const baseCategoryOptions = ["UG", "PG"];
    const normalizeCategoryValue = (value) =>
        value ? value.toString().trim().toUpperCase() : "";

    const categoryMatchesFilter = (filter, ...values) => {
        if (!filter) return true;
        return values.some(
            (value) => value && normalizeCategoryValue(value) === filter
        );
    };

    const categoryOptions = useMemo(() => {
        const result = [...baseCategoryOptions];
        const seen = new Set(result.map((val) => val?.toUpperCase()));
        groups.forEach((group) => {
            const value = group.category || group.Category;
            if (value) {
                const normalized = value.toUpperCase();
                if (!seen.has(normalized)) {
                    seen.add(normalized);
                    result.push(normalized);
                }
            }
        });
        return result;
    }, [groups]);

    const normalizedCategoryFilter = useMemo(() => {
        const value = filters.category || "";
        return value.toString().trim().toUpperCase();
    }, [filters.category]);

    const studentsForCategory = useMemo(() => {
        if (!normalizedCategoryFilter) return students;
        return students.filter((student) =>
            categoryMatchesFilter(
                normalizedCategoryFilter,
                student.Category,
                student.category,
                student.year?.category,
                student.year?.year_category
            )
        );
    }, [students, normalizedCategoryFilter]);

    const academicYearOptions = useMemo(() => {
        const values = new Set();
        const addLabel = (label) => {
            const normalized = (label ?? "").toString().trim();
            if (normalized) values.add(normalized);
        };
        const sourceStudents =
            normalizedCategoryFilter && normalizedCategoryFilter !== ""
                ? studentsForCategory
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
    }, [years, students, studentsForCategory, normalizedCategoryFilter]);

    const semesterOptions = useMemo(() => {
        const values = new Set();
        const sourceStudents =
            normalizedCategoryFilter && normalizedCategoryFilter !== ""
                ? studentsForCategory
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
    }, [students, studentsForCategory, normalizedCategoryFilter]);

    const filteredGroupOptions = useMemo(() => {
        if (!normalizedCategoryFilter) return groups;

        const relevantGroups = groups.filter((group) => {
            const groupCat = group.Category || group.category;
            return (
                groupCat &&
                groupCat.toString().toUpperCase() === normalizedCategoryFilter
            );
        });

        if (relevantGroups.length > 0) return relevantGroups;
        return relevantGroups;
    }, [groups, normalizedCategoryFilter]);

    const filteredCourseOptions = useMemo(() => {
        if (!normalizedCategoryFilter && !filters.group_name) return courses;
        const relevantStudents = studentsForCategory.filter((student) => {
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
        studentsForCategory,
        normalizedCategoryFilter,
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
            group:groups!students_group_name_fkey(group_code, group_name),
            course:courses!students_course_name_fkey(course_code, course_name),
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

            if (name === "category") {
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

    const chartData = useMemo(() => {
        if (!filters.academic_year) return null;

        // Filter students by ALL active filters to reflect the current selection in the charts
        const filteredData = studentsForCategory.filter((s) => {
            const matchesYear = s.academic_year === filters.academic_year;
            const matchesGroup = !filters.group_name || s.group_code === filters.group_name;
            const matchesCourse = !filters.course_name || s.course_code === filters.course_name;
            const matchesSemester = !filters.current_semester || String(s.current_semester) === String(filters.current_semester);

            return matchesYear && matchesGroup && matchesCourse && matchesSemester;
        });

        // Group Counts
        const groupCounts = {};
        filteredData.forEach((student) => {
            const group = student.group_name || "Unknown";
            groupCounts[group] = (groupCounts[group] || 0) + 1;
        });

        const groupLabels = Object.keys(groupCounts).map(
            (group) => `${group} (${groupCounts[group]})`
        );
        const groupValues = Object.values(groupCounts);

        // Course Counts
        const courseCounts = {};
        filteredData.forEach((student) => {
            const course = student.course_name || "Unknown";
            courseCounts[course] = (courseCounts[course] || 0) + 1;
        });

        const courseLabels = Object.keys(courseCounts).map(
            (course) => `${course} (${courseCounts[course]})`
        );
        const courseValues = Object.values(courseCounts);

        // Semester Counts
        const semesterCounts = {};
        filteredData.forEach((student) => {
            const sem = student.current_semester
                ? `Semester ${student.current_semester}`
                : "Unknown";
            semesterCounts[sem] = (semesterCounts[sem] || 0) + 1;
        });

        const semesterLabels = Object.keys(semesterCounts).map(
            (sem) => `${sem} (${semesterCounts[sem]})`
        );
        const semesterValues = Object.values(semesterCounts);

        // Education Themed Colors
        // Navy Blue, Academic Gold, Success Green, Brick Red, Royal Purple, Slate
        const eduColors = [
            "rgba(0, 51, 102, 0.85)",   // Navy
            "rgba(255, 193, 7, 0.85)",  // Gold
            "rgba(40, 167, 69, 0.85)",  // Green
            "rgba(220, 53, 69, 0.85)",  // Brick Red
            "rgba(111, 66, 193, 0.85)", // Purple
            "rgba(108, 117, 125, 0.85)",// Slate
        ];

        const eduBorders = eduColors.map(c => c.replace("0.85", "1"));

        return {
            total: filteredData.length,
            groups: {
                labels: groupLabels,
                datasets: [
                    {
                        label: "Students per Group",
                        data: groupValues,
                        backgroundColor: eduColors,
                        borderColor: eduBorders,
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
                        backgroundColor: "rgba(23, 162, 184, 0.85)", // Cyan/Info as a distinct single color for courses if many
                        borderColor: "rgba(23, 162, 184, 1)",
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
                        backgroundColor: eduColors,
                        borderColor: eduBorders,
                        borderWidth: 1,
                    },
                ],
            },
        };
    }, [studentsForCategory, filters]);

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
                                    Category
                                </label>
                                <select
                                    className="form-select text-dark fw-medium py-2"
                                    name="category"
                                    value={filters.category}
                                    onChange={handleChange}
                                    disabled={loading}
                                >
                                    <option value="">All Categories</option>
                                    {categoryOptions.map((opt) => (
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
                                            <h5 className="mb-1 text-white-50 text-uppercase small fw-bold">
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
                                            {filters.category && (
                                                <span className="badge bg-white text-primary mt-2">
                                                    {filters.category}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Group Distribution */}
                            <div className="col-md-6 col-lg-4">
                                <div className="card shadow-sm border-0 rounded-4 h-100">
                                    <div className="card-header bg-white border-0 pt-4 px-4 pb-0">
                                        <h5 className="fw-bold mb-0 text-secondary">
                                            Group Distribution
                                        </h5>
                                    </div>
                                    <div className="card-body p-4">
                                        <Bar
                                            data={chartData.groups}
                                            options={{ responsive: true, plugins: { legend: { display: false } } }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Course Distribution */}
                            <div className="col-md-6 col-lg-4">
                                <div className="card shadow-sm border-0 rounded-4 h-100">
                                    <div className="card-header bg-white border-0 pt-4 px-4 pb-0">
                                        <h5 className="fw-bold mb-0 text-secondary">
                                            Course Distribution
                                        </h5>
                                    </div>
                                    <div className="card-body p-4">
                                        <Bar
                                            data={chartData.courses}
                                            options={{ responsive: true, plugins: { legend: { display: false } } }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Semester Distribution */}
                            <div className="col-md-6 col-lg-4">
                                <div className="card shadow-sm border-0 rounded-4 h-100">
                                    <div className="card-header bg-white border-0 pt-4 px-4 pb-0">
                                        <h5 className="fw-bold mb-0 text-secondary">
                                            Semester Breakdown
                                        </h5>
                                    </div>
                                    <div className="card-body p-4 d-flex justify-content-center">
                                        <div style={{ maxWidth: "300px", width: "100%" }}>
                                            <Pie
                                                data={chartData.semesters}
                                                options={{ responsive: true, plugins: { legend: { position: 'bottom' } } }}
                                            />
                                        </div>
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
