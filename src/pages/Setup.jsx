import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AdminShell from "../components/AdminShell";
import { api } from "../lib/mockApi";
import { validateRequiredFields } from "../lib/validation";
import AcademicYearsSection from "./AcademicYears";
import GroupsCoursesSection from "./GroupsCourses";
import SubjectsSection from "./Subjects";
import crestPrimary from "../assets/media/images.png";
import { showToast } from "../store/ui";

// Utility
const uid = () => Math.random().toString(36).slice(2);

const renameKey = (map, from, to, fallbackValue) => {
  if (from === to) return map;
  const { [from]: value = fallbackValue, ...rest } = map;
  return { ...rest, [to]: value ?? fallbackValue };
};

const deleteKey = (map, key) => {
  if (!Object.prototype.hasOwnProperty.call(map, key)) return map;
  const { [key]: _omit, ...rest } = map;
  return rest;
};

const buildComboKey = (item = {}) => {
  const year =
    item.academicYearId || item.academicYearName || item.academic_year || "";
  const group = item.groupCode || item.group || item.group_name || "";
  const course =
    item.courseCode ||
    item.courseName ||
    item.course_code ||
    item.course_name ||
    "";
  const semester =
    item.semester ?? item.semester_number ?? item.semesterNumber ?? "";
  return [year, group, course, semester]
    .map((part) => (part === undefined || part === null ? "" : String(part)))
    .join("|");
};

const randomId = () => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 8;
    return v.toString(16);
  });
};

const buildSubjectForm = (category = "") => ({
  academicYearId: "",
  academicYearName: "",
  groupCode: "",
  courseCode: "",
  courseName: "",
  semester: "",
  category,
  categoryId: "",
  subjectName: "",
  subjectCode: "",
  extraSubjectNames: [],
  subjectSelections: [],
  feeCategory: "",
  feeAmount: "",
  subjectId: "",
});

const itemsToNames = (items = []) =>
  (items || []).map((item) => (item?.name || "").trim()).filter(Boolean);

const subjectsToItems = (subjects = []) => {
  if (!Array.isArray(subjects)) return [];
  return subjects
    .map((name) => ({ id: randomId(), name }))
    .filter((item) => item.name);
};

const buildCourseLookup = (courses = []) => {
  return courses.reduce((acc, course) => {
    if (!course) return acc;
    const courseCode =
      course.courseCode || course.code || course.course_code || "";
    const courseName =
      course.courseName || course.name || course.course_name || courseCode;
    const groupCode =
      course.groupCode || course.group_code || course.group_name || "";
    const entry = { courseCode, courseName, groupCode };
    if (courseName) acc[courseName] = entry;
    if (courseCode) acc[courseCode] = entry;
    return acc;
  }, {});
};

const buildYearNameLookup = (years = []) => {
  return years.reduce((acc, year) => {
    if (year?.name && year?.id !== undefined) acc[year.name] = year.id;
    return acc;
  }, {});
};

const invertMap = (mapObj = {}) => {
  return Object.entries(mapObj).reduce((acc, [key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      acc[value] = key;
    }
    return acc;
  }, {});
};

const normalizeSubjectRecord = (subject = {}, context = {}) => {
  const {
    courseLookup = {},
    categoryNameById = {},
    yearNameToId = {},
  } = context;

  const semesterValue =
    subject.semester ??
    subject.semester_number ??
    subject.semesterNo ??
    subject.semesterNumber;

  const feeAmountValue =
    subject.amount ?? subject.feeAmount ?? subject.fee_amount;

  const subjectCode =
    subject.subjectCode ||
    subject.subject_code ||
    subject.subjectName ||
    subject.subject_name ||
    "";

  const subjectName =
    subject.subjectName || subject.subject_name || subjectCode;

  const subjectNames =
    subject.subjectNames && Array.isArray(subject.subjectNames)
      ? subject.subjectNames
      : subject.subjectName
        ? [subject.subjectName]
        : [];
  const subjectCodes =
    subject.subjectCodes && Array.isArray(subject.subjectCodes)
      ? subject.subjectCodes
      : subject.subjectCode
        ? [subject.subjectCode]
        : subject.subject_code
          ? [subject.subject_code]
          : [];

  const courseKey =
    subject.courseName ||
    subject.course_name ||
    subject.courseCode ||
    subject.course_code ||
    "";

  const courseMeta = courseLookup[courseKey] || {};

  const academicYearName =
    subject.academicYearName ||
    subject.academic_year_name ||
    subject.academic_year ||
    "";

  const academicYearId =
    subject.academicYearId ||
    subject.academic_year_id ||
    yearNameToId[academicYearName] ||
    "";

  const categoryId = subject.category_id ?? subject.categoryId ?? "";
  const categoryName =
    subject.category ||
    subject.category_name ||
    categoryNameById[categoryId] ||
    "";

  const supabaseId =
    subject.subject_id || subject.subjectId || subject.id || "";

  return {
    id: supabaseId || subject.id || randomId(),
    subjectId: supabaseId || "",
    academicYearId,
    academicYearName,
    groupCode:
      subject.groupCode || subject.group_code || courseMeta.groupCode || "",
    courseCode:
      subject.courseCode ||
      subject.course_code ||
      courseMeta.courseCode ||
      courseKey,
    courseName: courseMeta.courseName || courseKey,
    semester:
      semesterValue === undefined ||
        semesterValue === null ||
        semesterValue === ""
        ? ""
        : Number(semesterValue),
    categoryId,
    category: categoryName,
    subjectCode,
    subjectName,
    feeCategory:
      subject.feeCategory ||
      subject.fee_category ||
      subject.fees_categories ||
      "",
    feeAmount:
      feeAmountValue === undefined ||
        feeAmountValue === null ||
        feeAmountValue === ""
        ? ""
        : Number(feeAmountValue),
    subjectNames,
    subjectCodes,
  };
};
const buildSubjectBatchKey = (subject = {}) => {
  if (!subject) return "";
  if (subject.batchId) return subject.batchId;
  const parts = [
    subject.academicYearId || subject.academicYearName || "",
    subject.groupCode || "",
    subject.courseCode || "",
    subject.semester === undefined || subject.semester === null
      ? ""
      : subject.semester,
    subject.categoryId || subject.category || "",
  ];
  const derived = parts
    .map((part) => (part === undefined || part === null ? "" : String(part)))
    .join("__");
  return derived || subject.subjectId || subject.id || "";
};

const ensureSubjectBatchKey = (subject = {}) => {
  if (!subject) return subject;
  if (subject.batchId) return subject;
  const batchKey = buildSubjectBatchKey(subject);
  return batchKey ? { ...subject, batchId: batchKey } : subject;
};

const TAB_CONFIG = [
  {
    key: "years",
    label: "Academic Years",
    tagline: "Define academic timelines and activation status.",
  },
  {
    key: "groups",
    label: "Groups & Courses",
    tagline: "Manage programme structures and duration.",
  },
  {
    key: "subjects",
    label: "Subjects",
    tagline: "Control curriculum details semester by semester.",
  },
  {
    key: "students",
    label: "Students",
    tagline: "Manage student records and information.",
  },
];

const PLACEHOLDER_FEE_NAMES = new Set([
  "Academic",
  "Exam",
  "Library",
  "Bus",
  "Lab",
]);

const stripPlaceholders = (list) => {
  if (!list || !list.length) return list;
  const looksLikePlaceholder = list.every(
    (cat) => PLACEHOLDER_FEE_NAMES.has(cat.name) && (cat.fees?.length || 0) <= 1
  );
  return looksLikePlaceholder ? [] : list;
};

const normalizeFeeCategories = (data) => {
  if (!Array.isArray(data)) return [];
  const hasNestedFees = data.some(
    (item) => Array.isArray(item?.fees) || Array.isArray(item?.items)
  );
  if (hasNestedFees) {
    return stripPlaceholders(
      data
        .map((cat) => ({
          id: cat?.id || randomId(),
          name: (cat?.name || "").toString(),
          fees: (cat?.fees || cat?.items || [])
            .map((fee) => ({
              id: fee?.id || randomId(),
              name: (fee?.name || "").toString(),
              amount:
                fee?.amount === 0 || fee?.amount ? String(fee.amount) : "",
            }))
            .filter((fee) => fee.name.trim()),
        }))
        .filter((cat) => cat.name.trim() || cat.fees.length)
    );
  }
  return stripPlaceholders(
    data
      .map((item) => {
        const feeName = (item?.name || "").toString();
        if (!feeName.trim()) return null;
        return {
          id: item?.id || randomId(),
          name: feeName,
          fees: [
            {
              id: randomId(),
              name: `${feeName} Fee`,
              amount:
                item?.amount === 0 || item?.amount ? String(item.amount) : "",
            },
          ],
        };
      })
      .filter(Boolean)
  );
};

const buildGroupNameMap = (groups = []) => {
  return (groups || []).reduce((acc, group) => {
    const code = group.code || group.group_code || group.groupName || "";
    const name = group.name || group.group_name || group.groupName || "";
    if (code) acc[code] = name || code;
    return acc;
  }, {});
};

const enrichCourseRecord = (course = {}, groupNameByCode = {}) => {
  const code = course.group_name || course.groupCode || course.group_code || "";
  return {
    ...course,
    groupCode: code,
    groupName: groupNameByCode[code] || code,
  };
};

export default function Setup() {
  const { tab: tabParam } = useParams();
  const tab = ["years", "groups", "subjects", "students"].includes(tabParam)
    ? tabParam
    : "years";

  const [yearForm, setYearForm] = useState({ name: "", category: "", active: true });
  const [academicYears, setAcademicYears] = useState([]);
  const [editingYearId, setEditingYearId] = useState("");

  const yearNameToId = useMemo(
    () => buildYearNameLookup(academicYears),
    [academicYears]
  );

  const resolveYearName = (yearId) => {
    if (!yearId) return "";
    const match = academicYears.find((y) => String(y.id) === String(yearId));
    return match?.name || "";
  };

  const addYear = async () => {
    if (!validateRequiredFields({ "Academic year name": yearForm.name }))
      return;
    try {
      if (editingYearId) {
        const updated = await api.updateAcademicYear?.(editingYearId, {
          name: yearForm.name,
          category: yearForm.category,
          active: yearForm.active,
        });
        if (updated) {
          setAcademicYears((prev) =>
            prev.map((y) => (y.id === editingYearId ? updated : y))
          );
        }
        setEditingYearId("");
      } else {
        const created = await api.addAcademicYear({
          name: yearForm.name,
          category: yearForm.category,
          active: yearForm.active,
        });
        if (created) {
          setAcademicYears((prev) => [...prev, created]);
        }
      }
    } catch (error) {
      console.error("Failed to save academic year", error);
      showToast(error?.message || "Failed to save academic year", {
        type: "danger",
      });
    }
    setYearForm({ name: "", active: true });
  };

  const editYear = (year) => {
    setYearForm({
      name: year.name,
      category: year.category || "",
      active: year.active
    });
    setEditingYearId(year.id);
  };

  const deleteYear = async (id) => {
    setAcademicYears((prev) => prev.filter((y) => y.id !== id));
    try {
      await api.deleteAcademicYear?.(id);
    } catch (error) {
      console.error("Failed to delete academic year", error);
      showToast(error?.message || "Failed to delete academic year", {
        type: "danger",
      });
    }
    if (editingYearId === id) {
      setYearForm({ name: "", category: "", active: true });
      setEditingYearId("");
    }
  };

  const cancelYearEdit = () => {
    setYearForm({ name: "", active: true });
    setEditingYearId("");
  };

  // Groups
  const [groups, setGroups] = useState([]);
  const groupNameByCode = useMemo(() => buildGroupNameMap(groups), [groups]);
  const [groupForm, setGroupForm] = useState({
    id: "",
    code: "",
    name: "",
    years: 0,
    semesters: 0,
  });

  const [editingGroupId, setEditingGroupId] = useState("");

  const saveGroup = async () => {
    if (
      !validateRequiredFields({
        "Group code": groupForm.code,
        "Group name": groupForm.name,
      })
    )
      return;

    const code = groupForm.code.toUpperCase();
    const payload = {
      code,
      name: groupForm.name,
      category: groupForm.category,
      years: Number(groupForm.years) || 0,
      semesters: Number(groupForm.semesters) || 0,
    };

    if (editingGroupId) {
      try {
        const updated = await api.updateGroup?.(editingGroupId, payload);
        if (updated) {
          setGroups((prev) =>
            prev.map((g) => (g.id === editingGroupId ? updated : g))
          );
          showToast("Updated successfully", {
            type: "success",
            title: "Group",
          });
        }
      } catch (error) {
        console.error("Error updating group:", error);
        showToast(error?.message || "Error updating group", {
          type: "danger",
        });
      }
      setEditingGroupId("");
    } else {
      if (groups.some((g) => g.code === code)) {
        showToast("Group code already exists.", {
          type: "danger",
          title: "Duplicate code",
        });
        return;
      }

      try {
        const created = await api.addGroup(payload);
        if (created) {
          setGroups((prev) => [...prev, created]);
          showToast("Group created Successfully", {
            type: "success",
            title: "Group",
          });
        }
      } catch (error) {
        console.error("Error adding group:", error);
        showToast(error?.message || "Error adding group", { type: "danger" });
      }
    }
    setGroupForm({
      id: "",
      category: "",
      code: "",
      name: "",
      years: 0,
      semesters: 0,
    });
  };
  const editGroup = (g) => {
    setGroupForm(g);
    setEditingGroupId(g.id);
  };

  const deleteGroup = async (id) => {
    setGroups((prev) => prev.filter((g) => g.id !== id));
    try {
      await api.deleteGroup?.(id);
      showToast("Group deleted successfully", {
        type: "success",
        title: "Group",
      });
    } catch (error) {
      console.error("Error deleting group:", error);
      showToast(error?.message || "Error deleting group", { type: "danger" });
    }
  };

  const cancelGroupEdit = () => {
    setGroupForm({
      id: "",
      category: "",
      code: "",
      name: "",
      years: 0,
      semesters: 0,
    });
    setEditingGroupId("");
  };

  // Courses
  const [courses, setCourses] = useState([]);
  const coursesWithNames = useMemo(
    () => courses.map((course) => enrichCourseRecord(course, groupNameByCode)),
    [courses, groupNameByCode]
  );
  const courseLookup = useMemo(() => buildCourseLookup(courses), [courses]);

  const [courseForm, setCourseForm] = useState({
    id: "",
    groupCode: "",
    groupName: "",
    courseCode: "",
    courseName: "",
    semesters: 6,
  });

  const [editingCourseId, setEditingCourseId] = useState("");

  // Semesters auto-generate
  const [semesters, setSemesters] = useState([]);
  useEffect(() => {
    const generated = courses.flatMap((course) => {
      const code = course.courseCode || course.code;
      const count = Number(course.semesters || 0);
      if (!code || !count) return [];
      return Array.from({ length: count }, (_, i) => ({
        id: `${code}-${i + 1}`,
        courseCode: code,
        number: i + 1,
      }));
    });
    setSemesters(generated);
  }, [courses]);

  const saveCourse = async () => {
    const {
      groupCode,
      courseCode,
      courseName,
      semesters: semCount,
    } = courseForm;

    if (
      !validateRequiredFields({
        "Group code": groupCode,
        "Course code": courseCode,
        "Course name": courseName,
        "Number of semesters": semCount,
      })
    )
      return;

    const code = courseCode.toUpperCase();

    const selectedGroup =
      groups.find((g) => (g.groupCode || g.code || g.group_code) === groupCode) ||
      groups.find((g) => (g.group_name || g.name) === courseForm.groupName);
    const groupNameValue =
      selectedGroup?.group_name ||
      selectedGroup?.name ||
      selectedGroup?.groupName ||
      courseForm.groupName ||
      groupNameByCode[groupCode] ||
      groupCode;

    const payload = {
      code,
      name: courseName,
      group_name: groupNameValue,
      semesters: Number(semCount) || 0,
    };

    if (editingCourseId) {
      try {
        const updated = await api.updateCourse?.(editingCourseId, payload);
        if (updated) {
          setCourses((prev) =>
            prev.map((c) => (c.id === editingCourseId ? updated : c))
          );
          showToast("Updated successfully", {
            type: "success",
            title: "Course",
          });
        }
      } catch (error) {
        console.error("Error updating course:", error);
        showToast(error?.message || "Error updating course", {
          type: "danger",
        });
      }
      setEditingCourseId("");
    } else {
      if (courses.some((c) => (c.courseCode || c.code) === code)) return;

      try {
        const created = await api.addCourse(payload);
        if (created) {
          setCourses((prev) => [...prev, created]);
          showToast("Course created Successfully", {
            type: "success",
            title: "Course",
          });
        }
      } catch (error) {
        console.error("Error adding course:", error);
        showToast(error?.message || "Error adding course", { type: "danger" });
      }
    }

    setCourseForm({
      id: "",
      groupCode: "",
      groupName: "",
      courseCode: "",
      courseName: "",
      semesters: 6,
    });
  };

  const editCourse = (c) => {
    setCourseForm({
      id: c.id,
      groupCode: c.groupCode || c.group_code || c.group_name || "",
      groupName: c.groupName || c.group_name || c.groupName || "",
      courseCode: c.courseCode || c.code || "",
      courseName: c.courseName || c.name || "",
      semesters: c.semesters ?? c.number_semesters ?? 6,
    });
    setEditingCourseId(c.id);
  };

  const deleteCourse = async (id) => {
    const course = courses.find((c) => c.id === id);
    setCourses(courses.filter((c) => c.id !== id));

    if (course) {
      const code = course.courseCode || course.code;
      setSemesters(semesters.filter((s) => s.courseCode !== code));
    }

    try {
      await api.deleteCourse?.(id);
      showToast("Course deleted successfully", {
        type: "success",
        title: "Course",
      });
    } catch (error) {
      console.error("Error deleting course:", error);
      showToast(error?.message || "Error deleting course", { type: "danger" });
    }
  };

  // Sub-categories
  const [categories, setCategories] = useState([]);
  const [categoryIdMap, setCategoryIdMap] = useState({});
  const categoryNameById = useMemo(
    () => invertMap(categoryIdMap),
    [categoryIdMap]
  );

  const [categoryName, setCategoryName] = useState("");
  const [categoryCredits, setCategoryCredits] = useState(0);
  const [editingCategory, setEditingCategory] = useState("");
  const [categoryCreditsMap, setCategoryCreditsMap] = useState({});
  const [catItems, setCatItems] = useState({});

  const [feeCategories, setFeeCategories] = useState([]);
  const [feeCategoryName, setFeeCategoryName] = useState("");
  const [editingFeeCategoryId, setEditingFeeCategoryId] = useState("");
  const [feeDrafts, setFeeDrafts] = useState({});

  const [students, setStudents] = useState([]);

  const persistFeeCategoryList = async (list) => {
    try {
      await api.setFeeTypes?.(list);
    } catch (error) {
      console.error("Failed to save fee categories", error);
      showToast(error?.message || "Failed to save fee categories", {
        type: "danger",
      });
    }
  };

  // Initial loading
  useEffect(() => {
    (async () => {
      try {
        const [yrs, grps, crs, ft, subcats, subs, studs] = await Promise.all([
          api.listAcademicYears?.() || [],
          api.listGroups?.() || [],
          api.listCourses?.() || [],
          api.getFeeTypes?.() || [],
          api.listSubCategories?.() || [],
          api.listSubjects?.() || [],
          api.listStudents?.() || [],
        ]);

        if (yrs.length) setAcademicYears(yrs);
        if (grps.length) setGroups(grps);
        if (crs.length) setCourses(crs);

        if (ft) {
          const normalized = normalizeFeeCategories(ft);
          setFeeCategories(normalized);
        }

        const catNameByIdInit = {};

        if (subcats.length) {
          const names = [];
          const itemsMap = {};
          const idMap = {};
          const creditsMap = {};

          subcats.forEach((cat) => {
            names.push(cat.name);
            idMap[cat.name] = cat.id;
            creditsMap[cat.name] = cat.credits || 0;
            itemsMap[cat.name] = subjectsToItems(cat.subjects);
            if (cat.id) catNameByIdInit[cat.id] = cat.name;
          });

          setCategories(names);
          setCatItems(itemsMap);
          setCategoryIdMap(idMap);
          setCategoryCreditsMap(creditsMap);
        } else {
          setCategories([]);
          setCatItems({});
          setCategoryIdMap({});
          setCategoryCreditsMap({});
        }

        const initialSubjectContext = {
          courseLookup: buildCourseLookup(crs),
          categoryNameById: catNameByIdInit,
          yearNameToId: buildYearNameLookup(yrs),
        };

        if (subs?.length) {
          setSubjects(
            subs.map((rec) =>
              ensureSubjectBatchKey(
                normalizeSubjectRecord(rec, initialSubjectContext)
              )
            )
          );
        } else {
          setSubjects([]);
        }

        if (studs?.length) {
          setStudents(studs);
        } else {
          setStudents([]);
        }
      } catch (error) {
        console.error("Failed to load setup data", error);
        showToast(error?.message || "Failed to load setup data", {
          type: "danger",
        });
      }
    })();
  }, []);
  const saveFeeCategory = async () => {
    const trimmed = feeCategoryName.trim();
    if (!trimmed) {
      showToast("Enter a fee category name.", {
        type: "warning",
        title: "Required field",
      });
      return;
    }

    const duplicate = feeCategories.some(
      (cat) =>
        cat.name.trim().toLowerCase() === trimmed.toLowerCase() &&
        cat.id !== editingFeeCategoryId
    );

    if (duplicate) {
      showToast("That fee category already exists.", {
        type: "danger",
        title: "Duplicate entry",
      });
      return;
    }

    let next = [];
    if (editingFeeCategoryId) {
      next = feeCategories.map((cat) =>
        cat.id === editingFeeCategoryId ? { ...cat, name: trimmed } : cat
      );
    } else {
      next = [...feeCategories, { id: randomId(), name: trimmed, fees: [] }];
    }

    setFeeCategories(next);

    try {
      await persistFeeCategoryList(next);
      showToast(
        editingFeeCategoryId ? "Fee category updated." : "Fee category added.",
        { type: "success" }
      );
      setFeeCategoryName("");
      setEditingFeeCategoryId("");
    } catch (error) {
      console.error("Failed to save fee category", error);
      showToast("Unable to save fee category.", { type: "danger" });
    }
  };

  const editFeeCategory = (cat) => {
    setFeeCategoryName(cat.name);
    setEditingFeeCategoryId(cat.id);
  };

  const deleteFeeCategory = async (id) => {
    const next = feeCategories.filter((cat) => cat.id !== id);
    setFeeCategories(next);

    try {
      await persistFeeCategoryList(next);
      setFeeDrafts((prev) => deleteKey(prev, id));

      if (editingFeeCategoryId === id) {
        setFeeCategoryName("");
        setEditingFeeCategoryId("");
      }

      showToast("Fee category deleted.", { type: "info" });
    } catch (error) {
      console.error("Failed to delete fee category", error);
      showToast("Unable to delete fee category.", { type: "danger" });
    }
  };

  // Sub-category (subjects) create/update/delete handlers
  const saveCategory = async () => {
    const trimmed = (categoryName || "").trim();
    if (!trimmed) {
      showToast("Enter a sub-category name.", {
        type: "warning",
        title: "Required field",
      });
      return;
    }

    // If editingCategory is set, it holds the existing category name (not id)
    if (editingCategory) {
      const oldName = editingCategory;
      const id = categoryIdMap[oldName];
      if (!id) {
        showToast("Unable to locate the category to update.", {
          type: "danger",
        });
        return;
      }
      const items = itemsToNames(catItems[oldName] || []);
      try {
        const updated = await api.updateSubCategory?.(id, {
          name: trimmed,
          credits: categoryCredits,
          subjects: items,
        });
        // update local maps
        setCategories((prev) =>
          prev.map((n) => (n === oldName ? updated.name : n))
        );
        setCatItems((prev) => {
          const copy = { ...prev };
          copy[updated.name] = subjectsToItems(updated.subjects || []);
          if (oldName !== updated.name) delete copy[oldName];
          return copy;
        });
        setCategoryIdMap((prev) => {
          const copy = { ...prev };
          if (oldName !== updated.name) delete copy[oldName];
          copy[updated.name] = updated.id;
          return copy;
        });
        setCategoryCreditsMap((prev) => {
          const copy = { ...prev };
          if (oldName !== updated.name) delete copy[oldName];
          copy[updated.name] = updated.credits;
          return copy;
        });
        setCategoryName("");
        setCategoryCredits(0);
        setEditingCategory("");
        showToast("Sub-category updated.", { type: "success" });
      } catch (error) {
        console.error("Failed to update sub-category", error);
        showToast(error?.message || "Unable to update sub-category.", {
          type: "danger",
        });
      }
    } else {
      try {
        const created = await api.addSubCategory?.({
          name: trimmed,
          credits: categoryCredits,
        });
        if (created) {
          setCategories((prev) => [...prev, created.name]);
          setCatItems((prev) => ({
            ...prev,
            [created.name]: subjectsToItems(created.subjects || []),
          }));
          setCategoryIdMap((prev) => ({ ...prev, [created.name]: created.id }));
          setCategoryCreditsMap((prev) => ({
            ...prev,
            [created.name]: created.credits,
          }));
          setCategoryName("");
          setCategoryCredits(0);
          showToast("Sub-category added.", { type: "success" });
        }
      } catch (error) {
        console.error("Failed to add sub-category", error);
        showToast(error?.message || "Unable to add sub-category.", {
          type: "danger",
        });
      }
    }
  };

  const deleteCategory = async (name) => {
    if (!name) return;
    const id = categoryIdMap[name];
    // optimistic UI update
    setCategories((prev) => prev.filter((n) => n !== name));
    setCatItems((prev) => {
      const copy = { ...prev };
      delete copy[name];
      return copy;
    });
    setCategoryCreditsMap((prev) => {
      const copy = { ...prev };
      delete copy[name];
      return copy;
    });
    setCategoryIdMap((prev) => {
      const copy = { ...prev };
      delete copy[name];
      return copy;
    });
    try {
      if (id) await api.deleteSubCategory?.(id);
      showToast("Sub-category deleted.", { type: "info" });
    } catch (error) {
      console.error("Failed to delete sub-category", error);
      showToast("Unable to delete sub-category.", { type: "danger" });
    }
  };

  const updateFeeDraft = (catId, field, value) => {
    setFeeDrafts((prev) => ({
      ...prev,
      [catId]: { ...prev[catId], [field]: value },
    }));
  };

  // Languages
  const [languages, setLanguages] = useState([]);
  const [langCount, setLangCount] = useState(0);
  const [langInputs, setLangInputs] = useState([]);

  const prepareLangInputs = (n) => {
    const count = Math.max(0, Number(n) || 0);
    setLangCount(count);
    setLangInputs(Array.from({ length: count }, (_, i) => langInputs[i] || ""));
  };

  const saveLanguages = () => {
    const newOnes = langInputs
      .filter(Boolean)
      .map((name) => ({ id: uid(), name }));

    if (newOnes.length) setLanguages([...languages, ...newOnes]);

    setLangCount(0);
    setLangInputs([]);
  };

  const editLanguage = (id, name) =>
    setLanguages(languages.map((l) => (l.id === id ? { ...l, name } : l)));

  const deleteLanguage = (id) =>
    setLanguages(languages.filter((l) => l.id !== id));

  // SUBJECTS
  const subjectContext = useMemo(
    () => ({
      courseLookup,
      categoryNameById,
      yearNameToId,
    }),
    [courseLookup, categoryNameById, yearNameToId]
  );

  const loadSubjects = useCallback(async () => {
    try {
      const rows = (await api.listSubjects?.()) || [];
      setSubjects(
        rows.map((rec) =>
          ensureSubjectBatchKey(normalizeSubjectRecord(rec, subjectContext))
        )
      );
    } catch (error) {
      console.error("Failed to reload subjects", error);
    }
  }, [subjectContext]);

  const [subjects, setSubjects] = useState([]);
  const [pendingSubjects, setPendingSubjects] = useState([]);
  const [subjectIdsToDelete, setSubjectIdsToDelete] = useState([]);
  const [subjectEditBackup, setSubjectEditBackup] = useState([]);
  const [subjectForm, setSubjectForm] = useState(() => buildSubjectForm(""));

  useEffect(() => {
    setSubjectForm((prev) => {
      if (!categories.length) {
        return prev.category ? { ...prev, category: "" } : prev;
      }
      if (categories.includes(prev.category)) return prev;
      return { ...prev, category: categories[0] };
    });
  }, [categories]);

  const [editingSubjectId, setEditingSubjectId] = useState("");
  const [editingBatchId, setEditingBatchId] = useState("");

  const selectedGroupName = groupNameByCode[subjectForm.groupCode] || "";
  const coursesForGroup = courses.filter((c) => {
    if (!subjectForm.groupCode) return false;
    const groupNameValue =
      c.groupName ||
      c.group_name ||
      groupNameByCode[c.groupCode] ||
      groupNameByCode[c.group_code] ||
      "";
    return groupNameValue && groupNameValue === selectedGroupName;
  });

  const semForCourse = semesters.filter(
    (s) => s.courseCode === subjectForm.courseCode
  );

  const saveSubject = () => {
    const {
      academicYearId,
      groupCode,
      courseCode,
      semester,
      category,
      subjectName,
      extraSubjectNames = [],
      extraSubjectCodes = [],
      subjectCode,
      subjectSelections = [],
      feeCategory,
      feeAmount,
    } = subjectForm;

    const selectedNames = Array.isArray(subjectSelections)
      ? subjectSelections
      : [];

    const hasSelection = selectedNames.length > 0;

    const manualEntries = [
      {
        name: subjectName,
        code: subjectCode,
      },
      ...(Array.isArray(extraSubjectNames)
        ? extraSubjectNames.map((name, idx) => ({
          name,
          code:
            Array.isArray(extraSubjectCodes) && idx < extraSubjectCodes.length
              ? extraSubjectCodes[idx]
              : "",
        }))
        : []),
    ]
      .map((entry) => ({
        name: (entry.name || "").trim(),
        code: (entry.code || "").trim(),
      }))
      .filter((entry) => entry.name);

    if (
      !academicYearId ||
      !groupCode ||
      !courseCode ||
      !semester ||
      !category
    ) {
      showToast(
        "Fill in academic year, group, course, semester and sub-category before adding a subject.",
        { type: "warning", title: "Missing details" }
      );
      return;
    }

    if (hasSelection && !subjectCode?.trim()) {
      showToast("Enter a subject code for your selected subject(s).", {
        type: "warning",
        title: "Subject code required",
      });
      return;
    }

    if (!hasSelection && manualEntries.some((entry) => !entry.code)) {
      showToast("Enter a subject code for every typed subject.", {
        type: "warning",
        title: "Subject code required",
      });
      return;
    }

    if (!hasSelection && manualEntries.length === 0) {
      showToast("Enter at least one subject name.", {
        type: "warning",
        title: "Subject name required",
      });
      return;
    }

    const names = hasSelection
      ? selectedNames
      : manualEntries.map((entry) => entry.name);
    const codes = hasSelection
      ? Array(names.length).fill(subjectCode.trim())
      : manualEntries.map((entry) => entry.code);

    const academicYearName = resolveYearName(academicYearId);
    const categoryId = categoryIdMap[category] || "";
    const courseMeta = courses.find(
      (c) => c.courseCode === courseCode || c.code === courseCode
    );
    const courseName = courseMeta?.courseName || courseCode;

    try {
      console.log("Starting to save subjects...");

      const newEntries = names.map((name, idx) => ({
        id: editingSubjectId || randomId(),
        subjectId: editingSubjectId || randomId(),
        batchId: editingBatchId || randomId(),
        academicYearId,
        academicYearName,
        groupCode,
        courseCode,
        courseName,
        semester: Number(semester),
        category,
        categoryId,
        subjectCode: codes[idx] || "",
        subjectName: name,
        feeCategory: feeCategory || null,
        feeAmount: feeAmount ? Number(feeAmount) : null,
      }));

      setPendingSubjects((prev) => {
        if (editingSubjectId) {
          return [
            ...prev.filter(
              (s) =>
                s.id !== editingSubjectId &&
                s.id !== editingSubjectId.toString()
            ),
            ...newEntries,
          ];
        }
        return [...prev, ...newEntries];
      });

      showToast(
        `${names.length} subject${names.length === 1 ? "" : "s"} added to pending list. Click 'Submit All' to save to database.`,
        { type: "info" }
      );

      setSubjectForm({
        ...subjectForm,
        subjectName: "",
        subjectCode: "",
        extraSubjectNames: [],
        extraSubjectCodes: [],
        subjectSelections: [],
        feeCategory: "",
        feeAmount: "",
      });

      if (editingSubjectId) {
        setEditingSubjectId("");
        setEditingBatchId("");
        setSubjectEditBackup([]);
      }
    } catch (error) {
      console.error("Error preparing subjects:", error);

      let errorMessage = "Failed to prepare subjects. Please try again.";
      if (error?.message) {
        errorMessage = error.message;
      }

      showToast(errorMessage, {
        type: "danger",
        title: "Error",
      });
    }
  };

  // 🔥🔥🔥 IMPORTANT — PATCHED FUNCTION BELOW 🔥🔥🔥
  const editPendingSubject = (rec) => {
    const batchRef = buildSubjectBatchKey(rec);

    setPendingSubjects((prev) =>
      prev.filter((s) => buildSubjectBatchKey(s) !== batchRef)
    );

    const options = catItems[rec.category] || [];
    const courseMeta =
      courseLookup[rec.courseCode] ||
      courseLookup[rec.courseName] ||
      courseLookup[rec.course_name] ||
      {};
    const resolvedGroupCode =
      rec.groupCode ||
      rec.group_code ||
      courseMeta.groupCode ||
      courseMeta.group_code ||
      "";
    const resolvedCourseCode =
      rec.courseCode ||
      rec.course_code ||
      courseMeta.courseCode ||
      courseMeta.course_code ||
      rec.courseName ||
      rec.course_name ||
      "";
    const resolvedCourseName =
      courseMeta.courseName ||
      courseMeta.course_name ||
      rec.courseName ||
      rec.course_name ||
      resolvedCourseCode;

    const names = rec.subjectNames?.length
      ? rec.subjectNames
      : [rec.subjectName].filter(Boolean);
    const codes =
      rec.subjectCodes?.length
        ? rec.subjectCodes
        : rec.subjectCode
          ? [rec.subjectCode]
          : [];
    const primaryCode = codes[0] || (rec.subjectCode || "");

    const allPreset =
      names.length > 0 &&
      names.every((name) => options.some((item) => item.name === name));

    // 🟢 FIXED: Always restore correct valid categoryId
    const fixedCategoryId =
      categoryIdMap[rec.category] || rec.categoryId || rec.category_id || "";

    setSubjectForm({
      ...rec,
      groupCode: resolvedGroupCode,
      courseCode: resolvedCourseCode,
      courseName: resolvedCourseName,
      categoryId: fixedCategoryId,
      semester:
        rec.semester === undefined || rec.semester === null
          ? ""
          : rec.semester.toString(),
      feeCategory: rec.feeCategory || "",
      feeAmount: rec.feeAmount?.toString() || "",
      subjectCode: primaryCode,
      subjectName: allPreset ? "" : names[0] || "",
      extraSubjectNames: allPreset ? [] : names.slice(1),
      extraSubjectCodes: allPreset
        ? []
        : names.slice(1).map((_, idx) => codes[idx + 1] || primaryCode),
      subjectSelections: allPreset ? names : [],
    });

    setEditingSubjectId(rec.subjectId || rec.id || "");
    setEditingBatchId(batchRef || "");
  };
  const submitPendingSubjects = async () => {
    if (!pendingSubjects.length) {
      showToast("No pending subjects to save.", { type: "warning" });
      return;
    }

    try {
      showToast("Saving subjects to database...", { type: "info" });

      if (subjectIdsToDelete.length) {
        try {
          await Promise.all(
            subjectIdsToDelete.map((id) =>
              api.deleteSubject?.(Number(id))
            )
          );
          setSubjectIdsToDelete([]);
        } catch (error) {
          console.error("Failed to delete subject(s) before update", error);
          throw error;
        }
      }

      const payload = [];

      // Process each pending subject
      for (const item of pendingSubjects) {
        const academicYearName = item.academicYearName || resolveYearName(item.academicYearId);
        const courseMeta = courseLookup[item.courseCode] || courseLookup[item.courseName] || {};
        const categoryId = item.categoryId || categoryIdMap[item.category] || null;
        const courseCodeValue = courseMeta.courseCode || item.courseCode || item.courseName || null;

        // Handle main subject
        if (item.subjectName && item.subjectCode) {
          const subjectData = {
            academic_year: academicYearName,
            course_name: courseCodeValue,
            semester_number: item.semester ? Number(item.semester) : null,
            category_id: categoryId,
            subject_code: item.subjectCode,
            subject_name: item.subjectName,
            amount: item.feeAmount ? Number(item.feeAmount) : null,
            fees_categories: null,
            created_at: new Date().toISOString()
          };

          // Only add if all required fields are present
          if (subjectData.subject_code && subjectData.subject_name) {
            payload.push(subjectData);
          }
        }

        // Handle extra subjects
        const extraNames = item.extraSubjectNames || [];
        const extraCodes = item.extraSubjectCodes || [];

        for (let i = 0; i < Math.max(extraNames.length, extraCodes.length); i++) {
          const name = extraNames[i];
          const code = extraCodes[i] || '';

          if (name) {
            payload.push({
              academic_year: academicYearName,
              course_name: courseCodeValue,
              semester_number: item.semester ? Number(item.semester) : null,
              category_id: categoryId,
              subject_code: code,
              subject_name: name,
              amount: item.feeAmount ? Number(item.feeAmount) : null,
              fees_categories: null,
              created_at: new Date().toISOString()
            });
          }
        }
      }

      // Check for duplicate subjects before saving
      const existingSubjects = await api.listSubjects?.() || [];
      const existingSubjectKeys = new Set(
        existingSubjects.map(sub =>
          `${sub.academic_year}|${sub.course_name}|${sub.semester_number}|${sub.subject_code}`.toLowerCase()
        )
      );

      // Filter out duplicates and validate required fields
      const newSubjects = payload.filter(subject => {
        // Check for required fields
        if (!subject.subject_code || !subject.subject_name) {
          console.warn('Skipping subject with missing required fields:', subject);
          return false;
        }

        const key = `${subject.academic_year}|${subject.course_name}|${subject.semester_number}|${subject.subject_code}`.toLowerCase();
        const isNew = !existingSubjectKeys.has(key);

        if (!isNew) {
          console.log('Skipping duplicate subject:', key);
        }

        return isNew;
      });

      if (newSubjects.length === 0) {
        showToast("All subjects already exist in the database.", {
          type: "warning",
          title: "No new subjects to add"
        });
        return;
      }

      // Insert new subjects in batches to avoid hitting any request size limits
      const BATCH_SIZE = 50;
      for (let i = 0; i < newSubjects.length; i += BATCH_SIZE) {
        const batch = newSubjects.slice(i, i + BATCH_SIZE);
        try {
          await api.addSubjects?.(batch);
        } catch (error) {
          console.error("Error adding subjects batch:", error);
          throw error; // Re-throw to be caught by the outer try-catch
        }
      }

      // Clear pending subjects and refresh the list
      setPendingSubjects([]);
      await loadSubjects();

      showToast(`Successfully added ${newSubjects.length} subject(s) to the database.`, {
        type: "success"
      });

      // Reset the form
      setSubjectForm({
        academicYearId: "",
        academicYearName: "",
        groupCode: "",
        courseCode: "",
        courseName: "",
        semester: "",
        category: "",
        categoryId: "",
        subjectName: "",
        subjectCode: "",
        extraSubjectNames: [],
        extraSubjectCodes: [],
        subjectSelections: [],
        feeAmount: "",
      });
      setEditingSubjectId("");
      setEditingBatchId("");
    } catch (error) {
      console.error("Failed to save subjects", error);
      showToast(error?.message || "Failed to save subjects. Please try again.", {
        type: "danger"
      });
    }
  };

  const editSubject = async (rec) => {
    const batchRef = buildSubjectBatchKey(rec);
    const snapshot = (rec.subjectRecords || [rec]).filter(Boolean);
    if (snapshot.length) {
      setSubjectEditBackup(snapshot);
    }
    const ids = (rec.subjectIds || []).filter(Boolean);
    if (ids.length) {
      setSubjectIdsToDelete(ids);
    }

    setSubjects((prev) =>
      prev.filter((s) => buildSubjectBatchKey(s) !== batchRef)
    );

    editPendingSubject(rec);
  };

  const deletePendingSubject = (item) => {
    const batchRef = buildSubjectBatchKey(item);

    setPendingSubjects((prev) =>
      prev.filter((s) => buildSubjectBatchKey(s) !== batchRef)
    );

    if (editingSubjectId === (item.subjectId || item.id)) {
      setSubjectForm(buildSubjectForm(categories[0] || ""));
      setEditingSubjectId("");
    }

    if (editingBatchId === batchRef) {
      setSubjectForm(buildSubjectForm(categories[0] || ""));
      setEditingBatchId("");
    }
  };

  const deleteSubject = async (group) => {
    const batchRef = buildSubjectBatchKey(group);

    const ids = (
      group.subjectIds?.length
        ? group.subjectIds
        : [group.subjectId || group.id]
    ).filter(Boolean);

    setSubjects((prev) =>
      prev.filter((s) => buildSubjectBatchKey(s) !== batchRef)
    );

    try {
      const numericIds = ids
        .map((id) => Number(id))
        .filter((n) => Number.isFinite(n));
      if (numericIds.length) {
        await Promise.all(numericIds.map((id) => api.deleteSubject?.(id)));
      }
      showToast("Subject entries deleted.", { type: "info" });
    } catch (error) {
      console.error("Failed to delete subject", error);
      showToast("Unable to delete subject.", { type: "danger" });
    }
  };

  const cancelSubjectEdit = () => {
    if (subjectEditBackup.length) {
      setSubjects((prev) => [...subjectEditBackup, ...prev]);
      setSubjectEditBackup([]);
    }
    setEditingSubjectId("");
    setEditingBatchId("");
    setSubjectForm(buildSubjectForm(categories[0] || ""));
    setSubjectIdsToDelete([]);
  };

  const heroStats = [
    {
      key: "years",
      label: "Academic Years",
      value: academicYears.length || 0,
      meta: "records",
      route: "/admin/setup/years",
    },
    {
      key: "groups",
      label: "Groups",
      value: groups.length || 0,
      meta: "active",
      route: "/admin/setup/groups",
    },
    {
      key: "courses",
      label: "Courses",
      value: courses.length || 0,
      meta: "active",
      route: "/admin/setup/groups",
    },
    {
      key: "students",
      label: "Students",
      value: students.length || 0,
      meta: "records",
      route: "/admin/students",
    },
  ];

  const heroTagline = "Manage programme structures and duration.";

  return (
    <AdminShell>
      <div className="desktop-container">
        <h2 className="fw-bold mb-3">Admin Setup</h2>

        <section className="setup-hero mb-4">
          <div className="setup-hero-grid">
            <div className="setup-hero-copywrap">
              <div className="setup-hero-crest">
                <img src={crestPrimary} alt="Vijayam crest" />
              </div>

              <h3 className="setup-hero-title mb-2">
                Vijayam Arts & Science College
              </h3>

              <p className="setup-hero-copy mb-3">{heroTagline}</p>

              <div className="setup-hero-chips d-flex flex-wrap gap-2">
                <span className="setup-hero-chip">
                  SMART EXAMINATION PLATFORM
                </span>
              </div>

              <p className="setup-hero-eyebrow text-uppercase mt-3">
                Administration · Setup Console
              </p>
            </div>

            <div className="setup-stat-grid">
              {heroStats.map((stat) => (
                <Link
                  key={stat.key}
                  to={stat.route}
                  className="setup-stat-card"
                >
                  <div className="setup-stat-label">{stat.label}</div>
                  <div className="setup-stat-value">{stat.value}</div>
                  <div className="setup-stat-meta">{stat.meta}</div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <nav className="setup-tab-nav d-flex flex-wrap gap-2 mb-4">
          {TAB_CONFIG.map((cfg) => (
            <Link
              key={cfg.key}
              to={`/admin/setup/${cfg.key}`}
              className={`setup-tab-pill ${tab === cfg.key ? "active" : ""}`}
            >
              <div className="setup-pill-label">{cfg.label}</div>
              <div className="setup-pill-meta">{cfg.tagline}</div>
            </Link>
          ))}
        </nav>

        {tab === "years" && (
          <AcademicYearsSection
            yearForm={yearForm}
            setYearForm={setYearForm}
            academicYears={academicYears}
            editingYearId={editingYearId}
            addYear={addYear}
            editYear={editYear}
            deleteYear={deleteYear}
            onCancelEdit={cancelYearEdit}
          />
        )}

        {tab === "groups" && (
          <GroupsCoursesSection
            groupForm={groupForm}
            setGroupForm={setGroupForm}
            editingGroupId={editingGroupId}
            setEditingGroupId={setEditingGroupId}
            groups={groups}
            saveGroup={saveGroup}
            editGroup={editGroup}
            deleteGroup={deleteGroup}
            courseForm={courseForm}
            setCourseForm={setCourseForm}
            editingCourseId={editingCourseId}
            setEditingCourseId={setEditingCourseId}
            courses={coursesWithNames}
            saveCourse={saveCourse}
            editCourse={editCourse}
            deleteCourse={deleteCourse}
          />
        )}

        {tab === "subjects" && (
          <SubjectsSection
            subjectForm={subjectForm}
            setSubjectForm={setSubjectForm}
            academicYears={academicYears}
            groups={groups}
            coursesForGroup={coursesForGroup}
            semForCourse={semForCourse}
            categories={categories}
            setCategories={setCategories}
            catItems={catItems}
            setCatItems={setCatItems}
            categoryName={categoryName}
            setCategoryName={setCategoryName}
            categoryCredits={categoryCredits}
            setCategoryCredits={setCategoryCredits}
            categoryCreditsMap={categoryCreditsMap}
            editingCategory={editingCategory}
            setEditingCategory={setEditingCategory}
            deleteCategory={deleteCategory}
            saveCategory={saveCategory}
            pendingSubjects={pendingSubjects}
            subjects={subjects}
            editingSubjectId={editingSubjectId}
            saveSubject={saveSubject}
            submitPendingSubjects={submitPendingSubjects}
            editPendingSubject={editPendingSubject}
            deletePendingSubject={deletePendingSubject}
            editSubject={editSubject}
            deleteSubject={deleteSubject}
            onCancelSubjectEdit={cancelSubjectEdit}
          />
        )}
      </div>
    </AdminShell>
  );
}
