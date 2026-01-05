import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminShell from '../../components/AdminShell'
import crestPrimary from '../../assets/media/images.png'
import SubjectsSection from '../exam/Subjects'
import { api } from '../../lib/mockApi'
import { showToast } from '../../store/ui'

const adminNavGroups = [

  {
    title: 'Exam Applications',
    static: true,
    items: [
      {
        to: '/admin-portal/applications',
        label: 'Exam Applications',
        icon: 'bi-inboxes'
      }
    ]
  },
  {
    title: 'Student Portal',
    items: [
      {
        to: '/admin-portal/academic-years',
        label: 'Academic Years',
        icon: 'bi-calendar3'
      },
      {
        to: '/admin-portal/groups-courses',
        label: 'Groups & Courses',
        icon: 'bi-diagram-3'
      },
      {
        to: '/admin-portal/subjects',
        label: 'Subjects',
        icon: 'bi-journal-text'
      }
    ]
  },
  {
    title: 'Fees Creation',
    static: true,
    items: [
      {
        to: '/admin-portal/fees-creation',
        label: 'Student Fees Creation',
        icon: 'bi-currency-rupee'
      }
    ]
  },    {
        title: 'Fees Collection',
        static: true,
        items: [
            {
                to: '/admin-portal/fees-collection',
                label: 'Fees Collection',
                icon: 'bi-cash-stack'
            }
        ]
    },
  {
    title: 'Profile Creation',
    static: true,
    items: [
      {
        to: '/admin-portal/profile-creation',
        label: 'Staff Profile Creation',
        icon: 'bi-person-plus-fill'
      }
    ]
  },
  {
    title: 'Staff Management',
    static: true,
    items: [
      {
        to: '/admin-portal/subject-mapping',
        label: 'Subject Mapping',
        icon: 'bi-person-lines-fill'
      }
    ]
  },
  {
    title: 'Department',
    static: true,
    items: [
      {
        to: '/admin-portal/department',
        label: 'Department',
        icon: 'bi-diagram-3'
      }
    ]
  },
  {
    title: 'Class Time Table',
    static: true,
    items: [
      {
        to: '/admin-portal/class-time-table',
        label: 'Class Time Table',
        icon: 'bi-calendar-date'
      }
    ]
  },
  {
    title: 'Class Time Table Creation',
    static: true,
    items: [
      {
        to: '/admin-portal/class-time-table-creation',
        label: 'Class Time Table Creation',
        icon: 'bi-calendar-plus'
      }
    ]
  }
]

const randomId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 8
    return v.toString(16)
  })
}

const buildSubjectForm = (category = '') => ({
  academicYearId: '',
  academicYearName: '',
  groupCode: '',
  courseCode: '',
  courseName: '',
  semester: '',
  category,
  categoryId: '',
  subjectName: '',
  subjectCode: '',
  extraSubjectNames: [],
  extraSubjectCodes: [],
  subjectSelections: [],
  feeCategory: '',
  feeAmount: '',
  subjectId: ''
})

const itemsToNames = (items = []) =>
  (items || []).map((item) => (item?.name || '').trim()).filter(Boolean)

const subjectsToItems = (subjects = []) => {
  if (!Array.isArray(subjects)) return []
  return subjects
    .map((name) => ({ id: randomId(), name }))
    .filter((item) => item.name)
}

const buildCourseLookup = (courses = []) => {
  return courses.reduce((acc, course) => {
    if (!course) return acc
    const courseCode = course.courseCode || course.code || course.course_code || ''
    const courseName = course.courseName || course.name || course.course_name || courseCode
    const groupCode = course.groupCode || course.group_code || course.group_name || ''
    const entry = { courseCode, courseName, groupCode }
    if (courseName) acc[courseName] = entry
    if (courseCode) acc[courseCode] = entry
    return acc
  }, {})
}

const buildYearNameLookup = (years = []) => {
  return years.reduce((acc, year) => {
    if (year?.name && year?.id !== undefined) acc[year.name] = year.id
    return acc
  }, {})
}

const invertMap = (mapObj = {}) => {
  return Object.entries(mapObj).reduce((acc, [key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      acc[value] = key
    }
    return acc
  }, {})
}

const normalizeSubjectRecord = (subject = {}, context = {}) => {
  const { courseLookup = {}, categoryNameById = {}, yearNameToId = {} } =
    context

  const semesterValue =
    subject.semester ??
    subject.semester_number ??
    subject.semesterNo ??
    subject.semesterNumber

  const feeAmountValue = subject.amount ?? subject.feeAmount ?? subject.fee_amount

  const subjectCode =
    subject.subjectCode ||
    subject.subject_code ||
    subject.subjectName ||
    subject.subject_name ||
    ''

  const subjectName = subject.subjectName || subject.subject_name || subjectCode

  const subjectNames =
    subject.subjectNames && Array.isArray(subject.subjectNames)
      ? subject.subjectNames
      : subject.subjectName
        ? [subject.subjectName]
        : []

  const subjectCodes =
    subject.subjectCodes && Array.isArray(subject.subjectCodes)
      ? subject.subjectCodes
      : subject.subjectCode
        ? [subject.subjectCode]
        : subject.subject_code
          ? [subject.subject_code]
          : []

  const courseKey =
    subject.courseName ||
    subject.course_name ||
    subject.courseCode ||
    subject.course_code ||
    ''

  const courseMeta = courseLookup[courseKey] || {}

  const academicYearName =
    subject.academicYearName ||
    subject.academic_year_name ||
    subject.academic_year ||
    ''

  const academicYearId =
    subject.academicYearId ||
    subject.academic_year_id ||
    yearNameToId[academicYearName] ||
    ''

  const categoryId = subject.category_id ?? subject.categoryId ?? ''
  const categoryName =
    subject.category ||
    subject.category_name ||
    categoryNameById[categoryId] ||
    ''

  const supabaseId = subject.subject_id || subject.subjectId || subject.id || ''

  return {
    id: supabaseId || subject.id || randomId(),
    subjectId: supabaseId || '',
    academicYearId,
    academicYearName,
    groupCode:
      subject.groupCode || subject.group_code || courseMeta.groupCode || '',
    courseCode:
      subject.courseCode ||
      subject.course_code ||
      courseMeta.courseCode ||
      courseKey,
    courseName: courseMeta.courseName || courseKey,
    semester:
      semesterValue === undefined || semesterValue === null || semesterValue === ''
        ? ''
        : Number(semesterValue),
    categoryId,
    category: categoryName,
    subjectCode,
    subjectName,
    feeCategory:
      subject.feeCategory ||
      subject.fee_category ||
      subject.fees_categories ||
      '',
    feeAmount:
      feeAmountValue === undefined ||
        feeAmountValue === null ||
        feeAmountValue === ''
        ? ''
        : Number(feeAmountValue),
    subjectNames,
    subjectCodes
  }
}

const buildSubjectBatchKey = (subject = {}) => {
  if (!subject) return ''
  if (subject.batchId) return subject.batchId
  const parts = [
    subject.academicYearId || subject.academicYearName || '',
    subject.groupCode || '',
    subject.courseCode || '',
    subject.semester === undefined || subject.semester === null
      ? ''
      : subject.semester,
    subject.categoryId || subject.category || ''
  ]
  const derived = parts
    .map((part) => (part === undefined || part === null ? '' : String(part)))
    .join('__')
  return derived || subject.subjectId || subject.id || ''
}

const ensureSubjectBatchKey = (subject = {}) => {
  if (!subject) return subject
  if (subject.batchId) return subject
  const batchKey = buildSubjectBatchKey(subject)
  return batchKey ? { ...subject, batchId: batchKey } : subject
}

const buildGroupNameMap = (groups = []) => {
  return (groups || []).reduce((acc, group) => {
    const code = group.code || group.group_code || group.groupName || ''
    const name = group.name || group.group_name || group.groupName || ''
    if (code) acc[code] = name || code
    return acc
  }, {})
}

export default function Subjects() {
  const [academicYears, setAcademicYears] = useState([])
  const [groups, setGroups] = useState([])
  const [courses, setCourses] = useState([])

  const [categories, setCategories] = useState([])
  const [catItems, setCatItems] = useState({})
  const [categoryName, setCategoryName] = useState('')
  const [categoryCredits, setCategoryCredits] = useState(0)
  const [editingCategory, setEditingCategory] = useState('')
  const [categoryCreditsMap, setCategoryCreditsMap] = useState({})
  const [categoryIdMap, setCategoryIdMap] = useState({})

  const [subjects, setSubjects] = useState([])
  const [pendingSubjects, setPendingSubjects] = useState([])
  const [subjectIdsToDelete, setSubjectIdsToDelete] = useState([])
  const [subjectEditBackup, setSubjectEditBackup] = useState([])
  const [subjectForm, setSubjectForm] = useState(() => buildSubjectForm(''))
  const [editingSubjectId, setEditingSubjectId] = useState('')
  const [editingBatchId, setEditingBatchId] = useState('')

  const groupNameByCode = useMemo(() => buildGroupNameMap(groups), [groups])
  const courseLookup = useMemo(() => buildCourseLookup(courses), [courses])
  const yearNameToId = useMemo(
    () => buildYearNameLookup(academicYears),
    [academicYears]
  )
  const categoryNameById = useMemo(
    () => invertMap(categoryIdMap),
    [categoryIdMap]
  )

  const subjectContext = useMemo(
    () => ({
      courseLookup,
      categoryNameById,
      yearNameToId
    }),
    [courseLookup, categoryNameById, yearNameToId]
  )

  const resolveYearName = (yearId) => {
    if (!yearId) return ''
    const match = academicYears.find((y) => String(y.id) === String(yearId))
    return match?.name || match?.academic_year || ''
  }

  const semesters = useMemo(() => {
    return courses.flatMap((course) => {
      const code = course.courseCode || course.code
      const count = Number(course.semesters || course.no_of_semesters || 0)
      if (!code || !count) return []
      return Array.from({ length: count }, (_, i) => ({
        id: `${code}-${i + 1}`,
        courseCode: code,
        number: i + 1
      }))
    })
  }, [courses])

  const loadSubjects = useCallback(async () => {
    try {
      const rows = (await api.listSubjects?.()) || []
      setSubjects(
        rows.map((rec) =>
          ensureSubjectBatchKey(normalizeSubjectRecord(rec, subjectContext))
        )
      )
    } catch (error) {
      console.error('Failed to reload subjects', error)
    }
  }, [subjectContext])

  useEffect(() => {
    setSubjectForm((prev) => {
      if (!categories.length) {
        return prev.category ? { ...prev, category: '' } : prev
      }
      if (categories.includes(prev.category)) return prev
      if (!prev.category) return prev
      return { ...prev, category: '' }
    })
  }, [categories])

  useEffect(() => {
    const loadInitial = async () => {
      try {
        const [yrs, grps, crs, subcats, subs] = await Promise.all([
          api.listAcademicYears?.() || [],
          api.listGroups?.() || [],
          api.listCourses?.() || [],
          api.listSubCategories?.() || [],
          api.listSubjects?.() || []
        ])

        setAcademicYears(yrs || [])
        setGroups(grps || [])
        setCourses(crs || [])

        const catNameByIdInit = {}

        if (subcats.length) {
          const names = []
          const itemsMap = {}
          const idMap = {}
          const creditsMap = {}

          subcats.forEach((cat) => {
            names.push(cat.name)
            idMap[cat.name] = cat.id
            creditsMap[cat.name] = cat.credits || 0
            itemsMap[cat.name] = subjectsToItems(cat.subjects)
            if (cat.id) catNameByIdInit[cat.id] = cat.name
          })

          setCategories(names)
          setCatItems(itemsMap)
          setCategoryIdMap(idMap)
          setCategoryCreditsMap(creditsMap)
        } else {
          setCategories([])
          setCatItems({})
          setCategoryIdMap({})
          setCategoryCreditsMap({})
        }

        const initialSubjectContext = {
          courseLookup: buildCourseLookup(crs || []),
          categoryNameById: catNameByIdInit,
          yearNameToId: buildYearNameLookup(yrs || [])
        }

        if (subs?.length) {
          setSubjects(
            subs.map((rec) =>
              ensureSubjectBatchKey(
                normalizeSubjectRecord(rec, initialSubjectContext)
              )
            )
          )
        } else {
          setSubjects([])
        }
      } catch (error) {
        console.error('Failed to load subjects data', error)
        showToast(error?.message || 'Failed to load subjects data', {
          type: 'danger'
        })
      }
    }

    loadInitial()
  }, [])

  const selectedGroupName = groupNameByCode[subjectForm.groupCode] || ''
  const coursesForGroup = courses.filter((c) => {
    if (!subjectForm.groupCode) return false
    const groupNameValue =
      c.groupName ||
      c.group_name ||
      groupNameByCode[c.groupCode] ||
      groupNameByCode[c.group_code] ||
      ''
    return groupNameValue && groupNameValue === selectedGroupName
  })
  const semForCourse = semesters.filter(
    (s) => s.courseCode === subjectForm.courseCode
  )

  const saveCategory = async () => {
    const trimmed = (categoryName || '').trim()
    if (!trimmed) {
      showToast('Enter a sub-category name.', {
        type: 'warning',
        title: 'Required field'
      })
      return
    }

    if (editingCategory) {
      const oldName = editingCategory
      const id = categoryIdMap[oldName]
      if (!id) {
        showToast('Unable to locate the category to update.', {
          type: 'danger'
        })
        return
      }
      const items = itemsToNames(catItems[oldName] || [])
      try {
        const updated = await api.updateSubCategory?.(id, {
          name: trimmed,
          credits: categoryCredits,
          subjects: items
        })
        setCategories((prev) =>
          prev.map((n) => (n === oldName ? updated.name : n))
        )
        setCatItems((prev) => {
          const copy = { ...prev }
          copy[updated.name] = subjectsToItems(updated.subjects || [])
          if (oldName !== updated.name) delete copy[oldName]
          return copy
        })
        setCategoryIdMap((prev) => {
          const copy = { ...prev }
          if (oldName !== updated.name) delete copy[oldName]
          copy[updated.name] = updated.id
          return copy
        })
        setCategoryCreditsMap((prev) => {
          const copy = { ...prev }
          if (oldName !== updated.name) delete copy[oldName]
          copy[updated.name] = updated.credits
          return copy
        })
        setCategoryName('')
        setCategoryCredits(0)
        setEditingCategory('')
        showToast('Sub-category updated.', { type: 'success' })
      } catch (error) {
        console.error('Failed to update sub-category', error)
        showToast(error?.message || 'Unable to update sub-category.', {
          type: 'danger'
        })
      }
    } else {
      try {
        const created = await api.addSubCategory?.({
          name: trimmed,
          credits: categoryCredits
        })
        if (created) {
          setCategories((prev) => [...prev, created.name])
          setCatItems((prev) => ({
            ...prev,
            [created.name]: subjectsToItems(created.subjects || [])
          }))
          setCategoryIdMap((prev) => ({ ...prev, [created.name]: created.id }))
          setCategoryCreditsMap((prev) => ({
            ...prev,
            [created.name]: created.credits
          }))
          setCategoryName('')
          setCategoryCredits(0)
          showToast('Sub-category added.', { type: 'success' })
        }
      } catch (error) {
        console.error('Failed to add sub-category', error)
        showToast(error?.message || 'Unable to add sub-category.', {
          type: 'danger'
        })
      }
    }
  }

  const deleteCategory = async (name) => {
    if (!name) return
    const id = categoryIdMap[name]
    setCategories((prev) => prev.filter((n) => n !== name))
    setCatItems((prev) => {
      const copy = { ...prev }
      delete copy[name]
      return copy
    })
    setCategoryCreditsMap((prev) => {
      const copy = { ...prev }
      delete copy[name]
      return copy
    })
    setCategoryIdMap((prev) => {
      const copy = { ...prev }
      delete copy[name]
      return copy
    })
    try {
      if (id) await api.deleteSubCategory?.(id)
      showToast('Sub-category deleted.', { type: 'info' })
    } catch (error) {
      console.error('Failed to delete sub-category', error)
      showToast('Unable to delete sub-category.', { type: 'danger' })
    }
  }

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
      feeAmount
    } = subjectForm

    const selectedNames = Array.isArray(subjectSelections)
      ? subjectSelections
      : []

    const hasSelection = selectedNames.length > 0

    const manualEntries = [
      {
        name: subjectName,
        code: subjectCode
      },
      ...(Array.isArray(extraSubjectNames)
        ? extraSubjectNames.map((name, idx) => ({
          name,
          code:
            Array.isArray(extraSubjectCodes) && idx < extraSubjectCodes.length
              ? extraSubjectCodes[idx]
              : ''
        }))
        : [])
    ]
      .map((entry) => ({
        name: (entry.name || '').trim(),
        code: (entry.code || '').trim()
      }))
      .filter((entry) => entry.name)

    if (
      !academicYearId ||
      !groupCode ||
      !courseCode ||
      !semester ||
      !category
    ) {
      showToast(
        'Fill in academic year, group, course, semester and sub-category before adding a subject.',
        { type: 'warning', title: 'Missing details' }
      )
      return
    }

    if (hasSelection && !subjectCode?.trim()) {
      showToast('Enter a subject code for your selected subject(s).', {
        type: 'warning',
        title: 'Subject code required'
      })
      return
    }

    if (!hasSelection && manualEntries.some((entry) => !entry.code)) {
      showToast('Enter a subject code for every typed subject.', {
        type: 'warning',
        title: 'Subject code required'
      })
      return
    }

    if (!hasSelection && manualEntries.length === 0) {
      showToast('Enter at least one subject name.', {
        type: 'warning',
        title: 'Subject name required'
      })
      return
    }

    const names = hasSelection
      ? selectedNames
      : manualEntries.map((entry) => entry.name)
    const codes = hasSelection
      ? Array(names.length).fill(subjectCode.trim())
      : manualEntries.map((entry) => entry.code)

    const academicYearName = resolveYearName(academicYearId)
    const categoryId = categoryIdMap[category] || ''
    const courseMeta = courses.find(
      (c) => c.courseCode === courseCode || c.code === courseCode
    )
    const courseName = courseMeta?.courseName || courseCode

    try {
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
        subjectCode: codes[idx] || '',
        subjectName: name,
        feeCategory: feeCategory || null,
        feeAmount: feeAmount ? Number(feeAmount) : null
      }))

      setPendingSubjects((prev) => {
        if (editingSubjectId) {
          return [
            ...prev.filter(
              (s) =>
                s.id !== editingSubjectId &&
                s.id !== editingSubjectId.toString()
            ),
            ...newEntries
          ]
        }
        return [...prev, ...newEntries]
      })

      showToast(
        `${names.length} subject${names.length === 1 ? '' : 's'} added to pending list. Click 'Submit All' to save to database.`,
        { type: 'info' }
      )

      setSubjectForm({
        ...subjectForm,
        subjectName: '',
        subjectCode: '',
        extraSubjectNames: [],
        extraSubjectCodes: [],
        subjectSelections: [],
        feeCategory: '',
        feeAmount: ''
      })

      if (editingSubjectId) {
        setEditingSubjectId('')
        setEditingBatchId('')
        setSubjectEditBackup([])
      }
    } catch (error) {
      console.error('Error preparing subjects:', error)
      showToast(error?.message || 'Failed to prepare subjects.', {
        type: 'danger',
        title: 'Error'
      })
    }
  }

  const editPendingSubject = (rec) => {
    const batchRef = buildSubjectBatchKey(rec)

    setPendingSubjects((prev) =>
      prev.filter((s) => buildSubjectBatchKey(s) !== batchRef)
    )

    const options = catItems[rec.category] || []
    const courseMeta =
      courseLookup[rec.courseCode] ||
      courseLookup[rec.courseName] ||
      courseLookup[rec.course_name] ||
      {}
    const resolvedGroupCode =
      rec.groupCode ||
      rec.group_code ||
      courseMeta.groupCode ||
      courseMeta.group_code ||
      ''
    const resolvedCourseCode =
      rec.courseCode ||
      rec.course_code ||
      courseMeta.courseCode ||
      courseMeta.course_code ||
      rec.courseName ||
      rec.course_name ||
      ''
    const resolvedCourseName =
      courseMeta.courseName ||
      courseMeta.course_name ||
      rec.courseName ||
      rec.course_name ||
      resolvedCourseCode

    const names = rec.subjectNames?.length
      ? rec.subjectNames
      : [rec.subjectName].filter(Boolean)
    const codes =
      rec.subjectCodes?.length
        ? rec.subjectCodes
        : rec.subjectCode
          ? [rec.subjectCode]
          : []
    const primaryCode = codes[0] || (rec.subjectCode || '')

    const allPreset =
      names.length > 0 &&
      names.every((name) => options.some((item) => item.name === name))

    const fixedCategoryId =
      categoryIdMap[rec.category] || rec.categoryId || rec.category_id || ''

    setSubjectForm({
      ...rec,
      groupCode: resolvedGroupCode,
      courseCode: resolvedCourseCode,
      courseName: resolvedCourseName,
      categoryId: fixedCategoryId,
      semester:
        rec.semester === undefined || rec.semester === null
          ? ''
          : rec.semester.toString(),
      feeCategory: rec.feeCategory || '',
      feeAmount: rec.feeAmount?.toString() || '',
      subjectCode: primaryCode,
      subjectName: allPreset ? '' : names[0] || '',
      extraSubjectNames: allPreset ? [] : names.slice(1),
      extraSubjectCodes: allPreset
        ? []
        : names.slice(1).map((_, idx) => codes[idx + 1] || primaryCode),
      subjectSelections: allPreset ? names : []
    })

    setEditingSubjectId(rec.subjectId || rec.id || '')
    setEditingBatchId(batchRef || '')
  }

  const submitPendingSubjects = async () => {
    if (!pendingSubjects.length) {
      showToast('No pending subjects to save.', { type: 'warning' })
      return
    }

    try {
      showToast('Saving subjects to database...', { type: 'info' })

      if (subjectIdsToDelete.length) {
        try {
          await Promise.all(
            subjectIdsToDelete.map((id) => api.deleteSubject?.(Number(id)))
          )
          setSubjectIdsToDelete([])
        } catch (error) {
          console.error('Failed to delete subject(s) before update', error)
          throw error
        }
      }

      const payload = []

      for (const item of pendingSubjects) {
        const academicYearName =
          item.academicYearName || resolveYearName(item.academicYearId)
        const courseMeta =
          courseLookup[item.courseCode] || courseLookup[item.courseName] || {}
        const categoryId = item.categoryId || categoryIdMap[item.category] || null
        const courseCodeValue =
          courseMeta.courseCode || item.courseCode || item.courseName || null

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
          }

          if (subjectData.subject_code && subjectData.subject_name) {
            payload.push(subjectData)
          }
        }

        const extraNames = item.extraSubjectNames || []
        const extraCodes = item.extraSubjectCodes || []

        for (let i = 0; i < Math.max(extraNames.length, extraCodes.length); i++) {
          const name = extraNames[i]
          const code = extraCodes[i] || ''

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
            })
          }
        }
      }

      const existingSubjects = (await api.listSubjects?.()) || []
      const existingSubjectKeys = new Set(
        existingSubjects.map(
          (sub) =>
            `${sub.academic_year}|${sub.course_name}|${sub.semester_number}|${sub.subject_code}`.toLowerCase()
        )
      )

      const newSubjects = payload.filter((subject) => {
        if (!subject.subject_code || !subject.subject_name) {
          console.warn('Skipping subject with missing required fields:', subject)
          return false
        }

        const key =
          `${subject.academic_year}|${subject.course_name}|${subject.semester_number}|${subject.subject_code}`.toLowerCase()
        const isNew = !existingSubjectKeys.has(key)

        if (!isNew) {
          console.log('Skipping duplicate subject:', key)
        }

        return isNew
      })

      if (newSubjects.length === 0) {
        showToast('All subjects already exist in the database.', {
          type: 'warning',
          title: 'No new subjects to add'
        })
        return
      }

      const BATCH_SIZE = 50
      for (let i = 0; i < newSubjects.length; i += BATCH_SIZE) {
        const batch = newSubjects.slice(i, i + BATCH_SIZE)
        try {
          await api.addSubjects?.(batch)
        } catch (error) {
          console.error('Error adding subjects batch:', error)
          throw error
        }
      }

      setPendingSubjects([])
      await loadSubjects()

      showToast(`Successfully added ${newSubjects.length} subject(s) to the database.`, {
        type: 'success'
      })

      setSubjectForm({
        academicYearId: '',
        academicYearName: '',
        groupCode: '',
        courseCode: '',
        courseName: '',
        semester: '',
        category: '',
        categoryId: '',
        subjectName: '',
        subjectCode: '',
        extraSubjectNames: [],
        extraSubjectCodes: [],
        subjectSelections: [],
        feeAmount: ''
      })
      setEditingSubjectId('')
      setEditingBatchId('')
    } catch (error) {
      console.error('Failed to save subjects', error)
      showToast(error?.message || 'Failed to save subjects. Please try again.', {
        type: 'danger'
      })
    }
  }

  const editSubject = async (rec) => {
    const batchRef = buildSubjectBatchKey(rec)
    const snapshot = (rec.subjectRecords || [rec]).filter(Boolean)
    if (snapshot.length) {
      setSubjectEditBackup(snapshot)
    }
    const ids = (rec.subjectIds || []).filter(Boolean)
    if (ids.length) {
      setSubjectIdsToDelete(ids)
    }

    setSubjects((prev) =>
      prev.filter((s) => buildSubjectBatchKey(s) !== batchRef)
    )

    editPendingSubject(rec)
  }

  const deletePendingSubject = (item) => {
    const batchRef = buildSubjectBatchKey(item)

    setPendingSubjects((prev) =>
      prev.filter((s) => buildSubjectBatchKey(s) !== batchRef)
    )

    if (editingSubjectId === (item.subjectId || item.id)) {
      setSubjectForm(buildSubjectForm(categories[0] || ''))
      setEditingSubjectId('')
    }

    if (editingBatchId === batchRef) {
      setSubjectForm(buildSubjectForm(categories[0] || ''))
      setEditingBatchId('')
    }
  }

  const deleteSubject = async (group) => {
    const batchRef = buildSubjectBatchKey(group)

    const ids = (
      group.subjectIds?.length ? group.subjectIds : [group.subjectId || group.id]
    ).filter(Boolean)

    setSubjects((prev) =>
      prev.filter((s) => buildSubjectBatchKey(s) !== batchRef)
    )

    try {
      const numericIds = ids
        .map((id) => Number(id))
        .filter((n) => Number.isFinite(n))
      if (numericIds.length) {
        await Promise.all(numericIds.map((id) => api.deleteSubject?.(id)))
      }

      showToast('Subject entries deleted.', { type: 'info' })
    } catch (error) {
      console.error('Failed to delete subject', error)
      showToast('Unable to delete subject.', { type: 'danger' })
    }
  }

  const cancelSubjectEdit = () => {
    if (subjectEditBackup.length) {
      setSubjects((prev) => [...subjectEditBackup, ...prev])
      setSubjectEditBackup([])
    }
    setEditingSubjectId('')
    setEditingBatchId('')
    setSubjectForm(buildSubjectForm(categories[0] || ''))
    setSubjectIdsToDelete([])
  }

  return (
    <AdminShell
      navGroups={adminNavGroups}
      brandTitle="Admin Management Console"
      brandSubtitle="Chittoor"
      footerTitle="Admin Management Studio"
      footerSubtitle="Crafted for Vijayam College"
    >
      <div className="desktop-container" style={{ overflowX: 'hidden' }}>
        <section className="setup-hero mb-4 text-center">
          <div className="setup-hero-copywrap mx-auto text-center" style={{ maxWidth: '640px' }}>
            <div className="admin-applications__crest mx-auto" aria-hidden="true">
              <img src={crestPrimary} alt="Vijayam crest" />
            </div>
            <h3 className="setup-hero-title mb-2">Vijayam Arts & Science College</h3>
            <p className="setup-hero-copy mb-3">Build and maintain subject structures for each program.</p>
            <div className="setup-hero-chips d-flex flex-wrap gap-2 justify-content-center">
              <span className="setup-hero-chip text-uppercase">SMART EXAMINATION PLATFORM</span>
              <span className="setup-hero-chip text-uppercase">ADMISSIONS CONTROL</span>
              <span className="setup-hero-chip text-uppercase">APPLICATIONS ADMIN CONSOLE</span>
            </div>
          </div>
        </section>

        <div className="row g-4 justify-content-center mx-0">
          <div className="col-12">
            <SubjectsSection
              subjectForm={subjectForm}
              setSubjectForm={setSubjectForm}
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
          </div>
        </div>
      </div>
    </AdminShell>
  )
}




