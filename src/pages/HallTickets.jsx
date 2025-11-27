import AdminShell from "../components/AdminShell";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabaseClient";
import { trackPromise } from "../store/ui";

export default function HallTickets() {
  const [students, setStudents] = useState([]);
  const [filters, setFilters] = useState({
    academic_year: "",
    group_name: "",
    course_name: "",
    category: "",
  });
  const [studentIdSearch, setStudentIdSearch] = useState("");
  const [paymentSemester, setPaymentSemester] = useState("");
  const [years, setYears] = useState([]);
  const [groups, setGroups] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);

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

  const parseAcademicYearStart = (academicYear) => {
    if (!academicYear) return null;
    const normalized = academicYear.toString().trim();
    if (!normalized) return null;
    const [startValue] = normalized.split("-").map((segment) => segment.trim());
    const year = Number(startValue);
    if (Number.isNaN(year)) return null;
    return year;
  };

  const deriveSemesterFromAcademicYear = (
    academicYear,
    referenceDate = new Date()
  ) => {
    const startYear = parseAcademicYearStart(academicYear);
    if (!Number.isFinite(startYear)) return null;
    const semStartMonth = 6; // July (0-based index)
    const monthsSinceStart =
      (referenceDate.getFullYear() - startYear) * 12 +
      referenceDate.getMonth() -
      semStartMonth;
    const computedSemester = Math.floor(monthsSinceStart / 6) + 1;
    if (monthsSinceStart < 0) return 1;
    if (computedSemester > 6) return 6;
    if (computedSemester < 1) return 1;
    return computedSemester;
  };

  const formatDerivedSemesterLabel = (academicYear) => {
    const semester = deriveSemesterFromAcademicYear(academicYear);
    return semester ? `Semester ${semester}` : "Semester N/A";
  };

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
      if (
        normalizedCategoryFilter &&
        !categoryMatchesFilter(
          normalizedCategoryFilter,
          year.category,
          year.Category,
          year.year_category,
          year.yearCategory
        )
      ) {
        return;
      }
      addLabel(year.academic_year ?? year.name);
    });

    sourceStudents.forEach((student) => {
      addLabel(student.academic_year ?? student.year?.academic_year);
    });

    if (
      values.size === 0 &&
      normalizedCategoryFilter &&
      studentsForCategory.length
    ) {
      studentsForCategory.forEach((student) =>
        addLabel(student.academic_year ?? student.year?.academic_year)
      );
    }

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
    if (!studentsForCategory.length) return groups;
    const codes = new Set();
    const names = new Set();
    studentsForCategory.forEach((student) => {
      if (student.group_code) codes.add(student.group_code);
      const groupName =
        student.group?.group_name ||
        student.group_name ||
        student.group ||
        "";
      if (groupName) names.add(groupName);
    });
    if (!codes.size && !names.size) return groups;
    return groups.filter(
      (group) =>
        (!!group.group_code && codes.has(group.group_code)) ||
        (!!group.group_name && names.has(group.group_name))
    );
  }, [groups, studentsForCategory, normalizedCategoryFilter]);

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
  }, [courses, studentsForCategory, normalizedCategoryFilter, filters.group_name]);

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

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
          .select("group_id, group_code, group_name")
          .order("group_name");

        if (groupsError) throw groupsError;

        const { data: coursesData, error: coursesError } = await supabase
          .from("courses")
          .select("course_id, course_code, course_name")
          .order("course_name");

        if (coursesError) throw coursesError;

        const { data: yearsData, error: yearsError } = await supabase
          .from("academic_year")
          .select("id, academic_year, status, category")
          .order("academic_year", { ascending: false });

        if (yearsError) throw yearsError;

        const transformedStudents = studentsData.map((student) => ({
          ...student,
          group_name: student.group?.group_name || student.group_name,
          group_code: student.group?.group_code,
          course_name: student.course?.course_name || student.course_name,
          course_code: student.course?.course_code,
          academic_year: student.year?.academic_year || student.academic_year,
        }));

        setStudents(transformedStudents);
        const activeYears = (yearsData || []).filter((year) =>
          year.status === undefined ? true : Boolean(year.status)
        );
        setYears(activeYears);
        setGroups(groupsData || []);
        setCourses(coursesData || []);
      } catch (error) {
        console.error("Error loading hall ticket data:", error);
      } finally {
        setLoading(false);
      }
    };

    trackPromise(loadData());
  }, []);

  const filteredStudents = useMemo(() => {
    const searchTerm = (studentIdSearch || "").toString().trim().toLowerCase();
    return students.filter((student) => {
      const matchesYear =
        !filters.academic_year ||
        student.academic_year === filters.academic_year;
      const matchesGroup =
        !filters.group_name || student.group_code === filters.group_name;
      const matchesCourse =
        !filters.course_name || student.course_code === filters.course_name;

      const matchesCategory = categoryMatchesFilter(
        normalizedCategoryFilter,
        student.Category,
        student.category,
        student.year?.category,
        student.year?.year_category
      );
      const matchesStudentId =
        !searchTerm ||
        (student.student_id || "")
          .toString()
          .toLowerCase()
          .includes(searchTerm);

      return (
        matchesYear &&
        matchesGroup &&
        matchesCourse &&
        matchesCategory &&
        matchesStudentId
      );
    });
  }, [students, filters, normalizedCategoryFilter, studentIdSearch]);

  return (
    <AdminShell>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="fw-bold mb-0">Hall Ticket Generator</h2>
      </div>

      <div className="card card-soft p-3 mb-4">
        <h5 className="mb-3">Filter Students</h5>
        <div className="row g-3">
          <div className="col-6 col-sm-4 col-md-3 col-lg-2">
            <label className="form-label">Student ID</label>
            <input
              type="text"
              className="form-control"
              value={studentIdSearch}
              onChange={(e) => setStudentIdSearch(e.target.value)}
              placeholder="Enter Student ID"
            />
          </div>
          <div className="col-6 col-sm-4 col-md-3 col-lg-2">
            <label className="form-label">Category</label>
            <select
              className="form-select"
              value={filters.category}
              onChange={(e) => handleFilterChange("category", e.target.value)}
            >
              <option value="">All Categories</option>
              {categoryOptions.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <div className="col-6 col-sm-4 col-md-3 col-lg-2">
            <label className="form-label">Academic Year</label>
            <select
              className="form-select"
              value={filters.academic_year}
              onChange={(e) =>
                handleFilterChange("academic_year", e.target.value)
              }
            >
              <option value="">All Years</option>
              {academicYearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          <div className="col-6 col-sm-4 col-md-3 col-lg-2">
            <label className="form-label">Group</label>
            <select
              className="form-select"
              value={filters.group_name}
              onChange={(e) => handleFilterChange("group_name", e.target.value)}
            >
              <option value="">All Groups</option>
              {filteredGroupOptions.map((group) => (
                <option key={group.group_id} value={group.group_code}>
                  {group.group_name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-6 col-sm-4 col-md-3 col-lg-2">
            <label className="form-label">Course</label>
            <select
              className="form-select"
              value={filters.course_name}
              onChange={(e) =>
                handleFilterChange("course_name", e.target.value)
              }
            >
              <option value="">All Courses</option>
              {filteredCourseOptions.map((course) => (
                <option key={course.course_id} value={course.course_code}>
                  {course.course_name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-6 col-sm-4 col-md-3 col-lg-2">
            <label className="form-label">Payment Semester</label>
            <select
              className="form-select"
              value={paymentSemester}
              onChange={(e) => setPaymentSemester(e.target.value)}
            >
              <option value="">Select Semester</option>
              {semesterOptions.map((semester) => (
                <option key={semester} value={semester}>
                  Semester {semester}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card card-soft p-0">
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead className="table-light">
              <tr>
                <th>Student ID</th>
                <th>Name</th>
                <th>Hall Ticket No</th>
                <th>Group</th>
                <th>Course</th>
                <th>Academic Year</th>
                <th>Current Semester</th>
                <th>Academic Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="text-center py-4">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredStudents.length > 0 ? (
                filteredStudents.map((student) => (
                  <tr key={student.id}>
                    <td>{student.student_id}</td>
                    <td>{student.full_name}</td>
                    <td>{student.hall_ticket_no || "-"}</td>
                    <td>{student.group?.group_name || student.group_name}</td>
                    <td>{student.course?.course_name || student.course_name}</td>
                    <td>{student.academic_year}</td>
                    <td>{formatDerivedSemesterLabel(student.academic_year)}</td>
                    <td>
                      <span
                        className={`badge ${
                          student.status === "DISCONTINUE"
                            ? "bg-danger"
                            : student.status === "HOLD"
                            ? "bg-warning text-dark"
                            : "bg-success"
                        }`}
                      >
                        {student.status === "DISCONTINUE"
                          ? "Discontinued"
                          : student.status === "HOLD"
                          ? "On Hold"
                          : "Active"}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="text-center py-4">
                    No students found matching the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}