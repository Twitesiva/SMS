import AdminShell from "../components/AdminShell";
import ConfirmationModal from '../components/ConfirmationModal.jsx';
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/mockApi";
import { supabase } from "../../supabaseClient";
import { validateRequiredFields } from "../lib/validation";
import { showToast } from "../store/ui";
import { useAuth } from "../store/auth";
import { logActivity } from "../lib/logger";

export default function FeesGeneration() {
  const { user } = useAuth();
  const [years, setYears] = useState([]);
  const [groups, setGroups] = useState([]);
  const [courses, setCourses] = useState([]);

  const [filteredYears, setFilteredYears] = useState([]);
  const [filteredGroups, setFilteredGroups] = useState([]);
  const [filteredCourses, setFilteredCourses] = useState([]);

  const [subjects, setSubjects] = useState([]);
  const [amounts, setAmounts] = useState({});

  const [subjectFees, setSubjectFees] = useState([]);
  const [editingSubjectId, setEditingSubjectId] = useState(null);

  const [feeCats, setFeeCats] = useState([]);
  const [feeCategoryName, setFeeCategoryName] = useState("");
  const [editingFeeCategoryId, setEditingFeeCategoryId] = useState(null);
  const [categoryFees, setCategoryFees] = useState([]);
  const [editingCategoryEntryKey, setEditingCategoryEntryKey] = useState(null);

  const [form, setForm] = useState({
    category: "",
    year: "",
    group: "",
    courseCode: "",
    semester: "",
  });

  const [selectedCategories, setSelectedCategories] = useState([]);
  const [categoryAmounts, setCategoryAmounts] = useState({});
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef(null);

  const [appliedFilter, setAppliedFilter] = useState(null);
  const [confirmModalState, setConfirmModalState] = useState({ isOpen: false, type: null, payload: null, isLoading: false });

  const normalizeCategory = (value) => (value || "").trim().toLowerCase();

  const categoryOptions = useMemo(() => {
    const seen = new Map();
    const sources = [...groups, ...years];
    sources.forEach((entry) => {
      const category =
        (entry.category || entry.Category || entry.category_name || entry.categoryName || "")
          .trim();
      if (!category) return;
      const key = category.toUpperCase();
      if (!seen.has(key)) {
        seen.set(key, category);
      }
    });
    const order = { UG: 0, PG: 1 };
    return Array.from(seen.entries())
      .sort(([aKey, aValue], [bKey, bValue]) => {
        const orderA = order[aKey] ?? 99;
        const orderB = order[bKey] ?? 99;
        if (orderA !== orderB) return orderA - orderB;
        return aValue.localeCompare(bValue);
      })
      .map(([, value]) => value);
  }, [groups, years]);

  const filteredFeeCategories = feeCats;

  const [supplementaryFees, setSupplementaryFees] = useState([]);
  const [paper1, setPaper1] = useState("");
  const [paper2, setPaper2] = useState("");
  const [paper3Plus, setPaper3Plus] = useState("");
  const [editingFeeId, setEditingFeeId] = useState(null);
  const [fineAmount, setFineAmount] = useState("");
  const [editingFineId, setEditingFineId] = useState(null);
  const [fineAmounts, setFineAmounts] = useState([]);
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState("");
  const [lastDate, setLastDate] = useState("");
  const [editingDeadlineId, setEditingDeadlineId] = useState(null);
  const [examDeadlines, setExamDeadlines] = useState([]);
  const [showAllFeeCategories, setShowAllFeeCategories] = useState(false);
  const [showAllExamDeadlines, setShowAllExamDeadlines] = useState(false);
  const canSubmitSupplementary = editingFeeId || supplementaryFees.length === 0;

  const matchingCategoriesCount = filteredFeeCategories.length;
  const storedStructuresCount = categoryFees.length;
  const outstandingSupplementaryCount = supplementaryFees.length;
  const fullyConfiguredStructures = useMemo(
    () =>
      categoryFees.filter((entry) => Number(entry.amount || 0) > 0).length,
    [categoryFees]
  );
  const departmentHeroStats = [
    {
      label: "Matching categories",
      value: matchingCategoriesCount,
      meta: appliedFilter ? "Filters active" : "All categories",
    },
    {
      label: "Visible rows",
      value: storedStructuresCount,
      meta: "Display limit All",
    },
    {
      label: "Outstanding balances",
      value: outstandingSupplementaryCount,
      meta: "Needs attention",
    },
    {
      label: "Fully configured",
      value: fullyConfiguredStructures,
      meta: "Registration settled",
    },
  ];

  const categoryFilterValue = normalizeCategory(form.category);

  // ---------------- LOAD MASTER DATA ----------------
  useEffect(() => {
    const load = async () => {
      const [ys, gs, cs] = await Promise.all([
        api.listAcademicYears(),
        api.listGroups(),
        api.listCourses(),
      ]);
      const activeYears = (ys || []).filter((y) => y?.active !== false);
      setYears(activeYears);
      setFilteredYears(activeYears);
      setGroups(gs || []);
      setFilteredGroups(gs || []); // initial load, keep as all groups
      setCourses(cs || []);
      setFilteredCourses(cs || []);
    };
    load();
  }, []);

  useEffect(() => {
    const normalizeGroupCategory = (group) =>
      normalizeCategory(group.category || group.Category);

    const computeNextYears = () => {
      if (!categoryFilterValue) return years;
      return years.filter(
        (year) => normalizeCategory(year.category) === categoryFilterValue
      );
    };

    const computeNextGroups = () => {
      if (!categoryFilterValue) return groups;
      return groups.filter(
        (group) => normalizeGroupCategory(group) === categoryFilterValue
      );
    };

    const nextYears = computeNextYears();
    const nextGroups = computeNextGroups();

    const categoriesGroupCodes = new Set(
      nextGroups
        .map((group) => group.group_code || group.code || group.groupCode)
        .filter(Boolean)
        .map((code) => String(code))
    );

    const selectedGroup = nextGroups.find((group) =>
      [group.code, group.group_code, group.groupCode]
        .map((code) => String(code || ""))
        .includes(String(form.group))
    );

    const filterCoursesByGroup = (targetGroup) => {
      if (!targetGroup) return [];
      const groupCode = targetGroup.code || targetGroup.group_code || targetGroup.groupCode;
      const groupNames = [targetGroup.name, targetGroup.group_name, targetGroup.groupName]
        .filter(Boolean)
        .map((value) => String(value));

      return courses.filter((course) => {
        if (!groupCode) return false;
        if (course.group_code === groupCode || course.groupCode === groupCode) return true;
        if (course.group_name && groupNames.includes(String(course.group_name))) return true;
        if (course.groupName && groupNames.includes(String(course.groupName))) return true;
        return false;
      });
    };

    const nextCourses =
      selectedGroup !== undefined
        ? filterCoursesByGroup(selectedGroup)
        : categoryFilterValue
          ? courses.filter(
            (course) =>
              categoriesGroupCodes.has(String(course.group_code || "")) ||
              categoriesGroupCodes.has(String(course.groupCode || ""))
          )
          : courses;

    setFilteredYears(nextYears);
    setFilteredGroups(nextGroups);
    setFilteredCourses(nextCourses);

    if (
      form.year &&
      !nextYears.some(
        (year) =>
          String(year.academic_year) === String(form.year) ||
          String(year.name) === String(form.year)
      )
    ) {
      setForm((prev) => ({ ...prev, year: "" }));
    }
    if (
      form.group &&
      !nextGroups.some(
        (group) =>
          String(group.code) === String(form.group) ||
          String(group.group_code) === String(form.group) ||
          String(group.groupCode) === String(form.group)
      )
    ) {
      setForm((prev) => ({ ...prev, group: "", courseCode: "" }));
    }
    if (
      form.courseCode &&
      !nextCourses.some(
        (course) =>
          String(course.code) === String(form.courseCode) || String(course.courseCode) === String(form.courseCode)
      )
    ) {
      setForm((prev) => ({ ...prev, courseCode: "" }));
    }
  }, [
    categoryFilterValue,
    years,
    groups,
    courses,
    form.year,
    form.group,
    form.courseCode,
  ]);

  useEffect(() => {
    const updates = {};
    if (!form.year && (form.group || form.courseCode || form.semester)) {
      updates.group = "";
      updates.courseCode = "";
      updates.semester = "";
    } else if (!form.group && (form.courseCode || form.semester)) {
      updates.courseCode = "";
      updates.semester = "";
    } else if (!form.courseCode && form.semester) {
      updates.semester = "";
    }

    if (Object.keys(updates).length) {
      setForm((prev) => ({ ...prev, ...updates }));
    }
  }, [form.year, form.group, form.courseCode, form.semester]);

  // load fee categories from Supabase
  useEffect(() => {
    loadFeeCategories();
  }, []);

  useEffect(() => {
    const handleDocumentClick = (event) => {
      if (
        categoryDropdownRef.current &&
        !categoryDropdownRef.current.contains(event.target)
      ) {
        setCategoryDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleDocumentClick);
    return () => document.removeEventListener("mousedown", handleDocumentClick);
  }, []);

  const loadFeeCategories = async () => {
    try {
      const { data, error } = await supabase
        .from("fee_categories")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      setFeeCats(data || []);
    } catch (error) {
      console.error("Error loading fee categories:", error);
      showToast("Failed to load fee categories.", { type: "danger" });
    }
  };

  // Save or update fee category
  const saveFeeCategory = async () => {
    if (!feeCategoryName.trim()) {
      showToast("Please enter a category name", { type: "warning" });
      return;
    }

    try {
      if (editingFeeCategoryId) {
        // Update existing category
        const { error } = await supabase
          .from("fee_categories")
          .update({ name: feeCategoryName })
          .eq("id", editingFeeCategoryId);

        if (error) throw error;
        showToast("Category updated successfully", { type: "success" });
      } else {
        // Create new category
        const { error } = await supabase
          .from("fee_categories")
          .insert([{ name: feeCategoryName }]);

        if (error) throw error;
        showToast("Category added successfully", { type: "success" });
      }

      // Log activity
      try {
        if (user) {
          const userRole = user.role || 'admin';
          const action = editingFeeCategoryId ? 'UPDATE' : 'CREATE';
          const desc = editingFeeCategoryId
            ? `updated fee category: ${feeCategoryName}`
            : `created new fee category: ${feeCategoryName}`;

          await logActivity(supabase, {
            user,
            role: userRole,
            action,
            page: 'Fees Generation',
            description: `${userRole.charAt(0).toUpperCase() + userRole.slice(1).toLowerCase()} ${desc}`
          });
        }
      } catch (logErr) {
        console.error("Logging failed", logErr);
      }

      // Refresh categories
      await loadFeeCategories();
      setFeeCategoryName("");
      setEditingFeeCategoryId(null);
    } catch (error) {
      console.error("Error saving fee category:", error);
      showToast("Failed to save category", { type: "danger" });
    }
  };

  // Edit fee category
  const editFeeCategory = (category) => {
    setFeeCategoryName(category.name);
    setEditingFeeCategoryId(category.id);
  };

  // Delete fee category
  const deleteFeeCategory = async (id) => {
    const category = feeCats.find((c) => c.id === id);
    if (!category) {
      showToast("Unable to delete category: not found.", { type: "warning" });
      return;
    }

    showToast("Deleting category...", { type: "info", title: "Deleting" });

    try {
      const { data: inUse, error: checkError } = await supabase
        .from("fee_structure")
        .select("id")
        .contains("fee_categories", [category.name])
        .limit(1);

      if (checkError) throw checkError;

      if (inUse && inUse.length > 0) {
        showToast("Cannot delete: This category is in use", { type: "danger" });
        return;
      }

      const { error } = await supabase
        .from("fee_categories")
        .delete()
        .eq("id", id);

      if (error) throw error;

      // Log activity
      try {
        if (user) {
          const userRole = user.role || 'admin';
          await logActivity(supabase, {
            user,
            role: userRole,
            action: 'DELETE',
            page: 'Fees Generation',
            description: `${userRole.charAt(0).toUpperCase() + userRole.slice(1).toLowerCase()} deleted fee category: ${category.name}`
          });
        }
      } catch (logErr) {
        console.error("Logging failed", logErr);
      }

      showToast("Category deleted successfully", { type: "success" });
      await loadFeeCategories();
    } catch (error) {
      console.error("Error deleting fee category:", error);
      showToast("Failed to delete category", { type: "danger" });
    }
  };

  // load subjects for selected course + semester
  useEffect(() => {
    if (form.courseCode && form.semester) loadSubjects();
  }, [form.courseCode, form.semester]);

  const loadSubjects = async () => {
    const res = await api.listSubjects({
      courseCode: form.courseCode,
      semester: Number(form.semester),
    });
    setSubjects(res || []);
  };

  // ---------------- SUBJECT FEES ----------------
  const handleSubjectOK = (sub) => {
    const amt = amounts[sub.id];
    if (!validateRequiredFields({ Amount: amt }, { title: "Enter amount" }))
      return;
    if (
      !validateRequiredFields(
        {
          "Academic Year": form.year,
          Group: form.group,
          Course: form.courseCode,
          Semester: form.semester,
        },
        { title: "Select academic details" }
      )
    )
      return;

    const subjectName =
      sub.name ||
      sub.subject_name ||
      sub.subjectName ||
      sub.title ||
      "Unknown Subject";

    const newRecord = {
      id: Date.now() + "_" + Math.random().toString(36),
      subjectId: sub.id,
      name: subjectName,
      amount: Number(amt),
      academic_year: form.year,
      group: form.group,
      course_code: form.courseCode,
      semester: form.semester,
    };

    setSubjectFees((prev) => [...prev, newRecord]);
    setAmounts({ ...amounts, [sub.id]: "" });
  };

  const submitAllSubjects = () => {
    if (subjectFees.length === 0) {
      showToast("No subject fees added!", {
        type: "warning",
        title: "Nothing to submit",
      });
      return;
    }

    setAppliedFilter({
      year: form.year,
      group: form.group,
      courseCode: form.courseCode,
      semester: form.semester,
    });

    showToast("Subject fees submitted!", { type: "success" });
  };

  const deleteSubjectFee = (id) => {
    setSubjectFees((prev) => prev.filter((x) => x.id !== id));
    showToast("Subject fee removed.", { type: "info", title: "Subject fees" });
  };

  // ---------------- CATEGORY FEES (CHECKBOX) ----------------
  const toggleCategory = (catId) => {
    setSelectedCategories((prev) => {
      const isSelected = prev.includes(catId);
      if (isSelected) {
        setCategoryAmounts((amounts) => {
          const { [catId]: removed, ...rest } = amounts;
          return rest;
        });
        return prev.filter((id) => id !== catId);
      }

      setCategoryAmounts((amounts) => ({
        ...amounts,
        [catId]: amounts[catId] ?? "",
      }));
      return [...prev, catId];
    });
  };

  const handleCategoryAmountChange = (catId, value) => {
    setCategoryAmounts((prev) => ({ ...prev, [catId]: value }));
  };

  const fetchCategoryFees = async () => {
    try {
      const { data, error } = await supabase
        .from("fee_structure")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const feesMap = new Map();

      const formattedData = (data || []).map((item) => {
        const categories = item.fee_categories || [];
        const amounts = item.fee_amounts || [];
        return {
          id: item.id,
          feeCategories: categories.map((name, index) => ({
            name,
            amount: Number(amounts[index] || 0),
          })),
          amount: Number(item.total_fee || 0),
          academic_year: String(item.academic_year || ""),
          group: item.group_code || "",
          group_code: item.group_code || "",
          course_code: item.course_code || "",
          semester: String(item.semester ?? ""),
          category: item.category || "",
          created_at: item.created_at,
        };
      });
      setCategoryFees(formattedData);
    } catch (error) {
      console.error("Error fetching category fees:", error);
      showToast("Error loading category fees. Please try again.", {
        type: "danger",
        title: "Category fees",
      });
    }
  };

  const handleCategoryOK = async () => {
    if (selectedCategories.length === 0) {
      showToast("Select at least one fee category", { type: "warning" });
      return;
    }

    const missingAmountCategory = selectedCategories.find(
      (catId) => !(categoryAmounts[catId] ?? "").toString().trim().length
    );
    if (missingAmountCategory) {
      showToast("Enter an amount for each selected fee category", {
        type: "warning",
      });
      return;
    }

    const invalidAmountCategory = selectedCategories.find((catId) =>
      Number.isNaN(
        parseFloat((categoryAmounts[catId] ?? "").toString().trim())
      )
    );
    if (invalidAmountCategory) {
      showToast("Enter valid numbers for all fee category amounts", {
        type: "warning",
      });
      return;
    }

    if (!form.year || !form.group || !form.courseCode || !form.semester) {
      showToast("Select Academic Year, Group, Course & Semester", {
        type: "warning",
      });
      return;
    }

    try {
      if (!isEditingCategoryEntry) {
        const { data: duplicate, error: duplicateError } = await supabase
          .from("fee_structure")
          .select("id")
          .eq("academic_year", form.year)
          .eq("group_code", form.group)
          .eq("course_code", form.courseCode)
          .eq("semester", Number(form.semester))
          .limit(1)
          .maybeSingle();

        if (duplicateError) throw duplicateError;
        if (duplicate) {
          showToast(
            "Already exists in this category",
            { type: "warning", title: "Duplicate fees" }
          );
          return;
        }
      }
      const feeNames = selectedCategories.map((catId) => {
        const category = feeCats.find((cat) => cat.id === catId);
        return category?.name || "";
      });
      const feeAmounts = selectedCategories.map((catId) =>
        parseFloat((categoryAmounts[catId] ?? "").toString().trim())
      );
      const totalFee = feeAmounts.reduce((sum, amount) => sum + (amount || 0), 0);

      await supabase
        .from("fee_structure")
        .delete()
        .eq("academic_year", form.year)
        .eq("group_code", form.group)
        .eq("course_code", form.courseCode)
        .eq("semester", Number(form.semester));

      const { error } = await supabase.from("fee_structure").insert({
        academic_year: form.year,
        group_code: form.group,
        course_code: form.courseCode,
        semester: Number(form.semester),
        category: form.category,
        fee_categories: feeNames,
        fee_amounts: feeAmounts,
        total_fee: totalFee,
        created_at: new Date().toISOString(),
      });

      if (error) throw error;

      // Log activity
      try {
        if (user) {
          const userRole = user.role || 'admin';
          const action = isEditingCategoryEntry ? 'UPDATE' : 'CREATE';
          // Resolve names for better logging
          const groupObj = groups.find(g => g.code === form.group || g.group_code === form.group || g.groupCode === form.group);
          const groupName = groupObj ? (groupObj.name || groupObj.group_name || groupObj.groupName || form.group) : form.group;

          const courseObj = courses.find(c => c.code === form.courseCode || c.course_code === form.courseCode || c.courseCode === form.courseCode);
          const courseName = courseObj ? (courseObj.name || courseObj.course_name || courseObj.courseName || form.courseCode) : form.courseCode;

          const desc = isEditingCategoryEntry
            ? `updated fee structure for ${form.year} - ${groupName} - ${courseName} - Sem ${form.semester}`
            : `created/configured fee structure for ${form.year} - ${groupName} - ${courseName} - Sem ${form.semester}`;

          await logActivity(supabase, {
            user,
            role: userRole,
            action,
            page: 'Fees Generation',
            description: `${userRole.charAt(0).toUpperCase() + userRole.slice(1).toLowerCase()} ${desc}`
          });
        }
      } catch (logErr) {
        console.error("Logging failed", logErr);
      }

      await fetchCategoryFees();
      resetFeeEntryForm();
      setSubjects([]);

      showToast("Fee saved successfully", { type: "success" });
    } catch (error) {
      console.error("Error:", error);
      showToast("Failed to save fees", {
        type: "danger",
        title: "Category fees",
      });
    }
  };

  const submitAllCategories = async () => {
    if (categoryFees.length === 0) {
      showToast("No fee category entries added!", {
        type: "warning",
        title: "Nothing to submit",
      });
      return;
    }

    setAppliedFilter({
      year: form.year,
      group: form.group,
      courseCode: form.courseCode,
      semester: form.semester,
    });

    showToast("Fee categories submitted!", { type: "success" });
  };

  const deleteCategoryFee = async (id) => {
    if (id === undefined || id === null) {
      showToast("Unable to delete category fee: missing identifier.", {
        type: "warning",
        title: "Category fees",
      });
      return;
    }
    showToast("Deleting category fee...", { type: "info", title: "Deleting" });

    // Find item details for logging before deletion
    const itemToDelete = categoryFees.find(c => c.id === id);
    let details = `ID: ${id}`;

    if (itemToDelete) {
      const groupObj = groups.find(g => g.code === itemToDelete.group_code || g.group_code === itemToDelete.group_code || g.groupCode === itemToDelete.group_code);
      const groupName = groupObj ? (groupObj.name || groupObj.group_name || groupObj.groupName || itemToDelete.group_code) : itemToDelete.group_code;

      const courseObj = courses.find(c => c.code === itemToDelete.course_code || c.course_code === itemToDelete.course_code || c.courseCode === itemToDelete.course_code);
      const courseName = courseObj ? (courseObj.name || courseObj.course_name || courseObj.courseName || itemToDelete.course_code) : itemToDelete.course_code;

      details = `${itemToDelete.academic_year} - ${groupName} - ${courseName} - Sem ${itemToDelete.semester}`;
    }

    try {
      const { error } = await supabase
        .from("fee_structure")
        .delete()
        .eq("id", id);

      if (error) throw error;

      // Log activity
      try {
        if (user) {
          const userRole = user.role || 'admin';
          await logActivity(supabase, {
            user,
            role: userRole,
            action: 'DELETE',
            page: 'Fees Generation',
            description: `${userRole.charAt(0).toUpperCase() + userRole.slice(1).toLowerCase()} deleted fee structure for ${details}`
          });
        }
      } catch (logErr) {
        console.error("Logging failed", logErr);
      }

      // Refresh the list
      await fetchCategoryFees();
    } catch (error) {
      console.error("Error deleting category fee:", error);
      showToast("Error deleting category fee. Please try again.", {
        type: "danger",
        title: "Category fees",
      });
    }
  };

  // ---------------- FILTER ----------------
  const filterRecords = (list) => {
    if (!appliedFilter) return list;

    return list.filter((item) => {
      if (appliedFilter.year && item.academic_year !== appliedFilter.year)
        return false;
      if (appliedFilter.group && item.group !== appliedFilter.group)
        return false;
      if (
        appliedFilter.courseCode &&
        item.course_code !== appliedFilter.courseCode
      )
        return false;
      if (appliedFilter.semester && item.semester !== appliedFilter.semester)
        return false;
      return true;
    });
  };

  const filteredSubjectFees = filterRecords(subjectFees);
  const filteredCategoryFees = filterRecords(categoryFees);

  const canSelectYear = Boolean(form.category);
  const canSelectGroup = Boolean(form.year);
  const canSelectCourse = Boolean(form.group);
  const canSelectSemester = Boolean(form.courseCode);
  const canOpenCategoryDropdown = Boolean(form.semester);

  const selectedCategoryNames = feeCats
    .filter((cat) => selectedCategories.includes(cat.id))
    .map((cat) => cat.name);

  const categoryButtonLabel = selectedCategoryNames.length
    ? selectedCategoryNames.length > 2
      ? `${selectedCategoryNames.length} categories selected`
      : selectedCategoryNames.join(", ")
    : "Select fee categories";

  const isEditingCategoryEntry = Boolean(editingCategoryEntryKey);

  const handleEditCategoryFee = (fees) => {
    const lookupAcademicYear = String(fees.academic_year || "").trim();
    const matchingYear = years.find((year) => {
      const yearLabel = String(year.name || year.academic_year || "").trim();
      return (
        normalizeCategory(yearLabel) === normalizeCategory(lookupAcademicYear) ||
        normalizeCategory(year.academic_year) === normalizeCategory(lookupAcademicYear)
      );
    });

    const derivedCategory = matchingYear
      ? (
        matchingYear.category ||
        matchingYear.Category ||
        matchingYear.category_name ||
        matchingYear.categoryName ||
        ""
      ).trim()
      : "";

    const amounts = {};
    const selected = [];
    (fees.feeCategories || []).forEach((cat) => {
      if (!cat?.name) return;
      const normalizedName = normalizeCategory(cat.name);
      const feeCat = feeCats.find(
        (fc) => normalizeCategory(fc.name || "") === normalizedName
      );
      if (feeCat) {
        selected.push(feeCat.id);
        amounts[feeCat.id] = cat.amount != null ? String(cat.amount) : "";
      }
    });

    setSelectedCategories(selected);
    setCategoryAmounts(amounts);

    setForm((prev) => ({
      ...prev,
      category: derivedCategory || prev.category,
      year: matchingYear
        ? matchingYear.name || matchingYear.academic_year
        : fees.academic_year,
      group: fees.group,
      courseCode: fees.course_code,
      semester: fees.semester,
    }));
    setEditingCategoryEntryKey(
      `${fees.academic_year}-${fees.group}-${fees.course_code}-${fees.semester}`
    );
  };

  const resetFeeEntryForm = () => {
    setSelectedCategories([]);
    setCategoryAmounts({});
    setForm((prev) => ({
      ...prev,
      year: "",
      group: "",
      courseCode: "",
      semester: "",
    }));
    setEditingCategoryEntryKey(null);
  };

  const cancelCategoryEdit = () => {
    resetFeeEntryForm();
  };

  // Fetch Supplementary Fees from Supabase
  const fetchSupplementaryFees = async () => {
    try {
      const { data, error } = await supabase
        .from("Supplementary")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSupplementaryFees(data || []);
    } catch (error) {
      console.error("Error fetching supplementary fees:", error);
      showToast("Error loading supplementary fees. Please try again.", {
        type: "danger",
        title: "Supplementary fees",
      });
    }
  };

  // Handle Supplementary Fees Submission
  const handleSupplementarySubmit = async (e) => {
    e.preventDefault();

    if (
      !validateRequiredFields(
        {
          "Paper 1 Fee": paper1,
          "Paper 2 Fee": paper2,
          "3+ Papers Fee": paper3Plus,
        },
        { title: "Enter fee amounts" }
      )
    ) {
      return;
    }

    // Convert to numbers and validate
    const paper1Value = parseFloat(paper1);
    const paper2Value = parseFloat(paper2);
    const paper3Value = parseFloat(paper3Plus);

    if (isNaN(paper1Value) || isNaN(paper2Value) || isNaN(paper3Value)) {
      showToast("Please enter valid numbers for all fields.", {
        type: "warning",
        title: "Supplementary fees",
      });
      return;
    }

    if (!editingFeeId && supplementaryFees.length > 0) {
      showToast(
        "Only one supplementary fee entry is allowed. Please edit or delete the existing record instead.",
        { type: "warning", title: "Supplementary fees" }
      );
      return;
    }

    const feeData = {
      "Paper-1": paper1Value,
      "Paper-2": paper2Value,
      "Paper-3": paper3Value,
      created_at: new Date().toISOString(),
    };

    console.log("Submitting fee data:", {
      editingFeeId,
      feeData,
      table: "Supplementary",
      supabaseConnected: !!supabase,
    });

    try {
      if (editingFeeId) {
        // Update existing fee
        console.log("Updating existing fee with ID:", editingFeeId);
        const { data, error } = await supabase
          .from("Supplementary")
          .update(feeData)
          .eq("id", editingFeeId)
          .select();

        if (error) {
          console.error("Update error details:", error);
          throw error;
        }

        console.log("Update successful, updated data:", data);
        setSupplementaryFees(
          supplementaryFees.map((fee) =>
            fee.id === editingFeeId ? { ...fee, ...feeData } : fee
          )
        );
        setEditingFeeId(null);
      } else {
        // Create new fee
        console.log("Creating new fee");
        const { data, error } = await supabase
          .from("Supplementary")
          .insert([feeData])
          .select();

        if (error) {
          console.error("Insert error details:", error);
          throw error;
        }

        console.log("Insert successful, new data:", data);
        if (data && data.length > 0) {
          setSupplementaryFees([data[0], ...supplementaryFees]);
        } else {
          console.log("No data returned from insert, refetching...");
          await fetchSupplementaryFees();
        }
      }

      // Clear form
      setPaper1("");
      setPaper2("");
      setPaper3Plus("");
    } catch (error) {
      console.error("Error in handleSupplementarySubmit:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        error: error,
      });

      // More user-friendly error message
      let errorMessage = "Error saving supplementary fee";
      if (error.code === "42P01") {
        errorMessage =
          "The Supplementary table does not exist in the database. Please create it first.";
      } else if (error.code === "42501") {
        errorMessage =
          "Permission denied. Please check your database permissions.";
      } else if (error.message) {
        errorMessage += `: ${error.message}`;
      }

      showToast(errorMessage, { type: "danger", title: "Supplementary fees" });
    }
  };

  // Set up edit mode for a fee
  const handleEditFee = (fee) => {
    setPaper1(fee["Paper-1"].toString());
    setPaper2(fee["Paper-2"].toString());
    setPaper3Plus(fee["Paper-3"].toString());
    setEditingFeeId(fee.id);
  };

  // Cancel edit mode
  const cancelEdit = () => {
    setPaper1("");
    setPaper2("");
    setPaper3Plus("");
    setEditingFeeId(null);
  };

  // Delete Supplementary Fee
  const deleteSupplementaryFee = async (id) => {
    try {
      const { error } = await supabase
        .from("Supplementary")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setSupplementaryFees(supplementaryFees.filter((fee) => fee.id !== id));
      showToast("Supplementary fee deleted.", {
        type: "success",
        title: "Supplementary fees",
      });
    } catch (error) {
      console.error("Error deleting supplementary fee:", error);
      showToast("Error deleting supplementary fee. Please try again.", {
        type: "danger",
        title: "Supplementary fees",
      });
    }
  };

  // Helper function to check if a table exists
  const checkTableExists = async (tableName) => {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select("*")
        .limit(1);

      if (error && error.code === "42P01") {
        // Table doesn't exist
        return false;
      }
      return true;
    } catch (error) {
      console.error("Error checking table existence:", error);
      return false;
    }
  };

  // Fetch data on component mount
  useEffect(() => {
    const init = async () => {
      // Load exams
      const { data: examsData, error: examsError } = await supabase
        .from('exam_master')
        .select('*');

      if (examsError) {
        console.error('Error loading exams:', examsError);
        showToast('Failed to load exams', { type: 'danger' });
      } else {
        setExams(examsData || []);
      }

      // Load fine amounts
      const { data: fineData, error: fineError } = await supabase
        .from('global_settings')
        .select('*');

      if (fineError) {
        console.error('Error loading fine amounts:', fineError);
      } else {
        setFineAmounts(fineData || []);
        if (fineData && fineData.length > 0) {
          setFineAmount(fineData[0].fine_amount || '');
        }
      }

      // Load exam deadlines
      const { data: deadlinesData, error: deadlinesError } = await supabase
        .from('exam_deadlines')
        .select(`
          *,
          exam:exam_master(exam_name)
        `);

      if (deadlinesError) {
        console.error('Error loading exam deadlines:', deadlinesError);
      } else {
        setExamDeadlines(deadlinesData || []);
      }

      // Load supplementary fees
      const tableExists = await checkTableExists("Supplementary");
      console.log("Supplementary table exists:", tableExists);
      if (tableExists) {
        await fetchSupplementaryFees();
      } else {
        showToast(
          "The Supplementary table does not exist in your Supabase database. Please create it with columns id, Paper-1, Paper-2, Paper-3, created_at.",
          { type: "warning", title: "Supplementary fees" }
        );
      }

      // Check and load category fees
      const feeTableExists = await checkTableExists("fee_structure");
      console.log("Fee structure table exists:", feeTableExists);
      if (feeTableExists) {
        await fetchCategoryFees();
      } else {
        console.log(
          "Fee structure table does not exist. It will be created when you add your first fee."
        );
      }
    };
    init();
  }, []);

  // ======================================================
  // ====================== UI ============================
  // ======================================================

  /* ---------------- DELETE CONFIRMATION HANDLERS ---------------- */
  const confirmDeleteAction = async () => {
    const { type, payload } = confirmModalState;
    if (!type || !payload) return;

    setConfirmModalState(prev => ({ ...prev, isLoading: true }));

    try {
      if (type === 'CATEGORY_FEE') {
        await deleteCategoryFee(payload.id);
      } else if (type === 'SUPPLEMENTARY_FEE') {
        await deleteSupplementaryFee(payload.id);
      } else if (type === 'FINE_AMOUNT') {
        await deleteFineAmount(payload.id);
      } else if (type === 'DEADLINE') {
        const { error } = await supabase.from('exam_deadlines').delete().eq('id', payload.id);
        if (error) throw error;
        setExamDeadlines(prev => prev.filter(d => d.id !== payload.id));
        showToast("Deadline deleted successfully", { type: "success" });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setConfirmModalState({ isOpen: false, type: null, payload: null, isLoading: false });
    }
  };

  const deleteFineAmount = async (id) => {
    try {
      const { error } = await supabase
        .from('global_settings')
        .delete()
        .eq('id', id);
      if (error) throw error;
      showToast("Fine amount deleted.", { type: "success" });
      // Refresh fine amounts
      const { data } = await supabase
        .from('global_settings')
        .select('*')
        .order('created_at', { ascending: false });

      setFineAmounts(data || []);
      if (id === editingFineId) {
        setFineAmount("");
        setEditingFineId(null);
      }

    } catch (error) {
      console.error("Error deleting fine amount:", error);
      showToast("Failed to delete fine amount", { type: "danger" });
    }
  };

  return (
    <AdminShell>
      <div className="students-hero mb-4">
        <div className="px-3 pt-3">
          <p className="students-hero-eyebrow text-uppercase mb-1">Departments</p>
          <h2 className="students-hero-title">Fees Management</h2>
          <p className="students-hero-copy mb-0">
            Manage fee categories, structures, and supplements with the same payments-style surface.
          </p>
        </div>
        <div className="students-stats-grid row g-3 px-3 pb-3">
          {departmentHeroStats.map((stat) => (
            <div className="col-6 col-md-3" key={stat.label}>
              <div className="students-hero-card h-100 p-3">
                <div className="students-hero-stat-label small mb-1 text-white">
                  {stat.label}
                </div>
                <div className="fs-3 fw-bold students-hero-stat-value text-white">
                  {stat.value ?? 0}
                </div>
                <div className="students-hero-stat-meta small text-white">
                  {stat.meta}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ---------------- MAIN FILTER PANEL ---------------- */}
      <div
        className="tab-pane fade show active"
        id="fee-structure"
        role="tabpanel"
      >
        <div className="students-table-panel card card-soft mb-4">
          <div className="students-table-panel-header mb-3">
            <div>
              <p className="students-table-panel-title mb-1" style={{ color: 'white' }}>Fee Categories</p>
              <p className="students-table-panel-copy small mb-0">
                Manage the categories that can be applied to any fee structure.
              </p>
            </div>
          </div>
          <div className="card-body">
            <div className="students-category-form-panel mb-4">
              <div className="row g-2 align-items-end">
                <div className="col-md-5 col-lg-4">
                  <label className="form-label text-muted fw-600">
                    {editingFeeCategoryId
                      ? "Edit fee category"
                      : "Add a fee category"}
                  </label>
                  <input
                    className="form-control"
                    placeholder="e.g., Tuition"
                    value={feeCategoryName}
                    onChange={(e) => setFeeCategoryName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        saveFeeCategory();
                      }
                    }}
                  />
                </div>
                <div className="col-md-3 col-lg-2">
                  <button
                    type="button"
                    className="btn btn-primary students-button w-100 mt-md-4"
                    onClick={saveFeeCategory}
                  >
                    {editingFeeCategoryId ? "Update Category" : "Add Category"}
                  </button>
                </div>
                {editingFeeCategoryId && (
                  <div className="col-md-3 col-lg-2">
                    <button
                      type="button"
                      className="btn btn-outline-secondary students-button w-100 mt-md-4"
                      onClick={() => {
                        setFeeCategoryName("");
                        setEditingFeeCategoryId(null);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="row g-3">
              {filteredFeeCategories.map((cat) => (
                <div key={cat.id} className="col-md-6 col-lg-4">
                  <div className="card h-100 students-category-card">
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <h6 className="mb-0">{cat.name}</h6>
                        </div>
                        <div className="btn-group">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary students-button students-button-sm"
                            onClick={() => editFeeCategory(cat)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger students-button students-button-sm"
                            onClick={() => deleteFeeCategory(cat.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {filteredFeeCategories.length === 0 && (
                <div className="col-12">
                  <div className="alert alert-info mb-0">
                    {feeCats.length === 0
                      ? "No fee categories found. Add one to get started."
                      : "No fee categories match the current filters."}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Fee Structure Container */}
        <div className="students-table-panel card card-soft mb-4">
          <div className="students-table-panel-header mb-3">
            <div>
              <p className="students-table-panel-title mb-1" style={{ color: 'white' }}>Fee Structure</p>
              <p className="students-table-panel-copy small mb-0">
                Review the current fee structure and assign categories to academic groups.
              </p>
            </div>
          </div>
          <div className="card-body">
            <div className="students-filter-control-panel">
              <div className="row g-3">
                {/* Category */}
                <div className="col-md-3">
                  <label className="form-label fw-bold">Category</label>
                  <select
                    className="form-select"
                    value={form.category}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        category: e.target.value,
                        year: "",
                        group: "",
                        courseCode: "",
                        semester: "",
                      })
                    }
                  >
                    <option value="">Category</option>
                    {categoryOptions.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Academic Year */}
                <div className="col-md-3">
                  <label className="form-label fw-bold">Academic Year</label>
                  <select
                    className="form-select"
                    disabled={!canSelectYear}
                    value={form.year}
                    onChange={(e) => setForm({ ...form, year: e.target.value })}
                  >
                    <option value="">Academic Year</option>
                    {filteredYears.map((y) => {
                      const label = y.name || y.academic_year;
                      return (
                        <option key={y.id} value={label}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Group */}
                <div className="col-md-3">
                  <label className="form-label fw-bold">Group</label>
                  <select
                    className="form-select"
                    disabled={!canSelectGroup}
                    value={form.group}
                    onChange={(e) =>
                      setForm({ ...form, group: e.target.value, courseCode: "" })
                    }
                  >
                    <option value="">Group</option>
                    {filteredGroups.map((g) => (
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
                    disabled={!canSelectCourse}
                    value={form.courseCode}
                    onChange={(e) =>
                      setForm({ ...form, courseCode: e.target.value, semester: "" })
                    }
                  >
                    <option value="">Course</option>
                    {filteredCourses.map((c) => (
                      <option key={c.id} value={c.code}>
                        {c.courseName || c.name || c.course_name || "Unnamed course"}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Semester */}
                <div className="col-md-2">
                  <label className="form-label fw-bold">Semester</label>
                  <select
                    className="form-select"
                    disabled={!canSelectSemester}
                    value={form.semester}
                    onChange={(e) => setForm({ ...form, semester: e.target.value })}
                  >
                    <option value="">Semester</option>
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        Sem {n}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Fee Categories Dropdown Selector */}
                <div className="col-md-3 position-relative" ref={categoryDropdownRef}>
                  <label className="form-label fw-bold">Fee Categories</label>
                  <button
                    type="button"
                    className="btn btn-outline-secondary students-button w-100 text-start d-flex justify-content-between align-items-center"
                    disabled={!canOpenCategoryDropdown}
                    aria-disabled={!canOpenCategoryDropdown}
                    onClick={(e) => {
                      if (!canOpenCategoryDropdown) return;
                      e.stopPropagation();
                      setCategoryDropdownOpen((prev) => !prev);
                    }}
                    aria-haspopup="true"
                    aria-expanded={categoryDropdownOpen}
                  >
                    <span className="me-2">{categoryButtonLabel}</span>
                    <span className="text-muted">&#9662;</span>
                  </button>
                  {categoryDropdownOpen && (
                    <div
                      className="bg-white border rounded mt-2 shadow-sm"
                      style={{
                        position: "absolute",
                        zIndex: 50,
                        width: "100%",
                        maxHeight: "300px",
                        overflowY: "auto",
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="p-3 d-flex flex-column gap-2">
                        {feeCats.map((cat) => (
                          <div key={cat.id} className="form-check">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id={`cat-dropdown-${cat.id}`}
                              checked={selectedCategories.includes(cat.id)}
                              onChange={() => toggleCategory(cat.id)}
                            />
                            <label
                              className="form-check-label"
                              htmlFor={`cat-dropdown-${cat.id}`}
                            >
                              {cat.name}
                            </label>
                          </div>
                        ))}
                        {feeCats.length === 0 && (
                          <div className="text-muted">No categories available</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Amount Input with Submit Button */}
                <div className="col-md-3 d-flex flex-column">
                  <div className="flex-grow-1">
                    {selectedCategories.length === 0 ? (
                      <div className="border rounded p-3 text-muted text-center">
                        Select at least one fee category to set amounts.
                      </div>
                    ) : (
                      selectedCategories.map((catId) => {
                        const category = feeCats.find((cat) => cat.id === catId);
                        return (
                          <div key={catId} className="mb-2">
                            <label className="form-label mb-1">
                              {category?.name || "Category"} Amount
                            </label>
                            <div className="input-group">
                              <span className="input-group-text">₹</span>
                              <input
                                type="number"
                                className="form-control"
                                placeholder="Amount"
                                value={categoryAmounts[catId] ?? ""}
                                onChange={(e) =>
                                  handleCategoryAmountChange(catId, e.target.value)
                                }
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div className="mt-auto d-flex gap-2">
                    <button
                      className="btn btn-primary students-button flex-grow-1"
                      onClick={handleCategoryOK}
                    >
                      Submit
                    </button>
                    {isEditingCategoryEntry && (
                      <button
                        type="button"
                        className="btn btn-outline-secondary students-button flex-grow-1"
                        onClick={cancelCategoryEdit}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ---------------- CATEGORY FEE TABLE ---------------- */}
            {filteredCategoryFees.length > 0 && (
              <div className="students-table-panel card card-soft mb-4 p-4">
                <div className="students-table-panel-header mb-3">
                  <div>
                    <p className="students-table-panel-title text-white mb-1">Fee Category Records</p>
                  </div>
                </div>
                <div className="table-responsive">
                  <table className="table table-bordered align-middle">
                    <thead>
                      <tr>
                        <th>Academic Year</th>
                        <th>Group</th>
                        <th>Course</th>
                        <th>Semester</th>
                        <th>Categories</th>
                        <th>Total Amount (₹)</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCategoryFees
                        .slice(0, showAllFeeCategories ? filteredCategoryFees.length : 6)
                        .map((fees) => {
                          const categoryDisplays = fees.feeCategories || [];
                          return (
                            <tr key={fees.id}>
                              <td>{fees.academic_year}</td>
                              <td>
                                {groups.find((g) => g.code === fees.group)?.name ||
                                  fees.group}
                              </td>
                              <td>
                                {courses.find((c) => c.code === fees.course_code)?.name ||
                                  fees.course_code}
                              </td>
                              <td>{fees.semester}</td>
                              <td>
                                {categoryDisplays.length === 0 ? (
                                  <span className="text-muted">No categories</span>
                                ) : (
                                  categoryDisplays.map((cat, index) => (
                                    <div
                                      key={cat.id || `category-${index}`}
                                      className="mb-1 d-flex align-items-center"
                                    >
                                      <span className="fw-semibold">{cat.name}</span>
                                    </div>
                                  ))
                                )}
                              </td>
                              <td>
                                <span className="fw-semibold">
                                  &#8377;
                                  {parseInt(Number(fees.amount || 0)).toLocaleString(
                                    "en-IN"
                                  )}
                                </span>
                              </td>
                              <td>
                                <div className="d-flex gap-2">
                                  <button
                                    className="btn btn-sm btn-outline-primary students-button students-button-sm"
                                    onClick={() => handleEditCategoryFee(fees)}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    className="btn btn-sm btn-outline-danger students-button students-button-sm"
                                    onClick={() => setConfirmModalState({ isOpen: true, type: 'CATEGORY_FEE', payload: fees })}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>

                  {filteredCategoryFees.length > 6 && (
                    <div className="d-flex justify-content-center mt-3">
                      <button
                        className="btn btn-outline-primary"
                        onClick={() => setShowAllFeeCategories(!showAllFeeCategories)}
                      >
                        {showAllFeeCategories ? (
                          <>
                            <i className="fas fa-arrow-left me-2"></i>
                            Back to Top
                          </>
                        ) : (
                          `View All (${filteredCategoryFees.length})`
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* Exam Deadlines Section */}
            <div className="students-table-panel card card-soft mb-4 p-4">
              <div className="students-table-panel-header mb-3">
                <div>
                  <p className="students-table-panel-title mb-1" style={{ color: 'white' }}>Exam Deadlines</p>
                  <p className="students-table-panel-copy small mb-0">
                    Manage last dates for exam registrations.
                  </p>
                </div>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!selectedExam || !lastDate) {
                    showToast("Please select an exam and set a last date", { type: "warning" });
                    return;
                  }

                  try {
                    if (editingDeadlineId) {
                      // Update existing deadline
                      const { error } = await supabase
                        .from('exam_deadlines')
                        .update({
                          exam_id: selectedExam,
                          last_date: lastDate
                        })
                        .eq('id', editingDeadlineId);

                      if (error) throw error;
                      showToast("Exam deadline updated successfully", { type: "success" });
                    } else {
                      // Create new deadline
                      const { error } = await supabase
                        .from('exam_deadlines')
                        .insert([{
                          exam_id: selectedExam,
                          last_date: lastDate
                        }]);

                      if (error) throw error;
                      showToast("Exam deadline added successfully", { type: "success" });
                    }

                    // Refresh deadlines
                    const { data: deadlinesData } = await supabase
                      .from('exam_deadlines')
                      .select(`
                  *,
                  exam:exam_master(exam_name)
                `);

                    setExamDeadlines(deadlinesData || []);
                    setSelectedExam("");
                    setLastDate("");
                    setEditingDeadlineId(null);
                  } catch (error) {
                    console.error("Error saving exam deadline:", error);
                    showToast("Failed to save exam deadline", { type: "danger" });
                  }
                }}
                className="mb-4"
              >
                <div className="row g-3">
                  <div className="col-md-5">
                    <div className="form-group">
                      <label className="form-label">Exam</label>
                      <select
                        className="form-select"
                        value={selectedExam}
                        onChange={(e) => setSelectedExam(e.target.value)}
                        required
                      >
                        <option value="">Select Exam</option>
                        {exams.map((exam) => (
                          <option key={exam.id} value={exam.id}>
                            {exam.exam_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="col-md-5">
                    <div className="form-group">
                      <label className="form-label">Last Date</label>
                      <input
                        type="date"
                        className="form-control"
                        value={lastDate}
                        onChange={(e) => setLastDate(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="col-md-2 d-flex align-items-end">
                    <button type="submit" className="btn btn-primary students-button w-100">
                      {editingDeadlineId ? "Update" : "Add"}
                    </button>
                  </div>
                </div>
              </form>

              {examDeadlines.length > 0 && (
                <div className="table-responsive">
                  <table className="table table-bordered align-middle">
                    <thead>
                      <tr>
                        <th>Exam</th>
                        <th>Last Date</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {examDeadlines
                        .slice(0, showAllExamDeadlines ? examDeadlines.length : 3)
                        .map((deadline) => (
                          <tr key={deadline.id}>
                            <td>{deadline.exam?.exam_name || 'N/A'}</td>
                            <td>{new Date(deadline.last_date).toLocaleDateString()}</td>
                            <td>
                              <div className="d-flex gap-2">
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-primary students-button students-button-sm"
                                  onClick={() => {
                                    setSelectedExam(deadline.exam_id);
                                    setLastDate(deadline.last_date.split('T')[0]);
                                    setEditingDeadlineId(deadline.id);
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-danger students-button students-button-sm"
                                  onClick={async () => {
                                    setConfirmModalState({ isOpen: true, type: 'DEADLINE', payload: deadline });
                                  }}
                                >
                                  Delete
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

            {/* Fine Amount Section */}
            <div className="students-table-panel card card-soft mb-4 p-4">
              <div className="students-table-panel-header mb-3">
                <div>
                  <p className="students-table-panel-title mb-1" style={{ color: 'white' }}>Fine Amount</p>
                  <p className="students-table-panel-copy small mb-0">
                    Configure the fine amount for late fee payments.
                  </p>
                </div>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!fineAmount) {
                    showToast("Please enter a fine amount", { type: "warning" });
                    return;
                  }

                  if (fineAmounts.length > 0 && !editingFineId) {
                    showToast(
                      "Only one fine amount entry is allowed. Please edit or delete the existing record.",
                      { type: "warning", title: "Fine Amount" }
                    );
                    return;
                  }

                  try {
                    if (editingFineId) {
                      // Update existing fine amount
                      const { error } = await supabase
                        .from('global_settings')
                        .update({
                          fine_amount: parseFloat(fineAmount)
                          // Removed updated_at since it doesn't exist in the table
                        })
                        .eq('id', editingFineId);

                      if (error) throw error;
                      showToast("Fine amount updated successfully", { type: "success" });
                    } else {
                      // Create new fine amount
                      const { error } = await supabase
                        .from('global_settings')
                        .insert([{
                          fine_amount: parseFloat(fineAmount),
                          created_at: new Date().toISOString()
                        }]);

                      if (error) throw error;
                      showToast("Fine amount saved successfully", { type: "success" });
                    }

                    // Refresh fine amounts
                    const { data } = await supabase
                      .from('global_settings')
                      .select('*')
                      .order('created_at', { ascending: false });

                    setFineAmounts(data || []);
                    setFineAmount("");
                    setEditingFineId(null);
                  } catch (error) {
                    console.error("Error saving fine amount:", error);
                    showToast("Failed to save fine amount", { type: "danger" });
                  }
                }}
                className="mb-4"
              >
                <div className="row g-3">
                  <div className="col-md-4">
                    <div className="form-group">
                      <label className="form-label">Fine Amount (₹)</label>
                      <div className="input-group">
                        <span className="input-group-text">₹</span>
                        <input
                          type="number"
                          className="form-control"
                          value={fineAmount}
                          onChange={(e) => setFineAmount(e.target.value)}
                          placeholder="Enter fine amount"
                          min="0"
                          step="0.01"
                          required
                          disabled={fineAmounts.length > 0 && !editingFineId}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="col-md-8 d-flex align-items-end gap-2">
                    <button
                      type="submit"
                      className="btn btn-primary students-button"
                      disabled={fineAmounts.length > 0 && !editingFineId}
                    >
                      {editingFineId ? "Update" : "Save"}
                    </button>
                    {editingFineId && (
                      <button
                        type="button"
                        className="btn btn-outline-secondary students-button"
                        onClick={() => {
                          setFineAmount("");
                          setEditingFineId(null);
                        }}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </form>

              {fineAmounts.length > 0 && (
                <div className="table-responsive">
                  <table className="table table-bordered align-middle">
                    <thead>
                      <tr>
                        <th>Fine Amount (₹)</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fineAmounts.slice(0, 1).map((item) => (
                        <tr key={item.id}>
                          <td>₹{parseFloat(item.fine_amount || 0).toFixed(2)}</td>
                          <td>
                            <div className="d-flex gap-2">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary students-button students-button-sm"
                                onClick={() => {
                                  setFineAmount(item.fine_amount || "");
                                  setEditingFineId(item.id);
                                }}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger students-button students-button-sm"
                                onClick={async () => {
                                  setConfirmModalState({ isOpen: true, type: 'FINE_AMOUNT', payload: item });
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
              }
            </div >

            {/* Supplementary Fees Section */}

            <div className="students-table-panel card card-soft mb-4 p-4">
              <div className="students-table-panel-header mb-3">
                <div>
                  <p className="students-table-panel-title mb-1" style={{ color: 'white' }}>Supplementary Fees</p>
                  <p className="students-table-panel-copy small mb-0">
                    Configure fees for supplementary examinations by paper count.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSupplementarySubmit} className="mb-4">
                <div className="row g-3 students-supplementary-grid">
                  <div className="col-md-3">
                    <div className="students-supplementary-field">
                      <label className="form-label">1 Paper Fee (₹)</label>
                      <input
                        type="number"
                        value={paper1}
                        onChange={(e) => setPaper1(e.target.value)}
                        className="form-control"
                        required
                        disabled={!canSubmitSupplementary}
                      />
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="students-supplementary-field">
                      <label className="form-label">2 Papers Fee (₹)</label>
                      <input
                        type="number"
                        value={paper2}
                        onChange={(e) => setPaper2(e.target.value)}
                        className="form-control"
                        required
                        disabled={!canSubmitSupplementary}
                      />
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="students-supplementary-field">
                      <label className="form-label">3 & above Papers Fee (₹)</label>
                      <input
                        type="number"
                        value={paper3Plus}
                        onChange={(e) => setPaper3Plus(e.target.value)}
                        className="form-control"
                        required
                        disabled={!canSubmitSupplementary}
                      />
                    </div>
                  </div>
                  <div className="col-md-3 d-flex flex-column justify-content-end">
                    <div className="d-flex gap-2">
                      <button
                        type="submit"
                        className="btn btn-primary students-button flex-grow-1"
                        disabled={!canSubmitSupplementary}
                      >
                        {editingFeeId ? "Update Fee" : "Add Supplementary Fee"}
                      </button>
                    </div>
                    {!canSubmitSupplementary && (
                      <small className="text-muted mt-2">
                        Only one supplementary fee entry is allowed; edit or delete the
                        existing record to replace it.
                      </small>
                    )}
                  </div>
                </div>
              </form>

              {
                supplementaryFees.length > 0 && (
                  <div className="overflow-x-auto students-table-panel-table-wrapper">
                    <table className="table table-bordered align-middle students-table-panel-table students-supplementary-table">
                      <thead>
                        <tr>
                          <th>1 PAPER (₹)</th>
                          <th>2 PAPERS (₹)</th>
                          <th>3+ PAPERS (₹)</th>
                          <th>ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {supplementaryFees.map((fee) => (
                          <tr key={fee.id}>
                            <td>
                              <div className="students-supplementary-cell">
                                <span className="fw-semibold">₹{fee["Paper-1"]}</span>
                              </div>
                            </td>
                            <td>
                              <div className="students-supplementary-cell">
                                <span className="fw-semibold">₹{fee["Paper-2"]}</span>
                              </div>
                            </td>
                            <td>
                              <div className="students-supplementary-cell">
                                <span className="fw-semibold">₹{fee["Paper-3"]}</span>
                              </div>
                            </td>
                            <td>
                              <div className="d-flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleEditFee(fee)}
                                  className="btn btn-sm btn-outline-primary students-button students-button-sm"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => setConfirmModalState({ isOpen: true, type: 'SUPPLEMENTARY_FEE', payload: fee })}
                                  className="btn btn-sm btn-outline-danger students-button students-button-sm"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              }

            </div >
          </div >
        </div >
      </div >
      <ConfirmationModal
        isOpen={confirmModalState.isOpen}
        onClose={() => setConfirmModalState({ isOpen: false, type: null, payload: null, isLoading: false })}
        onConfirm={confirmDeleteAction}
        title={
          confirmModalState.type === 'CATEGORY_FEE' ? "Delete Fee Record" :
            confirmModalState.type === 'SUPPLEMENTARY_FEE' ? "Delete Supplementary Fee" :
              confirmModalState.type === 'FINE_AMOUNT' ? "Delete Fine Amount" :
                confirmModalState.type === 'DEADLINE' ? "Delete Exam Deadline" :
                  "Confirm Delete"
        }
        message={
          confirmModalState.type === 'CATEGORY_FEE' ? "Are you sure you want to delete this fee record? This will remove fees for the selected academic year, group, and course." :
            confirmModalState.type === 'SUPPLEMENTARY_FEE' ? "Are you sure you want to delete this supplementary fee entry?" :
              confirmModalState.type === 'FINE_AMOUNT' ? "Are you sure you want to delete this fine amount?" :
                confirmModalState.type === 'DEADLINE' ? "Are you sure you want to delete this deadline?" :
                  "Are you sure you want to delete this item?"
        }
        isLoading={confirmModalState.isLoading}
      />
    </AdminShell >
  );
}

