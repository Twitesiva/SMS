import { supabase } from "../../supabaseClient.js";
import { trackPromise } from "../store/ui.js";

const TABLES = {
  applications: "applications",
  academicYears: "academic_year",
  groups: "groups",
  courses: "courses",
  subCategories: "subject_category",
  subjects: "subjects",
  batches: "batches",
  students: "students",
  exams: "exam_master",
  payments: "payments",
  hallTickets: "hall_tickets",
  results: "results",
  feeDefinitions: "fee_structure",
  feeCategories: "fee_categories",
  adminUsers: "admin_users",
  examSchedules: "exam_schedule",
  applicationDocuments: "application_documents",
};

const runQuery = async (query, label) => {
  const { data, error } = await trackPromise(query);
  if (error) {
    console.error(label ?? "Supabase query failed", error);
    throw new Error(label || error.message);
  }
  return data;
};

const runMaybeSingle = async (query, label) => {
  const { data, error } = await trackPromise(query);
  if (error && error.code !== "PGRST116") {
    console.error(label ?? "Supabase query failed", error);
    throw new Error(label || error.message);
  }
  return data ?? null;
};

const DUPLICATE_RULES = {
  [TABLES.academicYears]: { cols: ["academic_year"], pk: "id" },
  [TABLES.groups]: { cols: ["group_code", "group_name"], pk: "group_id" },
  [TABLES.courses]: { cols: ["course_code", "course_name"], pk: "course_id" },
  [TABLES.subCategories]: { cols: ["category_name"], pk: "category_id" },
  [TABLES.subjects]: {
    // treat subjects as batched by year/course/semester/category —
    // prevent inserting another batch for same year+course+semester+category
    composite: [
      "academic_year",
      "course_name",
      "semester_number",
      "category_id",
    ],
    pk: "subject_id",
  },
  [TABLES.batches]: { cols: ["name"], pk: "id" },
  [TABLES.students]: {
    cols: ["student_id", "hall_ticket_no", "aadhar_number", "email"],
    pk: "id",
  },
  [TABLES.feeCategories]: { cols: ["name"], pk: "id" },
  [TABLES.feeDefinitions]: {
    composite: ["academic_year", "group", "course", "semester", "fee_cat"],
    pk: "id",
  },
};

const ensureNoDuplicate = async (table, row = {}, opts = {}) => {
  // opts: { excludeId, excludeIdCol }
  const rule = DUPLICATE_RULES[table];
  if (!rule) return;

  const pk = opts.excludeIdCol || rule.pk;

  // composite check
  if (rule.composite) {
    const matchObj = {};
    for (const col of rule.composite) {
      // accept either incoming key or DB column names
      if (row[col] !== undefined && row[col] !== null && row[col] !== "") {
        matchObj[col] = row[col];
      }
    }
    if (Object.keys(matchObj).length === rule.composite.length) {
      // Try a direct filtered query first (efficient). If it fails (some
      // supabase REST filters can return 400 for complex values), fall back
      // to fetching the columns and checking in JS.
      try {
        let query = supabase.from(table).select(pk);
        for (const k of Object.keys(matchObj)) query = query.eq(k, matchObj[k]);
        if (opts.excludeId) query = query.neq(pk, opts.excludeId);
        const existing = await runMaybeSingle(
          query.maybeSingle(),
          "Duplicate check"
        );
        if (existing)
          throw new Error("Duplicate fee definition already exists");
      } catch (err) {
        // fallback: fetch rows for the composite columns and check equality in JS
        try {
          const cols = [...rule.composite, pk];
          const rows = await runQuery(
            supabase.from(table).select(cols.join(",")),
            "Duplicate check fallback"
          );
          const found = (rows || []).find((r) => {
            if (opts.excludeId && String(r[pk]) === String(opts.excludeId))
              return false;
            return rule.composite.every((c) => {
              const left = r[c];
              const right = matchObj[c];
              // loose equality for numbers/strings
              return String(left) === String(right);
            });
          });
          if (found)
            throw new Error("Duplicate data definition already exists");
        } catch (fallbackErr) {
          console.error("Duplicate check failed (fallback)", fallbackErr);
          throw fallbackErr;
        }
      }
    }
    return;
  }

  // single-column checks
  for (const col of rule.cols || []) {
    const val = row[col];
    if (val === undefined || val === null || val === "") continue;
    // Try a direct query; fallback to JS-check on failure (safer for weird
    // column/value combinations that can trigger REST 400 errors).
    try {
      let query = supabase.from(table).select(pk);
      query = query.eq(col, val);
      if (opts.excludeId) query = query.neq(pk, opts.excludeId);
      const existing = await runMaybeSingle(
        query.maybeSingle(),
        "Duplicate check"
      );
      if (existing) {
        const pretty = col.replace(/_/g, " ");
        throw new Error(`${pretty} already exists`);
      }
    } catch (err) {
      // fallback: fetch rows for the column and compare in JS
      try {
        const rows = await runQuery(
          supabase.from(table).select(`${col},${pk}`),
          "Duplicate check fallback"
        );
        const found = (rows || []).find((r) => {
          if (opts.excludeId && String(r[pk]) === String(opts.excludeId))
            return false;
          return String(r[col]) === String(val);
        });
        if (found) {
          const pretty = col.replace(/_/g, " ");
          throw new Error(`${pretty} already exists`);
        }
      } catch (fallbackErr) {
        console.error("Duplicate check failed (fallback)", fallbackErr);
        throw fallbackErr;
      }
    }
  }
};

const mapYear = (row = {}) => {
  const academicYear = row.academic_year ?? row.name ?? "";
  // Category/Status columns removed from DB, defaulting to inferred values
  return {
    id: row.id,
    academic_year: academicYear,
    name: academicYear,
    active: true,
    category: "UG",
  };
};

const toYearRow = ({ name }) => ({
  academic_year: name,
});

const mapGroup = (row = {}) => ({
  id: row.group_id ?? row.id,
  code: row.group_code,
  name: row.group_name,
  category: row.category || row.Category || "",
  years: row.duration_years ?? 0,
  semesters: row.number_semesters ?? 0,
});

const toGroupRow = ({ code, name, years, semesters, category }) => {
  const row = {
    group_code: code,
    group_name: name,
    duration_years: years ?? null,
    number_semesters: semesters ?? null,
  };
  // include category only when provided to avoid sending an unknown
  // column to Supabase (some schemas may not have this column).
  // Some DB schemas use a capitalized column name Category (legacy).
  // Write to that column name when present so UG/PG values persist.
  if (category !== undefined) row.Category = category ?? null;
  return row;
};

const mapCourse = (row = {}) => {
  const code = row.course_code || row.code;
  const name = row.course_name || row.name;
  const groupCode = row.group_code || row.groupCode || "";
  const groupName = row.group_name || row.groupName || "";
  const semesters = Number(row.no_of_semesters ?? row.semesters ?? 0) || 0;
  const duration =
    row.duration_years ?? (semesters ? Math.ceil(semesters / 2) : null);
  return {
    id: row.course_id ?? row.id,
    code,
    name,
    courseCode: code,
    courseName: name,
    group_code: groupCode,
    groupCode,
    group_name: groupName,
    groupName,
    semesters,
    duration_years: duration,
  };
};

const toCourseRow = ({ code, name, group_name, groupName, semesters, duration_years }) => {
  const normalizedGroupName = group_name ?? groupName ?? null;
  return {
    course_code: code,
    course_name: name,
    group_name: normalizedGroupName,
    no_of_semesters: semesters ?? null,
    duration_years:
      duration_years ?? (semesters ? Math.ceil(semesters / 2) : null),
  };
};

const parseSubjectList = (value) => {
  if (!value && value !== 0) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch { }
    return trimmed
      .split(/[\r\n,]+/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch { }
  return [];
};

const mapSubCategory = (row = {}) => ({
  id: row.category_id ?? row.id,
  name: row.category_name,
  credits: row.credits ?? 0,
  subjects: parseSubjectList(row.subjects_name),
});

const toSubCategoryRow = ({ name, credits }) => ({
  category_name: name,
  credits: credits ?? 0,
});

const mapSubject = (row = {}) => {
  const semesterValue = row.semester_number ?? row.semester ?? "";
  const feeAmountValue = row.amount ?? row.fee_amount;
  const subjectCodeRaw =
    row.subject_code ??
    row.subjectCode ??
    row.subject_name ??
    row.subjectName ??
    "";
  const subjectCodeSource = subjectCodeRaw;
  const subjectCodes = parseSubjectList(subjectCodeSource);
  const subjectCode =
    subjectCodes.length > 0 ? subjectCodes[0] : subjectCodeSource;
  const subjectName = row.subject_name || row.subjectName || subjectCode;
  return {
    id: row.subject_id ?? row.id,
    subjectId: row.subject_id ?? row.id ?? "",
    academicYearId: row.academic_year_id || row.academicYearId || "",
    academicYearName:
      row.academic_year_name || row.academic_year || row.academicYearName || "",
    groupCode: row.group_code || row.groupCode || "",
    courseCode: row.course_code || row.courseCode || row.course_name || "",
    courseName: row.course_name || row.courseName || row.course_code || "",
    semester:
      semesterValue === "" ||
        semesterValue === undefined ||
        semesterValue === null
        ? ""
        : Number(semesterValue),
    categoryId: row.category_id ?? row.categoryId ?? "",
    category:
      row.category ||
      row.category_name ||
      row.subject_category?.category_name ||
      "",
    subjectCodeRaw,
    subjectCode,
    subjectCodes,
    subjectName,
    subjectNames: parseSubjectList(
      row.subjects_name || row.subject_name || row.subjectName
    ),
    feeCategory:
      row.fee_category || row.feeCategory || row.fees_categories || "",
    feeAmount:
      feeAmountValue === undefined ||
        feeAmountValue === null ||
        feeAmountValue === ""
        ? ""
        : Number(feeAmountValue),
  };
};

const toSubjectRow = (subject = {}) => {
  const semesterRaw =
    subject.semester ??
    subject.semester_number ??
    subject.semesterNumber ??
    null;
  const semesterValue =
    semesterRaw === "" || semesterRaw === undefined || semesterRaw === null
      ? null
      : Number(semesterRaw);
  const feeAmountValue =
    subject.amount ?? subject.feeAmount ?? subject.fee_amount;
  const normalizedFee =
    feeAmountValue === "" ||
      feeAmountValue === undefined ||
      feeAmountValue === null
      ? null
      : Number(feeAmountValue);
  const subjectId = subject.subject_id || subject.subjectId || subject.id;
  const row = {
    academic_year:
      subject.academic_year ||
      subject.academicYearName ||
      subject.academicYear ||
      null,
    course_name:
      subject.course_name || subject.courseName || subject.courseCode || null,
    semester_number: semesterValue,
    category_id: subject.category_id ?? subject.categoryId ?? null,
    subject_code:
      subject.subject_code ||
      subject.subjectCode ||
      subject.subject_name ||
      subject.subjectName ||
      null,
    subject_name:
      subject.subject_name ||
      subject.subjectName ||
      subject.subject_code ||
      subject.subjectCode ||
      null,
    fees_categories: subject.fees_categories || subject.feeCategory || null,
    amount: normalizedFee,
  };
  if (subjectId) {
    row.subject_id = subjectId;
  }
  return row;
};

const mapApplication = (row = {}) => ({
  id: row.id,
  application_no: row.application_no,
  admission_year: row.admission_year,
  course_id: row.course_id,
  group_id: row.group_id,
  full_name: row.full_name,
  gender: row.gender,
  date_of_birth: row.date_of_birth,
  father_name: row.father_name,
  mother_name: row.mother_name,
  nationality: row.nationality,
  state: row.state,
  religion: row.religion,
  caste: row.caste,
  aadhar_number: row.aadhar_number,
  address: row.address,
  pincode: row.pincode,
  phone_number: row.phone_number,
  parent_no: row.parent_no,
  tenth_register_no: row.tenth_register_no,
  tenth_percentage: row.tenth_percentage,
  twelth_register_no: row.twelth_register_no,
  twelth_percentage: row.twelth_percentage,
  photo_url: row.photo_url,
  cert_url: row.cert_url,
  status: row.status || "DRAFT",
  created_at: row.created_at,
});

const toApplicationRow = (app = {}) => ({
  application_no: app.application_no,
  admission_year: app.admission_year ?? null,
  course_id: app.course_id ?? null,
  group_id: app.group_id ?? null,
  full_name: app.full_name || null,
  gender: app.gender || null,
  date_of_birth: app.date_of_birth || app.dob || null,
  father_name: app.father_name || null,
  mother_name: app.mother_name || null,
  nationality: app.nationality || null,
  state: app.state || null,
  religion: app.religion || null,
  caste: app.caste || null,
  aadhar_number: app.aadhar_number || app.aadhar_no || null,
  address: app.address || null,
  pincode: app.pincode || app.postal_code || null,
  phone_number: app.phone_number || app.mobile || null,
  parent_no: app.parent_no || app.Parent_no || null,
  tenth_register_no: app.tenth_register_no || null,
  tenth_percentage: app.tenth_percentage ?? null,
  twelth_register_no: app.twelth_register_no || null,
  twelth_percentage: app.twelth_percentage ?? null,
  photo_url: app.photo_url || null,
  cert_url: app.cert_url || null,
  status: app.status || "DRAFT",
});

const mapStudent = (row = {}) => ({
  id: row.id ?? row.student_id,
  student_id: row.student_id,
  hall_ticket_no: row.hall_ticket_no || row.hallticket_no,
  hallticket_no: row.hall_ticket_no || row.hallticket_no,
  full_name: row.full_name,
  academic_year: row.academic_year,
  group: row.group_name || row.group,
  course_id: row.course_name || row.course_id,
  course_name: row.course_name,
  gender: row.gender,
  dob: row.date_of_birth || row.dob,
  mobile: row.phone_number || row.mobile,
  email: row.email,
  address: row.address,
  father_name: row.father_name,
  mother_name: row.mother_name,
  nationality: row.nationality,
  state: row.state,
  aadhar_no: row.aadhar_number || row.aadhar_no,
  postal_code: row.pincode || row.postal_code,
  religion: row.religion,
  caste: row.caste,
  sub_caste: row.sub_caste,
  photo_url: row.photo_url,
  cert_url: row.cert_url,
  status: row.status || "ACTIVE",
  status: row.status || "ACTIVE",
  created_at: row.created_at,
  current_semester: row.current_semester,
});

const toStudentRow = (student = {}) => ({
  student_id: student.student_id,
  hall_ticket_no: student.hall_ticket_no || student.hallticket_no || null,
  academic_year: student.academic_year || null,
  group_name: student.group || student.group_name || null,
  course_name: student.course_id || student.course_name || null,
  full_name: student.full_name || null,
  gender: student.gender || null,
  date_of_birth: student.dob || student.date_of_birth || null,
  father_name: student.father_name || null,
  mother_name: student.mother_name || null,
  nationality: student.nationality || null,
  state: student.state || null,
  aadhar_number: student.aadhar_no || student.aadhar_number || null,
  address: student.address || null,
  pincode: student.postal_code || student.pincode || null,
  phone_number: student.mobile || student.phone_number || null,
  religion: student.religion || null,
  caste: student.caste || null,
  sub_caste: student.sub_caste || null,
  photo_url: student.photo_url || null,
  cert_url: student.cert_url || null,
  cert_url: student.cert_url || null,
  status: student.status || "ACTIVE",
  current_semester: student.current_semester || null,
});

const mapBatch = (row = {}) => ({
  id: row.id,
  name: row.name,
  created_at: row.created_at,
});

const toBatchRow = ({ name }) => ({ name });

const mapExam = (row = {}) => {
  const name = row.exam_name ?? row.name ?? row.title ?? "";
  const resultStatus =
    row.result_status ??
    row.resultStatus ??
    row.status ??
    row.exam_status ??
    "";
  const publishedFlag =
    row.results_published ??
    row.result_published ??
    row.resultsPublished ??
    row.resultPublished ??
    row.is_results_published ??
    row.isResultPublished ??
    null;
  return {
    id: row.id,
    exam_name: name,
    title: name,
    name,
    created_at: row.created_at,
    date: row.date || row.exam_date || row.created_at || "",
    time: row.time || row.exam_time || "",
    venue: row.venue || "",
    result_status: resultStatus,
    results_published: publishedFlag,
  };
};

const toExamRow = ({ title, name, exam_name }) => ({
  exam_name: exam_name ?? name ?? title ?? "",
});

const mapExamSchedule = (row = {}) => ({
  id: row.schedule_id ?? row.id,
  academic_year: row.academic_year ?? '',
  group_code: row.group_code ?? '',
  course_code: row.course_code ?? '',
  semester_number:
    row.semester_number === undefined || row.semester_number === null
      ? null
      : Number(row.semester_number),
  subject_code: row.subject_code ?? '',
  exam_date: row.exam_date ?? '',
  exam_start_time: row.exam_start_time ?? '',
  exam_end_time: row.exam_end_time ?? '',
  category: row.category ?? '',
  created_at: row.created_at,
});

const mapFeeDefinition = (row = {}) => {
  const groupValue = row.group ?? row.group_code ?? row.group_name;
  const courseValue = row.course ?? row.course_code ?? row.course_name;
  const semesterValue = row.semester ?? row.semester_number;
  return {
    id: row.id ?? row.fee_id,
    academic_year: row.academic_year,
    group: groupValue,
    group_code: groupValue,
    group_name: row.group_name ?? groupValue,
    course_code: courseValue,
    course_name: row.course_name ?? courseValue,
    semester: semesterValue,
    semester_number: semesterValue,
    payment_type: row.payment_type ?? row.fee_cat,
    amount: row.amount,
  };
};

const toFeeDefinitionRow = (fee = {}) => ({
  academic_year: fee.academic_year,
  group: fee.group || fee.group_code,
  course: fee.course_code || fee.course,
  semester: fee.semester ?? fee.semester_number,
  fee_cat: fee.payment_type ?? fee.fee_cat,
  amount: fee.amount,
});

const mapResult = (row = {}) => ({
  id: row.id ?? row.result_id,
  student_id: row.student_id,
  exam_id: row.exam_id,
  total: row.total,
  grade: row.grade ?? row.result_status,
  created_at: row.created_at,
});

const toResultRow = (result = {}) => ({
  student_id: result.student_id,
  exam_id: result.exam_id,
  total: result.total,
  grade: result.grade,
});

const mapFeeCategory = (row = {}) => ({
  id: row.id,
  name: row.name,
  fees: row.fees || [],
});

const toFeeCategoryRow = (category = {}) => ({
  id: category.id,
  name: category.name,
  fees: category.fees || [],
});

const ADMIN_USERS = [
  { email: "admin@vijayam", password: "admin123", role: "ADMIN" },
  { email: "principal@vijayam", password: "principal123", role: "PRINCIPAL" },
];

export const api = {
  submitApplication: async (app) => {
    const application = await runQuery(
      supabase
        .from(TABLES.applications)
        .insert(toApplicationRow(app))
        .select("id")
        .single(),
      "Unable to submit application"
    );

    const documents = [];
    if (app.photo_url) {
      documents.push({
        application_id: application.id,
        document_type: "PHOTO",
        document_url: app.photo_url,
      });
    }
    if (app.cert_url) {
      documents.push({
        application_id: application.id,
        document_type: "TRANSFER_CERTIFICATE",
        document_url: app.cert_url,
      });
    }
    if (app.tenth_marksheet_url) {
      documents.push({
        application_id: application.id,
        document_type: "MARKSHEET_10TH",
        document_url: app.tenth_marksheet_url,
      });
    }
    if (app.twelth_marksheet_url) {
      documents.push({
        application_id: application.id,
        document_type: "MARKSHEET_12TH",
        document_url: app.twelth_marksheet_url,
      });
    }

    if (documents.length > 0) {
      await runQuery(
        supabase.from(TABLES.applicationDocuments).insert(documents),
        "Unable to save application documents"
      );
    }

    return { ok: true, id: application.id };
  },

  login: async (email, password) => {
    const user = ADMIN_USERS.find(
      (u) =>
        u.email.toLowerCase() === String(email).trim().toLowerCase() &&
        u.password === String(password)
    );
    if (!user) throw new Error("Invalid email or password");
    // Don't leak the password back
    const { password: _, ...safeUser } = user;
    return safeUser;
  },

  listApplications: async () => {
    const rows = await runQuery(
      supabase
        .from(TABLES.applications)
        .select("*")
        .order("created_at", { ascending: false }),
      "Unable to load applications"
    );
    return rows.map(mapApplication);
  },

  approveApplication: async (appId, student) => {
    const studentRow = toStudentRow(student);
    // ensure duplicates (allow same mobile/phone)
    await ensureNoDuplicate(TABLES.students, studentRow);
    await runQuery(
      supabase.from(TABLES.students).insert(studentRow),
      "Unable to create student record"
    );
    await runQuery(
      supabase
        .from(TABLES.applications)
        .update({ status: "APPROVED" })
        .eq("id", appId),
      "Unable to update application status"
    );
  },

  deleteApplication: async (appId) => {
    await runQuery(
      supabase.from(TABLES.applications).delete().eq("id", appId),
      "Unable to delete application"
    );
  },

  listAcademicYears: async () => {
    const rows = await runQuery(
      supabase
        .from(TABLES.academicYears)
        .select("id, academic_year")
        .order("academic_year"),
      "Unable to fetch academic years"
    );
    return rows.map(mapYear);
  },

  addAcademicYear: async (payload) => {
    await ensureNoDuplicate(TABLES.academicYears, toYearRow(payload));
    const row = await runQuery(
      supabase
        .from(TABLES.academicYears)
        .insert(toYearRow(payload))
        .select("id, academic_year")
        .single(),
      "Unable to add academic year"
    );
    return mapYear(row);
  },

  updateAcademicYear: async (id, payload) => {
    await ensureNoDuplicate(TABLES.academicYears, toYearRow(payload), {
      excludeId: id,
    });
    const row = await runQuery(
      supabase
        .from(TABLES.academicYears)
        .update(toYearRow(payload))
        .eq("id", id)
        .select("id, academic_year")
        .single(),
      "Unable to update academic year"
    );
    return mapYear(row);
  },

  deleteAcademicYear: async (id) => {
    await runQuery(
      supabase.from(TABLES.academicYears).delete().eq("id", id),
      "Unable to delete academic year"
    );
  },

  listGroups: async () => {
    const rows = await runQuery(
      supabase.from(TABLES.groups).select("*").order("group_code"),
      "Unable to fetch groups"
    );
    return rows.map(mapGroup);
  },

  addGroup: async (group) => {
    await ensureNoDuplicate(TABLES.groups, toGroupRow(group));
    const row = await runQuery(
      supabase
        .from(TABLES.groups)
        .insert(toGroupRow(group))
        .select("*")
        .single(),
      "Unable to add group"
    );
    return mapGroup(row);
  },

  updateGroup: async (id, group) => {
    await ensureNoDuplicate(TABLES.groups, toGroupRow(group), {
      excludeId: id,
    });
    const row = await runQuery(
      supabase
        .from(TABLES.groups)
        .update(toGroupRow(group))
        .eq("group_id", id)
        .select("*")
        .single(),
      "Unable to update group"
    );
    return mapGroup(row);
  },

  deleteGroup: async (id) => {
    await runQuery(
      supabase.from(TABLES.groups).delete().eq("group_id", id),
      "Unable to delete group"
    );
  },

  listCourses: async () => {
    const rows = await runQuery(
      supabase
        .from(TABLES.courses)
        .select(
          "course_id, course_code, course_name, group_name, no_of_semesters, duration_years"
        )
        .order("course_code"),
      "Unable to fetch courses"
    );
    return rows.map(mapCourse);
  },

  addCourse: async (course) => {
    await ensureNoDuplicate(TABLES.courses, toCourseRow(course));
    const row = await runQuery(
      supabase
        .from(TABLES.courses)
        .insert(toCourseRow(course))
        .select(
          "course_id, course_code, course_name, group_name, no_of_semesters, duration_years"
        )
        .single(),
      "Unable to add course"
    );
    return mapCourse(row);
  },

  updateCourse: async (id, course) => {
    await ensureNoDuplicate(TABLES.courses, toCourseRow(course), {
      excludeId: id,
    });
    const row = await runQuery(
      supabase
        .from(TABLES.courses)
        .update(toCourseRow(course))
        .eq("course_id", id)
        .select(
          "course_id, course_code, course_name, group_name, no_of_semesters, duration_years"
        )
        .single(),
      "Unable to update course"
    );
    return mapCourse(row);
  },

  deleteCourse: async (id) => {
    await runQuery(
      supabase.from(TABLES.courses).delete().eq("course_id", id),
      "Unable to delete course"
    );
  },

  listSubCategories: async () => {
    const rows = await runQuery(
      supabase
        .from(TABLES.subCategories)
        .select("category_id, category_name, credits")
        .order("category_name"),
      "Unable to fetch sub-categories"
    );
    return rows.map(mapSubCategory);
  },

  addSubCategory: async ({ name, credits }) => {
    await ensureNoDuplicate(
      TABLES.subCategories,
      toSubCategoryRow({ name, credits, subjects: [] })
    );
    const row = await runQuery(
      supabase
        .from(TABLES.subCategories)
        .insert(toSubCategoryRow({ name, credits, subjects: [] }))
        .select("category_id, category_name, credits")
        .single(),
      "Unable to add sub-category"
    );
    return mapSubCategory(row);
  },

  updateSubCategory: async (id, { name, credits, subjects }) => {
    await ensureNoDuplicate(
      TABLES.subCategories,
      toSubCategoryRow({ name, credits, subjects }),
      {
        excludeId: id,
      }
    );
    const row = await runQuery(
      supabase
        .from(TABLES.subCategories)
        .update(toSubCategoryRow({ name, credits, subjects }))
        .eq("category_id", id)
        .select("category_id, category_name, credits")
        .single(),
      "Unable to update sub-category"
    );
    return mapSubCategory(row);
  },

  deleteSubCategory: async (id) => {
    if (!id) return;
    await runQuery(
      supabase.from(TABLES.subjects).delete().eq("category_id", id),
      "Unable to delete linked subjects for sub-category"
    );
    await runQuery(
      supabase.from(TABLES.subCategories).delete().eq("category_id", id),
      "Unable to delete sub-category"
    );
  },

  listSubjects: async () => {
    const rows = await runQuery(
      supabase
        .from(TABLES.subjects)
        .select(
          "subject_id, academic_year, course_name, semester_number, category_id, subject_code, subject_name, fees_categories, amount"
        )
        .order("academic_year", { ascending: false })
        .order("course_name")
        .order("semester_number"),
      "Unable to fetch subjects"
    );
    return rows.map(mapSubject);
  },

  addSubjects: async (subjects = []) => {
    if (!Array.isArray(subjects) || !subjects.length) return [];

    // First, check for existing subjects to avoid duplicates
    const existingSubjects = await runQuery(
      supabase.from(TABLES.subjects).select('*'),
      "Unable to fetch existing subjects"
    );

    // Create a map of existing subject codes to their IDs for quick lookup
    const existingSubjectMap = new Map(
      existingSubjects.map(sub => [
        `${sub.academic_year}|${sub.course_name}|${sub.semester_number}|${sub.subject_code}`.toLowerCase(),
        sub.subject_id
      ])
    );

    // Prepare the final list of subjects to insert
    const subjectsToInsert = [];
    const subjectsToUpdate = [];

    for (const subject of subjects) {
      const subjectRow = toSubjectRow(subject);
      const subjectKey = `${subjectRow.academic_year}|${subjectRow.course_name}|${subjectRow.semester_number}|${subjectRow.subject_code}`.toLowerCase();

      if (existingSubjectMap.has(subjectKey)) {
        // Subject exists, prepare for update
        const existingId = existingSubjectMap.get(subjectKey);
        subjectsToUpdate.push({
          ...subjectRow,
          subject_id: existingId
        });
      } else {
        // New subject, prepare for insert
        if (subjectRow.subject_id !== undefined) {
          delete subjectRow.subject_id; // Let the database generate the ID
        }
        subjectsToInsert.push(subjectRow);
      }
    }

    // Process updates
    const updatedSubjects = [];
    if (subjectsToUpdate.length > 0) {
      for (const subject of subjectsToUpdate) {
        const { subject_id, ...updateData } = subject;
        const { data: updated, error } = await supabase
          .from(TABLES.subjects)
          .update(updateData)
          .eq('subject_id', subject_id)
          .select();

        if (error) {
          console.error('Error updating subject:', error);
          throw new Error(`Error updating subject: ${error.message}`);
        }

        if (updated && updated.length > 0) {
          updatedSubjects.push(...updated);
        }
      }
    }

    // Process inserts
    let insertedSubjects = [];
    if (subjectsToInsert.length > 0) {
      const { data: inserted, error } = await supabase
        .from(TABLES.subjects)
        .insert(subjectsToInsert)
        .select();

      if (error) {
        console.error('Error inserting subjects:', error);
        throw new Error(`Error inserting subjects: ${error.message}`);
      }

      if (inserted) {
        insertedSubjects = inserted;
      }
    }

    // Return combined results
    return [...updatedSubjects, ...insertedSubjects].map(mapSubject);
  },

  deleteSubject: async (id) => {
    if (!id) return;
    await runQuery(
      supabase.from(TABLES.subjects).delete().eq("subject_id", id),
      "Unable to delete subject"
    );
  },

  updateSubject: async (id, row) => {
    if (!id) throw new Error("Missing subject id");
    const updateRow = { ...row };
    // Ensure we don't try to set subject_id (identity)
    if (updateRow.subject_id !== undefined) delete updateRow.subject_id;
    if (updateRow.subjectId !== undefined) delete updateRow.subjectId;
    const updated = await runQuery(
      supabase
        .from(TABLES.subjects)
        .update(updateRow)
        .eq("subject_id", id)
        .select(
          "subject_id, academic_year, course_name, semester_number, category_id, subject_code, subject_name, fees_categories, amount"
        )
        .single(),
      "Unable to update subject"
    );
    return mapSubject(updated);
  },

  listBatches: async () => {
    const rows = await runQuery(
      supabase
        .from(TABLES.batches)
        .select("id, name, created_at")
        .order("created_at", { ascending: false }),
      "Unable to fetch batches"
    );
    return rows.map(mapBatch);
  },

  addBatch: async (batch) => {
    await ensureNoDuplicate(TABLES.batches, toBatchRow(batch));
    const row = await runQuery(
      supabase
        .from(TABLES.batches)
        .insert(toBatchRow(batch))
        .select("id, name, created_at")
        .single(),
      "Unable to add batch"
    );
    return mapBatch(row);
  },

  listStudents: async () => {
    const rows = await runQuery(
      supabase
        .from(TABLES.students)
        .select(
          "id, student_id, hall_ticket_no, academic_year, group_name, course_name, full_name, gender, date_of_birth, phone_number, address, father_name, mother_name, nationality, state, aadhar_number, pincode, religion, caste, photo_url, cert_url, status, created_at, current_semester"
        )
        .order("created_at", { ascending: false }),
      "Unable to fetch students"
    );
    return rows.map(mapStudent);
  },

  deleteStudent: async (studentId) => {
    if (!studentId) return;
    await runQuery(
      supabase.from(TABLES.students).delete().eq("id", studentId),
      "Unable to delete student"
    );
  },

  listExams: async () => {
    const rows = await runQuery(
      supabase
        .from(TABLES.exams)
        .select("*")
        .order("created_at", { ascending: false }),
      "Unable to fetch exams"
    );
    return rows.map(mapExam);
  },

  addExam: async (exam) => {
    await runQuery(
      supabase.from(TABLES.exams).insert(toExamRow(exam)),
      "Unable to add exam"
    );
  },
  listExamSchedules: async (filters = {}) => {
    let query = supabase
      .from(TABLES.examSchedules)
      .select(
        "schedule_id, academic_year, semester_number, subject_code, exam_date, exam_start_time, exam_end_time, category"
      );
    if (filters.academic_year) query = query.eq("academic_year", filters.academic_year);
    if (filters.semester_number !== undefined && filters.semester_number !== null) {
      query = query.eq("semester_number", filters.semester_number);
    }
    if (filters.category) query = query.eq("category", filters.category);
    query = query.order("exam_date", { ascending: true });
    const rows = await runQuery(query, "Unable to fetch exam schedules");
    return (rows || []).map(mapExamSchedule);
  },
  getCurrentSemesterNumber: async () => {
    const row = await runMaybeSingle(
      supabase
        .from(TABLES.examSchedules)
        .select("semester_number")
        .order("schedule_id", { ascending: false })
        .limit(1)
        .maybeSingle(),
      "Unable to determine current semester"
    );
    if (!row) return null;
    return row.semester_number ?? null;
  },
  saveExamSchedule: async (entries = []) => {
    const payload = (entries || []).filter(Boolean);
    if (!payload.length) return;
    await runQuery(
      supabase.from(TABLES.examSchedules).insert(payload),
      "Unable to save exam schedule"
    );
  },

  addPayment: async (payment) => {
    await runQuery(
      supabase.from(TABLES.payments).insert({
        student_id: payment.student_id,
        amount: Number(payment.amount),
        method: payment.method,
        reference: payment.reference || null,
      }),
      "Unable to record payment"
    );
  },

  upsertHallTicket: async ({ student_id, exam_id, token }) => {
    const existing = await runMaybeSingle(
      supabase
        .from(TABLES.hallTickets)
        .select("id")
        .eq("student_id", student_id)
        .eq("exam_id", exam_id)
        .maybeSingle(),
      "Unable to load hall ticket"
    );
    if (existing) {
      await runQuery(
        supabase
          .from(TABLES.hallTickets)
          .update({ token })
          .eq("id", existing.id),
        "Unable to update hall ticket"
      );
    } else {
      await runQuery(
        supabase
          .from(TABLES.hallTickets)
          .insert({ student_id, exam_id, token }),
        "Unable to create hall ticket"
      );
    }
  },

  addResult: async (result) => {
    await runQuery(
      supabase.from(TABLES.results).insert(toResultRow(result)),
      "Unable to record result"
    );
  },

  listResults: async () => {
    const rows = await runQuery(
      supabase
        .from(TABLES.results)
        .select("id, student_id, exam_id, total, grade, created_at")
        .order("created_at", { ascending: false }),
      "Unable to fetch results"
    );
    return rows.map(mapResult);
  },

  listFees: async () => {
    const rows = await runQuery(
      supabase
        .from(TABLES.feeDefinitions)
        .select('id, academic_year, "group", course, semester, fee_cat, amount')
        .order("academic_year", { ascending: false }),
      "Unable to fetch fee definitions"
    );
    return rows.map(mapFeeDefinition);
  },

  addFee: async (fee) => {
    await ensureNoDuplicate(TABLES.feeDefinitions, toFeeDefinitionRow(fee));
    await runQuery(
      supabase.from(TABLES.feeDefinitions).insert(toFeeDefinitionRow(fee)),
      "Unable to add fee definition"
    );
  },

  getFeeTypes: async () => {
    const rows = await runQuery(
      supabase
        .from(TABLES.feeCategories)
        .select("id, name, fees")
        .order("name"),
      "Unable to fetch fee categories"
    );
    return rows.map(mapFeeCategory);
  },

  setFeeTypes: async (categories) => {
    // prevent duplicate names in the provided list
    const names = categories.map((c) =>
      String(c.name || "")
        .trim()
        .toLowerCase()
    );
    const dup = names.findIndex((n, i) => n && names.indexOf(n) !== i);
    if (dup !== -1) throw new Error("Duplicate fee category names in payload");

    const existing = await runQuery(
      supabase.from(TABLES.feeCategories).select("id, name"),
      "Unable to load existing fee categories"
    );
    const nextIds = new Set(categories.map((cat) => cat.id));
    const staleIds = existing
      .map((row) => row.id)
      .filter((id) => !nextIds.has(id));
    if (staleIds.length) {
      await runQuery(
        supabase.from(TABLES.feeCategories).delete().in("id", staleIds),
        "Unable to remove old fee categories"
      );
    }
    if (categories.length) {
      // validate against DB for duplicates (allow updating existing by id)
      for (const cat of categories) {
        await ensureNoDuplicate(TABLES.feeCategories, toFeeCategoryRow(cat), {
          excludeId: cat.id,
        });
      }
      await runQuery(
        supabase
          .from(TABLES.feeCategories)
          .upsert(categories.map(toFeeCategoryRow)),
        "Unable to save fee categories"
      );
    }
  },
  getStudentByHallTicket: async (hallTicketNo) => {
    const row = await runMaybeSingle(
      supabase
        .from(TABLES.students)
        .select("*")
        .eq("hall_ticket_no", hallTicketNo)
        .maybeSingle(),
      "Unable to find student"
    );
    if (!row) return null;

    const student = mapStudent(row);

    // Fetch full course name using the course code (stored in course_name column of students table)
    if (student.course_name) {
      const courseRow = await runMaybeSingle(
        supabase
          .from(TABLES.courses)
          .select("course_name")
          .eq("course_code", student.course_name)
          .maybeSingle()
      );
      if (courseRow && courseRow.course_name) {
        student.course_display = courseRow.course_name;
      }
    }

    // Fetch full group name using the group code (stored in group column of student object / group_name of DB)
    if (student.group) {
      const groupRow = await runMaybeSingle(
        supabase
          .from(TABLES.groups)
          .select("group_name")
          .eq("group_code", student.group)
          .maybeSingle()
      );
      if (groupRow && groupRow.group_name) {
        student.group_display = groupRow.group_name;
      }
    }

    return student;
  },
};
