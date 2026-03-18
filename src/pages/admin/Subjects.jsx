import { useEffect, useMemo, useState } from 'react'
import AdShellAdmin from '../../components/AdShellAdmin'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../store/ui'
import ConfirmationModal from '../../components/ConfirmationModal'
import './AdminContent.css'

const LEVEL_RANGES = {
  Primary: { min: 1, max: 5 },
  Middle: { min: 6, max: 9 },
  Secondary: { min: 10, max: 12 },
}

const extractClassNumber = (className) => {
  const match = String(className || '').match(/\d+/)
  return match ? parseInt(match[0], 10) : 0
}

const EMPTY_FORM = {
  school_level: '',
  class_id: '',
  group_id: '',
  category_id: '',
  subject_title: '',
  subject_code: '',
  extraSubjects: [], // [{ title, code }]
}

const getTermLabelForLevel = (level) => (level === 'Secondary' ? 'Full Year' : 'All Terms')

export default function Subjects() {
  const [classes, setClasses] = useState([])
  const [allGroups, setAllGroups] = useState([])
  const [categories, setCategories] = useState([])
  const [mappings, setMappings] = useState([]) // class_subjects with joins
  const [loadError, setLoadError] = useState(false)
  const [masterSubjects, setMasterSubjects] = useState([])
  const [masterModalOpen, setMasterModalOpen] = useState(false)
  const [masterModalLoading, setMasterModalLoading] = useState(false)

  const [categoryName, setCategoryName] = useState('')
  const [subjectForm, setSubjectForm] = useState(EMPTY_FORM)

  const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: null, payload: null })
  const [viewModal, setViewModal] = useState({
    isOpen: false,
    loading: false,
    class_id: '',
    group_id: null,
    group_name: '',
    class_name: '',
    class_number: 0,
    school_level: '',
    term: '',
    categories: {},
    mappingCount: 0,
  })
  const [pendingMappingDeleteId, setPendingMappingDeleteId] = useState(null)
  const [pendingRowDeleteKey, setPendingRowDeleteKey] = useState(null)

  // __LOADERS__
  const loadMappings = async () => {
    const { data, error } = await supabase
      .from('class_subjects')
      .select(
        `
        id,
        class_id,
        group_id,
        periods_per_week,
        subjects (
          id,
          subject_title,
          subject_code,
          category_id,
          school_level,
          subject_categories!subjects_category_id_fkey(category_name)
        ),
        classes (
          id,
          class_name,
          class_number,
          school_level
        ),
        groups (
          id,
          group_name
        )
      `
      )
      .order('id', { ascending: true })

    if (error) throw error
    setMappings(data || [])
  }

  const loadMasterSubjects = async () => {
    try {
      setMasterModalLoading(true)
      const { data, error } = await supabase
        .from('subjects')
        .select(`
          id,
          subject_title,
          subject_code,
          school_level,
          class_subjects (id),
          staff_subjects (id)
        `)
        .order('subject_title')

      if (error) throw error
      const processed = (data || []).map((subject) => ({
        ...subject,
        classCount: (subject.class_subjects || []).length,
        staffCount: (subject.staff_subjects || []).length,
      }))
      setMasterSubjects(processed)
    } catch (err) {
      console.error('Failed to load master subjects', err)
    } finally {
      setMasterModalLoading(false)
    }
  }

  const loadInitialData = async () => {
    try {
      const [clsRes, catsRes, grpRes] = await Promise.all([
        supabase.from('classes').select('id, class_name, class_number, school_level').order('class_number'),
        supabase.from('subject_categories').select('id, category_name').order('category_name'),
        supabase.from('groups').select('id, group_name, class_id').order('group_name'),
      ])

      const errs = [clsRes.error, catsRes.error, grpRes.error].filter(Boolean)
      if (errs.length) {
        errs.forEach((e) => e.code !== '42P01' && console.error(e))
        setLoadError(true)
      }

      if (clsRes.data) setClasses(clsRes.data)
      if (catsRes.data) setCategories(catsRes.data)
      if (grpRes.data) setAllGroups(grpRes.data)

      await loadMappings()
      await loadMasterSubjects()
    } catch (err) {
      console.error('Error loading initial data', err)
      setLoadError(true)
    }
  }

  useEffect(() => {
    loadInitialData()
  }, [])

  const filteredClasses = useMemo(() => {
    if (!subjectForm.school_level) return []
    const range = LEVEL_RANGES[subjectForm.school_level]
    if (!range) return classes
    return classes.filter((c) => {
      const num = Number(c.class_number || extractClassNumber(c.class_name))
      return num >= range.min && num <= range.max
    })
  }, [classes, subjectForm.school_level])

  const selectedClass = useMemo(
    () => classes.find((c) => String(c.id) === String(subjectForm.class_id)),
    [classes, subjectForm.class_id]
  )
  const selectedClassNumber = selectedClass ? Number(selectedClass.class_number || extractClassNumber(selectedClass.class_name)) : 0
  const showGroupDropdown = selectedClassNumber === 11 || selectedClassNumber === 12

  const filteredGroups = useMemo(
    () => allGroups.filter((g) => String(g.class_id) === String(subjectForm.class_id)),
    [allGroups, subjectForm.class_id]
  )

  // __ACTIONS__
  const handleLevelChange = (level) => {
    setSubjectForm((prev) => ({
      ...prev,
      school_level: level,
      class_id: '',
      group_id: '',
      category_id: '',
      subject_title: '',
      subject_code: '',
      extraSubjects: [],
    }))
  }

  const handleAddCategory = async () => {
    if (!categoryName.trim()) {
      showToast('Category Name is required', { type: 'warning' })
      return
    }

    try {
      const { data, error } = await supabase
        .from('subject_categories')
        .insert({ category_name: categoryName.trim() })
        .select()
        .single()

      if (error) {
        showToast(error.message, { type: 'danger' })
        return
      }

      setCategories((prev) => [...prev, data].sort((a, b) => a.category_name.localeCompare(b.category_name)))
      setCategoryName('')
      showToast('Category added successfully', { type: 'success' })
    } catch (err) {
      console.error(err)
      showToast('Error saving category.', { type: 'danger' })
    }
  }

  const validateForm = () => {
    const { school_level, class_id, group_id, category_id, subject_title } = subjectForm
    if (!school_level) return showToast('School Level is required.', { type: 'warning' }), false
    if (!class_id) return showToast('Class is required.', { type: 'warning' }), false
    if (showGroupDropdown && !group_id) return showToast('Group is required for Class 11 & 12.', { type: 'warning' }), false
    if (!category_id) return showToast('Category is required.', { type: 'warning' }), false
    if (!String(subject_title || '').trim()) return showToast('Subject Title is required.', { type: 'warning' }), false
    return true
  }

  const buildSubjectInputs = () => {
    const all = [
      { title: String(subjectForm.subject_title || '').trim(), code: String(subjectForm.subject_code || '').trim() },
      ...(subjectForm.extraSubjects || []).map((ex) => ({
        title: String(ex.title || '').trim(),
        code: String(ex.code || '').trim(),
      })),
    ].filter((s) => s.title)

    return all.map((s) => ({ title: s.title, code: s.code || null }))
  }

  const getOrCreateMasterSubjectId = async ({ title, code, school_level, category_id }) => {
    // 1) Reuse MASTER by title + level (no code validation needed here)
    const { data: existing, error: existingErr } = await supabase
      .from('subjects')
      .select('id')
      .eq('subject_title', title)
      .eq('school_level', school_level)
      .maybeSingle()

    if (existingErr) throw existingErr
    if (existing?.id) return existing.id

    // 2) Only when inserting NEW subject, validate subject_code uniqueness
    if (code) {
      const { data: codeExisting, error: codeErr } = await supabase
        .from('subjects')
        .select('id')
        .eq('subject_code', code)
        .maybeSingle()

      if (codeErr) throw codeErr
      if (codeExisting?.id) {
        throw new Error('Subject code already exists')
      }
    }

    const { data: inserted, error: insertErr } = await supabase
      .from('subjects')
      .insert([
        {
          subject_title: title,
          subject_code: code || null,
          school_level,
          category_id,
        },
      ])
      .select('id')
      .single()

    if (insertErr) throw insertErr
    return inserted.id
  }

  const saveSubjects = async () => {
    if (!validateForm()) return

    const inputs = buildSubjectInputs()
    if (!inputs.length) return showToast('No subjects to save.', { type: 'warning' })

    try {
      const masterIds = []
      for (const input of inputs) {
        const subjectId = await getOrCreateMasterSubjectId({
          title: input.title,
          code: input.code,
          school_level: subjectForm.school_level,
          category_id: subjectForm.category_id,
        })
        masterIds.push(String(subjectId))
      }

      const classId = subjectForm.class_id
      const groupId = showGroupDropdown ? subjectForm.group_id : null
      const uniqueSubjectIds = Array.from(new Set(masterIds))

      let existingQuery = supabase.from('class_subjects').select('subject_id').eq('class_id', classId).in('subject_id', uniqueSubjectIds)
      if (showGroupDropdown) existingQuery = existingQuery.eq('group_id', groupId)
      else existingQuery = existingQuery.is('group_id', null)

      const { data: bulkExisting, error: bulkErr } = await existingQuery
      if (bulkErr) throw bulkErr
      const existingSet = new Set((bulkExisting || []).map((r) => String(r.subject_id)))

      const toInsert = uniqueSubjectIds.filter((sid) => !existingSet.has(String(sid)))
      const already = uniqueSubjectIds.filter((sid) => existingSet.has(String(sid)))

      if (already.length) {
        showToast(showGroupDropdown ? 'Subject already assigned to this group.' : 'Subject already assigned to this class.', { type: 'warning' })
      }

      if (toInsert.length) {
        const rows = toInsert.map((sid) => ({ class_id: classId, subject_id: sid, group_id: groupId, periods_per_week: 5 }))
        const { error: insErr } = await supabase.from('class_subjects').insert(rows)
        if (insErr) throw insErr
      }

      showToast(showGroupDropdown ? 'Subjects saved and assigned to group.' : 'Subjects saved and assigned to class.', { type: 'success' })
      setSubjectForm((prev) => ({ ...prev, category_id: '', subject_title: '', subject_code: '', extraSubjects: [] }))
      await loadMappings()
      await loadMasterSubjects()
    } catch (err) {
      console.error('Error saving subjects', err)
      showToast(err.message || 'Failed to save subjects.', { type: 'danger' })
    }
  }

  const openMasterSubjectModal = () => {
    setMasterModalOpen(true)
    loadMasterSubjects()
  }

  const closeMasterSubjectModal = () => {
    setMasterModalOpen(false)
  }

  const groupedRows = useMemo(() => {
    const byKey = {}

    ;(mappings || []).forEach((row) => {
      const classId = row.class_id
      const groupId = row.group_id ?? null
      const cls = row.classes
      const subj = row.subjects
      if (!classId || !cls) return

      const className = cls.class_name || 'Unknown Class'
      const classNumber = Number(cls.class_number || extractClassNumber(className))
      const level = cls.school_level || subj?.school_level || '-'
      const term = getTermLabelForLevel(level)
      const is11or12 = classNumber === 11 || classNumber === 12
      const key = `${String(classId)}__${groupId ? String(groupId) : 'null'}`
      const groupName = is11or12 ? (row.groups?.group_name || 'Unknown Group') : ''

      if (!byKey[key]) {
        byKey[key] = {
          key,
          class_id: classId,
          group_id: groupId,
          school_level: level,
          class_name: className,
          class_number: classNumber,
          group_name: is11or12 ? groupName : '',
          term,
          mappingCount: 0,
        }
      }

      if (subj?.id) byKey[key].mappingCount += 1
    })

    return Object.values(byKey).sort((a, b) => {
      if (a.class_number !== b.class_number) return a.class_number - b.class_number
      return String(a.group_name || '').localeCompare(String(b.group_name || ''))
    })
  }, [mappings])

  const openViewModal = async (row) => {
    setPendingRowDeleteKey(null)
    setPendingMappingDeleteId(null)
    setViewModal({
      isOpen: true,
      loading: true,
      class_id: row.class_id,
      group_id: row.group_id ?? null,
      group_name: row.group_name || '',
      class_name: row.class_name,
      class_number: row.class_number,
      school_level: row.school_level,
      term: row.term,
      categories: {},
      mappingCount: row.mappingCount,
    })

    try {
      let viewQuery = supabase
        .from('class_subjects')
        .select(
          `
          id,
          class_id,
          group_id,
          subjects (
            id,
            subject_title,
            subject_code,
            subject_categories!subjects_category_id_fkey(category_name)
          )
        `
        )
        .eq('class_id', row.class_id)

      if (row.group_id) viewQuery = viewQuery.eq('group_id', row.group_id)
      else viewQuery = viewQuery.is('group_id', null)

      const { data, error } = await viewQuery.order('id', { ascending: true })

      if (error) throw error

      const cats = {}
      ;(data || []).forEach((r) => {
        const s = r.subjects
        if (!s?.id) return
        const catName = s.subject_categories?.category_name || 'Uncategorised'
        if (!cats[catName]) cats[catName] = []
        cats[catName].push({
          mapping_id: r.id,
          subject_id: s.id,
          subject_title: s.subject_title,
          subject_code: s.subject_code,
        })
      })

      Object.keys(cats).forEach((catName) => {
        cats[catName] = cats[catName].slice().sort((a, b) => String(a.subject_title || '').localeCompare(String(b.subject_title || '')))
      })

      setViewModal((prev) => ({ ...prev, loading: false, categories: cats, mappingCount: (data || []).length }))
    } catch (err) {
      console.error('Failed to load subjects', err)
      showToast('Failed to load subjects.', { type: 'danger' })
      setViewModal((prev) => ({ ...prev, loading: false }))
    }
  }

  const closeViewModal = () => {
    setPendingMappingDeleteId(null)
    setViewModal({
      isOpen: false,
      loading: false,
      class_id: '',
      group_id: null,
      group_name: '',
      class_name: '',
      class_number: 0,
      school_level: '',
      term: '',
      categories: {},
      mappingCount: 0,
    })
  }

  const handleConfirmDelete = async () => {
    const { type, payload } = confirmModal
    if (!type || !payload) {
      setConfirmModal({ isOpen: false, type: null, payload: null })
      return
    }

    try {
      if (type === 'CATEGORY') {
        const { error } = await supabase.from('subject_categories').delete().eq('id', payload)
        if (error) throw error
        setCategories((prev) => prev.filter((c) => c.id !== payload))
        showToast('Category deleted', { type: 'success' })
      } else if (type === 'MASTER_SUBJECT') {
        const { error } = await supabase.from('subjects').delete().eq('id', payload.id)
        if (error) throw error
        showToast('Subject deleted from master list', { type: 'success' })
        await loadMappings()
        await loadMasterSubjects()
      }
    } catch (err) {
      console.error(err)
      showToast(err.message || 'Delete failed', { type: 'danger' })
    } finally {
      setConfirmModal({ isOpen: false, type: null, payload: null })
    }
  }

  const deleteSingleMapping = async (mappingId) => {
    if (!mappingId) return

    try {
      const { error } = await supabase.from('class_subjects').delete().eq('id', mappingId)
      if (error) throw error

      setMappings((prev) => (prev || []).filter((m) => String(m.id) !== String(mappingId)))
      setViewModal((prev) => {
        const nextCats = {}
        Object.entries(prev.categories || {}).forEach(([catName, subs]) => {
          const nextSubs = (subs || []).filter((s) => String(s.mapping_id) !== String(mappingId))
          if (nextSubs.length) nextCats[catName] = nextSubs
        })
        const nextCount = Math.max(0, Number(prev.mappingCount || 0) - 1)
        return { ...prev, categories: nextCats, mappingCount: nextCount }
      })

      setPendingMappingDeleteId(null)
    } catch (err) {
      console.error(err)
      showToast('Failed to delete subject. Please try again.', { type: 'danger' })
      setPendingMappingDeleteId(null)
    }
  }

  const deleteAllForRow = async (row) => {
    if (!row?.class_id) return

    try {
      let delQuery = supabase.from('class_subjects').delete().eq('class_id', row.class_id)
      if (row.group_id) delQuery = delQuery.eq('group_id', row.group_id)
      else delQuery = delQuery.is('group_id', null)

      const { error } = await delQuery
      if (error) throw error

      setMappings((prev) =>
        (prev || []).filter((m) => {
          const sameClass = String(m.class_id) === String(row.class_id)
          const sameGroup = String(m.group_id || '') === String(row.group_id || '')
          return !(sameClass && sameGroup)
        })
      )

      setPendingRowDeleteKey(null)

      if (viewModal.isOpen) {
        const sameClass = String(viewModal.class_id) === String(row.class_id)
        const sameGroup = String(viewModal.group_id || '') === String(row.group_id || '')
        if (sameClass && sameGroup) closeViewModal()
      }
    } catch (err) {
      console.error(err)
      showToast('Failed to delete class mapping. Please try again.', { type: 'danger' })
      setPendingRowDeleteKey(null)
    }
  }

  const updateExtra = (idx, field, value) => {
    const arr = [...subjectForm.extraSubjects]
    arr[idx] = { ...arr[idx], [field]: value }
    setSubjectForm((prev) => ({ ...prev, extraSubjects: arr }))
  }

  const removeExtra = (idx) => {
    const arr = subjectForm.extraSubjects.filter((_, i) => i !== idx)
    setSubjectForm((prev) => ({ ...prev, extraSubjects: arr }))
  }

  const addExtraRow = () => {
    setSubjectForm((prev) => ({ ...prev, extraSubjects: [...prev.extraSubjects, { title: '', code: '' }] }))
  }

  // __RENDER__
  return (
    <AdShellAdmin>
      <div className="desktop-container admin-content" style={{ overflowX: 'hidden' }}>
        <h4 className="mb-4">Subjects Overview</h4>

        {loadError && (
          <div className="alert alert-warning mb-4 fw-bold">
            <i className="bi bi-exclamation-triangle-fill me-2"></i>
            Some data failed to load. Please check your database tables.
          </div>
        )}

        {/* CATEGORIES */}
        <section className="setup-section mb-4">
          <div className="students-section-shell card card-soft mb-4">
            <div className="students-section-shell-header mb-3">
              <div>
                <h5 className="section-title mb-1" style={{ fontSize: '1.1rem' }}>
                  Subject Categories
                </h5>
                <p className="students-section-copy mb-0">Organise subjects into meaningful buckets (e.g., Main, Activity, Language).</p>
              </div>
            </div>

            <div className="students-section-form row g-2 align-items-end">
              <div className="col-md-6">
                <label className="form-label fw-bold mb-1">Category Name</label>
                <input
                  className="form-control"
                  placeholder="e.g., Main"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddCategory()
                  }}
                />
              </div>
              <div className="col-md-3">
                <button type="button" className="btn btn-primary students-button w-100" onClick={handleAddCategory}>
                  Add Category
                </button>
              </div>
            </div>

            {categories.length > 0 && (
              <div className="row g-3 mt-3">
                {categories.map((cat) => (
                  <div key={cat.id} className="col-md-4">
                    <div className="card h-100 students-category-card">
                      <div className="card-body d-flex justify-content-between align-items-center">
                        <p className="fw-bold mb-0 text-dark">{cat.category_name}</p>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => setConfirmModal({ isOpen: true, type: 'CATEGORY', payload: cat.id })}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <div className="mb-4 text-end">
          <button type="button" className="btn btn-outline-secondary fw-bold rounded-pill px-4" onClick={openMasterSubjectModal}>
            View All Subjects
          </button>
        </div>

        {/* CREATE SUBJECTS (CLASS-WISE) */}
        <section className="setup-section mb-4">
          <div className="students-section-shell card card-soft mb-4">
            <div className="students-section-shell-header mb-4">
              <div>
                <h5 className="section-title mb-1" style={{ fontSize: '1.1rem' }}>
                  Create Subjects
                </h5>
                <p className="students-section-copy mb-0">
                  Creates MASTER subjects per level. Classes 1–10 are class-wise; Classes 11–12 are group-wise.
                </p>
              </div>
            </div>

            <div className="students-section-form">
              <div className="row g-3 mb-3">
                <div className="col-md-3">
                  <label className="form-label fw-bold mb-1">School Level *</label>
                  <select className="form-select" value={subjectForm.school_level} onChange={(e) => handleLevelChange(e.target.value)}>
                    <option value="">Select Level</option>
                    <option value="Primary">Primary (Class 1-5)</option>
                    <option value="Middle">Middle (Class 6-9)</option>
                    <option value="Secondary">Secondary (Class 10-12)</option>
                  </select>
                </div>

                <div className="col-md-3">
                  <label className="form-label fw-bold mb-1">Class *</label>
                  <select
                    className="form-select"
                    value={subjectForm.class_id}
                    disabled={!subjectForm.school_level}
                    onChange={(e) => setSubjectForm((prev) => ({ ...prev, class_id: e.target.value, group_id: '' }))}
                  >
                    <option value="">Select Class</option>
                    {filteredClasses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.class_name}
                      </option>
                    ))}
                  </select>
                </div>

                {showGroupDropdown && (
                  <div className="col-md-3">
                    <label className="form-label fw-bold mb-1">Group *</label>
                    <select
                      className="form-select"
                      value={subjectForm.group_id}
                      onChange={(e) => setSubjectForm((prev) => ({ ...prev, group_id: e.target.value }))}
                    >
                      <option value="">Select Group</option>
                      {filteredGroups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.group_name}
                        </option>
                      ))}
                    </select>
                    <div className="text-muted small mt-1">Required for Class 11 & 12.</div>
                  </div>
                )}

                <div className="col-md-3">
                  <label className="form-label fw-bold mb-1">Category *</label>
                  <select
                    className="form-select"
                    value={subjectForm.category_id}
                    onChange={(e) => setSubjectForm((prev) => ({ ...prev, category_id: e.target.value }))}
                  >
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.category_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="row g-3">
                <div className="col-md-7">
                  <label className="form-label fw-bold mb-1">Subject Title *</label>
                  <input
                    className="form-control"
                    placeholder="e.g., Tamil"
                    value={subjectForm.subject_title}
                    onChange={(e) => setSubjectForm((prev) => ({ ...prev, subject_title: e.target.value }))}
                  />
                </div>
                <div className="col-md-5">
                  <label className="form-label fw-bold mb-1">Subject Code</label>
                  <input
                    className="form-control"
                    placeholder="e.g., TAM101"
                    value={subjectForm.subject_code}
                    onChange={(e) => setSubjectForm((prev) => ({ ...prev, subject_code: e.target.value }))}
                  />
                </div>
              </div>

              <div className="mt-3">
                <div className="fw-bold text-dark mb-2">Add Subject</div>
                {(subjectForm.extraSubjects || []).map((ex, idx) => (
                  <div key={idx} className="d-flex gap-2 mb-2 flex-wrap">
                    <input
                      className="form-control"
                      style={{ flex: '1 1 40%' }}
                      placeholder="Subject Title"
                      value={ex.title}
                      onChange={(e) => updateExtra(idx, 'title', e.target.value)}
                    />
                    <input
                      className="form-control"
                      style={{ flex: '1 1 35%' }}
                      placeholder="Subject Code"
                      value={ex.code}
                      onChange={(e) => updateExtra(idx, 'code', e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn btn-outline-danger btn-sm"
                      style={{ width: '38px', flexShrink: 0 }}
                      onClick={() => removeExtra(idx)}
                    >
                      <i className="bi bi-x-lg"></i>
                    </button>
                  </div>
                ))}

                <button type="button" className="btn btn-sm btn-outline-primary mt-2 fw-bold" onClick={addExtraRow}>
                  <i className="bi bi-plus-lg me-1"></i> Add Subject
                </button>
              </div>

              <div className="mt-4 d-flex justify-content-end">
                <button type="button" className="btn btn-primary students-button fw-bold px-4" onClick={saveSubjects}>
                  Submit Subjects
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* CONFIGURED SUBJECTS TABLE */}
        <section className="setup-section mb-4">
          <div className="students-table-panel card card-soft mb-4">
            <div className="students-table-panel-header mb-3">
              <div>
                <p className="students-table-panel-title mb-1 text-white">Configured Subjects</p>
                <p className="students-table-panel-copy mb-0">Class-wise subjects (no section-wise variation).</p>
              </div>
            </div>

            <div className="table-responsive">
              <table className="table students-table align-middle mb-0">
                <thead>
                  <tr className="text-uppercase" style={{ fontSize: '0.82rem' }}>
                    <th className="fw-bold py-3 text-secondary ps-3" style={{ minWidth: '80px' }}>
                      Level
                    </th>
                    <th className="fw-bold py-3 text-secondary" style={{ minWidth: '120px' }}>
                      Class
                    </th>
                    <th className="fw-bold py-3 text-secondary" style={{ minWidth: '120px' }}>
                      Group
                    </th>
                    <th className="fw-bold py-3 text-secondary" style={{ minWidth: '90px' }}>
                      Term
                    </th>
                    <th className="fw-bold py-3 text-secondary" style={{ minWidth: '260px' }}>
                      Categories & Subjects
                    </th>
                    <th className="fw-bold py-3 text-secondary" style={{ minWidth: '120px' }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {groupedRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-5 text-muted fw-bold">
                        No subjects assigned
                      </td>
                    </tr>
                  ) : (
                    groupedRows.map((row) => (
                      <tr key={row.key} className="align-middle border-bottom">
                        <td className="ps-3 fw-semibold">
                          <span className="badge bg-secondary bg-opacity-10 text-secondary px-2 py-1">{row.school_level}</span>
                        </td>
                        <td className="fw-bold">Class {row.class_name}</td>
                        <td>
                          {row.group_name ? (
                            <span className="badge bg-primary bg-opacity-10 text-primary px-2 py-1">{row.group_name}</span>
                          ) : (
                            <span className="text-muted small">-</span>
                          )}
                        </td>
                        <td>
                          <span className="badge bg-light text-dark border px-2 py-1">{row.term}</span>
                        </td>
                        <td className="py-3">
                          <div
                            className="border rounded px-3 py-2"
                            style={{ backgroundColor: '#f9fbff', borderColor: '#d3e0f5', cursor: 'pointer', maxWidth: 520 }}
                            onClick={() => openViewModal(row)}
                            title="Click to view subjects"
                          >
                            <div className="fw-bold text-dark mb-1">Subjects</div>
                            <div className="text-primary small fw-semibold" style={{ fontSize: '0.8rem' }}>
                              <i className="bi bi-eye me-1"></i>
                              {row.mappingCount} subject{row.mappingCount !== 1 ? 's' : ''} — click to view
                            </div>
                          </div>
                        </td>
                        <td className="py-3">
                          {String(pendingRowDeleteKey || '') === String(row.key) ? (
                            <div className="d-flex flex-column gap-2">
                              <div className="text-muted fw-semibold" style={{ fontSize: '0.78rem' }}>
                                Delete all subjects for this {row.group_id ? 'group' : 'class'}?
                              </div>
                              <div className="d-flex gap-2 flex-wrap">
                                <button type="button" className="btn btn-sm btn-danger fw-bold" onClick={() => deleteAllForRow(row)}>
                                  Confirm
                                </button>
                                <button type="button" className="btn btn-sm btn-outline-secondary fw-bold" onClick={() => setPendingRowDeleteKey(null)}>
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="d-flex gap-2 flex-wrap">
                              <button
                                type="button"
                                className="btn btn-sm rounded-pill px-3 fw-bold"
                                style={{ color: '#4c6496', border: '1px solid #d3e0f5', backgroundColor: '#f9fbff', fontSize: '0.8rem' }}
                                onClick={() => openViewModal(row)}
                              >
                                View
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm rounded-pill px-3 fw-bold text-danger"
                                style={{ border: '1px solid #f5d3d3', backgroundColor: '#fff9f9', fontSize: '0.8rem' }}
                                onClick={() => setPendingRowDeleteKey(row.key)}
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, type: null, payload: null })}
        onConfirm={handleConfirmDelete}
        title={confirmModal.type === 'MASTER_SUBJECT' ? 'Delete Subject' : 'Delete Category'}
        message={
          confirmModal.type === 'MASTER_SUBJECT'
            ? `This will delete ${confirmModal.payload?.subject_title || 'this subject'} from ${confirmModal.payload?.classCount || 0} classes and ${confirmModal.payload?.staffCount || 0} staff.`
            : 'Are you sure you want to delete this category? This action cannot be undone.'
        }
        confirmText="Confirm Delete"
      />

      {viewModal.isOpen && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeViewModal()
          }}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content shadow-lg" style={{ borderRadius: '16px', border: 'none', overflow: 'hidden' }}>
              <div
                className="modal-header border-0 pb-0 text-white"
                style={{ background: 'linear-gradient(135deg, #4c6496, #2d3b59)', padding: '24px 32px' }}
              >
                <div className="flex-grow-1">
                  <p className="mb-0 fw-bold" style={{ fontSize: '0.72rem', letterSpacing: '1.5px', opacity: 0.7 }}>
                    CONFIGURED SUBJECTS
                  </p>
                  <h4 className="mb-1 fw-bold text-white text-uppercase" style={{ letterSpacing: '2px' }}>
                    Class {viewModal.class_name}
                  </h4>
                  <p className="mb-0 fw-semibold" style={{ fontSize: '0.9rem', color: '#e0e7ff' }}>
                    {viewModal.school_level} {viewModal.group_name ? `• ${viewModal.group_name}` : ''} • {viewModal.term}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-sm ms-3 align-self-start mt-1"
                  style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white', border: 'none', borderRadius: '8px', padding: '4px 12px' }}
                  onClick={closeViewModal}
                >
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>

              <div className="modal-body bg-white p-0" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                {viewModal.loading ? (
                  <div className="p-5 text-center text-muted fw-bold">Loading subjects...</div>
                ) : viewModal.mappingCount === 0 ? (
                  <div className="p-5 text-center text-muted fw-bold">No subjects assigned</div>
                ) : (
                  <div className="p-4">
                    {Object.entries(viewModal.categories)
                      .sort((a, b) => a[0].localeCompare(b[0]))
                      .map(([catName, subs]) => (
                        <div key={catName} className="mb-4">
                          <div className="fw-bold text-dark mb-2">{catName}:</div>
                          <div className="d-flex flex-column gap-2">
                            {(subs || []).map((s) => (
                              <div key={s.mapping_id} className="d-flex justify-content-between align-items-center border rounded px-3 py-2">
                                <div className="fw-semibold">
                                  {s.subject_title} {s.subject_code ? <span className="text-muted">({s.subject_code})</span> : null}
                                </div>
                                {String(pendingMappingDeleteId || '') === String(s.mapping_id) ? (
                                  <div className="d-flex gap-2">
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-danger"
                                      onClick={() => deleteSingleMapping(s.mapping_id)}
                                    >
                                      Confirm
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-secondary"
                                      onClick={() => setPendingMappingDeleteId(null)}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => setPendingMappingDeleteId(s.mapping_id)}
                                  >
                                    Delete
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {masterModalOpen && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeMasterSubjectModal()
          }}
        >
          <div className="modal-dialog modal-dialog-centered modal-xl">
            <div className="modal-content shadow-lg" style={{ borderRadius: '16px', border: 'none', overflow: 'hidden' }}>
              <div
                className="modal-header border-0 pb-0 text-white"
                style={{ background: 'linear-gradient(135deg, #4c6496, #2d3b59)', padding: '24px 32px' }}
              >
                <div className="flex-grow-1">
                  <p className="mb-0 fw-semibold" style={{ fontSize: '0.75rem', letterSpacing: '1px', opacity: 0.8 }}>
                    MASTER SUBJECTS
                  </p>
                  <h4 className="mb-1 fw-bold text-white">View All Subjects</h4>
                  <p className="mb-0" style={{ fontSize: '0.85rem', opacity: 0.9 }}>
                    Shows usage count across classes and staff.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-sm ms-3 align-self-start mt-1"
                  style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white', border: 'none', borderRadius: '8px', padding: '4px 12px' }}
                  onClick={closeMasterSubjectModal}
                >
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>
              <div className="modal-body bg-white p-0" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                {masterModalLoading ? (
                  <div className="p-5 text-center text-muted fw-bold">Loading subjects...</div>
                ) : masterSubjects.length === 0 ? (
                  <div className="p-5 text-center text-muted fw-bold">No subjects available.</div>
                ) : (
                  <div className="table-responsive">
                    <table className="table mb-0">
                      <thead>
                        <tr className="text-uppercase text-secondary" style={{ fontSize: '0.75rem' }}>
                          <th>Subject</th>
                          <th>Code</th>
                          <th>Level</th>
                          <th>Usage</th>
                          <th className="text-end">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {masterSubjects.map((subject) => (
                          <tr key={subject.id}>
                            <td className="fw-semibold">{subject.subject_title}</td>
                            <td>{subject.subject_code || '-'}</td>
                            <td>{subject.school_level || '-'}</td>
                            <td>
                              <div className="text-muted small">
                                {subject.classCount} Classes / {subject.staffCount} Staff
                              </div>
                            </td>
                            <td className="text-end">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger rounded-pill px-3"
                                onClick={() =>
                                  setConfirmModal({
                                    isOpen: true,
                                    type: 'MASTER_SUBJECT',
                                    payload: {
                                      id: subject.id,
                                      subject_title: subject.subject_title,
                                      classCount: subject.classCount,
                                      staffCount: subject.staffCount,
                                    },
                                  })
                                }
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </AdShellAdmin>
  )
}
