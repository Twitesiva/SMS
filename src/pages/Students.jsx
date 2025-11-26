import AdminShell from "../components/AdminShell";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../supabaseClient";
import { trackPromise, showToast } from "../store/ui";
import { toast } from "react-toastify";
import { validateRequiredFields } from "../lib/validation";
import { api } from "../lib/mockApi";
 
export default function Students() {
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
  const [editingStudent, setEditingStudent] = useState(null);
  const [viewingStudent, setViewingStudent] = useState(null);
  const [statusModal, setStatusModal] = useState({
    show: false,
    student: null,
    selectedStatus: 'CONTINUE'
  });
  const [paymentStatuses, setPaymentStatuses] = useState({});
  const [paymentHistoryModal, setPaymentHistoryModal] = useState({
    show: false,
    student: null,
    payments: [],
    loading: false,
    error: null,
    balance: 0,
    totalFee: 0,
  });
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

  const formatFeeTypeLabel = (feeType) => {
    if (!feeType) return "";
    const normalized = feeType.toString().trim().toLowerCase();
    if (normalized === "exam") return "Exam";
    if (normalized === "full") return "Full";
    if (normalized === "partial") return "Partial";
    return feeType.toString().trim();
  };

  const formatCurrency = (value) => {
    if (value === undefined || value === null || Number.isNaN(Number(value)))
      return "";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(Number(value));
  };

  const formatDateLabel = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString();
  };

  const getPaymentVariant = (status) => {
    if (!status) return "secondary";
    const normalized = status.toString().trim().toLowerCase();
    if (normalized === "success") return "success";
    if (normalized === "pending") return "warning";
    if (normalized === "failed") return "danger";
    return "secondary";
  };

  const formatPaymentStatusInfo = (
    payment,
    outstandingBalance = 0,
    coverage = { examPaid: false, otherPaid: false }
  ) => {
    if (!payment) {
      return {
        label: "Not Paid",
        variant: "danger",
        detailLines: [
          { label: "Exam fees", paid: false },
          { label: "Other fees", paid: false },
        ],
      };
    }
    const normalizedStatus = (payment.payment_status || "")
      .toString()
      .trim()
      .toLowerCase();
    let baseLabel = "Unknown";
    if (normalizedStatus === "success") baseLabel = "Paid";
    else if (normalizedStatus === "pending") baseLabel = "Pending";
    else if (normalizedStatus === "failed") baseLabel = "Failed";
    else if (normalizedStatus) {
      baseLabel =
        normalizedStatus.charAt(0).toUpperCase() + normalizedStatus.slice(1);
    }
    const feeTypeLabel = formatFeeTypeLabel(payment.fee_type);
    const label = feeTypeLabel ? `${baseLabel} (${feeTypeLabel})` : baseLabel;
    const variant = getPaymentVariant(normalizedStatus);
    return {
      label,
      variant,
      detailLines: [
        { label: "Exam fees", paid: coverage.examPaid },
        { label: "Other fees", paid: coverage.otherPaid },
      ],
    };
  };

  const formatPaymentDate = (value) => {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    const shifted = new Date(parsed.getTime() + 5.5 * 60 * 60 * 1000);
    const datePart = shifted.toLocaleDateString();
    let hours = shifted.getHours();
    const minutes = shifted.getMinutes();
    const period = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 === 0 ? 12 : hours % 12;
    const formattedTime = `${String(hours).padStart(2, "0")}.${String(
      minutes
    ).padStart(2, "0")}`;
    return `${datePart}, ${formattedTime} ${period}`;
  };

  const getStudentInitials = (value) => {
    if (!value) return "ST";
    const parts = value
      .toString()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return "ST";
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    const firstInitial = parts[0][0] || "";
    const lastInitial = parts[parts.length - 1][0] || "";
    return (firstInitial + lastInitial).toUpperCase();
  };

  const parseAcademicYearStart = (academicYear) => {
    if (!academicYear) return null;
    const normalized = academicYear.toString().trim();
    if (!normalized) return null;
    const [startValue] = normalized.split("-").map((segment) => segment.trim());
    const year = Number(startValue);
    if (Number.isNaN(year)) return null;
    return year;
  };

  const deriveSemesterFromAcademicYear = (academicYear, referenceDate = new Date()) => {
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

  const loadPaymentStatuses = async (studentRows, semesterFilter) => {
    const studentsWithId = (studentRows || []).filter(
      (student) => student && student.id
    );
    if (!studentsWithId.length) {
      setPaymentStatuses({});
      return;
    }

    const studentIds = studentsWithId.map((student) => student.id);

    let registrationQuery = supabase
      .from("exam_registrations")
      .select("id, student_id, total_fee")
      .in("student_id", studentIds);
    const semesterValue =
      semesterFilter === undefined || semesterFilter === null
        ? ""
        : semesterFilter.toString().trim();
    if (semesterValue) {
      const numericSemester = Number(semesterValue);
      if (!Number.isNaN(numericSemester)) {
        registrationQuery = registrationQuery.eq("semester", numericSemester);
      } else {
        registrationQuery = registrationQuery.eq("semester", semesterValue);
      }
    }
    const { data: registrations, error: registrationsError } =
      await registrationQuery;

    if (registrationsError) throw registrationsError;

    const registrationMap = new Map();
    const studentsWithRegistration = new Set();
    const studentRegistrationTotals = {};
    (registrations || []).forEach((registration) => {
      if (registration?.id && registration.student_id) {
        registrationMap.set(registration.id, registration.student_id);
        studentsWithRegistration.add(registration.student_id);
        const totalFee = Number(registration.total_fee || 0);
        studentRegistrationTotals[registration.student_id] =
          (studentRegistrationTotals[registration.student_id] || 0) + totalFee;
      }
    });

    if (!registrationMap.size) {
      const statuses = {};
      studentIds.forEach((studentId) => {
        statuses[studentId] = formatPaymentStatusInfo(null);
      });
      setPaymentStatuses(statuses);
      return;
    }

    const registrationIds = Array.from(registrationMap.keys());
    const { data: paymentsData, error: paymentsError } = await supabase
      .from("payments")
      .select("exam_registration_id, payment_status, fee_type, amount_paid, payment_type")
      .in("exam_registration_id", registrationIds)
      .order("created_at", { ascending: false });

    if (paymentsError) throw paymentsError;

    const latestPayments = {};
    const paymentTotals = {};
    const paymentCoverage = {};
    (paymentsData || []).forEach((payment) => {
      const studentId = registrationMap.get(payment.exam_registration_id);
      if (!studentId) return;
      if (!latestPayments[studentId]) {
        latestPayments[studentId] = payment;
      }
      if (payment.payment_status === "success") {
        paymentTotals[studentId] =
          (paymentTotals[studentId] || 0) + Number(payment.amount_paid || 0);
        if (!paymentCoverage[studentId]) {
          paymentCoverage[studentId] = { examPaid: false, otherPaid: false };
        }
        const feeTypeNormalized = (payment.fee_type || "").toString().trim().toLowerCase();
        if (feeTypeNormalized === "exam" || feeTypeNormalized === "partial" || feeTypeNormalized === "full") {
          paymentCoverage[studentId].examPaid = true;
        }
        if (feeTypeNormalized === "full") {
          paymentCoverage[studentId].otherPaid = true;
        }
      }
    });

    const statuses = {};
    studentIds.forEach((studentId) => {
      const coverage = paymentCoverage[studentId] || {
        examPaid: false,
        otherPaid: false,
      };
      if (latestPayments[studentId]) {
        const outstandingBalance = Math.max(
          (studentRegistrationTotals[studentId] || 0) -
            (paymentTotals[studentId] || 0),
          0
        );
        statuses[studentId] = formatPaymentStatusInfo(
          latestPayments[studentId],
          outstandingBalance,
          coverage
        );
      } else if (studentsWithRegistration.has(studentId)) {
        statuses[studentId] = {
          label: "Awaiting Payment",
          variant: "warning",
          detailLines: [
            { label: "Exam fees", paid: coverage.examPaid },
            { label: "Other fees", paid: coverage.otherPaid },
          ],
        };
      } else {
        statuses[studentId] = {
          label: "Not Registered",
          variant: "secondary",
          detailLines: [
            { label: "Exam fees", paid: coverage.examPaid },
            { label: "Other fees", paid: coverage.otherPaid },
          ],
        };
      }
    });

    setPaymentStatuses(statuses);
  };

  const fetchRegistrationIdsForStudent = async (student, semesterFilter) => {
    if (!student?.id) return { ids: [], totalFee: 0 };
    let query = supabase
      .from("exam_registrations")
      .select("id, total_fee")
      .eq("student_id", student.id);
    const semesterValue =
      semesterFilter === undefined || semesterFilter === null
        ? ""
        : semesterFilter.toString().trim();
    if (semesterValue) {
      const numericSemester = Number(semesterValue);
      if (!Number.isNaN(numericSemester)) {
        query = query.eq("semester", numericSemester);
      } else {
        query = query.eq("semester", semesterValue);
      }
    }
    const { data, error } = await query;
    if (error) throw error;
    if (!data || !data.length) return { ids: [], totalFee: 0 };
    const ids = data.map((row) => row?.id).filter(Boolean);
    const totalFee = data.reduce((sum, row) => sum + Number(row?.total_fee || 0), 0);
    return { ids, totalFee };
  };

  const openPaymentHistoryModal = async (student) => {
    if (!paymentSemester) {
      showToast("Please select the payment semester first.", {
        type: "warning",
      });
      return;
    }
    setPaymentHistoryModal({
      show: true,
      student,
      payments: [],
      loading: true,
      error: null,
    });
    try {
      const {
        ids: registrationIds,
        totalFee: registrationTotalFee,
      } = await fetchRegistrationIdsForStudent(student, paymentSemester);
      if (!registrationIds.length) {
        setPaymentHistoryModal((prev) => ({
          ...prev,
          payments: [],
          loading: false,
          error: "No registration found for the selected semester.",
        }));
        return;
      }
      const { data: payments, error } = await supabase
        .from("payments")
        .select(
          "id, fee_type, amount_paid, payment_status, payment_type, created_at"
        )
        .in("exam_registration_id", registrationIds)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const orderedPayments = (payments || [])
        .map((payment) => payment || {})
        .sort((a, b) => {
          const dateA = new Date(a.created_at || 0).getTime();
          const dateB = new Date(b.created_at || 0).getTime();
          return dateA - dateB;
        })
        .map((payment, index) => ({
          ...payment,
          sequence: index + 1,
        }));
      const totalPaid = orderedPayments
        .filter((payment) => payment.payment_status === "success")
        .reduce((sum, payment) => sum + Number(payment.amount_paid || 0), 0);
      setPaymentHistoryModal((prev) => ({
        ...prev,
        payments: orderedPayments,
        loading: false,
        balance: Math.max(registrationTotalFee - totalPaid, 0),
        totalFee: registrationTotalFee,
      }));
    } catch (error) {
      console.error("Unable to load payment history:", error);
      setPaymentHistoryModal((prev) => ({
        ...prev,
        payments: [],
        loading: false,
        error: error?.message || "Unable to load payment history.",
        balance: 0,
        totalFee: 0,
      }));
    }
  };

  const closePaymentHistoryModal = () => {
    setPaymentHistoryModal({
      show: false,
      student: null,
      payments: [],
      loading: false,
      error: null,
    });
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

  const [editForm, setEditForm] = useState({
    student_id: "",
    hall_ticket_no: "",
    academic_year: "",
    group_name: "",
    group_code: "",
    course_name: "",
    course_code: "",
    full_name: "",
    gender: "",
    date_of_birth: "",
    father_name: "",
    mother_name: "",
    nationality: "",
    state: "",
    aadhar_number: "",
    address: "",
    pincode: "",
    phone_number: "",
    email: "",
    religion: "",
    caste: "",
    sub_caste: "",
    photo_url: "",
    cert_url: "",
    status: "ACTIVE",
    category: "",
  });
 
  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Fetch students with related data
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
 
        // Fetch groups
        const { data: groupsData, error: groupsError } = await supabase
          .from("groups")
          .select("group_id, group_code, group_name")
          .order("group_name");
 
        if (groupsError) throw groupsError;
 
        // Fetch courses
        const { data: coursesData, error: coursesError } = await supabase
          .from("courses")
          .select("course_id, course_code, course_name")
          .order("course_name");
 
        if (coursesError) throw coursesError;
 
        // Fetch academic years
        const { data: yearsData, error: yearsError } = await supabase
          .from("academic_year")
          .select("id, academic_year, status, category")
          .order("academic_year", { ascending: false });

        if (yearsError) throw yearsError;

        // Transform students data to include related fields
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
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    };
    trackPromise(loadData());
  }, []);

  // Filter students based on selected filters
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
        matchesCategory
        && matchesStudentId
      );
    });
  }, [students, filters, normalizedCategoryFilter, studentIdSearch]);

  useEffect(() => {
    if (!paymentSemester) {
      setPaymentStatuses({});
      return;
    }
    const updateStatuses = async () => {
      try {
        await loadPaymentStatuses(filteredStudents, paymentSemester);
      } catch (error) {
        console.error("Error loading payment statuses:", error);
        setPaymentStatuses({});
      }
    };
    updateStatuses();
  }, [filteredStudents, paymentSemester]);
 
  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };
 
  const handleEdit = (student) => {
    setEditingStudent(student);
    setEditForm({
      student_id: student.student_id || "",
      hall_ticket_no: student.hall_ticket_no || "",
      academic_year: student.academic_year || "",

      category: (student.Category || student.category || "").toUpperCase(),
      group_name:
        student.group?.group_name || student.group_name || student.group || "",
      group_code: student.group?.group_code || student.group_code || "",
      course_name:
        student.course?.course_name ||
        student.course_name ||
        student.course ||
        "",
      course_code: student.course?.course_code || student.course_code || "",
      full_name: student.full_name || "",
      gender: student.gender || "",
      date_of_birth: student.date_of_birth || "",
      father_name: student.father_name || "",
      mother_name: student.mother_name || "",
      nationality: student.nationality || "",
      state: student.state || "",
      aadhar_number: student.aadhar_number || "",
      address: student.address || "",
      pincode: student.pincode || "",
      phone_number: student.phone_number || "",
      email: student.email || "",
      religion: student.religion || "",
      caste: student.caste || "",
      sub_caste: student.sub_caste || "",
      photo_url: student.photo_url || "",
      cert_url: student.cert_url || "",
      status: student.status || "ACTIVE",
    });
  };
 
  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => {
    if (name === "group_code") {
      const match = groups.find((g) => g.group_code === value);
      return {
        ...prev,
        group_code: value,
        group_name: match?.group_name || "",
        };
      }
    if (name === "course_code") {
      const match = courses.find((c) => c.course_code === value);
      return {
        ...prev,
        course_code: value,
        course_name: match?.course_name || "",
      };
    }
    if (name === "category") {
      return {
        ...prev,
        category: value.toUpperCase(),
      };
    }
      return {
        ...prev,
        [name]: value,
      };
    });
  };
 
  const handleUpdateStudent = async () => {
    if (!editingStudent) return;
    const essentialFields = {
      "Student ID": editForm.student_id,
      Category: editForm.category,
      "Full Name": editForm.full_name,
      "Academic Year": editForm.academic_year,
      Group: editForm.group_name,
      Course: editForm.course_name,
    };
    const valid = validateRequiredFields(essentialFields, {
      notify: ({ message }) => toast.warn(message),
    });
    if (!valid) return;
 
    try {
      setLoading(true);
      const payload = {
        student_id: editForm.student_id,
        hall_ticket_no: editForm.hall_ticket_no,
        academic_year: editForm.academic_year,
        Category: editForm.category,
        group_name: editForm.group_code,
        course_name: editForm.course_code,
        full_name: editForm.full_name,
        gender: editForm.gender,
        date_of_birth: editForm.date_of_birth,
        father_name: editForm.father_name,
        mother_name: editForm.mother_name,
        nationality: editForm.nationality,
        state: editForm.state,
        aadhar_number: editForm.aadhar_number,
        address: editForm.address,
        pincode: editForm.pincode,
        phone_number: editForm.phone_number,
        email: editForm.email,
        religion: editForm.religion,
        caste: editForm.caste,
        sub_caste: editForm.sub_caste,
        photo_url: editForm.photo_url,
        cert_url: editForm.cert_url,
        status: editForm.status,
      };
      const { error } = await supabase
        .from("students")
        .update(payload)
        .eq("id", editingStudent.id);
 
      if (error) throw error;
 
      const groupDisplayName =
        groups.find((g) => g.group_code === editForm.group_code)?.group_name ||
        editForm.group_code;
      const courseDisplayName =
        courses.find((c) => c.course_code === editForm.course_code)
          ?.course_name || editForm.course_code;
      // Update the local state with display-friendly names
      setStudents((prev) =>
        prev.map((student) =>
          student.id === editingStudent.id
            ? {
                ...student,
                ...editForm,
                ...payload,
                group_name: groupDisplayName,
                course_name: courseDisplayName,
                group_code: editForm.group_code,
                course_code: editForm.course_code,
              }
            : student
        )
      );
 
      toast.success("Student updated successfully");
      setEditingStudent(null);
    } catch (error) {
      console.error("Error updating student:", error);
      toast.error("Failed to update student");
    } finally {
      setLoading(false);
    }
  };
 
  const handleCancelEdit = () => {
    setEditingStudent(null);
  };
 
  const [pendingDeleteStudentId, setPendingDeleteStudentId] = useState(null);

  const handleDelete = async (studentId) => {
    if (pendingDeleteStudentId === studentId) {
      setPendingDeleteStudentId(null);
      try {
        await api.deleteStudent(studentId);
        setStudents((prev) => prev.filter((s) => s.id !== studentId));
        showToast("Student deleted.", { type: "info" });
      } catch (error) {
        console.error("Error deleting student:", error);
        showToast("Unable to delete student.", { type: "danger" });
      }
      return;
    }
    setPendingDeleteStudentId(studentId);
    showToast(
      "Click delete again within 5 seconds to confirm removing this student.",
      { type: "warning" }
    );
    setTimeout(() => {
      setPendingDeleteStudentId((prev) =>
        prev === studentId ? null : prev
      );
    }, 5000);
  };
 
  // Open status modal with current student's status
  const openStatusModal = (student) => {
    setStatusModal({
      show: true,
      student,
      selectedStatus: student.status || 'CONTINUE'
    });
  };
 
  // Close status modal
  const closeStatusModal = () => {
    setStatusModal(prev => ({
      ...prev,
      show: false
    }));
  };
 
  // Update student status in database and local state
  const updateStudentStatus = async () => {
    if (!statusModal.student) return;
   
    try {
      const { error } = await supabase
        .from("students")
        .update({ status: statusModal.selectedStatus })
        .eq("id", statusModal.student.id);
 
      if (error) throw error;
 
      // Update local state
      setStudents(students.map(student =>
        student.id === statusModal.student.id
          ? { ...student, status: statusModal.selectedStatus }
          : student
      ));
 
      toast.success("Student status updated successfully");
      closeStatusModal();
    } catch (error) {
      console.error("Error updating student status:", error);
      toast.error("Failed to update student status");
    }
  };

  const openStudentDetails = (student) => {
    setViewingStudent(student);
  };

  const closeStudentDetails = () => {
    setViewingStudent(null);
  };

  const viewingPaymentStatus = viewingStudent
    ? paymentStatuses[viewingStudent.id]
    : null;
  const viewingMedia = viewingStudent
    ? {
        photoUrl: viewingStudent.photo_url?.toString().trim() || null,
        initials: getStudentInitials(
          viewingStudent.full_name || viewingStudent.student_id || "Student"
        ),
      }
    : { photoUrl: null, initials: "ST" };

  return (
    <AdminShell>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="fw-bold mb-0">Student Management</h2>
      </div>
 
      {/* Filters */}
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
 
      {/* Students Table */}
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
                  <th>Payment Status</th>
                  <th>Edit Details</th>
                </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" className="text-center py-4">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredStudents.length > 0 ? (
                filteredStudents.map((student) => (
                  <tr
                    key={student.id}
                    role="button"
                    onClick={() => openStudentDetails(student)}
                    style={{ cursor: "pointer" }}
                  >
                    <td>{student.student_id}</td>
                    <td>{student.full_name}</td>
                    <td>{student.hall_ticket_no || "-"}</td>
                    <td>{student.group?.group_name || student.group_name}</td>
                    <td>{student.course?.course_name || student.course_name}</td>
                    <td>{student.academic_year}</td>
                    <td>{formatDerivedSemesterLabel(student.academic_year)}</td>
                    <td>
                      <button
                        className={`btn btn-sm ${
                          student.status === "DISCONTINUE"
                            ? "btn-danger"
                            : student.status === "HOLD"
                            ? "btn-warning"
                            : "btn-success"
                        }`}
                        onClick={(event) => {
                          event.stopPropagation();
                          openStatusModal(student);
                        }}
                        style={{ minWidth: "100px" }}
                      >
                        {student.status === "DISCONTINUE"
                          ? "Discontinued"
                          : student.status === "HOLD"
                          ? "On Hold"
                          : "Active"}
                      </button>
                    </td>
                    <td>
                      {paymentSemester ? (
                        paymentStatuses[student.id] ? (
                          <div className="d-flex flex-wrap gap-1">
                            {paymentStatuses[student.id]?.detailLines?.map(
                              (line, index) => (
                                <button
                                  key={`payment-detail-${student.id}-${index}`}
                                  type="button"
                                  className={`btn btn-sm ${
                                    line.paid
                                      ? "btn-status-paid"
                                      : "btn-status-unpaid"
                                  }`}
                                  style={{ minWidth: "160px" }}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openPaymentHistoryModal(student);
                                  }}
                                >
                                  {line.paid
                                    ? `${line.label} paid`
                                    : `${line.label} unpaid`}
                                </button>
                              )
                            )}
                          </div>
                        ) : (
                          <span className="text-muted">Loading...</span>
                        )
                      ) : (
                        <span className="text-muted">
                          Select payment semester
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="d-flex gap-2">
                        <button
                          className="btn btn-sm btn-outline-primary"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleEdit(student);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDelete(student.id);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" className="text-center py-4">
                    No students found matching the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
 
      {viewingStudent && (
        <div
          className="modal d-block"
          tabIndex="-1"
          style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
        >
          <div className="modal-dialog modal-dialog-centered modal-xl">
            <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
              <div
                className="modal-header border-0 pb-0"
                style={{
                  background:
                    "linear-gradient(135deg, #1d4d9f 0%, #2d9cdb 55%, #38b6ff 100%)",
                  color: "#fff",
                  boxShadow: "0 10px 25px rgba(29, 77, 159, 0.35)",
                }}
              >
                <div>
                  <p
                    className="text-uppercase small mb-1"
                    style={{ letterSpacing: "0.2em" }}
                  >
                    Student Overview
                  </p>
                  <h5 className="modal-title fw-semibold mb-1">
                    {viewingStudent.full_name || "Student Details"}
                  </h5>
                  <div className="d-flex flex-wrap gap-2 align-items-center text-white-50 small">
                    <span>{viewingStudent.student_id || "-"}</span>
                    {(viewingStudent.course?.course_name ||
                      viewingStudent.course_name ||
                      viewingStudent.group?.group_name ||
                      viewingStudent.group_name) && <span>•</span>}
                    <span>
                      {viewingStudent.course?.course_name ||
                        viewingStudent.course_name ||
                        viewingStudent.group?.group_name ||
                        viewingStudent.group_name ||
                        ""}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-light btn-sm"
                  aria-label="Close"
                  onClick={closeStudentDetails}
                >
                  Close
                </button>
              </div>
              <div className="modal-body bg-light p-4">
                <div className="d-flex flex-column flex-lg-row gap-4">
                  <div className="text-center flex-shrink-0">
                    <div
                      className="rounded-4 bg-white border border-2 border-white overflow-hidden shadow"
                      style={{ width: 150, height: 150 }}
                    >
                      {viewingMedia.photoUrl ? (
                        <img
                          src={viewingMedia.photoUrl}
                          alt={viewingStudent.full_name || "Student photo"}
                          className="w-100 h-100"
                          style={{ objectFit: "cover" }}
                        />
                      ) : (
                        <div className="w-100 h-100 d-flex align-items-center justify-content-center fs-2 text-primary">
                          {viewingMedia.initials}
                        </div>
                      )}
                    </div>
                    <div className="mt-3">
                      <p className="text-uppercase small text-muted mb-0">
                        {viewingStudent.status === "DISCONTINUE"
                          ? "Discontinued"
                          : viewingStudent.status === "HOLD"
                          ? "On Hold"
                          : "Active Student"}
                      </p>
                      <h6 className="text-truncate mb-0">
                        {viewingStudent.full_name || "-"}
                      </h6>
                    </div>
                  </div>
                  <div className="flex-grow-1">
                    <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
                      <span
                        className={`badge rounded-pill px-3 py-2 fs-7 text-uppercase ${
                          viewingPaymentStatus
                            ? `bg-${viewingPaymentStatus.variant || "secondary"}`
                            : "bg-secondary"
                        }`}
                      >
                        {viewingPaymentStatus?.label ||
                          "Payment info pending"}
                      </span>
                      <span
                        className={`badge rounded-pill px-3 py-2 fs-7 text-uppercase ${
                          viewingStudent.status === "DISCONTINUE"
                            ? "bg-danger"
                            : viewingStudent.status === "HOLD"
                            ? "bg-warning text-dark"
                            : "bg-success"
                        }`}
                      >
                        {viewingStudent.status === "DISCONTINUE"
                          ? "Discontinued"
                          : viewingStudent.status === "HOLD"
                          ? "On Hold"
                          : "Active"}
                      </span>
                    </div>
                    <div className="row g-3">
                      {[
                        {
                          label: "Category",
                          value:
                            viewingStudent.Category ||
                            viewingStudent.category,
                        },
                        {
                          label: "Academic Year",
                          value: viewingStudent.academic_year,
                        },
                        {
                          label: "Current Semester",
                          value: formatDerivedSemesterLabel(viewingStudent.academic_year),
                        },
                        {
                          label: "Course",
                          value:
                            viewingStudent.course?.course_name ||
                            viewingStudent.course_name,
                        },
                        {
                          label: "Group",
                          value:
                            viewingStudent.group?.group_name ||
                            viewingStudent.group_name,
                        },
                        {
                          label: "Hall Ticket",
                          value: viewingStudent.hall_ticket_no,
                        },
                        { label: "Gender", value: viewingStudent.gender },
                        {
                          label: "Date of Birth",
                          value: formatDateLabel(viewingStudent.date_of_birth),
                        },
                        {
                          label: "Nationality",
                          value: viewingStudent.nationality,
                        },
                      ].map((field) => (
                        <div key={field.label} className="col-6 col-md-4">
                          <small className="text-uppercase text-muted">
                            {field.label}
                          </small>
                          <div className="fw-semibold">{field.value || "-"}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="row g-3 mt-4">
                  <div className="col-lg-6">
                    <div className="bg-white rounded-4 shadow-sm p-4 h-100">
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <p className="text-uppercase small text-muted mb-0">
                          Contact
                        </p>
                        <span className="text-muted small">Primary</span>
                      </div>
                      <div className="fw-semibold">{viewingStudent.phone_number || "-"}</div>
                      <div className="text-muted small">
                        {viewingStudent.email || "-"}
                      </div>
                    </div>
                  </div>
                  <div className="col-lg-6">
                    <div className="bg-white rounded-4 shadow-sm p-4 h-100">
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <p className="text-uppercase small text-muted mb-0">
                          Residence
                        </p>
                        <span className="text-muted small">
                          {viewingStudent.pincode ? `PIN ${viewingStudent.pincode}` : ""}
                        </span>
                      </div>
                      <div className="fw-semibold text-capitalize">
                        {viewingStudent.address || "-"}
                      </div>
                      <div className="text-muted small mt-2">
                        {viewingStudent.state || "-"}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="row g-3 mt-3">
                  <div className="col-lg-6">
                    <div className="bg-white rounded-4 shadow-sm p-4 h-100">
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <p className="text-uppercase small text-muted mb-0">
                          Parents
                        </p>
                        <span className="text-muted small">
                          Family Info
                        </span>
                      </div>
                      <div className="fw-semibold">
                        {viewingStudent.father_name || "-"}
                      </div>
                      <div className="text-muted small">
                        Father
                      </div>
                      <div className="fw-semibold mt-3">
                        {viewingStudent.mother_name || "-"}
                      </div>
                      <div className="text-muted small">
                        Mother
                      </div>
                    </div>
                  </div>
                  <div className="col-lg-6">
                    <div className="bg-white rounded-4 shadow-sm p-4 h-100">
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <p className="text-uppercase small text-muted mb-0">
                          Identity
                        </p>
                        <span className="text-muted small">
                          Core details
                        </span>
                      </div>
                      <div className="fw-semibold">
                        {viewingStudent.aadhar_number || "-"}
                      </div>
                      <div className="text-muted small">
                        Aadhar
                      </div>
                      <div className="fw-semibold mt-3">
                        {viewingStudent.religion || "-"}
                      </div>
                      <div className="text-muted small">
                        Religion
                      </div>
                      <div className="fw-semibold mt-3 text-capitalize">
                        {viewingStudent.caste || "-"}
                        {viewingStudent.sub_caste
                          ? ` • ${viewingStudent.sub_caste}`
                          : ""}
                      </div>
                      <div className="text-muted small">
                        Caste / Sub Caste
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer border-0 pt-0">
                <button
                  type="button"
                  className="btn btn-outline-secondary rounded-pill px-4"
                  onClick={closeStudentDetails}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {editingStudent && (
        <div
          className="modal d-block"
          tabIndex="-1"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header bg-light">
                <h5 className="modal-title">
                  Edit Student: {editingStudent.student_id} ·{" "}
                  {editingStudent.full_name}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={handleCancelEdit}
                ></button>
              </div>
              <div
                className="modal-body"
                style={{ maxHeight: "70vh", overflowY: "auto" }}
              >
                <div className="row">
                  <div className="col-md-6">
                    <h6>Student Information</h6>
                    <div className="mb-3">
                      <label className="form-label">Student ID</label>
                      <input
                        type="text"
                        className="form-control"
                        name="student_id"
                        value={editForm.student_id}
                        onChange={handleEditChange}
                        required
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Hall Ticket No</label>
                      <input
                        type="text"
                        className="form-control"
                        name="hall_ticket_no"
                        value={editForm.hall_ticket_no}
                        onChange={handleEditChange}
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Full Name</label>
                      <input
                        type="text"
                        className="form-control"
                        name="full_name"
                        value={editForm.full_name}
                        onChange={handleEditChange}
                        required
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Date of Birth</label>
                      <input
                        type="date"
                        className="form-control"
                        name="date_of_birth"
                        value={editForm.date_of_birth}
                        onChange={handleEditChange}
                        required
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Gender</label>
                      <select
                        className="form-select"
                        name="gender"
                        value={editForm.gender}
                        onChange={handleEditChange}
                        required
                      >
                        <option value="">Select Gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <h6>Academic Information</h6>
                    <div className="mb-3">
                      <label className="form-label">Category</label>
                      <select
                        className="form-select"
                        name="category"
                        value={editForm.category}
                        onChange={handleEditChange}
                        required
                      >
                        <option value="">Select Category</option>
                        {categoryOptions.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Academic Year</label>
                      <select
                        className="form-select"
                        name="academic_year"
                        value={editForm.academic_year}
                        onChange={handleEditChange}
                        required
                      >
                        <option value="">Select Year</option>
                        {years.map((year) => (
                          <option key={year.id} value={year.academic_year}>
                            {year.academic_year}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Group</label>
                      <select
                        className="form-select"
                        name="group_code"
                        value={editForm.group_code}
                        onChange={handleEditChange}
                        required
                      >
                        <option value="">Select Group</option>
                        {groups.map((group) => (
                          <option key={group.group_id} value={group.group_code}>
                            {group.group_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Course</label>
                      <select
                        className="form-select"
                        name="course_code"
                        value={editForm.course_code}
                        onChange={handleEditChange}
                        required
                      >
                        <option value="">Select Course</option>
                        {courses.map((course) => (
                          <option
                            key={course.course_id}
                            value={course.course_code}
                          >
                            {course.course_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Status</label>
                      <select
                        className="form-select"
                        name="status"
                        value={editForm.status}
                        onChange={handleEditChange}
                        required
                      >
                        <option value="ACTIVE">Active</option>
                        <option value="INACTIVE">Inactive</option>
                        <option value="GRADUATED">Graduated</option>
                        <option value="DROPPED">Dropped</option>
                      </select>
                    </div>
                  </div>
                </div>
 
                <div className="row mt-3">
                  <div className="col-md-6">
                    <h6>Parent Information</h6>
                    <div className="mb-3">
                      <label className="form-label">Father's Name</label>
                      <input
                        type="text"
                        className="form-control"
                        name="father_name"
                        value={editForm.father_name}
                        onChange={handleEditChange}
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Mother's Name</label>
                      <input
                        type="text"
                        className="form-control"
                        name="mother_name"
                        value={editForm.mother_name}
                        onChange={handleEditChange}
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <h6>Contact Information</h6>
                    <div className="mb-3">
                      <label className="form-label">Phone Number</label>
                      <input
                        type="tel"
                        className="form-control"
                        name="phone_number"
                        value={editForm.phone_number}
                        onChange={handleEditChange}
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Email</label>
                      <input
                        type="email"
                        className="form-control"
                        name="email"
                        value={editForm.email}
                        onChange={handleEditChange}
                      />
                    </div>
                  </div>
                </div>
 
                <div className="row mt-3">
                  <div className="col-12">
                    <h6>Address & Identity</h6>
                    <div className="mb-3">
                      <label className="form-label">Address</label>
                      <textarea
                        className="form-control"
                        name="address"
                        rows="2"
                        value={editForm.address}
                        onChange={handleEditChange}
                      ></textarea>
                    </div>
                    <div className="row">
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">State</label>
                          <input
                            type="text"
                            className="form-control"
                            name="state"
                            value={editForm.state}
                            onChange={handleEditChange}
                          />
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">Pincode</label>
                          <input
                            type="text"
                            className="form-control"
                            name="pincode"
                            value={editForm.pincode}
                            onChange={handleEditChange}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="row">
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">Aadhar Number</label>
                          <input
                            type="text"
                            className="form-control"
                            name="aadhar_number"
                            value={editForm.aadhar_number}
                            onChange={handleEditChange}
                          />
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">Nationality</label>
                          <input
                            type="text"
                            className="form-control"
                            name="nationality"
                            value={editForm.nationality}
                            onChange={handleEditChange}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
 
                <div className="row mt-3">
                  <div className="col-md-4">
                    <div className="mb-3">
                      <label className="form-label">Religion</label>
                      <input
                        type="text"
                        className="form-control"
                        name="religion"
                        value={editForm.religion}
                        onChange={handleEditChange}
                      />
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="mb-3">
                      <label className="form-label">Caste</label>
                      <input
                        type="text"
                        className="form-control"
                        name="caste"
                        value={editForm.caste}
                        onChange={handleEditChange}
                      />
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="mb-3">
                      <label className="form-label">Sub Caste</label>
                      <input
                        type="text"
                        className="form-control"
                        name="sub_caste"
                        value={editForm.sub_caste}
                        onChange={handleEditChange}
                      />
                    </div>
                  </div>
                </div>
 
                <div className="row mt-3">
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">Photo URL</label>
                      <input
                        type="text"
                        className="form-control"
                        name="photo_url"
                        value={editForm.photo_url}
                        onChange={handleEditChange}
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">Signature URL</label>
                      <input
                        type="text"
                        className="form-control"
                        name="cert_url"
                        value={editForm.cert_url}
                        onChange={handleEditChange}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCancelEdit}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleUpdateStudent}
                  disabled={loading}
                >
                  {loading ? "Updating..." : "Update Student"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Status Change Modal */}
      {statusModal.show && (
        <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Update Student Status</h5>
                <button type="button" className="btn-close" onClick={closeStatusModal}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Select Status</label>
                  <div className="d-flex flex-column gap-2">
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="statusOption"
                        id="continueOption"
                        value="CONTINUE"
                        checked={statusModal.selectedStatus === 'CONTINUE'}
                        onChange={() => setStatusModal({...statusModal, selectedStatus: 'CONTINUE'})}
                      />
                      <label className="form-check-label" htmlFor="continueOption">
                        Continue (Active)
                      </label>
                    </div>
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="statusOption"
                        id="discontinueOption"
                        value="DISCONTINUE"
                        checked={statusModal.selectedStatus === 'DISCONTINUE'}
                        onChange={() => setStatusModal({...statusModal, selectedStatus: 'DISCONTINUE'})}
                      />
                      <label className="form-check-label" htmlFor="discontinueOption">
                        Discontinue
                      </label>
                    </div>
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="statusOption"
                        id="holdOption"
                        value="HOLD"
                        checked={statusModal.selectedStatus === 'HOLD'}
                        onChange={() => setStatusModal({...statusModal, selectedStatus: 'HOLD'})}
                      />
                      <label className="form-check-label" htmlFor="holdOption">
                        Hold
                      </label>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeStatusModal}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={updateStudentStatus}
                >
                  Update Status
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {paymentHistoryModal.show && (
        <div
          className="modal d-block"
          tabIndex="-1"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  Payment history for{" "}
                  {paymentHistoryModal.student?.full_name ||
                    paymentHistoryModal.student?.student_id ||
                    "Student"}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={closePaymentHistoryModal}
                ></button>
              </div>
              <div className="modal-body">
                <p className="text-muted mb-3">
                  Semester {paymentSemester || "—"}{" "}
                  {paymentHistoryModal.student?.hall_ticket_no &&
                    `• Hall Ticket ${paymentHistoryModal.student?.hall_ticket_no}`}
                </p>
                {paymentHistoryModal.loading ? (
                  <div className="text-center py-4">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  </div>
                ) : paymentHistoryModal.error ? (
                  <div className="alert alert-warning mb-0">
                    {paymentHistoryModal.error}
                  </div>
                ) : paymentHistoryModal.payments.length ? (
                  <>
                    <div className="table-responsive">
                    <table className="table table-sm mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>#</th>
                          <th>Date</th>
                          <th>Amount</th>
                          <th>Type</th>
                          <th>Fee Type</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                            {paymentHistoryModal.payments.map((payment) => (
                              <tr
                                key={
                                  payment.id ||
                                  `${payment.payment_type}-${payment.created_at}`
                                }
                              >
                                <td>{payment.sequence || "?"}</td>
                                <td>{formatPaymentDate(payment.created_at)}</td>
                                <td>
                                  {payment.amount_paid
                                    ? formatCurrency(payment.amount_paid)
                                    : "-"}
                                </td>
                                <td>{payment.payment_type || "—"}</td>
                                <td>{payment.fee_type || "—"}</td>
                                <td className="text-capitalize">
                                  {payment.payment_status || "—"}
                                </td>
                              </tr>
                            ))}
                      </tbody>
                    </table>
                    </div>
                    {paymentHistoryModal.balance > 0 && (
                      <div className="alert alert-info mt-3 mb-0">
                        Balance {formatCurrency(paymentHistoryModal.balance)}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-muted">No payments have been recorded yet.</div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closePaymentHistoryModal}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
 
 
