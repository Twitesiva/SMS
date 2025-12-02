import AdminShell from "../components/AdminShell";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { api } from "../lib/mockApi";
import { validateRequiredFields } from "../lib/validation";
import { showToast } from "../store/ui";

const EXAM_RELEVANT_FEE_TYPES = new Set(["exam", "full", "partial"]);
const isExamCoveragePayment = (feeType = "") =>
  EXAM_RELEVANT_FEE_TYPES.has((feeType || "").toLowerCase());
const sumExamCoverageFromPayments = (payments = []) =>
  (payments || []).reduce((sum, payment) => {
    if (!payment) return sum;
    const amount = Number(payment.amount_paid || 0);
    if (isExamCoveragePayment(payment.fee_type)) {
      return sum + amount;
    }
    return sum;
  }, 0);

const normalizeCategoryValue = (value) =>
  value === undefined || value === null ? "" : String(value).trim().toUpperCase();

const formatCurrency = (value) => {
  const num = Number(value || 0);
  return `₹${num.toLocaleString("en-IN")}`;
};

export default function Payments() {
  // Master data
  const [years, setYears] = useState([]);
  const [groups, setGroups] = useState([]);
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);

  // Form
  const [form, setForm] = useState({
    category: "",
    year: "",
    group: "",
    group_code: "",
    courseCode: "",
    semester: "",
    student_id: "",
    examName: "",
  });
  const [displayCount, setDisplayCount] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [storedExamList, setStoredExamList] = useState([]);
  const [editingExam, setEditingExam] = useState(null);

  const [activePaymentStudent, setActivePaymentStudent] = useState(null);

  const [modalStudent, setModalStudent] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalCourseCode, setModalCourseCode] = useState("");
  const [modalSemester, setModalSemester] = useState("");
  const [selectedSupplementarySemesters, setSelectedSupplementarySemesters] =
    useState([]);
  const [selectedSubjectKeys, setSelectedSubjectKeys] = useState(() => new Set());
  const [modalFeeInfo, setModalFeeInfo] = useState(null);
  const [modalPaymentRecords, setModalPaymentRecords] = useState([]);
  const [loadingModalFee, setLoadingModalFee] = useState(false);
  const [modalStep, setModalStep] = useState(1);
  const [supplementaryFeeRates, setSupplementaryFeeRates] = useState(null);
  const [loadingSupplementaryFeeRates, setLoadingSupplementaryFeeRates] =
    useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentOption, setPaymentOption] = useState("full");
  const [partialAmount, setPartialAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [modalPaymentSummary, setModalPaymentSummary] = useState(null);
  const [loadingModalPayments, setLoadingModalPayments] = useState(false);
  const [appliedRegistrationDetails, setAppliedRegistrationDetails] = useState({});
  const [appliedKeys, setAppliedKeys] = useState([]);
  const applyAppliedFlags = (details = {}) => {
    const merged = { ...details };
    appliedKeys.forEach((key) => {
      if (!key) return;
      merged[key] = {
        ...(merged[key] || {}),
        applied: true,
      };
    });
    return merged;
  };
  const [allowPaymentWithoutSelection, setAllowPaymentWithoutSelection] = useState(false);
  const examFeeData = useMemo(() => {
    if (!modalFeeInfo?.categories?.length) return null;
    const categories = modalFeeInfo.categories.filter((cat) =>
      /exam/i.test(cat.name || "")
    );
    if (!categories.length) return null;
    const total = categories.reduce((sum, cat) => sum + cat.amount, 0);
    return { categories, total };
  }, [modalFeeInfo]);

  const hasActiveFilters = Boolean(
    form.category ||
      form.year ||
      form.group_code ||
      form.courseCode ||
      form.semester ||
      form.student_id
  );

  const firstDefined = (...values) =>
    values.find(
      (value) => value !== undefined && value !== null && value !== ""
    );
  const normalizeSearchValue = (value) =>
    (value || "").toString().trim().toLowerCase();
  const categoryOptions = useMemo(() => {
    const categories = new Set();
    years.forEach((year) => {
      if (year.category) categories.add(year.category);
    });
    groups.forEach((group) => {
      if (group.category) categories.add(group.category);
    });
    const order = { UG: 0, PG: 1 };
    return Array.from(categories).sort((a, b) => {
      const keyA = order[a] ?? 99;
      const keyB = order[b] ?? 99;
      if (keyA !== keyB) return keyA - keyB;
      return a.localeCompare(b);
    });
  }, [years, groups]);

  const availableYears = useMemo(() => {
    if (!form.category) return years;
    const normalizedCategory = normalizeCategoryValue(form.category);
    return years.filter(
      (year) => normalizeCategoryValue(year.category) === normalizedCategory
    );
  }, [years, form.category]);

  const availableGroups = useMemo(() => {
    if (!form.category) return groups;
    const normalizedCategory = normalizeCategoryValue(form.category);
    return groups.filter(
      (group) => normalizeCategoryValue(group.category) === normalizedCategory
    );
  }, [groups, form.category]);

  const visibleGroupOptions = useMemo(() => {
    if (form.category && availableGroups.length > 0) {
      return availableGroups;
    }
    return groups;
  }, [form.category, availableGroups, groups]);

  const filteredCoursesForGroup = useMemo(() => {
    if (!form.group_code && !form.group) return courses;
    const targets = new Set(
      [form.group_code, form.group].map(normalizeSearchValue).filter(Boolean)
    );
    return courses.filter((course) => {
      return ["group_code", "group_name", "groupCode"].some((key) => {
        const value = course[key];
        if (!value) return false;
        return targets.has(normalizeSearchValue(value));
      });
    });
  }, [courses, form.group_code, form.group]);

  const subjectsForCurrentSemester = useMemo(() => {
    if (!modalCourseCode || modalSemester === "") return [];
    const normalizedCourse = normalizeSearchValue(modalCourseCode);
    const semesterValue =
      modalSemester === "" || modalSemester === undefined || modalSemester === null
        ? ""
        : String(modalSemester);
    return subjects.filter((subject) => {
      const courseMatch =
        normalizeSearchValue(subject.courseCode) === normalizedCourse ||
        normalizeSearchValue(subject.courseName) === normalizedCourse;
      const semesterMatch =
        subject.semester === "" ? semesterValue === "" : String(subject.semester) === semesterValue;
      return courseMatch && semesterMatch;
    });
  }, [subjects, modalCourseCode, modalSemester]);

  const subjectsForSupplementarySemester = useMemo(() => {
    if (!modalCourseCode || selectedSupplementarySemesters.length === 0) return [];
    const normalizedCourse = normalizeSearchValue(modalCourseCode);
    const semesterSet = new Set(
      selectedSupplementarySemesters.map((semester) =>
        semester === "" || semester === undefined || semester === null
          ? ""
          : String(semester)
      )
    );
    return subjects.filter((subject) => {
      const courseMatch =
        normalizeSearchValue(subject.courseCode) === normalizedCourse ||
        normalizeSearchValue(subject.courseName) === normalizedCourse;
      const semesterValue =
        subject.semester === "" || subject.semester === undefined || subject.semester === null
          ? ""
          : String(subject.semester);
      const semesterMatch = semesterSet.has(semesterValue);
      return courseMatch && semesterMatch;
    });
  }, [subjects, modalCourseCode, selectedSupplementarySemesters]);
  const availableSupplementarySemesters = useMemo(() => {
    const numeric = Number(modalSemester);
    if (!Number.isFinite(numeric) || numeric <= 1) {
      return [];
    }
    const parity = numeric % 2 === 0 ? 0 : 1;
    const options = [];
    for (let sem = numeric - 2; sem >= (parity === 0 ? 2 : 1); sem -= 2) {
      options.push(sem);
    }
    return options;
  }, [modalSemester]);

  useEffect(() => {
    setSelectedSupplementarySemesters((prev) =>
      prev.filter((sem) =>
        availableSupplementarySemesters.includes(Number(sem))
      )
    );
  }, [availableSupplementarySemesters]);

  const displayedSubjectLabel = selectedSupplementarySemesters.length
    ? "Supplementary subjects"
    : modalSemester
      ? `Sem ${modalSemester}`
      : "the selected semester";

  const calculateRecordOutstanding = (record) => {
    if (!record) return 0;
    const totalFee = Number(record.total_fee || 0);
    const payments = Array.isArray(record.payments) ? record.payments : [];
    const paidTotal = payments.reduce((sum, payment) => {
      if (!payment) return sum;
      if (payment.payment_status === "success") {
        return sum + Number(payment.amount_paid || 0);
      }
      return sum;
    }, 0);
    return Math.max(totalFee - paidTotal, 0);
  };

  const modalPaymentSemesterOptions = useMemo(() => {
    const seen = new Map();
    modalPaymentRecords.forEach((record) => {
      const semester = record.semester;
      if (semester === undefined || semester === null) return;
      const normalized = String(semester);
      if (seen.has(normalized)) return;
      const outstanding = calculateRecordOutstanding(record);
      seen.set(normalized, {
        semester: normalized,
        outstanding,
      });
    });
    return Array.from(seen.values());
  }, [modalPaymentRecords]);

  const resolveModalSubjectNames = (subject) => {
    const fromList = subject.subjectNames?.filter(Boolean) || [];
    if (fromList.length) return fromList;
    return [subject.subjectName, subject.subjectCode].filter(Boolean);
  };

  const deriveSubjectIdentifier = (subject) => {
    const candidate =
      subject.subject_id ??
      subject.id ??
      subject.subjectId ??
      subject.subjectCode ??
      subject.subject_code;
    if (candidate !== undefined && candidate !== null && candidate !== "") {
      return String(candidate);
    }
    const fallbackName = subject.subject_name ?? subject.subjectName ?? "subject";
    const fallbackSemester =
      subject.semester ??
      subject.semester_number ??
      subject.semesterNumber ??
      "";
    const fallbackCourse =
      subject.courseCode ?? subject.course_code ?? subject.courseCode ?? "";
    return `${fallbackName}-${fallbackCourse}-${fallbackSemester}`;
  };

  const buildSubjectEntries = (
    subjectList,
    { contextKey = "current", subjectIdLookup } = {}
  ) =>
    subjectList.flatMap((subject) => {
      const names = resolveModalSubjectNames(subject);
      const code =
        subject.subjectCode ||
        subject.subject_code ||
        subject.code ||
        "";
      const subjectIdentifier = deriveSubjectIdentifier(subject);
      const codeKey =
        (subject.subjectCode ||
          subject.subject_code ||
          subject.code ||
          "")
          .toString()
          .trim()
          .toLowerCase();
      const lookupId = subjectIdLookup?.get(codeKey);
      const referenceId =
        lookupId ??
        subject.subject_id ??
        subject.id ??
        subject.subjectId ??
        null;
      const dedupKey =
        `${subjectIdentifier}-${contextKey || "current"}`;
      return names.map((name, index) => ({
        key: `${subjectIdentifier}-${contextKey}-${name}-${index}`,
        name,
        code: code || undefined,
        subjectId: subjectIdentifier,
        subjectReferenceId: referenceId,
        dedupKey,
        contextKey,
      }));
    });

  const subjectIdLookup = useMemo(() => {
    const map = new Map();
    subjects.forEach((subject) => {
      const code =
        (subject.subjectCode ||
          subject.subject_code ||
          subject.code ||
          "")
          .toString()
          .trim()
          .toLowerCase();
      const referenceId =
        subject.subject_id ?? subject.id ?? subject.subjectId ?? null;
      if (code && referenceId) {
        map.set(code, referenceId);
      }
    });
    return map;
  }, [subjects]);

  const currentSubjectEntries = useMemo(
    () =>
      buildSubjectEntries(subjectsForCurrentSemester, {
        contextKey: "current",
        subjectIdLookup,
      }),
    [subjectsForCurrentSemester, subjectIdLookup]
  );
  const supplementarySubjectsBySemester = useMemo(() => {
    if (!subjectsForSupplementarySemester.length || !selectedSupplementarySemesters.length) {
      return [];
    }
    const semesterMap = new Map();
    subjectsForSupplementarySemester.forEach((subject) => {
      const semesterValue =
        subject.semester === "" ||
        subject.semester === undefined ||
        subject.semester === null
          ? ""
          : String(subject.semester);
      if (!selectedSupplementarySemesters.includes(semesterValue)) {
        return;
      }
      if (!semesterMap.has(semesterValue)) {
        semesterMap.set(semesterValue, []);
      }
      semesterMap.get(semesterValue).push(subject);
    });
    return selectedSupplementarySemesters.map((semester) => ({
      semester,
      entries: buildSubjectEntries(semesterMap.get(semester) || [], {
        contextKey: `supp-${semester}`,
        subjectIdLookup,
      }),
    }));
  }, [subjectsForSupplementarySemester, selectedSupplementarySemesters]);
  const supplementarySubjectEntries = useMemo(
    () => supplementarySubjectsBySemester.flatMap((group) => group.entries),
    [supplementarySubjectsBySemester]
  );
  const combinedSubjectEntries = useMemo(
    () => [...currentSubjectEntries, ...supplementarySubjectEntries],
    [currentSubjectEntries, supplementarySubjectEntries]
  );
  const currentSelectedEntries = useMemo(
    () =>
      currentSubjectEntries.filter((entry) =>
        selectedSubjectKeys.has(entry.key)
      ),
    [currentSubjectEntries, selectedSubjectKeys]
  );
  const supplementarySelectedEntries = useMemo(
    () =>
      supplementarySubjectEntries.filter((entry) =>
        selectedSubjectKeys.has(entry.key)
      ),
    [supplementarySubjectEntries, selectedSubjectKeys]
  );
  const supplementarySelectedBySemester = useMemo(
    () =>
      supplementarySubjectsBySemester
        .map((group) => ({
          semester: group.semester,
          entries: group.entries.filter((entry) =>
            selectedSubjectKeys.has(entry.key)
          ),
        }))
        .filter((group) => group.entries.length > 0),
    [supplementarySubjectsBySemester, selectedSubjectKeys]
  );

  const uniqueModalSubjectKeys = useMemo(
    () => Array.from(new Set(combinedSubjectEntries.map((entry) => entry.key))),
    [combinedSubjectEntries]
  );
  useEffect(() => {
    setSelectedSubjectKeys((prev) => {
      const available = new Set(uniqueModalSubjectKeys);
      const next = new Set([...prev].filter((key) => available.has(key)));
      return next;
    });
    setModalStep(allowPaymentWithoutSelection ? 2 : 1);
  }, [uniqueModalSubjectKeys, allowPaymentWithoutSelection]);
  const currentSelectedCount = currentSelectedEntries.length;
  const supplementarySelectedCount = supplementarySelectedEntries.length;
  const supplementaryFeeAmount = useMemo(() => {
    if (!supplementaryFeeRates || supplementarySelectedCount === 0) {
      return 0;
    }
    if (supplementarySelectedCount === 1) {
      return supplementaryFeeRates.paper1;
    }
    if (supplementarySelectedCount === 2) {
      return supplementaryFeeRates.paper2;
    }
    return supplementaryFeeRates.paper3;
  }, [supplementaryFeeRates, supplementarySelectedCount]);
  const otherFeeCategories = useMemo(() => {
    const categories = modalFeeInfo?.categories || [];
    return categories.filter(
      (category) => !/exam/i.test((category?.name || "").toString())
    );
  }, [modalFeeInfo]);
  const otherFeeTotal = useMemo(
    () =>
      otherFeeCategories.reduce(
        (sum, category) => sum + Number(category?.amount || 0),
        0
      ),
    [otherFeeCategories]
  );
  const fallbackExamFeeAmount = modalPaymentSummary?.totalExamFee || 0;
  const regularExamFeeAmount = examFeeData?.total ?? fallbackExamFeeAmount;
  const regularExamFeeDisplay =
    examFeeData || fallbackExamFeeAmount > 0
      ? formatCurrency(regularExamFeeAmount)
      : "Not configured";
  const hasExamFees = Boolean(examFeeData?.categories?.length);
  const hasOtherFees = otherFeeCategories.length > 0;
  const examOnlyAmount = regularExamFeeAmount;
  const examSubtotal = examOnlyAmount + supplementaryFeeAmount;
  const fallbackOtherFeeTotal = modalPaymentSummary?.otherFeeTotal || 0;
  const appliedOtherFeeTotal = otherFeeTotal || fallbackOtherFeeTotal;
  const computedTotalFeeBreakdown = examSubtotal + appliedOtherFeeTotal;
  const totalFeeBreakdownAmount =
    computedTotalFeeBreakdown > 0
      ? computedTotalFeeBreakdown
      : modalPaymentSummary?.totalFee || 0;
  const alreadyPaidTotal = modalPaymentSummary?.alreadyPaidTotal || 0;
  const examCoverageAmount = modalPaymentSummary?.examCoverageAmount || 0;
  const alreadyPaidExam = Math.min(examOnlyAmount, examCoverageAmount);
  const outstandingTotal = Math.max(
    totalFeeBreakdownAmount - alreadyPaidTotal,
    0
  );
  const outstandingExam = Math.max(examOnlyAmount - alreadyPaidExam, 0);
  const paymentIntentAmount = useMemo(() => {
    if (paymentOption === "exam") return outstandingExam;
    if (paymentOption === "full") return outstandingTotal;
    const parsed = Number(partialAmount);
    if (Number.isNaN(parsed) || parsed <= 0) {
      return Math.max(outstandingExam, 0);
    }
    return Math.min(
      Math.max(parsed, Math.max(outstandingExam, 0)),
      Math.max(outstandingTotal, 0)
    );
  }, [paymentOption, partialAmount, outstandingExam, outstandingTotal]);
  useEffect(() => {
    if (outstandingExam <= 0 && paymentOption === "exam") {
      setPaymentOption("full");
    }
  }, [outstandingExam, paymentOption]);
  const selectedSubjectCount =
    currentSelectedCount + supplementarySelectedCount;
  const totalModalSubjectCount =
    currentSubjectEntries.length + supplementarySubjectEntries.length;
  const currentTotalCount = currentSubjectEntries.length;
  const toggleSubjectSelection = (key) => {
    setSelectedSubjectKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const toggleSupplementarySemesterSelection = (semesterValue) => {
    setSelectedSupplementarySemesters((prev) => {
      if (prev.includes(semesterValue)) {
        return prev.filter((sem) => sem !== semesterValue);
      }
      return [...prev, semesterValue];
    });
  };
  const handleAdvanceToSummary = () => {
    if (!selectedSubjectKeys.size) {
      showToast("Select at least one subject before continuing.", {
        type: "warning",
      });
      return;
    }
    setModalStep(2);
  };

  const markAppliedKey = (key) => {
    if (!key) return;
    setAppliedKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
  };

  const handleStoreSelectedSubjects = async () => {
    if (!selectedSubjectKeys.size && !allowPaymentWithoutSelection) {
      showToast("Select at least one subject before continuing.", {
        type: "warning",
      });
      return;
    }
    if (!activePaymentStudent) {
      showToast("Student information is missing.", { type: "danger" });
      return;
    }

    const examNameValue = (form.examName || "").trim();
    if (!examNameValue) {
      showToast("Enter an exam name before storing subjects.", {
        type: "warning",
      });
      return;
    }

    const detailKeyForModal = getAppliedRegistrationKey(
      activePaymentStudent,
      modalSemester || form.semester || ""
    );

    const uniqueSubjectEntries = getUniqueSelectedSubjectEntries();
    try {
      const { examRegistrationId, examMasterId } =
        await createOrFetchExamRegistration(examNameValue);
      await persistExamRegistrationSubjects(
        examRegistrationId,
        uniqueSubjectEntries,
        examMasterId
      );
      showToast("Selected subjects stored successfully.", {
        type: "success",
        title: "Exam",
      });
      try {
        const nextDetails = await buildAppliedRegistrationDetails();
        const merged = { ...nextDetails };
        if (detailKeyForModal) {
          merged[detailKeyForModal] = {
            ...(merged[detailKeyForModal] || {}),
            applied: true,
          };
        }
        setAppliedRegistrationDetails(merged);
        markAppliedKey(detailKeyForModal);
      } catch (error) {
        console.error("Failed to refresh applied registrations:", error);
      }
      closeStudentModal();
    } catch (error) {
      console.error("Unable to store selected subjects", error);
      showToast("Unable to store selected subjects. Please try again.", {
        type: "danger",
        title: "Exam",
      });
    }
  };

  const renderSelectionLine = (entry) => (
    <div
      key={`${entry.key}-summary`}
      className="d-flex justify-content-between py-1 border-bottom"
    >
      <span className="text-truncate">{entry.name}</span>
      <span className="text-muted small">
        {entry.code || "Code unavailable"}
      </span>
    </div>
  );

  const renderSubjectRow = (entry) => (
    <tr
      key={entry.key}
      className="cursor-pointer"
      onClick={() => toggleSubjectSelection(entry.key)}
    >
      <td className="align-middle text-center" style={{ width: "1px" }}>
        <input
          className="form-check-input"
          type="checkbox"
          id={`subject-checkbox-${entry.key}`}
          checked={selectedSubjectKeys.has(entry.key)}
          onChange={() => toggleSubjectSelection(entry.key)}
          aria-label={`Select ${entry.name}`}
          onClick={(event) => event.stopPropagation()}
        />
      </td>
      <td className="align-middle text-truncate" style={{ maxWidth: 400 }}>
        {entry.name}
      </td>
      <td className="align-middle text-muted small text-nowrap">
        {entry.code || "Code unavailable"}
      </td>
    </tr>
  );

  const getUniqueSelectedSubjectEntries = useCallback(() => {
    const selectedSubjectEntries = combinedSubjectEntries.filter((entry) =>
      selectedSubjectKeys.has(entry.key)
    );
    const next = [];
    const tracked = new Set();
    selectedSubjectEntries.forEach((entry) => {
      const identity =
        entry.key ??
        entry.dedupKey ??
        `${entry.subjectId}:${entry.contextKey ?? "regular"}`;
      if (tracked.has(identity)) return;
      tracked.add(identity);
      next.push(entry);
    });
    return next;
  }, [combinedSubjectEntries, selectedSubjectKeys]);

  const renderStudentProfileCard = (student) => {
    if (!student) return null;
    return (
      <div className="card card-soft p-4 mb-3">
        <div className="row align-items-center">
          <div className="col-md-4 d-flex align-items-center gap-3">
            {(student.photo_url || student.photo) ? (
              <img
                src={student.photo_url || student.photo}
                alt={student.full_name || student.name || "Student"}
                className="rounded-circle"
                style={{ width: 96, height: 96, objectFit: "cover" }}
              />
            ) : (
              <div
                className="bg-secondary text-white rounded-circle d-inline-flex align-items-center justify-content-center"
                style={{ width: 96, height: 96, fontSize: 20 }}
              >
                {(student.full_name || student.name || "S").slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <h5 className="mb-1">
                {student.full_name || student.name || "Unnamed Student"}
              </h5>
              <div className="text-muted">
                ID: {student.student_id || "N/A"}
              </div>
              <div className="text-muted">Vijayam College Arts & Science</div>
            </div>
          </div>
          <div className="col-md-7 d-flex flex-column justify-content-center align-items-end text-end">
            <h5 className="fw-bold">About this student</h5>
            <div className="d-flex flex-column gap-2 mt-3">
              <div className="fs-5">
                {formatGroupLabel(student, getMatchedGroup(student))}
              </div>
              <div className="fs-5">
                {getMatchedCourse(student)?.courseName ||
                  student.course_name ||
                  student.course_code ||
                  "Course unknown"}
              </div>
              <div className="fs-5">
                {student.academic_year || student.academicYear || "Academic year not set"}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPaymentStatusCell = () => null;

  const getAppliedRegistrationKey = (student, semesterValue) => {
    const semester =
      semesterValue ||
      form.semester ||
      student?.semester ||
      student?.semester_number ||
      "";
    const studentId =
      student?.student_id ??
      student?.studentId ??
      student?.id ??
      student?.student_id_number ??
      "";
    if (!studentId || !semester) return null;
    return `${studentId}-${semester}`;
  };

  const buildAppliedRegistrationDetails = useCallback(async () => {
    if (!students.length) return {};
    const validStudents = students.filter(
      (student) => student?.id !== undefined && student?.id !== null
    );
    if (!validStudents.length) return {};

    const studentLookup = new Map(
      validStudents.map((student) => [student.id, student])
    );

    const studentIds = Array.from(studentLookup.keys());
    if (!studentIds.length) return {};

    const { data, error } = await supabase
      .from("exam_registrations")
      .select(
        "student_id, semester, total_fee, total_exam_fee, payments(fee_type, amount_paid, payment_status)"
      )
      .in("student_id", studentIds)
      .limit(1000);

    if (error) throw error;

    const nextDetails = {};
    (data || []).forEach((registration) => {
      if (!registration) return;
      const studentRecord = studentLookup.get(registration.student_id);
      if (!studentRecord) return;

      const studentIdSource =
        studentRecord.student_id ??
        studentRecord.studentId ??
        studentRecord.id ??
        studentRecord.student_id_number ??
        "";
      if (!studentIdSource) return;

      const semesterValue =
        registration.semester === undefined || registration.semester === null
          ? ""
          : String(registration.semester);
      if (!semesterValue) return;

      const successfulPayments = (registration.payments || []).filter(
        (payment) => payment?.payment_status === "success"
      );
      if (!successfulPayments.length) return;

      const paidTotal = successfulPayments.reduce(
        (sum, payment) => sum + Number(payment.amount_paid || 0),
        0
      );
      const totalFee = Number(registration.total_fee || 0);
      const totalExamFee = Number(registration.total_exam_fee || 0);
      const examCoverageAmount = sumExamCoverageFromPayments(successfulPayments);
      const hasExamPaid =
        totalExamFee > 0 ? examCoverageAmount >= totalExamFee : examCoverageAmount > 0;
      const fullyPaid = totalFee > 0 ? paidTotal >= totalFee : hasExamPaid;

      const status = fullyPaid
        ? "fully-paid"
        : hasExamPaid
        ? "exam-paid"
        : "partial-paid-without-exam";

      nextDetails[`${studentIdSource}-${semesterValue}`] = {
        fullyPaid,
        hasExamPaid,
        status,
        paidTotal,
        examCoverageAmount,
        totalFee,
      };
    });

    return applyAppliedFlags(nextDetails);
  }, [students, appliedKeys]);

  const getMatchedGroup = (student) =>
    groups.find(
      (g) =>
        g.code === student.group_code ||
        g.code === student.group ||
        g.code === student.group_name ||
        g.name === student.group ||
        g.name === student.group_name
    );

  const formatGroupLabel = (student, match) => {
    return (
      match?.name ||
      student.group_name ||
      student.group ||
      "Group unknown"
    );
  };

  const getMatchedCourse = (student) =>
    courses.find(
      (c) =>
        c.courseCode === student.course_code ||
        c.courseCode === student.course_name ||
        c.courseCode === student.courseCode ||
        c.courseName === student.course_name ||
        c.courseName === student.courseCode
    );

  const getStudentIdentifier = (student) =>
    firstDefined(
      student?.student_id,
      student?.studentId,
      student?.id,
      student?.student_id_number
    );
  const getStudentHallTickets = (student) => [
    student?.hall_ticket_number,
    student?.hall_ticket,
    student?.hallTicketNo,
    student?.hall_ticket_no,
  ].filter(Boolean);
  const selectedStudent = useMemo(() => {
    if (!form.student_id) return null;
    const normalizedTarget = String(form.student_id).toLowerCase().trim();
    if (!normalizedTarget) return null;
    return students.find((student) => {
      const candidate = getStudentIdentifier(student);
      if (candidate) {
        if (String(candidate).toLowerCase().trim() === normalizedTarget) {
          return true;
        }
      }
      const hallTickets = getStudentHallTickets(student);
      return hallTickets.some(
        (ticket) =>
          String(ticket).toLowerCase().trim() === normalizedTarget
      );
    });
  }, [form.student_id, students]);
  const buildFormDefaultsFromStudent = (student) => {
    if (!student) return {};
    const matchedGroup = getMatchedGroup(student);
    const matchedCourse = getMatchedCourse(student);
    const categoryCandidate =
      student.category ??
      student.Category ??
      matchedGroup?.category ??
      "";
    const normalizedCategory = normalizeCategoryValue(categoryCandidate);
    return {
      category: normalizedCategory || "",
      year:
        student.academic_year ||
        student.academicYear ||
        student.year?.academic_year ||
        "",
      group: matchedGroup?.name || student.group_name || student.group || "",
      group_code:
        matchedGroup?.code ||
        matchedGroup?.group_code ||
        student.group_code ||
        student.group ||
        "",
      courseCode:
        matchedCourse?.courseCode ||
        matchedCourse?.course_code ||
        student.course_code ||
        student.course ||
        student.courseCode ||
        "",
    };
  };

  const matchesCategoryForStudent = (student) => {
    if (!form.category) return true;
    const targetCategory = normalizeCategoryValue(form.category);
    if (!targetCategory) return true;
    return normalizeCategoryValue(student.category) === targetCategory;
  };

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchesYear = !form.year || s.academic_year === form.year;
      const matchesGroup =
        !form.group_code ||
        [s.group_code, s.group, s.group_name].includes(form.group_code);
      const matchesCourse =
        !form.courseCode ||
        [s.course_code, s.course_name, s.course_id].includes(form.courseCode);
      const matchesSemester =
        !form.semester ||
        !s.semester ||
        String(s.semester) === String(form.semester);
      const matchesCategory = matchesCategoryForStudent(s);
      const hallTicketSearch = form.student_id
        ? String(form.student_id).toLowerCase().trim()
        : "";
      const matchesStudentId =
        !form.student_id ||
        (s.student_id &&
          String(s.student_id)
            .toLowerCase()
            .includes(String(form.student_id).trim().toLowerCase()));
      const matchesHallTicket =
        !hallTicketSearch ||
        getStudentHallTickets(s).some((ticket) =>
          String(ticket).toLowerCase().includes(hallTicketSearch)
        );
      const passesStudentFilter =
        !form.student_id || matchesStudentId || matchesHallTicket;
      return (
        matchesYear &&
        matchesGroup &&
        matchesCourse &&
        matchesSemester &&
        matchesCategory &&
        passesStudentFilter
      );
    });
  }, [
    students,
    form.year,
    form.group_code,
    form.courseCode,
    form.semester,
    form.category,
    form.student_id,
  ]);

  const navigate = useNavigate();
  const location = useLocation();

  const loadData = useCallback(async () => {
    try {
      const [
        yearsData,
        groupsData,
        coursesData,
        studentsData,
        subjectsData,
      ] = await Promise.all([
        api.listAcademicYears?.(),
        api.listGroups?.(),
        api.listCourses?.(),
        api.listStudents?.(),
        api.listSubjects?.(),
      ]);

    const normalizedYears = (yearsData || [])
        .filter((y) => y?.active !== false)
        .map((year) => {
          const rawCategory = year.category ?? year.Category;
          return {
            ...year,
            category: normalizeCategoryValue(rawCategory),
          };
        });

    const normalizedGroups = (groupsData || []).map((g) => {
        const rawCategory = g.category ?? g.Category;
        return {
          id: g.group_id ?? g.id,
          code: g.group_code ?? g.code,
          group_code: g.group_code ?? g.code,
          name: g.group_name ?? g.name,
          category: normalizeCategoryValue(rawCategory),
        };
      });

      const normalizedCourses = (coursesData || []).map((c) => ({
        id: c.course_id ?? c.id,
        courseCode: c.course_code || c.code,
        courseName: c.course_name || c.name,
        group_code: c.group_code || c.group_name || c.groupCode,
        group_name: c.group_name || c.groupCode,
      }));

      const yearCategoryMap = new Map(
        normalizedYears.map((year) => [year.academic_year, year.category])
      );

      const groupCategoryMap = new Map();
      normalizedGroups.forEach((group) => {
        if (!group.category) return;
        const keys = [group.code, group.name].filter(Boolean);
        keys.forEach((key) => groupCategoryMap.set(key, group.category));
      });

      const normalizedStudents = (studentsData || []).map((s) => {
        const academicYear = s.academic_year || "";
        const groupCategory =
          groupCategoryMap.get(s.group_code) ??
          groupCategoryMap.get(s.group) ??
          groupCategoryMap.get(s.group_name);
        const studentCategory =
          groupCategory || yearCategoryMap.get(academicYear) || "";
        return {
          ...s,
          academic_year: academicYear,
          group_name: s.group_name || s.group || s.group_code || "",
          group: s.group_name || s.group || s.group_code || "",
          group_code: s.group_code || s.group || s.group_name || "",
          course_name: s.course_name || s.course_id || s.courseCode || "",
          course_code: s.course_code || s.course_name || s.course_id || "",
          semester: s.semester ?? s.semester_number ?? "",
          category: studentCategory,
        };
      });

      setYears(normalizedYears);
      setGroups(normalizedGroups);
      setCourses(normalizedCourses);
      setStudents(normalizedStudents);
      setSubjects(subjectsData || []);
    } catch (e) {
      console.error("Error loading payment masters:", e);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const refreshStoredExamList = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("exam_master")
        .select("id, exam_name")
        .order("exam_name", { ascending: true })
        .limit(500);
      if (error) throw error;
      const names = (data || [])
        .map((entry) => ({
          id: entry.id,
          exam_name: (entry.exam_name || "").trim(),
        }))
        .filter((entry) => entry.exam_name);
      setStoredExamList(names);
    } catch (error) {
      console.error("Failed to load exam names:", error);
    }
  }, []);

  useEffect(() => {
    refreshStoredExamList();
  }, [refreshStoredExamList]);

  // Restore filters and selected student when navigated back with state
  useEffect(() => {
    const navState = location?.state;
    if (!navState) return;
    const { studentId, selectedFilters } = navState;

    if (selectedFilters) {
      setForm((prev) => ({ ...prev, ...selectedFilters }));
    }

    if (studentId && students && students.length) {
      const found = students.find((s) => s.student_id === studentId);
      if (found) {
        setActivePaymentStudent(found);
      }
    }

    // clear the navigation state so this runs only once
    try {
      navigate(location.pathname, { replace: true });
    } catch (e) {
      // ignore navigation replace failures
    }
  }, [location, students, navigate]);

  useEffect(() => {
    let cancelled = false;
    const refreshAppliedRegistrations = async () => {
      try {
        const nextDetails = await buildAppliedRegistrationDetails();
        if (!cancelled) {
          setAppliedRegistrationDetails(nextDetails);
        }
      } catch (error) {
        console.error("Failed to load applied registrations:", error);
      }
    };
    refreshAppliedRegistrations();
    return () => {
      cancelled = true;
    };
  }, [buildAppliedRegistrationDetails]);

  useEffect(() => {
    const loadFeeInfo = async () => {
      if (!modalStudent || !modalCourseCode || modalSemester === "") {
        setModalFeeInfo(null);
        return;
      }
      const academicYear =
        modalStudent.academic_year || modalStudent.academicYear || "";
      const groupValue =
        modalStudent.group ||
        modalStudent.group_name ||
        modalStudent.group_code ||
        "";
      const courseValue = modalCourseCode;
      const semesterValue =
        modalSemester === "" ||
        modalSemester === undefined ||
        modalSemester === null
          ? ""
          : String(modalSemester);
      if (!academicYear || !groupValue || !courseValue || semesterValue === "") {
        setModalFeeInfo(null);
        return;
      }
      setLoadingModalFee(true);
      try {
      const { data, error } = await supabase
        .from("fee_structure")
        .select("fee_categories, fee_amounts, total_fee")
        .eq("academic_year", academicYear)
        .eq("group_code", groupValue)
        .eq("course_code", courseValue)
        .eq("semester", Number(semesterValue))
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        setModalFeeInfo(null);
        return;
      }
      const categories = (data.fee_categories || []).map((name, index) => ({
        name: name || "Fee",
        amount: Number(data.fee_amounts?.[index] || 0),
      }));
      setModalFeeInfo({
        total: Number(data.total_fee || 0),
        categories,
      });
      } catch (error) {
        console.error("Failed to load fee info", error);
        showToast("Unable to load fee info for this semester.", {
          type: "danger",
        });
        setModalFeeInfo(null);
      } finally {
        setLoadingModalFee(false);
      }
    };
    loadFeeInfo();
  }, [modalStudent, modalCourseCode, modalSemester]);

  useEffect(() => {
    let cancelled = false;
    const loadPaymentHistory = async () => {
      if (!modalStudent || !modalCourseCode || modalSemester === "") {
        setModalPaymentSummary(null);
        return;
      }
      const academicYear =
        modalStudent.academic_year || modalStudent.academicYear || "";
      const matchedGroup = groups.find(
        (g) =>
          g.code === modalStudent.group_code ||
          g.code === modalStudent.group ||
          g.code === modalStudent.group_name ||
          g.name === modalStudent.group ||
          g.name === modalStudent.group_name
      );
      const groupLabel =
        matchedGroup?.name ||
        modalStudent.group_name ||
        modalStudent.group ||
        "Group unknown";
      const normalizedCourseCode = modalCourseCode;
      const matchedCourse = courses.find((c) => {
        const courseCodeMatch =
          c.courseCode === modalStudent.course_code ||
          c.courseCode === modalStudent.course_name ||
          c.courseCode === modalStudent.courseCode;
        const courseNameMatch =
          c.courseName === modalStudent.course_name ||
          c.courseName === modalStudent.course_code;
        return courseCodeMatch || courseNameMatch;
      });
      const courseName =
        normalizedCourseCode ||
        matchedCourse?.courseName ||
        matchedCourse?.course_name ||
        modalStudent.course_name ||
        modalStudent.course_code ||
        modalStudent.courseCode ||
        "";
      const semesterValue =
        modalSemester === "" ||
        modalSemester === undefined ||
        modalSemester === null
          ? ""
          : String(modalSemester);
      const semesterNumber =
        semesterValue === "" ? null : Number(semesterValue);
      if (!academicYear || !groupLabel || !courseName || semesterNumber === null) {
        setModalPaymentSummary(null);
        return;
      }
      setLoadingModalPayments(true);
      try {
        const { data: registration, error: registrationError } = await supabase
          .from("exam_registrations")
          .select("id, total_fee, total_exam_fee, other_fee")
          .eq("student_id", modalStudent.id)
          .eq("academic_year", academicYear)
          .eq("group_name", groupLabel)
          .eq("course_name", courseName)
          .eq("semester", semesterNumber)
          .maybeSingle();
        if (registrationError) throw registrationError;
        if (!registration?.id) {
          setModalPaymentSummary(null);
          return;
        }
        const { data: payments, error: paymentsError } = await supabase
          .from("payments")
          .select("fee_type, amount_paid, payment_status, payment_type")
          .eq("exam_registration_id", registration.id)
          .order("created_at", { ascending: false });
        if (paymentsError) throw paymentsError;
        const successfulPayments = (payments || []).filter(
          (payment) => payment?.payment_status === "success"
        );
        const alreadyPaidTotal = successfulPayments.reduce(
          (sum, payment) => sum + Number(payment.amount_paid || 0),
          0
        );
        const examCoverageAmount = sumExamCoverageFromPayments(successfulPayments);
        const alreadyPaidExam = Math.min(examSubtotal, examCoverageAmount);
        setModalPaymentSummary({
          registrationId: registration.id,
          successfulPayments,
          alreadyPaidTotal,
          alreadyPaidExam,
          examCoverageAmount,
          totalFee: Number(registration.total_fee || 0),
          totalExamFee: Number(registration.total_exam_fee || 0),
          otherFeeTotal: Number(registration.other_fee || 0),
        });
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load payment history:", error);
          setModalPaymentSummary(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingModalPayments(false);
        }
      }
    };
    loadPaymentHistory();
    return () => {
      cancelled = true;
    };
  }, [modalStudent, modalCourseCode, modalSemester, groups, courses]);

  useEffect(() => {
    let isMounted = true;
    const loadSupplementaryFees = async () => {
      setLoadingSupplementaryFeeRates(true);
      try {
        const { data, error } = await supabase
          .from("Supplementary")
          .select("Paper-1, Paper-2, Paper-3")
          .order("created_at", { ascending: false })
          .limit(1);
        if (error) {
          if (error.code !== "42P01") {
            console.error("Failed to load supplementary fees:", error);
          }
          if (isMounted) {
            setSupplementaryFeeRates(null);
          }
          return;
        }
        if (!data || data.length === 0) {
          if (isMounted) {
            setSupplementaryFeeRates(null);
          }
          return;
        }
        if (!isMounted) return;
        const latest = data[0];
        if (isMounted) {
          setSupplementaryFeeRates({
            paper1: Number(latest["Paper-1"]) || 0,
            paper2: Number(latest["Paper-2"]) || 0,
            paper3: Number(latest["Paper-3"]) || 0,
          });
        }
      } catch (error) {
        console.error("Failed to load supplementary fees:", error);
        if (isMounted) {
          setSupplementaryFeeRates(null);
        }
      } finally {
        if (isMounted) {
          setLoadingSupplementaryFeeRates(false);
        }
      }
    };
    loadSupplementaryFees();
    return () => {
      isMounted = false;
    };
  }, []);

  const save = async (override = {}) => {
    // Payment form has been removed as per requirements
    return false;
  };

  const prepareStudentPaymentContext = (student, options = {}) => {
    setActivePaymentStudent(student);
    setModalStudent(student);
    const semesterValue =
      options.semester ??
      firstDefined(
        form.semester,
        student.semester,
        student.semester_number,
        student.semesterNo,
        student.semesterNumber
      ) ??
      "";
    const courseValue =
      options.courseCode ??
      firstDefined(
        form.courseCode,
        student.courseCode,
        student.course_code,
        student.course_name,
        student.courseCode
      ) ??
      "";
    setModalSemester(semesterValue);
    setModalCourseCode(courseValue);
    setModalFeeInfo(null);
    setModalPaymentSummary(null);
    setSelectedSubjectKeys(new Set());
    setSelectedSupplementarySemesters([]);
    setModalStep(options.skipSubjectSelection ? 2 : 1);
    setModalPaymentRecords(options.records || []);
    setPaymentOption("full");
    setPartialAmount("");
    setPaymentMethod("");
    setAllowPaymentWithoutSelection(Boolean(options.skipSubjectSelection));
  };

  const openStudentModal = (student, options = {}) => {
    prepareStudentPaymentContext(student, options);
    setModalOpen(true);
  };

  const handleModalSemesterChange = (semesterValue) => {
    setModalSemester(semesterValue);
    setModalFeeInfo(null);
    setModalPaymentSummary(null);
    setSelectedSubjectKeys(new Set());
    setSelectedSupplementarySemesters([]);
    setModalStep(1);
    setAllowPaymentWithoutSelection(false);
  };

  const closeStudentModal = () => {
    setModalOpen(false);
    setModalStudent(null);
    setModalStep(1);
    setModalPaymentSummary(null);
    setLoadingModalPayments(false);
    setModalPaymentRecords([]);
    setAllowPaymentWithoutSelection(false);
  };
  const closePaymentModal = ({ notifyCancellation = false } = {}) => {
    setShowPaymentModal(false);
    setPaymentOption("full");
    setPartialAmount("");
    setPaymentMethod("");
    if (notifyCancellation) {
      showToast("Payment canceled.", {
        type: "info",
        title: "Payment",
      });
    }
  };
  const generateDecodeNo = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 5; i += 1) {
      const index = Math.floor(Math.random() * chars.length);
      code += chars.charAt(index);
    }
    return code;
  };
  const persistExamRegistrationSubjects = async (
    examRegistrationId,
    subjectEntries,
    examMasterId
  ) => {
    if (!subjectEntries?.length) return;
    const payload = [];
    const seenBySubjectId = new Set();
    subjectEntries.forEach((entry) => {
      const subjectId =
        entry.subjectReferenceId ?? entry.subjectId ?? null;
      if (subjectId && seenBySubjectId.has(subjectId)) return;
      if (subjectId) seenBySubjectId.add(subjectId);
      payload.push({
        exam_registration_id: examRegistrationId,
        subject_id: subjectId,
      });
    });
    const { error: deleteError } = await supabase
      .from("exam_registration_subjects")
      .delete()
      .eq("exam_registration_id", examRegistrationId);
    if (deleteError) throw deleteError;
    const { data: insertedSubjects, error: insertError } = await supabase
      .from("exam_registration_subjects")
      .insert(payload)
      .select("id");
    if (insertError) throw insertError;
    const subjectsWithIds = insertedSubjects || [];
    if (!subjectsWithIds.length) return;
    const decodePayload = subjectsWithIds.map((subject) => ({
      exam_registration_subject_id: subject.id,
      decode_no: generateDecodeNo(),
      is_valid: true,
      exam_id: examMasterId,
    }));
    const { error: decodeInsertError } = await supabase
      .from("decode_numbers")
      .insert(decodePayload);
    if (decodeInsertError) throw decodeInsertError;
  };

  const ensureExamMaster = useCallback(
    async (examName) => {
      const normalized = (examName || "").trim();
      if (!normalized) return null;

      const { data: existing, error: existingError } = await supabase
        .from("exam_master")
        .select("id")
        .eq("exam_name", normalized)
        .limit(1)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existing?.id) return existing.id;

      const { data: inserted, error: insertError } = await supabase
        .from("exam_master")
        .insert({ exam_name: normalized })
        .select("id")
        .maybeSingle();
      if (insertError) throw insertError;
      await refreshStoredExamList();
      return inserted?.id ?? null;
    },
    [refreshStoredExamList]
  );

  const handleSelectSavedExam = (exam) => {
    setForm((prev) => ({ ...prev, examName: exam.exam_name }));
    setEditingExam(exam);
  };

  const handleSaveExamName = async () => {
    const value = (form.examName || "").trim();
    if (!value) {
      showToast("Enter an exam name before saving.", { type: "warning" });
      return;
    }
    if (editingExam) {
      showToast("Finish editing or cancel before saving a new exam name.", {
        type: "warning",
      });
      return;
    }
    const exists = storedExamList.some(
      (entry) => entry.exam_name.toLowerCase() === value.toLowerCase()
    );
    if (exists) {
      showToast("This exam name already exists.", { type: "warning" });
      return;
    }
    try {
      const { error } = await supabase
        .from("exam_master")
        .insert({ exam_name: value });
      if (error) throw error;
      await refreshStoredExamList();
      showToast("Exam name saved.", { type: "success" });
      setEditingExam(null);
    } catch (error) {
      console.error("Failed to save exam name:", error);
      showToast("Unable to save exam name.", { type: "danger" });
    }
  };

  const handleUpdateExamName = async () => {
    if (!editingExam) {
      showToast("Select an exam name to edit.", { type: "warning" });
      return;
    }
    const value = (form.examName || "").trim();
    if (!value) {
      showToast("Exam name cannot be empty.", { type: "warning" });
      return;
    }
    if (value === editingExam.exam_name) {
      showToast("No changes to save.", { type: "info" });
      return;
    }
    const duplicate = storedExamList.some(
      (entry) =>
        entry.id !== editingExam.id &&
        entry.exam_name.toLowerCase() === value.toLowerCase()
    );
    if (duplicate) {
      showToast("Another exam already uses this name.", { type: "warning" });
      return;
    }
    try {
      const { error } = await supabase
        .from("exam_master")
        .update({ exam_name: value })
        .eq("id", editingExam.id);
      if (error) throw error;
      await refreshStoredExamList();
      showToast("Exam name updated.", { type: "success" });
      setEditingExam(null);
    } catch (error) {
      console.error("Failed to update exam name:", error);
      showToast("Unable to update exam name.", { type: "danger" });
    }
  };

  const [completeRegistrationModalOpen, setCompleteRegistrationModalOpen] = useState(
    false
  );
  const [completionTargetExam, setCompletionTargetExam] = useState(null);
  const [completedExamIds, setCompletedExamIds] = useState([]);

  const openCompleteRegistrationModal = (exam) => {
    setCompleteRegistrationModalOpen(true);
    setCompletionTargetExam(exam);
  };

  const closeCompleteRegistrationModal = () => {
    setCompleteRegistrationModalOpen(false);
    setCompletionTargetExam(null);
  };

  const handleCompleteRegistrationConfirm = () => {
    closeCompleteRegistrationModal();
    if (completionTargetExam?.id) {
      setCompletedExamIds((prev) =>
        prev.includes(completionTargetExam.id)
          ? prev
          : [...prev, completionTargetExam.id]
      );
    }
    showToast("Registration completed.", {
      type: "success",
      title: "Registration",
    });
  };

  const handleDeleteExamName = async (examEntry) => {
    const target = examEntry ?? editingExam;
    if (!target) {
      showToast("Select an exam to delete.", { type: "warning" });
      return;
    }
    try {
      const { error } = await supabase
        .from("exam_master")
        .delete()
        .eq("id", target.id);
      if (error) throw error;
      await refreshStoredExamList();
      setForm((prev) => ({ ...prev, examName: "" }));
      setEditingExam(null);
      showToast("Exam name removed.", { type: "success" });
    } catch (error) {
      console.error("Failed to delete exam name:", error);
      showToast("Unable to delete exam name.", { type: "danger" });
    }
  };

  const createOrFetchExamRegistration = async (examName) => {
    if (!activePaymentStudent) {
      throw new Error("Student information is missing.");
    }
    const semesterNumber =
      modalSemester === "" ||
      modalSemester === undefined ||
      modalSemester === null
        ? null
        : Number(modalSemester);
    const academicYear =
      activePaymentStudent.academic_year ||
      activePaymentStudent.academicYear ||
      null;
    const groupLabel = formatGroupLabel(
      activePaymentStudent,
      getMatchedGroup(activePaymentStudent)
    );
    const courseName =
      getMatchedCourse(activePaymentStudent)?.courseName ||
      activePaymentStudent.course_name ||
      activePaymentStudent.course_code ||
      null;

    const examMasterId = await ensureExamMaster(examName);
    let query = supabase
      .from("exam_registrations")
      .select("id, exam_id")
      .eq("student_id", activePaymentStudent.id);
    if (semesterNumber !== null && !Number.isNaN(semesterNumber)) {
      query = query.eq("semester", semesterNumber);
    }
    if (academicYear) {
      query = query.eq("academic_year", academicYear);
    }
    if (groupLabel) {
      query = query.eq("group_name", groupLabel);
    }
    if (courseName) {
      query = query.eq("course_name", courseName);
    }
    if (examMasterId) {
      query = query.eq("exam_id", examMasterId);
    }

    const { data: existingReg, error: existingRegError } = await query.maybeSingle();
    if (existingRegError) throw existingRegError;
    if (existingReg?.id) {
      return {
        examRegistrationId: existingReg.id,
        examMasterId: existingReg.exam_id || examMasterId,
      };
    }

    const payload = {
      student_id: activePaymentStudent.id,
      academic_year: academicYear,
      group_name: groupLabel,
      course_name: courseName,
      semester: semesterNumber,
      total_exam_fee: examSubtotal,
      other_fee: otherFeeTotal,
      total_fee: totalFeeBreakdownAmount,
      status: "pending",
      exam_id: examMasterId,
    };

    const { data: insertedReg, error: insertError } = await supabase
      .from("exam_registrations")
      .insert(payload)
      .select("id")
      .maybeSingle();
    if (insertError) throw insertError;
    if (!insertedReg?.id) {
      throw new Error("Unable to establish exam registration");
    }
    return {
      examRegistrationId: insertedReg.id,
      examMasterId,
    };
  };

  const handlePaymentModalConfirm = async () => {
    if (!paymentMethod) {
      showToast("Please select a payment method.", { type: "warning" });
      return;
    }
    if (!activePaymentStudent) {
      showToast("Student information is missing.", { type: "danger" });
      return;
    }
    const examNameValue = (form.examName || "").trim();
    if (!examNameValue) {
      showToast("Enter an exam name before recording payments.", {
        type: "warning",
      });
      return;
    }
    const examFullyPaid =
      examOnlyAmount > 0 &&
      (modalPaymentSummary?.alreadyPaidExam || 0) >= examOnlyAmount;
    if (paymentOption === "exam" && examFullyPaid) {
      showToast("Exam fees already paid for this student.", {
        type: "warning",
        title: "Payment",
      });
      setPaymentMethod("");
      setPaymentOption("full");
      return;
    }

    const uniqueSubjectEntries = getUniqueSelectedSubjectEntries();

    let amount = 0;

    try {
      const { examRegistrationId, examMasterId } =
        await createOrFetchExamRegistration(examNameValue);
      const { data: existingPayments, error: paymentsError } = await supabase
        .from("payments")
        .select("fee_type, amount_paid, payment_status, payment_type")
        .eq("exam_registration_id", examRegistrationId)
        .eq("payment_status", "success");
      if (paymentsError) throw paymentsError;
      const successfulPayments = existingPayments || [];
      const alreadyPaidTotal = successfulPayments.reduce(
        (sum, payment) => sum + Number(payment.amount_paid || 0),
        0
      );
      const examCoverageAmount = sumExamCoverageFromPayments(successfulPayments);
      const alreadyPaidExam = Math.min(examSubtotal, examCoverageAmount);
      const outstandingTotal = Math.max(
        totalFeeBreakdownAmount - alreadyPaidTotal,
        0
      );
      const outstandingExam = Math.max(examSubtotal - alreadyPaidExam, 0);

      const effectivePaymentOption =
        paymentOption === "exam" && outstandingExam <= 0 ? "full" : paymentOption;
      if (
        effectivePaymentOption !== paymentOption &&
        paymentOption === "exam" &&
        outstandingExam <= 0
      ) {
        setPaymentOption("full");
      }
      if (effectivePaymentOption === "exam") {
        amount = outstandingExam;
      } else if (effectivePaymentOption === "full") {
        if (outstandingTotal <= 0) {
          const detailKey = getAppliedRegistrationKey(activePaymentStudent);
          if (detailKey) {
            setAppliedRegistrationDetails((prev) => ({
              ...prev,
              [detailKey]: {
                ...(prev[detailKey] || {}),
                fullyPaid: true,
                hasExamPaid: true,
                status: "fully-paid",
                paidTotal: Math.max(paidTotal, totalFeeBreakdownAmount),
                examCoverageAmount,
                totalFee: totalFeeBreakdownAmount,
              },
            }));
          }
          showToast("Semester fees are already fully paid.", {
            type: "warning",
            title: "Payment",
          });
          setPaymentMethod("");
          return;
        }
        amount = outstandingTotal;
      } else {
        const parsed = Number(partialAmount);
        if (Number.isNaN(parsed) || parsed <= 0) {
          showToast("Enter a valid amount for the partial payment.", {
            type: "warning",
            title: "Payment",
          });
          return;
        }
        if (parsed < outstandingExam) {
          showToast(
            `Partial amount must cover the remaining exam portion of ${formatCurrency(
              outstandingExam
            )}.`,
            { type: "warning", title: "Payment" }
          );
          return;
        }
        if (parsed > outstandingTotal) {
          showToast(
            `Amount exceeds the outstanding balance of ${formatCurrency(
              outstandingTotal
            )}.`,
            { type: "warning", title: "Payment" }
          );
          return;
        }
        amount = parsed;
      }
      const normalizedPaymentOption = effectivePaymentOption;

      const { data: duplicateEntry, error: duplicateError } = await supabase
        .from("payments")
        .select("id")
        .match({
          exam_registration_id: examRegistrationId,
          payment_type: paymentMethod,
          fee_type: normalizedPaymentOption,
          amount_paid: amount,
          payment_status: "success",
        })
        .limit(1)
        .maybeSingle();
      if (duplicateError) throw duplicateError;
      if (duplicateEntry?.id) {
        showToast("This payment already exists.", {
          type: "warning",
          title: "Payment",
        });
        setPaymentMethod("");
        return;
      }

      await persistExamRegistrationSubjects(
        examRegistrationId,
        uniqueSubjectEntries,
        examMasterId
      );
      const { error: paymentError } = await supabase.from("payments").insert({
        exam_registration_id: examRegistrationId,
        amount_paid: amount,
        payment_type: paymentMethod,
        fee_type: normalizedPaymentOption,
        payment_status: "success",
      });
      if (paymentError) throw paymentError;
    } catch (error) {
      console.error("Unable to record payment", error);
      showToast("Payment unsuccessful. Unable to record payment. Please try again.", {
        type: "danger",
        title: "Payment",
      });
      return;
    }

    showToast(
      `Payment successful for ${formatCurrency(amount)} via ${paymentMethod}.`,
      {
        type: "success",
        title: "Payment",
      }
    );

    try {
      const nextDetails = await buildAppliedRegistrationDetails();
      setAppliedRegistrationDetails(nextDetails);
    } catch (error) {
      console.error("Failed to refresh applied registrations:", error);
    }

    closePaymentModal();
    closeStudentModal();
  };

  const matchedStudentCount = hasActiveFilters ? filteredStudents.length : 0;

  const filteredBySearch = searchTerm
    ? filteredStudents.filter((student) => {
        const key = `${student.student_id} ${
          student.full_name || student.name || ""
        }`.toLowerCase();
        return key.includes(searchTerm.toLowerCase());
      })
    : filteredStudents;

  const limitedStudents = displayCount
    ? filteredBySearch.slice(
        0,
        Math.min(Number(displayCount), filteredBySearch.length)
      )
    : filteredBySearch;

  const outstandingStudentsCount = useMemo(() => {
    return limitedStudents.reduce((count, student) => {
      const key = getAppliedRegistrationKey(student);
      const detail = key ? appliedRegistrationDetails[key] : null;
      if (detail && !detail.fullyPaid) {
        return count + 1;
      }
      return count;
    }, 0);
  }, [limitedStudents, appliedRegistrationDetails]);

  const fullyPaidCount = useMemo(() => {
    return limitedStudents.reduce((count, student) => {
      const key = getAppliedRegistrationKey(student);
      const detail = key ? appliedRegistrationDetails[key] : null;
      if (detail?.fullyPaid) {
        return count + 1;
      }
      return count;
    }, 0);
  }, [limitedStudents, appliedRegistrationDetails]);

  const paymentStats = useMemo(() => {
    const displayLabel = displayCount || "All";
    return [
      {
        label: "Matching students",
        value: filteredBySearch.length,
        meta: hasActiveFilters ? "Filters active" : "All students",
      },
      {
        label: "Visible rows",
        value: limitedStudents.length,
        meta: `Display limit ${displayLabel}`,
      },
      {
        label: "Outstanding balances",
        value: outstandingStudentsCount,
        meta: "Needs attention",
      },
      {
        label: "Fully paid",
        value: fullyPaidCount,
        meta: "Registration settled",
      },
    ];
  }, [
    filteredBySearch.length,
    limitedStudents.length,
    displayCount,
    hasActiveFilters,
    outstandingStudentsCount,
    fullyPaidCount,
  ]);

  const handleSemesterChange = (value) => {
    setForm((prev) => {
      const next = { ...prev, semester: value };
      if (selectedStudent) {
        const defaults = buildFormDefaultsFromStudent(selectedStudent);
        Object.entries(defaults).forEach(([key, defaultValue]) => {
          if (!defaultValue) return;
          if (next[key]) return;
          next[key] = defaultValue;
        });
      }
      return next;
    });
  };

  const getInitials = (name) => {
    if (!name) return "S";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <AdminShell>
      <div className="d-flex flex-wrap align-items-center justify-content-between mb-3">
        <div>
          <h2 className="fw-bold mb-0">Record Payment</h2>
          <p className="text-muted small mb-0">
            Manage student payments and keep fee records synchronized, just like the Students tab.
          </p>
        </div>
      </div>
      <div className="students-hero mb-4">
        <div className="px-3 pt-3">
          <p className="students-hero-eyebrow text-uppercase mb-1">Payments</p>
          <h2 className="students-hero-title">Record payments</h2>
          <p className="students-hero-copy mb-0">
            Filter, search, and select a student to settle outstanding fees in one clean flow.
          </p>
        </div>
        <div className="d-flex flex-wrap align-items-center gap-2 px-3 pb-3">
          <input
            type="text"
            className="form-control students-hero-search"
            placeholder="Search student or ID"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="students-stats-grid row g-3 px-3 pb-3">
          {paymentStats.map((stat) => (
            <div className="col-6 col-md-3" key={stat.label}>
            <div className="students-hero-card h-100 p-3">
              <div className="students-hero-stat-label small mb-1 text-white">{stat.label}</div>
              <div className="fs-3 fw-bold students-hero-stat-value text-white">{stat.value}</div>
              <div className="students-hero-stat-meta small text-white">{stat.meta}</div>
            </div>
            </div>
          ))}
        </div>
      </div>

      <div className="students-filter-panel payments-filter-panel card card-soft mb-4 p-4">
        <h4 className="fw-bold mb-3">Exam details</h4>
        <p className="text-muted small mb-0">
          Enter the exam name that should be associated with the selected students.
        </p>
        <div className="row g-3 mt-3">
          <div className="col-md-8">
            <label className="form-label fw-bold">Exam name</label>
            <input
              type="text"
              className="form-control"
              placeholder="Enter exam name"
              value={form.examName}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, examName: e.target.value }));
              }}
              list="exam-name-options"
            />
            <datalist id="exam-name-options">
              {storedExamList.map((exam) => (
                <option key={exam.id} value={exam.exam_name} />
              ))}
            </datalist>
          </div>
        </div>
        <div className="mt-3">
          <div className="text-muted small mb-1">Saved exams</div>
          <div className="list-group list-group-flush">
            {storedExamList.map((entry) => (
              <div
                key={entry.id}
                className="list-group-item d-flex flex-wrap justify-content-between align-items-center gap-2"
              >
                <div className="w-100 w-md-auto">
                  <div className="fw-semibold">{entry.exam_name}</div>
                  <div className="text-muted small">
                    {editingExam?.id === entry.id
                      ? "Selected for editing"
                      : "Tap edit to change the name"}
                  </div>
                </div>
                <div className="d-flex flex-wrap gap-2 justify-content-end w-100 w-md-auto">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary rounded-pill px-3"
                    onClick={() => handleSelectSavedExam(entry)}
                    title="Edit this exam name"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger rounded-pill px-3"
                    onClick={() => handleDeleteExamName(entry)}
                    title="Remove this exam name"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm rounded-pill px-3 ${
                      completedExamIds.includes(entry.id)
                        ? "btn-outline-secondary"
                        : "btn-outline-success"
                    }`}
                    onClick={() => openCompleteRegistrationModal(entry)}
                    title="Mark students for this exam as fully registered"
                    disabled={completedExamIds.includes(entry.id)}
                  >
                    {completedExamIds.includes(entry.id)
                      ? "Completed"
                      : "Complete Registration"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-3 d-flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={handleSaveExamName}
            disabled={Boolean(editingExam)}
          >
            Save
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-primary"
            onClick={handleUpdateExamName}
            disabled={!editingExam}
          >
            Edit
          </button>
        </div>
      </div>
      <div className="students-filter-panel payments-filter-panel card card-soft mb-4 p-4">
        <h4 className="fw-bold mb-3">Filter Students</h4>

        <div className="row g-3">
          {/* Student ID */}
          <div className="col-md-3">
            <label className="form-label fw-bold">Hall ticket number</label>
            <input
              type="text"
              className="form-control"
              value={form.student_id}
              onChange={(e) =>
                setForm({
                  ...form,
                  student_id: e.target.value,
                })
              }
              placeholder="Enter Hall ticket"
            />
          </div>

          {/* Category */}
          <div className="col-md-3">
            <label className="form-label fw-bold">Category</label>
            <select
              className="form-select"
              value={form.category}
              onChange={(e) => {
                const selectedCategory = normalizeCategoryValue(e.target.value);
                setForm({
                  ...form,
                  category: selectedCategory,
                  year: "",
                  group: "",
                  group_code: "",
                  courseCode: "",
                  semester: "",
                  student_id: "",
                });
              }}
            >
              <option value="">Select Category</option>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          {/* Academic Year */}
          <div className="col-md-2">
            <label className="form-label fw-bold">Academic Year</label>
            <select
              className="form-select"
              value={form.year}
              disabled={!form.category}
              onChange={(e) =>
                setForm({
                  ...form,
                  year: e.target.value,
                  group: "",
                  group_code: "",
                  courseCode: "",
                  semester: "",
                  student_id: "",
                })
              }
            >
              <option value="">Select Year</option>
              {availableYears.map((y) => (
                <option key={y.id} value={y.academic_year}>
                  {y.academic_year}
                </option>
              ))}
            </select>
          </div>

          {/* Group */}
          <div className="col-md-2">
            <label className="form-label fw-bold">Group</label>
            <select
              className="form-select"
              value={form.group_code}
              disabled={!form.year}
              onChange={(e) => {
                const value = e.target.value;
                const groupOptions = visibleGroupOptions;
                const row =
                  groupOptions.find(
                    (g) => g.code === value || g.group_code === value
                  ) ??
                  groups.find((g) => g.code === value || g.group_code === value);

                setForm((prev) => ({
                  ...prev,
                  group: row?.name || "",
                  group_code: row?.code || value,
                  courseCode: "",
                  semester: "",
                  student_id: "",
                }));
              }}
            >
              <option value="">Select Group</option>
              {availableGroups.length > 0
                ? availableGroups.map((g) => (
                    <option key={g.id} value={g.code}>
                      {g.name}
                    </option>
                  ))
                : groups.map((g) => (
                    <option key={g.id} value={g.code}>
                      {g.name}
                    </option>
                  ))}
            </select>
          </div>

          {/* Course */}
          <div className="col-md-3">
            <label className="form-label fw-bold">Course</label>
            <select
              className="form-select"
              value={form.courseCode}
              disabled={!form.group_code}
              onChange={(e) =>
                setForm({
                  ...form,
                  courseCode: e.target.value,
                  semester: "",
                  student_id: "",
                })
              }
            >
              <option value="">Select Course</option>

              {filteredCoursesForGroup.map((c) => (
                <option key={c.id} value={c.courseCode}>
                  {c.courseName}
                </option>
              ))}
            </select>
          </div>

          {/* Semester */}
          <div className="col-md-2">
            <label className="form-label fw-bold">Semester</label>
            <select
              className="form-select"
              value={form.semester}
              disabled={!form.courseCode && !selectedStudent}
              onChange={(e) => handleSemesterChange(e.target.value)}
            >
              <option value="">Select Semester</option>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  Sem {n}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label fw-bold">Exam name</label>
            <select
              className="form-select"
              value={form.examName}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, examName: e.target.value }))
              }
            >
              <option value="">Select exam</option>
              {storedExamList.map((entry) => (
                <option key={entry.id} value={entry.exam_name}>
                  {entry.exam_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <div className="students-table-panel payments-table-panel card card-soft p-4 mb-4">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
          <div>
            <h5 className="fw-bold mb-1">Filtered students</h5>
            <p className="text-muted small mb-0">
              Select a student to review or apply payments.
            </p>
          </div>
          <span className="text-muted small">
            {hasActiveFilters
              ? `Displaying ${limitedStudents.length} of ${filteredBySearch.length}`
              : "Apply filters to load students"}
          </span>
        </div>
          {!hasActiveFilters ? (
            <div className="text-muted small">
              Select Category, Academic Year, Group, Course, or Semester to see
              matching students.
            </div>
          ) : limitedStudents.length === 0 ? (
            <div className="text-muted small">
              No students match the selected filters yet.
            </div>
          ) : (
              <div className="table-responsive">
                <table className="table table-borderless table-hover align-middle mb-0 payments-student-table">
                <thead className="table-light">
                  <tr>
                    <th scope="col">Photo</th>
                    <th scope="col">Academic year</th>
                    <th scope="col">Student ID</th>
                    <th scope="col">Hall ticket</th>
                    <th scope="col">Name</th>
                    <th scope="col">Group</th>
                    <th scope="col">Course</th>
                    <th scope="col">Payment status</th>
                    <th scope="col" className="text-end">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {limitedStudents.map((s) => {
                    const studentName =
                      s.full_name || s.name || "Unnamed student";
                    const academicYear = s.academic_year || "Year not set";
                    const matchedGroup = getMatchedGroup(s);
                    const groupLabel = formatGroupLabel(s, matchedGroup);
                    const matchedCourse = getMatchedCourse(s);
                    const courseLabel =
                      matchedCourse?.courseName ||
                      s.course_name ||
                      s.course_code ||
                      s.course_id ||
                      "Course unknown";
                    const departmentLabel =
                      matchedGroup?.name ||
                      s.department ||
                      s.department_name ||
                      s.group_name ||
                      s.group ||
                      "Department unknown";
                    const semesterLabel = s.semester
                      ? `Sem ${s.semester}`
                      : "Semester n/a";
                    const hallTicketNumber =
                      s.hall_ticket_number ||
                      s.hall_ticket ||
                      s.hallTicketNo ||
                      s.hall_ticket_no ||
                      "N/A";
                    const photoUrl = s.photo_url || s.photo || s.avatar;
                    const initials = getInitials(studentName);

                    const isActive =
                      activePaymentStudent?.student_id === s.student_id;

                    return (
                      <Fragment key={`${s.student_id}-row`}>
                        <tr className={isActive ? "table-primary" : undefined}>
                          <td>
                            {photoUrl ? (
                              <img
                                src={photoUrl}
                                alt={studentName}
                                className="rounded-circle"
                                style={{
                                  width: 40,
                                  height: 40,
                                  objectFit: "cover",
                                }}
                              />
                            ) : (
                              <div
                                className="bg-secondary text-white rounded-circle d-inline-flex align-items-center justify-content-center"
                                style={{ width: 40, height: 40, fontSize: 12 }}
                              >
                                {initials}
                              </div>
                            )}
                          </td>
                          <td>{academicYear}</td>
                          <td className="fw-semibold">{s.student_id}</td>
                          <td>{hallTicketNumber}</td>
                          <td>{studentName}</td>
                          <td>{groupLabel}</td>
                          <td>{courseLabel}</td>
                          {(() => {
                            const key = getAppliedRegistrationKey(s);
                            const detail = key ? appliedRegistrationDetails[key] : null;
                            const isApplied = detail?.fullyPaid;
                            const buttonLabel =
                              detail?.paidTotal > 0
                                ? "Pay balance"
                                : "Apply for Exam";
                            const shouldSkipSelection =
                              detail && detail.paidTotal > 0 && !detail.fullyPaid;
                            const openModal = () =>
                              openStudentModal(
                                s,
                                shouldSkipSelection ? { skipSubjectSelection: true } : {}
                              );
                            return (
                              <Fragment key={`${s.student_id}-payment`}>
                                <td className="text-center">
                                  <div className="d-flex flex-column gap-2 align-items-center">
                                    {renderPaymentStatusCell(detail)}
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-success"
                                      onClick={openModal}
                                      disabled={isApplied}
                                    >
                                      Pay now
                                    </button>
                                  </div>
                                </td>
                  <td className="text-end">
                    {detail?.applied ? (
                      <div className="d-flex flex-column align-items-end text-success small">
                        <span className="fw-semibold">Applied</span>
                        <span className="text-muted small">Subjects already stored</span>
                      </div>
                    ) : (
                      <button
                        className={`btn btn-sm ${
                          isActive ? "btn-outline-secondary" : "btn-outline-primary"
                        }`}
                        onClick={openModal}
                        disabled={detail?.paidTotal > 0}
                      >
                        {buttonLabel}
                      </button>
                    )}
                  </td>
                              </Fragment>
                            );
                          })()}
                          </tr>
                        </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
      </div>
      {completeRegistrationModalOpen && (
        <div
          className="modal d-block"
          tabIndex="-1"
          role="dialog"
          aria-modal="true"
          style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header border-0">
                <div>
                  <h5 className="modal-title fw-bold">Complete registration?</h5>
                  <p className="text-muted small mb-0">
                    Confirming will mark the selected students as finalized in the
                    current exam batch.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={closeCompleteRegistrationModal}
                ></button>
              </div>
              <div className="modal-body">
                <div className="p-3 rounded-3 border border-success bg-light">
                  <div className="fw-semibold text-success mb-2">
                    Registration record
                  </div>
                  <p className="mb-1 text-muted small">
                    Students tied to{" "}
                    <strong>
                      {completionTargetExam?.exam_name || form.examName || "this"}
                    </strong>{" "}
                    exam will be marked completed.
                  </p>
                  <ul className="list-unstyled mb-0 small text-muted">
                    <li>- Students filtered: {displayCount || "All"}</li>
                    <li>
                      - Visible after filters: {filteredBySearch.length}
                    </li>
                  </ul>
                </div>
              </div>
              <div className="modal-footer border-0 pt-0">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={closeCompleteRegistrationModal}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={handleCompleteRegistrationConfirm}
                >
                  Confirm completion
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {modalOpen && modalStudent && (
        <>
          <div className="modal-backdrop show"></div>
          <div
            className="modal show d-block"
            tabIndex="-1"
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-dialog modal-lg modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Student Payment Overview</h5>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Close"
                    onClick={closeStudentModal}
                  ></button>
                </div>
                <div className="modal-body">
                  <div className="card card-soft p-4">
                    <div className="row align-items-center">
                      <div className="col-md-4 d-flex align-items-center gap-3">
                        {(modalStudent.photo_url || modalStudent.photo) ? (
                          <img
                            src={modalStudent.photo_url || modalStudent.photo}
                            alt={modalStudent.full_name || modalStudent.name || "Student"}
                            className="rounded-circle"
                            style={{ width: 96, height: 96, objectFit: "cover" }}
                          />
                        ) : (
                          <div
                            className="bg-secondary text-white rounded-circle d-inline-flex align-items-center justify-content-center"
                            style={{ width: 96, height: 96, fontSize: 20 }}
                          >
                            {(modalStudent.full_name || modalStudent.name || "S").slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <h5 className="mb-1">
                            {modalStudent.full_name || modalStudent.name || "Unnamed Student"}
                          </h5>
                          <div className="text-muted">
                            ID: {modalStudent.student_id || "N/A"}
                          </div>
                          <div className="text-muted">Vijayam College Arts & Science</div>
                        </div>
                      </div>
                      <div className="col-md-7 d-flex flex-column justify-content-center align-items-end text-end">
                        <h5 className="fw-bold">About this student</h5>
                        <div className="d-flex flex-column gap-2 mt-3">
                          <div className="fs-5">
                            {formatGroupLabel(modalStudent, getMatchedGroup(modalStudent))}
                          </div>
                          <div className="fs-5">
                            {getMatchedCourse(modalStudent)?.courseName || modalStudent.course_name || modalStudent.course_code || modalStudent.course_id || "Course unknown"}
                          </div>
                          <div className="fs-5">
                            {modalStudent.academic_year || "Academic year not set"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
              {modalPaymentSemesterOptions.length > 0 && (
                <div className="mt-3 d-flex flex-wrap align-items-center gap-3">
                  <label className="mb-0 small fw-semibold">
                    Choose semester
                  </label>
                    <select
                      className="form-select form-select-sm"
                      style={{ width: "240px" }}
                      value={modalSemester}
                      onChange={(event) =>
                        handleModalSemesterChange(event.target.value)
                      }
                    >
                      <option value="">Select semester</option>
                      {modalPaymentSemesterOptions.map(({ semester, outstanding }) => (
                        <option
                          key={semester}
                          value={semester}
                          disabled={outstanding <= 0}
                        >
                          {`Semester ${semester}`}
                          {outstanding <= 0
                            ? " (Fully paid)"
                            : ` (Balance ${formatCurrency(outstanding)})`}
                        </option>
                      ))}
                    </select>
                </div>
              )}
                    <div className="mt-4">
                    {modalStep === 1 && (
                      <div className="mb-4">
                          <div className="d-flex align-items-start justify-content-between flex-wrap gap-3">
                            <div>
                              <h5 className="fw-semibold mb-1">Step 1: Pick subjects</h5>
                              <p className="text-muted small mb-0">
                                Tap each subject you want to store for the exam, then continue to review before confirming.
                              </p>
                            </div>
                            <div className="text-end small text-muted">
                              Selected {selectedSubjectCount} / Available {totalModalSubjectCount || "-"}
                            </div>
                          </div>
                          <div className="mt-2 d-flex flex-wrap gap-2">
                            <span className="badge bg-light text-dark border">
                              Current semester {currentTotalCount} subjects
                            </span>
                            {supplementarySubjectsBySemester.map((group) => (
                              <span
                                key={`suppl-badge-${group.semester}`}
                                className="badge bg-light text-dark border"
                              >
                                Supplementary Sem {group.semester} ({group.entries.length})
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    {modalStep === 1 && availableSupplementarySemesters.length > 0 && (
                      <div className="d-flex align-items-center justify-content-end gap-2 mb-3">
                        <span className="fw-semibold">Select Supplementary:</span>
                        {availableSupplementarySemesters.map((sem) => {
                          const semValue = String(sem);
                          const isActive =
                            selectedSupplementarySemesters.includes(semValue);
                          return (
                            <button
                              key={sem}
                              type="button"
                              className={`btn btn-sm ${
                                isActive ? "btn-primary" : "btn-outline-primary"
                              }`}
                              onClick={() =>
                                toggleSupplementarySemesterSelection(semValue)
                              }
                            >
                              Sem {sem}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {modalStep === 1 ? (
                      combinedSubjectEntries.length === 0 ? null : (
                        <>
                          {currentSubjectEntries.length > 0 && (
                            <div className="border rounded mb-3">
                              <div className="px-3 py-2 bg-light border-bottom d-flex justify-content-between align-items-center">
                                <span className="fw-semibold">Current semester subjects</span>
                                <span className="text-muted small">
                                  {currentSelectedCount} of {currentTotalCount} selected
                                </span>
                              </div>
                              <div className="table-responsive">
                                <table className="table table-sm table-hover mb-0">
                                  <thead>
                                    <tr>
                                      <th scope="col" className="text-center" style={{ width: "1px" }}>
                                        Select
                                      </th>
                                      <th scope="col">Subject</th>
                                      <th scope="col">Subject code</th>
                                    </tr>
                                  </thead>
                                  <tbody>{currentSubjectEntries.map(renderSubjectRow)}</tbody>
                                </table>
                              </div>
                            </div>
                          )}
                          {supplementarySubjectsBySemester.length > 0 &&
                            supplementarySubjectsBySemester.map((group) => {
                              const selectedInGroup = group.entries.filter((entry) =>
                                selectedSubjectKeys.has(entry.key)
                              ).length;
                              return (
                                <div
                                  className="border rounded mb-3"
                                  key={`suppl-sem-${group.semester}`}
                                >
                                  <div className="px-3 py-2 bg-light border-bottom d-flex justify-content-between align-items-center">
                                    <div>
                                      <span className="fw-semibold">
                                        Supplementary Sem {group.semester}
                                      </span>
                                    </div>
                                    <span className="text-muted small">
                                      {selectedInGroup} of {group.entries.length} supplementary subjects selected
                                    </span>
                                  </div>
                                  <div className="table-responsive">
                                    {group.entries.length > 0 ? (
                                      <table className="table table-sm table-hover mb-0">
                                        <thead>
                                          <tr>
                                            <th scope="col" className="text-center" style={{ width: "1px" }}>
                                              Select
                                            </th>
                                            <th scope="col">Subject</th>
                                            <th scope="col">Subject code</th>
                                          </tr>
                                        </thead>
                                        <tbody>{group.entries.map(renderSubjectRow)}</tbody>
                                      </table>
                                    ) : (
                                      <div className="p-3 text-muted small">
                                        No supplementary subjects configured for Sem {group.semester}.
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                        </>
                      )
                    ) : (
                      <>
                          <div className="mb-3">
                            <div className="d-flex align-items-start justify-content-between flex-wrap gap-3">
                              <div>
                                <h5 className="fw-semibold mb-1">Step 2: Review selections</h5>
                                <p className="text-muted small mb-0">
                                  Confirm the subjects you picked - no payment amounts are shown here so you can focus on the papers themselves.
                                </p>
                              </div>
                              <div className="text-end small text-muted">
                                {selectedSubjectCount} subjects ready to store
                              </div>
                            </div>
                          </div>
                      <div className="card border border-primary shadow-sm mb-3">
                        <div className="card-body">
                          <div className="mb-3">
                            <h6 className="fw-semibold mb-1">Review selections</h6>
                            <p className="text-muted small mb-0">
                              {selectedSubjectCount
                                ? `${selectedSubjectCount} subjects selected`
                                : "Select at least one subject before confirming."}
                          </p>
                          </div>
                          {currentSelectedEntries.length > 0 && (
                            <div className="mb-3">
                              <div className="text-muted small mb-2 fw-semibold">
                                Current semester
                              </div>
                              <div className="d-flex flex-column gap-2">
                                {currentSelectedEntries.map((entry) => (
                                  <div key={`review-current-${entry.key}`} className="border-bottom pb-2">
                                    <div className="fw-semibold">{entry.name}</div>
                                    <div className="text-muted small">
                                      {entry.code || "Code unavailable"}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {supplementarySelectedBySemester.length > 0 && (
                            <div>
                              {supplementarySelectedBySemester.map((group) => (
                                <div className="mb-3" key={`review-suppl-${group.semester}`}>
                                  <div className="text-muted small mb-2 fw-semibold">
                                    Supplementary Semester {group.semester} - {group.entries.length} selected
                                  </div>
                                  <div className="d-flex flex-column gap-2">
                                    {group.entries.map((entry) => (
                                      <div key={`review-suppl-entry-${entry.key}`} className="border-bottom pb-2">
                                        <div className="fw-semibold">{entry.name}</div>
                                        <div className="text-muted small">
                                          {entry.code || "Code unavailable"}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                  </div>
                </div>
                <div className="modal-footer d-flex gap-2">
                  {modalStep === 2 && (
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => setModalStep(1)}
                    >
                      Back
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={
                      modalStep === 1
                        ? handleAdvanceToSummary
                        : handleStoreSelectedSubjects
                    }
                  >
                    {modalStep === 1 ? "Next" : "Confirm"}
                  </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={closeStudentModal}
                >
                  Close
                </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      {showPaymentModal && (
        <div
          className="modal d-block"
          tabIndex="-1"
          role="dialog"
          aria-modal="true"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
        >
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Complete payment</h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={() => closePaymentModal({ notifyCancellation: true })}
                ></button>
              </div>
              <div className="modal-body">
                {renderStudentProfileCard(activePaymentStudent)}
                <div className="mb-4">
                  <div className="fw-semibold mb-2">Payment option</div>
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="radio"
                      name="paymentOption"
                      id="paymentOptionExam"
                      value="exam"
                      checked={paymentOption === "exam"}
                      onChange={() => setPaymentOption("exam")}
                      disabled={outstandingExam <= 0}
                    />
                    <label
                      className="form-check-label d-flex justify-content-between align-items-center"
                      htmlFor="paymentOptionExam"
                    >
                      <div className="d-flex align-items-center gap-2">
                        <span>Exam fee only</span>
                        {outstandingExam <= 0 && (
                          <span className="text-danger small">
                            Already covered
                          </span>
                        )}
                      </div>
                      <span className="text-muted small">
                        {formatCurrency(examSubtotal)}
                        {modalPaymentSummary && (
                          <>
                            {" "}
                            • Remaining {formatCurrency(outstandingExam)}
                          </>
                        )}
                      </span>
                    </label>
                  </div>
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="radio"
                      name="paymentOption"
                      id="paymentOptionFull"
                      value="full"
                      checked={paymentOption === "full"}
                      onChange={() => setPaymentOption("full")}
                    />
                    <label
                      className="form-check-label d-flex justify-content-between align-items-center"
                      htmlFor="paymentOptionFull"
                    >
                      <span>Full fees</span>
                      <span className="text-muted small">
                        {formatCurrency(totalFeeBreakdownAmount)}
                        {modalPaymentSummary && (
                          <>
                            {" "}
                            • Remaining {formatCurrency(outstandingTotal)}
                          </>
                        )}
                      </span>
                    </label>
                  </div>
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="radio"
                      name="paymentOption"
                      id="paymentOptionPartial"
                      value="partial"
                      checked={paymentOption === "partial"}
                      onChange={() => setPaymentOption("partial")}
                    />
                    <label className="form-check-label" htmlFor="paymentOptionPartial">
                      Partial
                    </label>
                  </div>
                  {paymentOption === "partial" && (
                    <div className="mt-2">
                      <label className="form-label mb-1">Amount</label>
                      <input
                        type="number"
                        className="form-control"
                        min={Math.max(outstandingExam, 0)}
                        value={partialAmount}
                        onChange={(event) => setPartialAmount(event.target.value)}
                        placeholder={formatCurrency(Math.max(outstandingExam, 0))}
                      />
                      <div className="form-text">
                        Minimum {formatCurrency(Math.max(outstandingExam, 0))}.
                      </div>
                    </div>
                  )}
                </div>
                  <div className="card border rounded shadow-sm mb-3">
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-baseline">
                        <div>
                          <h6 className="mb-0">Amount to be paid</h6>
                        </div>
                        <span className="fs-5 fw-semibold">
                          {formatCurrency(paymentIntentAmount)}
                        </span>
                      </div>
                      {loadingModalPayments ? (
                        <div className="text-muted small mt-1">
                          Loading previous payments...
                        </div>
                      ) : alreadyPaidTotal > 0 ? (
                        <div className="text-muted small mt-1">
                          Already paid {formatCurrency(alreadyPaidTotal)}.
                        </div>
                      ) : null}
                    </div>
                  </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Payment method</label>
                  <select
                    className="form-select"
                    value={paymentMethod}
                    onChange={(event) => setPaymentMethod(event.target.value)}
                  >
                    <option value="">Select method</option>
                    {["Cash", "Card", "UPI", "GPay"].map((method) => (
                      <option key={method} value={method}>
                        {method}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer d-flex justify-content-end gap-2">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => closePaymentModal({ notifyCancellation: true })}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handlePaymentModalConfirm}
                >
                  Pay now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
