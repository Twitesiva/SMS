import AdminShell from "../components/AdminShell";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { api } from "../lib/mockApi";
import { validateRequiredFields } from "../lib/validation";
import { showToast } from "../store/ui";
import {
  getFirstUnpublishedExam,
  isExamResultPublished,
} from "../lib/examUtils";

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

const normalizeSemesterValue = (value) =>
  value === undefined || value === null ? "" : String(value).trim();

const normalizeStudentIdentifier = (value) =>
  value === undefined || value === null ? "" : String(value).trim();

const buildRegistrationKey = (studentId, semesterValue) => {
  const normalizedStudentId = normalizeStudentIdentifier(studentId);
  if (!normalizedStudentId) return null;
  const normalizedSemester = normalizeSemesterValue(semesterValue);
  return `${normalizedStudentId}-${normalizedSemester}`;
};

const formatCurrency = (value) => {
  const num = Number(value || 0);
  return `₹${num.toLocaleString("en-IN")}`;
};

const formatDeadlineDate = (value) => {
  if (!value) return "";
  const normalized = new Date(value);
  if (Number.isNaN(normalized.getTime())) return "";
  return normalized.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getCategoryNameFromLookup = (subject, lookup) => {
  const directCategory =
    subject.category ??
    subject.category_name ??
    subject.categoryName ??
    subject.subCategory ??
    subject.fee_category ??
    "";
  if (directCategory) return directCategory;
  const categoryId =
    subject.category_id ??
    subject.categoryId ??
    subject.categoryID ??
    null;
  if (categoryId && lookup) {
    return lookup.get(String(categoryId)) || "";
  }
  return "";
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
  const [storedExamList, setStoredExamList] = useState([]);

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
  const [paymentMethod, setPaymentMethod] = useState("");
  const [modalPaymentSummary, setModalPaymentSummary] = useState(null);
  const [loadingModalPayments, setLoadingModalPayments] = useState(false);
  const [appliedRegistrationDetails, setAppliedRegistrationDetails] = useState({});
  const [savedRegistrationSubjectIds, setSavedRegistrationSubjectIds] = useState([]);
  const [deletingRegistrationId, setDeletingRegistrationId] = useState(null);
  const [loadingSavedSubjects, setLoadingSavedSubjects] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [showPaymentDetailsModal, setShowPaymentDetailsModal] = useState(false);
  const [activeSubjectCategory, setActiveSubjectCategory] = useState(null);
  const [fineAmountSetting, setFineAmountSetting] = useState(0);
  const [examDeadlines, setExamDeadlines] = useState([]);
  const [subjectCategoryLookup, setSubjectCategoryLookup] = useState(new Map());
  const selectedExamId = useMemo(() => {
    const normalized = (form.examName || "").trim().toLowerCase();
    if (!normalized) return null;
    const match = storedExamList.find(
      (exam) => (exam.exam_name || "").toLowerCase() === normalized
    );
    return match?.id ?? null;
  }, [form.examName, storedExamList]);

  // New state for tracking failed subjects
  const [failedSubjectIds, setFailedSubjectIds] = useState(new Set());

  useEffect(() => {
    let isMounted = true;
    const loadFineConfig = async () => {
      try {
        const fineQuery = supabase
          .from("global_settings")
          .select("fine_amount")
          .order("created_at", { ascending: false })
          .limit(1);
        const deadlineQuery = supabase
          .from("exam_deadlines")
          .select("exam_id, last_date");
        const [{ data: fineData, error: fineError }, { data: deadlineData, error: deadlineError }] =
          await Promise.all([fineQuery, deadlineQuery]);
        if (fineError) {
          console.error("Failed to load fine amount:", fineError);
        } else if (isMounted) {
          const amount = Number(fineData?.[0]?.fine_amount || 0);
          setFineAmountSetting(Number.isFinite(amount) ? amount : 0);
        }
        if (deadlineError) {
          console.error("Failed to load exam deadlines:", deadlineError);
        } else if (isMounted) {
          setExamDeadlines(deadlineData || []);
        }
      } catch (error) {
        console.error("Unable to load fine configuration:", error);
      }
    };
    void loadFineConfig();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const fetchSubjectCategories = async () => {
      try {
        const { data, error } = await supabase
          .from("subject_category")
          .select("category_id, category_name");
        if (!isMounted) return;
        if (error) {
          console.error("Failed to load subject categories:", error);
          return;
        }
        const lookup = new Map();
        (data || []).forEach((category) => {
          if (category?.category_id) {
            lookup.set(String(category.category_id), category.category_name || "");
          }
        });
        setSubjectCategoryLookup(lookup);
      } catch (error) {
        if (isMounted) {
          console.error("Unable to fetch subject categories:", error);
        }
      }
    };
    void fetchSubjectCategories();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const fetchFailedSubjects = async () => {
      if (!modalStudent?.id) {
        if (isMounted) setFailedSubjectIds(new Set());
        return;
      }
      try {
        // Fetch all results for this student with status 'FAIL'
        const { data, error } = await supabase
          .from("results")
          .select("subject_id, result_status")
          .eq("student_id", modalStudent.id)
          .eq("result_status", "FAIL");

        if (error) {
          console.error("Failed to fetch student results:", error);
          return;
        }

        if (isMounted) {
          const failedSet = new Set();
          (data || []).forEach((row) => {
            if (row.subject_id) {
              failedSet.add(String(row.subject_id));
            }
          });
          setFailedSubjectIds(failedSet);
        }
      } catch (err) {
        console.error("Error fetching failed subjects:", err);
      }
    };

    fetchFailedSubjects();
    return () => {
      isMounted = false;
    };
  }, [modalStudent?.id]);
  const normalizedSelectedExamName = useMemo(
    () => (form.examName || "").trim().toLowerCase() || null,
    [form.examName]
  );
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
  const getNormalizedSubjectAcademicYear = (subject = {}) =>
    normalizeSearchValue(
      subject.academicYearName ??
      subject.academic_year ??
      subject.academicYear ??
      subject.year ??
      ""
    );
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

  const normalizedModalAcademicYear = normalizeSearchValue(
    firstDefined(
      modalStudent?.academic_year,
      modalStudent?.academicYear,
      modalStudent?.year,
      modalStudent?.academicYearName,
      modalStudent?.academic_year_name
    )
  );

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
      const matchesAcademicYear =
        !normalizedModalAcademicYear ||
        getNormalizedSubjectAcademicYear(subject) === normalizedModalAcademicYear;
      return courseMatch && semesterMatch && matchesAcademicYear;
    });
  }, [subjects, modalCourseCode, modalSemester, normalizedModalAcademicYear]);

  const subjectsForSupplementarySemester = useMemo(() => {
    // If we have failed subjects, we want to check strictly against them first
    if (failedSubjectIds.size > 0) {
      // Get all subjects that are failed
      const failedSubjects = subjects.filter(s => {
        const sid = String(s.subject_id ?? s.id ?? s.subjectId ?? "");
        return failedSubjectIds.has(sid);
      });

      // Filter for eligibility (Odd/Even semester match with current modalSemester)
      const currentSemNum = Number(modalSemester);
      if (!currentSemNum) return [];

      const eligibleFailedSubjects = failedSubjects.filter(s => {
        const sSem = Number(s.semester);
        if (!sSem) return false;
        // Check parity (Odd/Odd or Even/Even) and ensures it is a previous semester
        return (sSem < currentSemNum) && (sSem % 2 === currentSemNum % 2);
      });

      return eligibleFailedSubjects;
    }

    // Fallback to standard logic if no failed subjects (or empty set)
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
      return courseMatch && semesterSet.has(semesterValue);
    });
  }, [
    subjects,
    modalCourseCode,
    modalSemester,
    selectedSupplementarySemesters,
    failedSubjectIds,
  ]);
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

  const subjectRecordById = useMemo(() => {
    const map = new Map();
    subjects.forEach((subject) => {
      const identifier =
        subject.subject_id ?? subject.id ?? subject.subjectId ?? null;
      if (identifier !== undefined && identifier !== null) {
        map.set(String(identifier), subject);
      }
    });
    return map;
  }, [subjects]);

  useEffect(() => {
    if (!availableSupplementarySemesters.length) return;
    setSelectedSupplementarySemesters((prev) => {
      const normalizedPrev = prev.map((sem) => String(sem)).sort();
      const normalizedAvailable = availableSupplementarySemesters
        .map((sem) => String(sem))
        .sort();
      const alreadyMatches =
        normalizedPrev.length === normalizedAvailable.length &&
        normalizedAvailable.every((sem, index) => sem === normalizedPrev[index]);
      if (alreadyMatches && prev.length) return prev;
      return availableSupplementarySemesters.map((sem) => String(sem));
    });
  }, [availableSupplementarySemesters]);

  useEffect(() => {
    if (!savedRegistrationSubjectIds.length) {
      return;
    }
    const normalizedCurrentSemester = normalizeSemesterValue(modalSemester);
    const storedSupplementarySemesters = new Set();
    savedRegistrationSubjectIds.forEach((subjectId) => {
      const subject = subjectRecordById.get(String(subjectId));
      if (!subject) return;
      const subjectSemester =
        subject.semester ??
        subject.semester_number ??
        subject.semesterNumber ??
        "";
      const normalizedSubjectSemester = normalizeSemesterValue(subjectSemester);
      if (
        !normalizedSubjectSemester ||
        normalizedSubjectSemester === normalizedCurrentSemester
      ) {
        return;
      }
      if (
        availableSupplementarySemesters.some(
          (option) => String(option) === normalizedSubjectSemester
        )
      ) {
        storedSupplementarySemesters.add(normalizedSubjectSemester);
      }
    });

    // Also ensure semesters for failed subjects are selected
    if (failedSubjectIds.size > 0 && subjectsForSupplementarySemester.length > 0) {
      subjectsForSupplementarySemester.forEach(sub => {
        const sSem = String(sub.semester || "");
        if (
          sSem &&
          availableSupplementarySemesters.some(opt => String(opt) === sSem) &&
          !storedSupplementarySemesters.has(sSem)
        ) {
          storedSupplementarySemesters.add(sSem);
        }
      });
    }

    const nextSemesters = Array.from(storedSupplementarySemesters);
    if (!nextSemesters.length) {
      // If no stored subjects and no failed subjects logic triggered, default to all available
      // But wait, if we have failed subjects, we want ONLY the semesters for failed subjects ideally?
      // Or do we still want all? The prompt says "S1 student... semester1 fail subject should be autofetch".
      // It implies we just want the failed subject show up. 
      // Keeping existing behavior: if nothing stored, select *all* available supplementary semesters.
      // But if we found failed subjects, we might have added them to storedSupplementarySemesters.
      // Let's rely on the check below.
      if (failedSubjectIds.size === 0 && savedRegistrationSubjectIds.length === 0) {
        // Fallback to all available if no saved data/failures
        // Logic handled in previous useEffect (lines 381-394) which sets all available by default.
        return;
      }
      if (failedSubjectIds.size > 0 && nextSemesters.length === 0) {
        // If we have failed subjects but somehow didn't pick up semesters (maybe mismatch), 
        // let's not clear selection.
        return;
      }
    }

    // If we have specific semesters to select (from saved OR failures)
    if (nextSemesters.length > 0) {
      const alreadyMatch =
        nextSemesters.length === selectedSupplementarySemesters.length &&
        nextSemesters.every((semester) =>
          selectedSupplementarySemesters.includes(semester)
        );
      if (alreadyMatch) {
        return;
      }
      setSelectedSupplementarySemesters(nextSemesters);
    }
  }, [
    allowPaymentWithoutSelection,
    availableSupplementarySemesters,
    modalSemester,
    savedRegistrationSubjectIds,
    selectedSupplementarySemesters,
    subjectRecordById,
    failedSubjectIds,
    subjectsForSupplementarySemester
  ]);

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
        category: getCategoryNameFromLookup(subject, subjectCategoryLookup),
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
    if (!subjectsForSupplementarySemester.length) {
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

      // Removed filter: if (!selectedSupplementarySemesters.includes(semesterValue)) return;
      // We want to show ALL fetched supplementary subjects (which are either failed or selected manually).
      // Since subjectsForSupplementarySemester is already filtered to relevant ones (especially failures), we should display them.

      if (!semesterMap.has(semesterValue)) {
        semesterMap.set(semesterValue, []);
      }
      semesterMap.get(semesterValue).push(subject);
    });
    // Create groups for all semesters found in the subjects list
    return Array.from(semesterMap.keys()).sort().map((semester) => ({
      semester,
      entries: buildSubjectEntries(semesterMap.get(semester) || [], {
        contextKey: `supp-${semester}`,
        subjectIdLookup,
      }),
    }));
  }, [subjectsForSupplementarySemester]);
  const supplementarySubjectEntries = useMemo(
    () => supplementarySubjectsBySemester.flatMap((group) => group.entries),
    [supplementarySubjectsBySemester]
  );
  const filterEntriesByCategory = (entries) => {
    if (!activeSubjectCategory) return entries;
    return entries.filter((entry) => entry.category === activeSubjectCategory);
  };
  const filteredCurrentSubjectEntries = useMemo(
    () => filterEntriesByCategory(currentSubjectEntries),
    [currentSubjectEntries, activeSubjectCategory]
  );
  const filteredSupplementarySubjectEntries = useMemo(
    () => filterEntriesByCategory(supplementarySubjectEntries),
    [supplementarySubjectEntries, activeSubjectCategory]
  );
  const filteredSupplementarySubjectsBySemester = useMemo(
    () =>
      supplementarySubjectsBySemester
        .map((group) => ({
          semester: group.semester,
          entries: filterEntriesByCategory(group.entries),
        }))
        .filter((group) => group.entries.length > 0),
    [supplementarySubjectsBySemester, activeSubjectCategory]
  );
  const combinedSubjectEntries = useMemo(
    () => [...currentSubjectEntries, ...supplementarySubjectEntries],
    [currentSubjectEntries, supplementarySubjectEntries]
  );
  const subjectCountsByCategory = useMemo(() => {
    const map = new Map();
    combinedSubjectEntries.forEach((entry) => {
      const key = (entry.category || "").toString().trim();
      if (!key) return;
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }, [combinedSubjectEntries]);
  const subjectCategoryOptions = useMemo(
    () => Array.from(subjectCountsByCategory.keys()),
    [subjectCountsByCategory]
  );
  useEffect(() => {
    if (!subjectCategoryOptions.includes(activeSubjectCategory)) {
      setActiveSubjectCategory(null);
    }
  }, [subjectCategoryOptions, activeSubjectCategory]);

  useEffect(() => {
    if (activeSubjectCategory) return;
    if (!subjectCategoryOptions.length) return;
    const supplementaryCategory = subjectCategoryOptions.find((category) =>
      filteredSupplementarySubjectEntries.some((entry) => entry.category === category)
    );
    setActiveSubjectCategory(
      supplementaryCategory || subjectCategoryOptions[0]
    );
  }, [
    subjectCategoryOptions,
    activeSubjectCategory,
    filteredSupplementarySubjectEntries,
  ]);
  const filteredCurrentSelectedCount = useMemo(
    () =>
      filteredCurrentSubjectEntries.filter((entry) =>
        selectedSubjectKeys.has(entry.key)
      ).length,
    [filteredCurrentSubjectEntries, selectedSubjectKeys]
  );
  const filteredSupplementarySelectedCount = useMemo(
    () =>
      filteredSupplementarySubjectEntries.filter((entry) =>
        selectedSubjectKeys.has(entry.key)
      ).length,
    [filteredSupplementarySubjectEntries, selectedSubjectKeys]
  );
  const visibleCurrentSubjectEntries = activeSubjectCategory
    ? filteredCurrentSubjectEntries
    : currentSubjectEntries;
  const visibleSupplementarySubjectGroups = supplementarySubjectsBySemester;
  const visibleSubjectCountForCategory =
    visibleCurrentSubjectEntries.length +
    visibleSupplementarySubjectGroups.reduce(
      (sum, group) => sum + group.entries.length,
      0
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

  // Auto-select failed/supplementary subjects when they appear
  useEffect(() => {
    if (!supplementarySubjectEntries.length) return;

    setSelectedSubjectKeys((prev) => {
      const next = new Set(prev);
      let changed = false;
      supplementarySubjectEntries.forEach((entry) => {
        if (!next.has(entry.key)) {
          next.add(entry.key);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [supplementarySubjectEntries]);

  useEffect(() => {
    if (
      !savedRegistrationSubjectIds.length ||
      !combinedSubjectEntries.length
    ) {
      return;
    }
    const subjectIdSet = new Set(savedRegistrationSubjectIds);
    const nextKeys = new Set();
    combinedSubjectEntries.forEach((entry) => {
      const identifier =
        entry.subjectReferenceId ?? entry.subjectId ?? null;
      if (!identifier) return;
      if (subjectIdSet.has(String(identifier))) {
        nextKeys.add(entry.key);
      }
    });
    if (!nextKeys.size) return;
    setSelectedSubjectKeys((prev) => {
      if (
        prev.size === nextKeys.size &&
        Array.from(prev).every((key) => nextKeys.has(key))
      ) {
        return prev;
      }
      return nextKeys;
    });
  }, [combinedSubjectEntries, savedRegistrationSubjectIds]);
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
  const alreadyPaidExam = Math.min(examSubtotal, examCoverageAmount);
  const outstandingTotal = Math.max(
    totalFeeBreakdownAmount - alreadyPaidTotal,
    0
  );
  const outstandingExam = Math.max(examSubtotal - alreadyPaidExam, 0);
  const examDueAmount = Math.max(examSubtotal - alreadyPaidExam, 0);
  const selectedExamDeadline = useMemo(() => {
    if (!selectedExamId || !examDeadlines.length) return null;
    return examDeadlines.find(
      (deadline) => String(deadline.exam_id) === String(selectedExamId)
    ) ?? null;
  }, [examDeadlines, selectedExamId]);
  const normalizedDeadline = selectedExamDeadline?.last_date
    ? new Date(selectedExamDeadline.last_date)
    : null;
  const isAfterDeadline =
    normalizedDeadline &&
    Date.now() >
    new Date(
      normalizedDeadline.getFullYear(),
      normalizedDeadline.getMonth(),
      normalizedDeadline.getDate(),
      23,
      59,
      59,
      999
    ).getTime();
  const lateFeeAmount = isAfterDeadline ? Number(fineAmountSetting || 0) : 0;
  const paymentIntentAmount = outstandingTotal + lateFeeAmount;
  const selectedSubjectCount =
    currentSelectedCount + supplementarySelectedCount;
  const totalModalSubjectCount =
    currentSubjectEntries.length + supplementarySubjectEntries.length;
  const toggleSubjectSelection = (key) => {
    setSelectedSubjectKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
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

  const handleProceedToPaymentReview = () => {
    setShowPaymentDetailsModal(true);
  };

  const handleStoreSelectedSubjects = async () => {
    if (allowPaymentWithoutSelection) {
      if (!savedRegistrationSubjectIds.length && !selectedSubjectKeys.size) {
        showToast("No subjects stored yet. Please select subjects first.", {
          type: "warning",
        });
        return;
      }
      handleProceedToPaymentReview();
      return;
    }
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

    const uniqueSubjectEntries = getUniqueSelectedSubjectEntries();
    try {
      const { examRegistrationId, examMasterId } =
        await createOrFetchExamRegistration(examNameValue);
      const insertedSubjects = await persistExamRegistrationSubjects(
        examRegistrationId,
        uniqueSubjectEntries,
        examMasterId
      );
      const barcodeSummary = await ensureBarcodesForSubjects(
        examRegistrationId,
        insertedSubjects || []
      );
      showToast("Selected subjects Applied successfully.", {
        type: "success",
        title: "Exam",
      });
      if (barcodeSummary.failureCount) {
        showToast(
          `Stored subjects but barcode generation failed for ${barcodeSummary.failureCount} subject(s).`,
          { type: "warning", title: "Exam" }
        );
      }
      try {
        const nextDetails = await buildAppliedRegistrationDetails();
        setAppliedRegistrationDetails(nextDetails);
      } catch (error) {
        console.error("Failed to refresh applied registrations:", error);
      }
      closeStudentModal();
    } catch (error) {
      console.error("Unable to Apply selected subjects", error);
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
      <span className="text-truncate">
        {entry.code ? `${entry.code} - ${entry.name}` : entry.name}
      </span>
    </div>
  );

  const renderSubjectRow = (entry, index) => {
    const isSelected = selectedSubjectKeys.has(entry.key);
    return (
      <tr
        key={entry.key}
        className={`cursor-pointer ${isSelected ? 'table-success fw-bold' : ''}`}
        onClick={() => toggleSubjectSelection(entry.key)}
      >
        <td className="align-middle text-center" style={{ width: "50px" }}>
          {index + 1}
        </td>
        <td className="align-middle text-truncate" style={{ maxWidth: 400 }}>
          {entry.code ? `${entry.code} - ${entry.name}` : entry.name}
        </td>
      </tr>
    );
  };

  const dedupeSubjectEntries = (entries) => {
    const next = [];
    const tracked = new Set();
    entries.forEach((entry) => {
      const identity =
        entry.key ??
        entry.dedupKey ??
        `${entry.subjectId}:${entry.contextKey ?? "regular"}`;
      if (tracked.has(identity)) return;
      tracked.add(identity);
      next.push(entry);
    });
    return next;
  };

  const getUniqueSelectedSubjectEntries = useCallback(() => {
    const selectedSubjectEntries = combinedSubjectEntries.filter((entry) =>
      selectedSubjectKeys.has(entry.key)
    );
    const selectedDeduped = dedupeSubjectEntries(selectedSubjectEntries);
    if (selectedDeduped.length) {
      return selectedDeduped;
    }
    if (!savedRegistrationSubjectIds.length) {
      return [];
    }
    const savedSet = new Set(savedRegistrationSubjectIds.map(String));
    const fallbackEntries = combinedSubjectEntries.filter((entry) => {
      const identifier =
        entry.subjectReferenceId ?? entry.subjectId ?? null;
      return identifier && savedSet.has(String(identifier));
    });
    return dedupeSubjectEntries(fallbackEntries);
  }, [
    combinedSubjectEntries,
    savedRegistrationSubjectIds,
    selectedSubjectKeys,
  ]);

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

  const getAppliedRegistrationKey = (student, semesterValue) => {
    const semesterCandidate =
      semesterValue ??
      form.semester ??
      student?.semester ??
      student?.semester_number ??
      "";
    const studentId =
      student?.student_id ??
      student?.studentId ??
      student?.id ??
      student?.student_id_number ??
      "";
    return buildRegistrationKey(studentId, semesterCandidate);
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
    if (!studentIds.length || !selectedExamId) return {};

    const { data, error } = await supabase
      .from("exam_registrations")
      .select(
        "id, student_id, semester, exam_id, total_fee, total_exam_fee, payments(fee_type, amount_paid, payment_status), exam_master(exam_name)"
      )
      .in("student_id", studentIds)
      .limit(1000);

    if (error) throw error;

    const nextDetails = {};
    const registrationKeyById = new Map();
    (data || []).forEach((registration) => {
      if (!registration) return;
      const registrationId = registration.id;
      const studentRecord = studentLookup.get(registration.student_id);
      if (!studentRecord) return;

      const examNameRow = (
        registration.exam_master?.exam_name || ""
      ).trim().toLowerCase();
      if (!normalizedSelectedExamName || normalizedSelectedExamName !== examNameRow)
        return;

      const studentIdSource =
        studentRecord.student_id ??
        studentRecord.studentId ??
        studentRecord.id ??
        studentRecord.student_id_number ??
        "";
      if (!studentIdSource) return;

      if (selectedExamId && registration.exam_id !== selectedExamId) return;
      const semesterValue =
        registration.semester === undefined || registration.semester === null
          ? ""
          : registration.semester;

      const successfulPayments = (registration.payments || []).filter(
        (payment) => payment?.payment_status === "success"
      );

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

      const registrationKey = buildRegistrationKey(studentIdSource, semesterValue);
      if (!registrationKey) return;
      registrationKeyById.set(registrationId, registrationKey);
      nextDetails[registrationKey] = {
        fullyPaid,
        hasExamPaid,
        status,
        paidTotal,
        examCoverageAmount,
        totalFee,
        applied: false,
        registrationId,
      };
    });

    (data || []).forEach((registration) => {
      const key = registrationKeyById.get(registration?.id);
      if (key && nextDetails[key]) {
        nextDetails[key].applied = true;
      }
    });

    return nextDetails;
  }, [students, selectedExamId, normalizedSelectedExamName]);

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
    }).sort((a, b) => {
      const nameA = (a.full_name || a.name || "").toLowerCase();
      const nameB = (b.full_name || b.name || "").toLowerCase();
      return nameA.localeCompare(nameB);
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
          semester: s.semester ?? s.semester_number ?? s.current_semester ?? "",
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
        .select("*")
        .order("exam_name", { ascending: true })
        .limit(500);
      if (error) throw error;
      const names = (data || [])
        .map((entry) => ({
          id: entry.id,
          exam_name: (entry.exam_name || "").trim(),
          results_published: entry.results_published,
          result_published: entry.result_published,
          result_status: entry.result_status,
          status: entry.status,
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

  useEffect(() => {
    if (!storedExamList.length) return;
    setForm((prev) => {
      const normalizedCurrent = (prev.examName || "")
        .toString()
        .trim()
        .toLowerCase();
      const currentExam = storedExamList.find(
        (exam) =>
          (exam.exam_name || "").toString().trim().toLowerCase() ===
          normalizedCurrent
      );
      if (currentExam && !isExamResultPublished(currentExam)) {
        return prev;
      }
      const fallback = getFirstUnpublishedExam(storedExamList);
      const fallbackName = fallback?.exam_name || "";
      if (!fallbackName) {
        if (!prev.examName) {
          return prev;
        }
        return { ...prev, examName: "" };
      }
      if (fallbackName.toLowerCase() === normalizedCurrent) {
        return prev;
      }
      return { ...prev, examName: fallbackName };
    });
  }, [storedExamList]);

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
    setActiveSubjectCategory(null);
    const skipSelection = Boolean(options.skipSubjectSelection);
    setModalStep(skipSelection ? 2 : 1);
    setModalPaymentRecords(options.records || []);
    setPaymentMethod("");
    setAllowPaymentWithoutSelection(skipSelection);
    setSavedRegistrationSubjectIds([]);
    const registrationId = options.registrationDetail?.registrationId ?? null;
    if (registrationId) {
      void loadExamRegistrationSubjects(registrationId);
    }
  };

  const openStudentModal = async (student, options = {}) => {
    // Check if this is a new application (not editing existing)
    if (!options.registrationDetail && !options.skipSubjectSelection) {
      // Get exam name and semester from form
      const examNameValue = (form.examName || "").trim();
      const semesterValue = form.semester;

      if (examNameValue && semesterValue && student?.id) {
        try {
          // Get exam_id for the selected exam
          const { data: examData, error: examError } = await supabase
            .from("exam_master")
            .select("id")
            .eq("exam_name", examNameValue)
            .maybeSingle();

          if (!examError && examData?.id) {
            // Check if student has already applied for this exam
            const { data: existingRegs, error: regError } = await supabase
              .from("exam_registrations")
              .select("id, semester")
              .eq("student_id", student.id)
              .eq("exam_id", examData.id);

            if (!regError && existingRegs && existingRegs.length > 0) {
              const currentSemester = Number(semesterValue);

              // Check for exact match (same exam, same semester)
              const exactMatch = existingRegs.find(reg => reg.semester === currentSemester);
              if (exactMatch) {
                showToast(
                  "This student has already applied for this exam in the selected semester.",
                  { type: "warning", title: "Already Applied" }
                );
                return;
              }

              // Check for different semester (same exam, different semester)
              const differentSemester = existingRegs.find(reg => reg.semester !== currentSemester);
              if (differentSemester) {
                showToast(
                  `This student has already applied for this exam in Semester ${differentSemester.semester}. Cannot apply for the same exam in a different semester.`,
                  { type: "danger", title: "Already Applied for this Exam" }
                );
                return;
              }
            }
          }
        } catch (error) {
          console.error("Error checking existing application:", error);
          // Continue to open modal even if check fails
        }
      }
    }

    prepareStudentPaymentContext(student, options);
    setModalOpen(true);
  };

  const handleEditStoredSubjects = (student, detail) => {
    if (!detail?.registrationId) return;
    openStudentModal(student, {
      registrationDetail: detail,
    });
  };

  const handleDeleteStoredSubjects = async (student, detail) => {
    if (!detail?.registrationId) return;
    if (deletingRegistrationId === detail.registrationId) return;
    const registrationId = detail.registrationId;
    const studentName = student?.full_name || student?.name || "the student";

    // First, check if there are any marks associated with these registrations
    try {
      setDeletingRegistrationId(registrationId);

      // Check for existing marks first
      // We need to traverse: marks -> barcodes -> exam_registration_subjects -> exam_registrations

      // 1. Get relevant exam_registration_subjects IDs
      const { data: subjectData, error: subjectError } = await supabase
        .from('exam_registration_subjects')
        .select('id')
        .eq('exam_registration_id', registrationId);

      if (subjectError) throw subjectError;

      const subjectIdsToCheck = (subjectData || []).map(s => s.id);
      let marksExist = false;

      if (subjectIdsToCheck.length > 0) {
        // 2. Get barcodes linked to these subjects
        const { data: barcodeData, error: barcodeError } = await supabase
          .from('barcodes')
          .select('id')
          .in('exam_registration_subject_id', subjectIdsToCheck);

        if (barcodeError) throw barcodeError;

        const barcodeIds = (barcodeData || []).map(b => b.id);

        if (barcodeIds.length > 0) {
          // 3. Check for marks linked to these barcodes
          const { data: marksData, error: marksCheckError } = await supabase
            .from('marks')
            .select('id')
            .in('barcode_id', barcodeIds)
            .limit(1);

          if (marksCheckError) throw marksCheckError;
          if (marksData && marksData.length > 0) {
            marksExist = true;
          }
        }
      }

      if (marksExist) {
        // If marks exist, show a warning and don't allow deletion
        showToast(
          `Cannot delete subjects for ${studentName} because marks have already been recorded. ` +
          'Please delete the associated marks first.',
          { type: 'warning', title: 'Cannot Delete' }
        );
        return;
      }

      // Step 1: Get all subject IDs related to this registration to clean up barcodes
      const { data: regSubjects, error: fetchSubjectsError } = await supabase
        .from('exam_registration_subjects')
        .select('id')
        .eq('exam_registration_id', registrationId);

      if (fetchSubjectsError) throw fetchSubjectsError;

      const subjectIds = (regSubjects || []).map(r => r.id);

      // Step 2: Delete barcodes associated with these subjects
      if (subjectIds.length > 0) {
        const { error: deleteBarcodesError } = await supabase
          .from('barcodes')
          .delete()
          .in('exam_registration_subject_id', subjectIds);

        if (deleteBarcodesError) throw deleteBarcodesError;
      }

      // Step 3: Delete exam registration subjects
      const { error: deleteSubjectsError } = await supabase
        .from('exam_registration_subjects')
        .delete()
        .eq('exam_registration_id', registrationId);

      if (deleteSubjectsError) throw deleteSubjectsError;

      // Step 4: Delete payments associated (if any, usually none if we are here but good to clean up)
      const { error: deletePaymentsError } = await supabase
        .from('payments')
        .delete()
        .eq('exam_registration_id', registrationId);

      if (deletePaymentsError) throw deletePaymentsError;

      // Step 5: Finally delete the registration
      const { error: deleteRegError } = await supabase
        .from('exam_registrations')
        .delete()
        .eq('id', registrationId);

      if (deleteRegError) throw deleteRegError;

      const nextDetails = await buildAppliedRegistrationDetails();
      setAppliedRegistrationDetails(nextDetails);

      showToast(`Applied subjects removed for ${studentName}.`, {
        type: "success",
        title: "Exam",
      });
    } catch (error) {
      console.error("Unable to delete stored subjects", error);

      let errorMessage = "Unable to delete stored subjects. ";
      if (error.code === '23503') {
        errorMessage += "This record is referenced by other data and cannot be deleted.";
      } else {
        errorMessage += "Please try again later.";
      }

      showToast(errorMessage, {
        type: "danger",
        title: "Error",
      });
    } finally {
      setDeletingRegistrationId(null);
    }
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
    setSavedRegistrationSubjectIds([]);
  };
  const closePaymentModal = ({ notifyCancellation = false } = {}) => {
    setShowPaymentModal(false);
    setShowPaymentDetailsModal(false);
    setPaymentMethod("");
    if (notifyCancellation) {
      showToast("Payment canceled.", {
        type: "info",
        title: "Payment",
      });
    }
  };
  // Function to generate a unique barcode
  const generateUniqueBarcode = (examRegId, subjectId) => {
    // Generate a 7 digit random numeric value as requested
    const min = 1000000;
    const max = 9999999;
    return String(Math.floor(Math.random() * (max - min + 1)) + min);
  };
  const persistExamRegistrationSubjects = async (
    examRegistrationId,
    subjectEntries,
    examMasterId
  ) => {
    // If we have an existing registration but no subjects selected, 
    // it implies we should delete all subjects (if that's the intention),
    // but typically we expect at least one subject. 
    // Assuming handling '0 subjects' is valid (removing all).

    if (!activePaymentStudent?.id) return;

    try {
      // 1. Identify Target Subjects (Unique IDs)
      const targetSubjectIds = new Set();
      (subjectEntries || []).forEach((entry) => {
        const subjectId = entry.subjectReferenceId ?? entry.subjectId ?? null;
        if (subjectId) targetSubjectIds.add(String(subjectId));
      });

      // 2. Fetch Existing Subjects for this Registration
      const { data: existingRows, error: fetchError } = await supabase
        .from('exam_registration_subjects')
        .select('id, subject_id')
        .eq('exam_registration_id', examRegistrationId);

      if (fetchError) throw fetchError;

      const existingMap = new Map(); // subject_id -> id (primary key of exam_registration_subjects)
      (existingRows || []).forEach(row => {
        if (row.subject_id) existingMap.set(String(row.subject_id), row.id);
      });

      const existingSubjectIds = new Set(existingMap.keys());

      // 3. Determine deletions and insertions
      const toDeleteSubjectIds = [...existingSubjectIds].filter(sid => !targetSubjectIds.has(sid));
      const toInsertSubjectIds = [...targetSubjectIds].filter(sid => !existingSubjectIds.has(sid));

      // 4. Perform Deletions
      if (toDeleteSubjectIds.length > 0) {
        const idsToDelete = toDeleteSubjectIds.map(sid => existingMap.get(sid));

        // 4a. Delete barcodes linked to these exam_registration_subjects
        const { error: delBarcodeError } = await supabase
          .from('barcodes')
          .delete()
          .in('exam_registration_subject_id', idsToDelete);

        if (delBarcodeError) throw delBarcodeError;

        // 4b. Delete the exam_registration_subjects rows
        const { error: delSubError } = await supabase
          .from('exam_registration_subjects')
          .delete()
          .in('id', idsToDelete);

        if (delSubError) throw delSubError;
      }

      // 5. Perform Insertions
      let insertedData = [];
      if (toInsertSubjectIds.length > 0) {
        const rowsToInsert = toInsertSubjectIds.map(sid => ({
          exam_registration_id: examRegistrationId,
          subject_id: sid
        }));

        const { data: inserted, error: insertError } = await supabase
          .from('exam_registration_subjects')
          .insert(rowsToInsert)
          .select();

        if (insertError) throw insertError;
        insertedData = inserted;
      }

      // Return unified list of current subjects (existing kept + inserted)
      // This is used by subsequent calls (e.g. ensureBarcodes)
      const combined = [
        ...existingRows.filter(row => targetSubjectIds.has(String(row.subject_id))),
        ...(insertedData || [])
      ];

      console.log('Exam registration subjects synced.', {
        added: toInsertSubjectIds.length,
        removed: toDeleteSubjectIds.length
      });

      return combined;
    } catch (error) {
      console.error('Error in persistExamRegistrationSubjects:', {
        error,
        examRegistrationId,
        subjectEntries,
        studentId: activePaymentStudent?.id
      });
      throw error;
    }
  };

  const loadExamRegistrationSubjects = useCallback(async (registrationId) => {
    setLoadingSavedSubjects(true);
    if (!registrationId) {
      setSavedRegistrationSubjectIds([]);
      setLoadingSavedSubjects(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("exam_registration_subjects")
        .select("subject_id")
        .eq("exam_registration_id", registrationId);
      if (error) throw error;
      const subjectIds = (data || [])
        .map((row) => row?.subject_id)
        .filter((value) => value !== undefined && value !== null)
        .map((value) => String(value));
      setSavedRegistrationSubjectIds(subjectIds);
    } catch (error) {
      console.error("Failed to load stored subjects:", error);
      setSavedRegistrationSubjectIds([]);
    } finally {
      setLoadingSavedSubjects(false);
    }
  }, []);

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
    const buildRegistrationQuery = ({
      includeDetails = true,
    } = {}) => {
      const columns = includeDetails ? "id, exam_id" : "id";
      let query = supabase
        .from("exam_registrations")
        .select(columns)
        .eq("student_id", activePaymentStudent.id);
      if (examMasterId) {
        query = query.eq("exam_id", examMasterId);
      }
      return query;
    };

    const { data: existingReg, error: existingRegError } = await buildRegistrationQuery().maybeSingle();
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

    let insertedReg = null;
    try {
      const { data, error } = await supabase
        .from("exam_registrations")
        .insert(payload)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      insertedReg = data;
    } catch (error) {
      const isConflict =
        error?.code === "23505" ||
        (error?.details || "").includes("exam_reg_unique");
      if (isConflict) {
        const { data: conflictReg, error: conflictError } =
          await buildRegistrationQuery({ relaxExamFilter: true }).maybeSingle();
        if (conflictError) throw conflictError;
        if (conflictReg?.id) {
          return {
            examRegistrationId: conflictReg.id,
            examMasterId: conflictReg.exam_id || examMasterId,
          };
        }
      }
      throw error;
    }
    if (!insertedReg?.id) {
      throw new Error("Unable to establish exam registration");
    }
    return {
      examRegistrationId: insertedReg.id,
      examMasterId,
    };
  };

  // Function to generate barcode for a subject
  const generateBarcodeForSubject = async (examRegistrationId, subjectId, studentId) => {
    console.log('Generating barcode for:', { examRegistrationId, subjectId, studentId });

    try {
      // First, verify the subject exists in exam_registration_subjects
      const { data: subjectData, error: subjectError } = await supabase
        .from('exam_registration_subjects')
        .select('id, subject_id')
        .eq('id', subjectId)
        .single();

      if (subjectError || !subjectData) {
        console.error('Subject not found in exam_registration_subjects:', subjectError || 'No data');
        throw new Error(`Subject ${subjectId} not found in exam registration`);
      }

      // Check if barcode already exists
      const { data: existingBarcode, error: checkError } = await supabase
        .from('barcodes')
        .select('id, barcode')
        .eq('exam_registration_subject_id', subjectId)
        .eq('student_id', studentId)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingBarcode) {
        console.log('Barcode already exists:', existingBarcode.barcode);
        return existingBarcode.barcode; // Return existing barcode if it exists
      }

      // Generate a unique barcode
      const barcode = generateUniqueBarcode(examRegistrationId, subjectId);
      console.log('Generated new barcode:', barcode);

      // Insert the barcode
      const { data: newBarcode, error: insertError } = await supabase
        .from('barcodes')
        .insert([{
          exam_registration_subject_id: subjectId,
          student_id: studentId,
          barcode: barcode,
          created_at: new Date().toISOString()
        }])
        .select('barcode')
        .single();

      if (insertError) {
        console.error('Error inserting barcode:', insertError);
        throw insertError;
      }

      console.log('Barcode created successfully:', newBarcode);
      return newBarcode.barcode;

    } catch (error) {
      console.error('Error in generateBarcodeForSubject:', {
        error,
        examRegistrationId,
        subjectId,
        studentId
      });
      throw error;
    }
  };

  const ensureBarcodesForSubjects = async (examRegistrationId, subjectRows = []) => {
    const normalizedRows = (subjectRows || []).filter((subject) => subject?.id);
    if (!examRegistrationId || !normalizedRows.length || !activePaymentStudent?.id) {
      return { successCount: 0, failureCount: 0 };
    }

    const results = await Promise.allSettled(
      normalizedRows.map((subject) =>
        generateBarcodeForSubject(examRegistrationId, subject.id, activePaymentStudent.id)
      )
    );

    const failureCount = results.filter((result) => result.status === 'rejected').length;
    const successCount = results.length - failureCount;

    if (failureCount) {
      console.warn(
        `Barcode generation failed for ${failureCount} subject(s) of registration ${examRegistrationId}.`
      );
    }

    return { successCount, failureCount };
  };



  const handlePaymentModalConfirm = async () => {
    if (processingPayment) return;
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

    const markActiveRegistrationPaid = (paidAmount = 0) => {
      const registrationKey = getAppliedRegistrationKey(
        activePaymentStudent,
        modalSemester
      );
      if (!registrationKey) return;
      setAppliedRegistrationDetails((prev) => {
        const previous = prev[registrationKey] ?? {};
        const paidTotal = Math.max(
          Number(previous.paidTotal || 0),
          Number(paidAmount || 0)
        );
        const nextTotalFee =
          previous.totalFee || totalFeeBreakdownAmount || 0;
        const examCoverage = Math.max(
          Number(previous.examCoverageAmount || 0),
          examSubtotal
        );
        return {
          ...prev,
          [registrationKey]: {
            ...previous,
            fullyPaid: true,
            hasExamPaid: true,
            status: "fully-paid",
            paidTotal,
            totalFee: nextTotalFee,
            examCoverageAmount: examCoverage,
            applied: true,
          },
        };
      });
    };

    const uniqueSubjectEntries = getUniqueSelectedSubjectEntries();
    let paymentAmount = 0;
    setProcessingPayment(true);
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
      const alreadyPaidExam = Math.min(
        examSubtotal,
        sumExamCoverageFromPayments(successfulPayments)
      );
      const amount = Math.max(examSubtotal - alreadyPaidExam, 0);
      const payableAmount = amount + lateFeeAmount;
      if (payableAmount <= 0) {
        markActiveRegistrationPaid(alreadyPaidExam);
        showToast("Payment successful. No outstanding amount remaining.", {
          type: "success",
          title: "Payment",
        });
        setPaymentMethod("");
        closePaymentModal();
        closeStudentModal();
        return;
      }
      const normalizedPaymentOption = "exam";

      const { data: duplicateEntry, error: duplicateError } = await supabase
        .from("payments")
        .select("id")
        .match({
          exam_registration_id: examRegistrationId,
          payment_type: paymentMethod,
          fee_type: normalizedPaymentOption,
          amount_paid: payableAmount,
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
      // First check for existing payment to avoid duplicates
      const { data: existingPayment, error: checkError } = await supabase
        .from('payments')
        .select('id')
        .eq('exam_registration_id', examRegistrationId)
        .eq('fee_type', normalizedPaymentOption)
        .eq('payment_status', 'success')
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingPayment) {
        // If payment already exists, update it instead of creating a new one
        const { error: updateError } = await supabase
          .from('payments')
          .update({
            amount_paid: payableAmount,
            payment_type: paymentMethod,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingPayment.id);

        if (updateError) throw updateError;
      } else {
        // Create new payment record if it doesn't exist
        const { error: insertError } = await supabase
          .from('payments')
          .insert({
            exam_registration_id: examRegistrationId,
            amount_paid: payableAmount,
            payment_type: paymentMethod,
            fee_type: normalizedPaymentOption,
            payment_status: 'success',
          });

        if (insertError) throw insertError;
      }

      paymentAmount = payableAmount;

      // After successful payment, generate barcodes for each subject
      if (uniqueSubjectEntries.length > 0) {
        try {
          const { data: registrationSubjects, error: subjectsError } = await supabase
            .from('exam_registration_subjects')
            .select('id')
            .eq('exam_registration_id', examRegistrationId);

          if (subjectsError) {
            console.error('Error fetching registration subjects:', subjectsError);
            throw subjectsError;
          }

          const { successCount, failureCount } = await ensureBarcodesForSubjects(
            examRegistrationId,
            registrationSubjects || []
          );

          if (failureCount > 0) {
            showToast(
              `Generated barcodes for ${successCount} subject(s) but failed for ${failureCount}. Check console for details.`,
              { type: 'warning' }
            );
          }
        } catch (error) {
          console.error('Error in barcode generation process:', error);
          showToast(
            'Error generating barcodes. Check console for details.',
            { type: 'error' }
          );
        }
      }
    } catch (error) {
      console.error("Unable to record payment", error);

      let errorMessage = "Payment unsuccessful. ";
      if (error.code === '23505') { // Unique violation
        errorMessage += "This payment has already been recorded.";
      } else if (error.code === '23503') { // Foreign key violation
        errorMessage += "Invalid registration reference. Please refresh and try again.";
      } else {
        errorMessage += "Unable to record payment. Please try again.";
      }

      showToast(errorMessage, {
        type: "danger",
        title: "Payment Error",
      });
      return;
    } finally {
      setProcessingPayment(false);
    }

    markActiveRegistrationPaid(paymentAmount);

    showToast(
      `Payment successful for ${formatCurrency(paymentAmount)} via ${paymentMethod}.`,
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

  const limitedStudents = displayCount
    ? filteredStudents.slice(
      0,
      Math.min(Number(displayCount), filteredStudents.length)
    )
    : filteredStudents;

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
        value: filteredStudents.length,
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
    filteredStudents.length,
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
        <h4 className="fw-bold mb-3">Filter Students</h4>

        <div className="row g-3">
          {/* Student ID */}
          <div className="col-md-3">
            <label className="form-label fw-bold">Hall ticket / Student ID</label>
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
              {storedExamList.map((entry) => {
                const isPublished = isExamResultPublished(entry);
                return (
                  <option
                    key={entry.id}
                    value={entry.exam_name}
                  >
                    {entry.exam_name}
                    {isPublished ? " (Results published)" : ""}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>
      <div className="students-table-panel payments-table-panel card card-soft p-4 mb-4">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
          <div>
            <h5 className="fw-bold mb-1">Filtered students</h5>
            <p className="text-muted small mb-0">
              Find a student to review or apply payments.
            </p>
          </div>
          <span className="text-muted small">
            {hasActiveFilters
              ? `Displaying ${limitedStudents.length} of ${filteredStudents.length}`
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
                  <th scope="col">Semester</th>
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
                        <td>{s.current_semester}</td>
                        {(() => {
                          const key = getAppliedRegistrationKey(s);
                          const detail = key ? appliedRegistrationDetails[key] : null;
                          const isApplied = detail?.fullyPaid;
                          const hasStoredSubjects = Boolean(detail?.applied);
                          const buttonLabel =
                            detail?.paidTotal > 0
                              ? "Pay balance"
                              : "Apply for Exam";
                          const skipSelection =
                            hasStoredSubjects ||
                            (detail && detail.paidTotal > 0 && !detail.fullyPaid);
                          const openModal = () => {
                            if (!form.examName) {
                              showToast("Please select the exam name.", { type: "warning" });
                              return;
                            }
                            // Check if results are published for the selected exam
                            const selectedExamEntry = storedExamList.find(e => e.exam_name === form.examName);
                            if (selectedExamEntry && isExamResultPublished(selectedExamEntry) && !detail?.applied) {
                              showToast("Results for this exam have already been published.Please Select the New Exam name!", { type: "warning" });
                              return;
                            }

                            if (!detail?.applied && !form.semester) {
                              showToast("Please select a semester first.", { type: "warning" });
                              return;
                            }
                            openStudentModal(s, {
                              skipSubjectSelection: skipSelection,
                              registrationDetail: detail,
                            });
                          };
                          return (
                            <Fragment key={`${s.student_id}-payment`}>
                              <td className="text-center">
                                <div className="d-flex flex-column gap-2 align-items-center">
                                  <button
                                    type="button"
                                    className={`btn btn-sm ${isApplied ? "btn-success" : "btn-outline-success"
                                      }`}
                                    onClick={() => {
                                      if (!detail?.applied) {
                                        showToast("Please apply for the exam first before making payment.", { type: "warning" });
                                        return;
                                      }
                                      openModal();
                                    }}
                                    disabled={isApplied || !detail?.applied}
                                  >
                                    {isApplied ? "Successfully Paid" : "Pay now"}
                                  </button>
                                </div>
                              </td>
                              <td className="text-end">
                                {detail?.applied ? (
                                  (() => {
                                    const selectedExamEntry = storedExamList.find(e => e.exam_name === form.examName);
                                    const isResultsPublished = selectedExamEntry ? isExamResultPublished(selectedExamEntry) : false;

                                    const hasPayments = Number(detail.paidTotal || 0) > 0;
                                    const canModifyStoredSubjects = !hasPayments && !isResultsPublished;
                                    if (canModifyStoredSubjects) {
                                      return (
                                        <div className="d-flex flex-column align-items-end gap-2">
                                          <div className="d-flex gap-2 justify-content-end">
                                            <button
                                              type="button"
                                              className="btn btn-sm btn-outline-primary"
                                              onClick={() => handleEditStoredSubjects(s, detail)}
                                            >
                                              Edit
                                            </button>
                                            <button
                                              type="button"
                                              className="btn btn-sm btn-outline-danger"
                                              onClick={() => handleDeleteStoredSubjects(s, detail)}
                                              disabled={
                                                deletingRegistrationId === detail.registrationId
                                              }
                                            >
                                              Delete
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    }
                                    return (
                                      <div className="d-flex flex-column align-items-end text-success small">
                                        <span className="fw-semibold">Applied</span>
                                        <span className="text-muted small">
                                          {hasPayments
                                            ? "Payment recorded"
                                            : "Subjects already stored"}
                                        </span>
                                      </div>
                                    );
                                  })()
                                ) : (
                                  <button
                                    className={`btn btn-sm ${isActive ? "btn-outline-secondary" : "btn-outline-primary"
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
                            <p className="text-muted fs-5 mb-0">
                              Tap each subject you want to store for the exam, then continue to review before confirming.
                            </p>
                          </div>
                          <div className="text-end align-self-center">
                            <span className="fw-bold fs-4 text-primary">Selected : {selectedSubjectCount}</span>
                          </div>
                        </div>
                        <div className="mt-2 d-flex flex-wrap gap-2">
                          {activeSubjectCategory ? (
                            <>
                              <span className="badge bg-light text-dark border">
                                Current Semester {modalSemester}
                              </span>
                              {visibleSupplementarySubjectGroups.map((group) => (
                                <span
                                  key={`suppl-badge-${group.semester}`}
                                  className="badge bg-light text-dark border"
                                >
                                  Supplementary Sem {group.semester} ({group.entries.length})
                                </span>
                              ))}
                            </>
                          ) : (
                            <span className="badge bg-light text-dark border">
                              Select a sub-category to see the available subjects.
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    {modalStep === 1 && subjectCategoryOptions.length > 0 && (
                      <div className="mb-3">
                        <div className="d-flex flex-wrap gap-2">
                          {subjectCategoryOptions.map((category) => {
                            const isActive = activeSubjectCategory === category;
                            return (
                              <button
                                key={category}
                                type="button"
                                className={`btn btn-sm ${isActive ? "btn-primary" : "btn-outline-primary"
                                  }`}
                                onClick={() =>
                                  setActiveSubjectCategory((prev) =>
                                    prev === category ? null : category
                                  )
                                }
                              >
                                <span className="me-2">{category}</span>
                                <span className="badge bg-white text-dark border">
                                  {subjectCountsByCategory.get(category) || 0}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {modalStep === 1 && availableSupplementarySemesters.length > 0 && (
                      <div className="d-flex align-items-center justify-content-end gap-2 mb-3">
                        <span className="text-muted small">
                          Supplementary subject groups (Sem {availableSupplementarySemesters.join(
                            ", "
                          )}) are shown automatically.
                        </span>
                      </div>
                    )}
                    {modalStep === 1 ? (
                      combinedSubjectEntries.length === 0 ? null : (
                        <>
                          {!activeSubjectCategory ? (
                            <div className="border rounded mb-3 p-3 text-muted small">
                              Select a sub-category to view its subjects before selecting them.
                            </div>
                          ) : (
                            <>
                              {visibleCurrentSubjectEntries.length > 0 ? (
                                <div className="border rounded mb-3">
                                  <div className="px-3 py-2 bg-light border-bottom d-flex justify-content-between align-items-center">
                                    <span className="fw-semibold">Current semester subjects</span>
                                    <span className="text-muted small">
                                      {filteredCurrentSelectedCount} of {visibleCurrentSubjectEntries.length} selected
                                    </span>
                                  </div>
                                  <div className="table-responsive">
                                    <table className="table table-sm table-hover mb-0">
                                      <thead>
                                        <tr>
                                          <th scope="col" className="text-center" style={{ width: "50px" }}>
                                            S.No
                                          </th>
                                          <th scope="col">Subject</th>
                                        </tr>
                                      </thead>
                                      <tbody>{visibleCurrentSubjectEntries.map((entry, index) => renderSubjectRow(entry, index))}</tbody>
                                    </table>
                                  </div>
                                </div>
                              ) : (
                                <div className="border rounded mb-3 p-3 text-muted small">
                                  No current semester subjects tied to {activeSubjectCategory}.
                                </div>
                              )}
                              {visibleSupplementarySubjectGroups.length > 0 &&
                                visibleSupplementarySubjectGroups.map((group) => {
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
                                                <th scope="col" className="text-center" style={{ width: "50px" }}>
                                                  S.No
                                                </th>
                                                <th scope="col">Subject</th>
                                              </tr>
                                            </thead>
                                            <tbody>{group.entries.map((entry, index) => renderSubjectRow(entry, index))}</tbody>
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
                          )}
                        </>
                      )
                    ) : (
                      <>
                        <div className="mb-3">
                          <div className="d-flex align-items-start justify-content-between flex-wrap gap-3">
                            <div>
                              <h5 className="fw-semibold mb-1">Step 2: Review selections</h5>
                              <p className="text-muted fs-5 mb-0">
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
                                <div className="table-responsive">
                                  <table className="table table-sm table-hover mb-0">
                                    <thead>
                                      <tr>
                                        <th scope="col" style={{ width: "50px" }} className="text-center">Serial Number</th>
                                        <th scope="col">Subject</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {currentSelectedEntries.map((entry, index) => (
                                        <tr key={`review-current-${entry.key}`}>
                                          <td className="text-center fw-semibold">{index + 1}</td>
                                          <td className="fw-semibold">
                                            {entry.code ? `${entry.code} - ${entry.name}` : entry.name}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
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
                                    <div className="table-responsive">
                                      <table className="table table-sm table-hover mb-0">
                                        <thead>
                                          <tr>
                                            <th scope="col" style={{ width: "50px" }} className="text-center">S.NO</th>
                                            <th scope="col">Subject</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {group.entries.map((entry, index) => (
                                            <tr key={`review-suppl-entry-${entry.key}`}>
                                              <td className="text-center fw-semibold">{index + 1}</td>
                                              <td className="fw-semibold">
                                                {entry.code ? `${entry.code} - ${entry.name}` : entry.name}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
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
                <div class="mb-4">
                  <div class="fw-semibold mb-2">Exam fee</div>
                  <p class="text-muted small mb-2">
                    Pay the configured exam and supplementary fees in full for the selected subjects.
                  </p>
                  <div class="d-flex flex-column gap-1">
                    <div class="d-flex justify-content-between align-items-center">
                      <span class="text-muted small">Amount due</span>
                      <span class="fw-semibold">{formatCurrency(examSubtotal)}
                        {modalPaymentSummary && (
                          <span class="text-muted small">(Remaining {formatCurrency(outstandingExam)})</span>
                        )}
                      </span>
                    </div>
                    {lateFeeAmount > 0 && selectedExamDeadline?.last_date && (
                      <div class="text-muted small">
                        Fine fee {formatCurrency(lateFeeAmount)} applies after {formatDeadlineDate(selectedExamDeadline.last_date)}.
                      </div>
                    )}
                  </div>
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
                  disabled={processingPayment}
                >
                  {processingPayment ? "Processing..." : "Pay now"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showPaymentDetailsModal && (
        <div
          className="modal d-block"
          tabIndex="-1"
          role="dialog"
          aria-modal="true"
          style={{ backgroundColor: "rgba(0,0,0,0.4)", zIndex: 1100 }}
        >
          <div className="modal-dialog modal-md modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Payment details</h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={() => setShowPaymentDetailsModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <div className="d-flex justify-content-between">
                    <span>Regular exam fee</span>
                    <span>{formatCurrency(examOnlyAmount)}</span>
                  </div>
                  {supplementaryFeeAmount > 0 && (
                    <div className="d-flex justify-content-between">
                      <span>Supplementary fee</span>
                      <span>{formatCurrency(supplementaryFeeAmount)}</span>
                    </div>
                  )}
                  {lateFeeAmount > 0 && (
                    <div className="d-flex justify-content-between">
                      <span>Fine fee</span>
                      <span>{formatCurrency(lateFeeAmount)}</span>
                    </div>
                  )}
                  <div className="mt-2 border-top pt-2 d-flex justify-content-between fw-semibold">
                    <span>Total due</span>
                    <span>{formatCurrency(paymentIntentAmount)}</span>
                  </div>
                  {modalPaymentSummary?.alreadyPaidExam > 0 && (
                    <div className="text-muted small mt-1">
                      There is a balance of {formatCurrency(outstandingExam)} remaining.
                    </div>
                  )}
                  {lateFeeAmount > 0 && selectedExamDeadline?.last_date && (
                    <div className="text-muted small mt-2">
                      Fine fee applies after {formatDeadlineDate(selectedExamDeadline.last_date)}.
                    </div>
                  )}
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
                {loadingSavedSubjects && (
                  <div className="text-muted small mb-2">
                    Loading saved subjects before recording payment...
                  </div>
                )}
              </div>
              <div className="modal-footer d-flex gap-2 justify-content-end">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setShowPaymentDetailsModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handlePaymentModalConfirm}
                  disabled={
                    !paymentMethod ||
                    loadingSavedSubjects ||
                    processingPayment
                  }
                >
                  {processingPayment ? "Processing..." : "Confirm payment"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
