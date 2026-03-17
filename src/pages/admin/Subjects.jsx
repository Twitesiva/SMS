import { useEffect, useState, useMemo } from 'react'
import AdShellAdmin from '../../components/AdShellAdmin'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../store/ui'
import ConfirmationModal from '../../components/ConfirmationModal'
import './AdminContent.css'

// Maps school level to class number range
const LEVEL_RANGES = {
  Primary:   { min: 1,  max: 5  },
  Middle:    { min: 6,  max: 9  },
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
  term: '',
  category_id: '',
  subject_title: '',
  subject_code: '',
  extraSubjects: [],   // [{ title, code }]
}

export default function Subjects() {
  const [classes,         setClasses]         = useState([])
  const [allGroups,       setAllGroups]        = useState([])
  const [categories,      setCategories]       = useState([])
  const [subjects,        setSubjects]         = useState([])
  const [loadError,       setLoadError]        = useState(false)
  const [categoryName,    setCategoryName]     = useState('')
  const [subjectForm,     setSubjectForm]      = useState(EMPTY_FORM)
  const [isEditing,       setIsEditing]        = useState(false)
  const [editingIds,      setEditingIds]       = useState([])   // IDs being replaced on update
  const [viewModalData,   setViewModalData]    = useState({ isOpen: false, loading: false, categoryName: '', subtitle: '', subjects: [] })
  const [confirmModal,    setConfirmModal]     = useState({ isOpen: false, type: null, payload: null })

  // ─── Data loading ──────────────────────────────────────────────────────────

  const loadInitialData = async () => {
    try {
      const [clsRes, catsRes, grpRes] = await Promise.all([
        supabase.from('classes').select('id, class_name, class_number, school_level').order('class_number'),
        supabase.from('subject_categories').select('id, category_name').order('category_name'),
        supabase.from('groups').select('id, group_name, class_id').order('group_name'),
      ])

      const errs = [clsRes.error, catsRes.error, grpRes.error].filter(Boolean)
      if (errs.length) {
        errs.forEach(e => e.code !== '42P01' && console.error(e))
        setLoadError(true)
      }

      if (clsRes.data)  setClasses(clsRes.data)
      if (catsRes.data) setCategories(catsRes.data)
      if (grpRes.data)  setAllGroups(grpRes.data)

      loadSubjects()
    } catch (err) {
      console.error('Error loading initial data', err)
      setLoadError(true)
    }
  }

  const loadSubjects = async () => {
    try {
      const { data, error } = await supabase
        .from('subjects')
        .select(`
          id, subject_title, subject_code, term, school_level, class_id, group_id, category_id,
          classes!subjects_class_id_fkey(class_name, class_number),
          groups!subjects_group_id_fkey(group_name),
          subject_categories!subjects_category_id_fkey(category_name)
        `)
        .order('school_level')
        .order('class_id')

      if (error) {
        console.error('Subjects fetch error:', error)
        setLoadError(true)
        return
      }
      setSubjects(data || [])
    } catch (err) {
      console.error('Error loading subjects', err)
    }
  }

  useEffect(() => { loadInitialData() }, [])

  // ─── Derived state ─────────────────────────────────────────────────────────

  // Classes filtered by school level
  const filteredClasses = useMemo(() => {
    if (!subjectForm.school_level) return []
    const { min, max } = LEVEL_RANGES[subjectForm.school_level] || {}
    if (min === undefined) return classes
    return classes.filter(c => {
      const num = c.class_number || extractClassNumber(c.class_name)
      return num >= min && num <= max
    })
  }, [classes, subjectForm.school_level])

  // Selected class info
  const selectedClass = useMemo(
    () => classes.find(c => String(c.id) === String(subjectForm.class_id)),
    [classes, subjectForm.class_id]
  )
  const classNumber = selectedClass
    ? (selectedClass.class_number || extractClassNumber(selectedClass.class_name))
    : 0

  const isSecondary      = subjectForm.school_level === 'Secondary'
  const isHigherSec      = classNumber === 11 || classNumber === 12
  const isTermBased      = !isSecondary  // Primary + Middle use terms

  // Groups filtered by selected class
  const filteredGroups = useMemo(
    () => allGroups.filter(g => String(g.class_id) === String(subjectForm.class_id)),
    [allGroups, subjectForm.class_id]
  )

  // Auto-set term when class/level changes
  useEffect(() => {
    if (isSecondary) {
      setSubjectForm(prev => ({ ...prev, term: 'Full Year' }))
    } else {
      setSubjectForm(prev => ({ ...prev, term: '' }))
    }
  }, [subjectForm.class_id, isSecondary])

  // Reset group/term when class changes
  useEffect(() => {
    setSubjectForm(prev => ({ ...prev, group_id: '' }))
  }, [subjectForm.class_id])

  // Reset class when level changes
  const handleLevelChange = (level) => {
    setSubjectForm(prev => ({ ...prev, school_level: level, class_id: '', group_id: '', term: '' }))
  }

  // ─── Subject grouping for table ────────────────────────────────────────────

  // Convert integer term to display string
  const getTermDisplay = (termValue) => {
    if (termValue === 0 || termValue === '0') return 'Full Year';
    if (termValue === 1) return 'Term 1';
    if (termValue === 2) return 'Term 2';
    if (termValue === 3) return 'Term 3';
    return '-';
  };

  const groupedSubjects = useMemo(() => {
    const map = {}
    subjects.forEach(s => {
      const classStr = s.classes?.class_name || 'Unknown Class'
      const groupStr = s.groups?.group_name  || null
      const termStr  = getTermDisplay(s.term)
      const level    = s.school_level || '-'

      // Key uniquely identifies a row in the table
      const key = `${s.class_id}_${s.group_id || 'null'}_${s.term}_${level}`

      if (!map[key]) {
        map[key] = {
          id: key,
          school_level: level,
          class_name: classStr,
          group_name: groupStr,
          term: termStr,
          categories: {},
          subjectIds: [],
        }
      }

      const catName = s.subject_categories?.category_name || 'Uncategorised'
      if (!map[key].categories[catName]) map[key].categories[catName] = []
      map[key].categories[catName].push(s)
      map[key].subjectIds.push(s.id)
    })

    return Object.values(map).sort((a, b) => {
      const aNum = extractClassNumber(a.class_name)
      const bNum = extractClassNumber(b.class_name)
      if (aNum !== bNum) return aNum - bNum
      return (a.group_name || '').localeCompare(b.group_name || '')
    })
  }, [subjects])

  // ─── Category management ───────────────────────────────────────────────────

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

      if (error) { showToast(error.message, { type: 'danger' }); return }
      setCategories(prev => [...prev, data].sort((a, b) => a.category_name.localeCompare(b.category_name)))
      setCategoryName('')
      showToast('Category added successfully', { type: 'success' })
    } catch (err) {
      console.error(err)
      showToast('Error saving category.', { type: 'danger' })
    }
  }

  // ─── Validation ────────────────────────────────────────────────────────────

  const validateForm = () => {
    const { school_level, class_id, term, category_id, subject_title } = subjectForm

    if (!school_level) { showToast('School Level is required.', { type: 'warning' }); return false }
    if (!class_id)     { showToast('Class is required.', { type: 'warning' }); return false }
    if (isHigherSec && !subjectForm.group_id) {
      showToast('Group is required for Classes 11 and 12.', { type: 'warning' }); return false
    }
    if (isTermBased && !term) {
      showToast('Term is required for Primary and Middle classes.', { type: 'warning' }); return false
    }
    if (!category_id)    { showToast('Category is required.', { type: 'warning' }); return false }
    if (!subject_title.trim()) { showToast('Subject Title is required.', { type: 'warning' }); return false }
    return true
  }

  // Subject code uniqueness check
  const checkCodeUniqueness = async (codes) => {
    const nonEmpty = codes.filter(Boolean)
    if (!nonEmpty.length) return true

    const { data, error } = await supabase
      .from('subjects')
      .select('subject_code')
      .in('subject_code', nonEmpty)

    if (error) { console.error(error); return true }  // Allow on fetch error

    const existingCodes = (data || []).map(s => s.subject_code)
    // If editing, exclude the codes we're about to replace
    const conflicting = existingCodes.filter(code => !editingIds.length || true)
    if (conflicting.length) {
      showToast(`Subject code(s) already exist: ${conflicting.join(', ')}`, { type: 'warning' })
      return false
    }
    return true
  }

  // ─── Build subject rows from form ──────────────────────────────────────────

  // Map term string to integer for database
  const termMap = {
    "Term 1": 1,
    "Term 2": 2,
    "Term 3": 3
  };

  const buildSubjectRows = () => {
    const { school_level, class_id, group_id, term, category_id, subject_title, subject_code, extraSubjects } = subjectForm
    const finalGroupId = isHigherSec ? (group_id || null) : null
    
    // Convert term string to integer for database
    let finalTerm;
    if (isSecondary) {
      finalTerm = 0; // "Full Year" stored as 0
    } else {
      // Primary/Middle: "Term 1" -> 1, "Term 2" -> 2, "Term 3" -> 3
      finalTerm = term ? (termMap[term] || null) : null;
    }

    const all = [
      { title: subject_title.trim(), code: subject_code.trim() },
      ...extraSubjects.map(ex => ({ title: ex.title.trim(), code: ex.code.trim() }))
    ].filter(s => s.title)

    return all.map(s => ({
      school_level,
      class_id:    class_id    || null,
      group_id:    finalGroupId,
      term:        finalTerm,
      category_id: category_id || null,
      subject_title: s.title,
      subject_code:  s.code   || null,
    }))
  }

  // ─── Save subjects ─────────────────────────────────────────────────────────

  const saveSubjects = async () => {
    if (!validateForm()) return

    const rows = buildSubjectRows()
    if (!rows.length) { showToast('No subjects to save.', { type: 'warning' }); return }

    // Code uniqueness check
    const codes = rows.map(r => r.subject_code).filter(Boolean)
    if (codes.length) {
      const { data: existing } = await supabase
        .from('subjects')
        .select('subject_code')
        .in('subject_code', codes)

      const conflicts = (existing || []).map(s => s.subject_code)
      if (conflicts.length) {
        showToast(`Subject code(s) already in use: ${conflicts.join(', ')}`, { type: 'warning' })
        return
      }
    }

    // Title duplicate check per class/group/term
    for (const row of rows) {
      const dup = subjects.some(s => {
        const sameClass = String(s.class_id) === String(row.class_id)
        const sameTerm  = s.term === row.term
        const sameTitle = (s.subject_title || '').toLowerCase() === row.subject_title.toLowerCase()
        const sameGroup = String(s.group_id || '') === String(row.group_id || '')
        return sameClass && sameTerm && sameTitle && sameGroup
      })
      if (dup) {
        showToast(`"${row.subject_title}" already exists for this selection.`, { type: 'warning' })
        return
      }
    }

    try {
      console.log('Save Subjects Payload:', rows)
      const { error } = await supabase.from('subjects').insert(rows)
      if (error) throw error

      showToast(`Successfully added ${rows.length} subject(s)`, { type: 'success' })
      setSubjectForm(prev => ({ ...prev, subject_title: '', subject_code: '', extraSubjects: [] }))
      loadSubjects()
    } catch (err) {
      console.error('Save subjects error:', err)
      showToast(err.message || 'Failed to insert subjects.', { type: 'danger' })
    }
  }

  // ─── Update subjects ───────────────────────────────────────────────────────

  const updateSubjects = async () => {
    if (!validateForm()) return

    const rows = buildSubjectRows()
    if (!rows.length) { showToast('No subjects to save.', { type: 'warning' }); return }

    // Code uniqueness (exclude current editing IDs)
    const codes = rows.map(r => r.subject_code).filter(Boolean)
    if (codes.length) {
      const { data: existing } = await supabase
        .from('subjects')
        .select('id, subject_code')
        .in('subject_code', codes)
        .not('id', 'in', `(${editingIds.join(',')})`)

      const conflicts = (existing || []).map(s => s.subject_code)
      if (conflicts.length) {
        showToast(`Subject code(s) already in use: ${conflicts.join(', ')}`, { type: 'warning' })
        return
      }
    }

    try {
      console.log('Update Subjects Payload:', rows)
      // Delete old, insert new
      if (editingIds.length) {
        const { error: delErr } = await supabase.from('subjects').delete().in('id', editingIds)
        if (delErr) throw delErr
      }
      const { error: insErr } = await supabase.from('subjects').insert(rows)
      if (insErr) throw insErr

      showToast(`Successfully updated ${rows.length} subject(s)`, { type: 'success' })
      setIsEditing(false)
      setEditingIds([])
      setSubjectForm(EMPTY_FORM)
      loadSubjects()
    } catch (err) {
      console.error('Update subjects error:', err)
      showToast(err.message || 'Failed to update subjects.', { type: 'danger' })
    }
  }

  // ─── Edit handler ──────────────────────────────────────────────────────────

  const handleEditGroup = (subs) => {
    if (!subs?.length) return
    const first = subs[0]
    const extras = subs.slice(1).map(s => ({ title: s.subject_title, code: s.subject_code || '' }))
    const clsNum = first.classes?.class_number || extractClassNumber(first.classes?.class_name)
    setSubjectForm({
      school_level:  first.school_level  || '',
      class_id:      first.class_id      || '',
      group_id:      first.group_id      || '',
      term:          first.term          || '',
      category_id:   first.category_id   || '',
      subject_title: first.subject_title || '',
      subject_code:  first.subject_code  || '',
      extraSubjects: extras,
    })
    setEditingIds(subs.map(s => s.id))
    setIsEditing(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelEdit = () => {
    setIsEditing(false)
    setEditingIds([])
    setSubjectForm(EMPTY_FORM)
  }

  // ─── View modal ────────────────────────────────────────────────────────────

  // Convert display term back to integer for database query
  const getTermValue = (termDisplay) => {
    if (termDisplay === 'Full Year') return 0;
    if (termDisplay === 'Term 1') return 1;
    if (termDisplay === 'Term 2') return 2;
    if (termDisplay === 'Term 3') return 3;
    return null;
  };

  const openViewModal = async (catName, catsubs, group) => {
    if (!catsubs?.length) return
    const first = catsubs[0]

    const subtitle = [
      group.class_name,
      group.group_name ? `(${group.group_name})` : null,
      group.term && group.term !== '-' ? `• ${group.term}` : null,
    ].filter(Boolean).join(' ')

    setViewModalData({ isOpen: true, loading: true, categoryName: catName, subtitle, subjects: [] })

    // Convert term display string back to integer for query
    const termValue = getTermValue(group.term);

    let q = supabase
      .from('subjects')
      .select('id, subject_title, subject_code')
      .eq('class_id', first.class_id)
      .eq('category_id', first.category_id)
      .order('subject_title')

    if (termValue !== null && termValue !== undefined) q = q.eq('term', termValue)
    if (first.group_id) q = q.eq('group_id', first.group_id)
    else                q = q.is('group_id', null)

    const { data, error } = await q
    if (!error && data) {
      setViewModalData(prev => ({ ...prev, loading: false, subjects: data }))
    } else {
      console.error('Error fetching modal subjects:', error)
      setViewModalData(prev => ({ ...prev, loading: false, subjects: [] }))
      showToast('Failed to load subjects', { type: 'danger' })
    }
  }

  // ─── Delete ────────────────────────────────────────────────────────────────

  const handleConfirmDelete = async () => {
    const { type, payload } = confirmModal
    try {
      if (type === 'CATEGORY') {
        const { error } = await supabase.from('subject_categories').delete().eq('id', payload)
        if (error) throw error
        setCategories(prev => prev.filter(c => c.id !== payload))
        showToast('Category deleted', { type: 'success' })
      } else if (type === 'SUBJECT_GROUP') {
        const { error } = await supabase.from('subjects').delete().in('id', payload)
        if (error) throw error
        setSubjects(prev => prev.filter(s => !payload.includes(s.id)))
        showToast('Subjects deleted', { type: 'success' })
      }
    } catch (err) {
      showToast(err.message, { type: 'danger' })
    }
    setConfirmModal({ isOpen: false, type: null, payload: null })
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const updateExtra = (idx, field, value) => {
    const arr = [...subjectForm.extraSubjects]
    arr[idx] = { ...arr[idx], [field]: value }
    setSubjectForm(prev => ({ ...prev, extraSubjects: arr }))
  }

  const removeExtra = (idx) => {
    const arr = subjectForm.extraSubjects.filter((_, i) => i !== idx)
    setSubjectForm(prev => ({ ...prev, extraSubjects: arr }))
  }

  const addExtraRow = () => {
    setSubjectForm(prev => ({ ...prev, extraSubjects: [...prev.extraSubjects, { title: '', code: '' }] }))
  }

  // ─── Render ────────────────────────────────────────────────────────────────

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

        {/* ── CATEGORIES SECTION ── */}
        <section className="setup-section mb-4">
          <div className="students-section-shell card card-soft mb-4">
            <div className="students-section-shell-header mb-3">
              <div>
                <h5 className="section-title mb-1" style={{ fontSize: '1.1rem' }}>Subject Categories</h5>
                <p className="students-section-copy mb-0">
                  Organise subjects into meaningful buckets (e.g., Main, Activity, Language).
                </p>
              </div>
            </div>

            <div className="students-section-form row g-2 align-items-end">
              <div className="col-md-6">
                <label className="form-label fw-bold mb-1">Category Name</label>
                <input
                  className="form-control"
                  placeholder="e.g., Main"
                  value={categoryName}
                  onChange={e => setCategoryName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddCategory() }}
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
                {categories.map(cat => (
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

        {/* ── CREATE SUBJECTS SECTION ── */}
        <section className="setup-section mb-4">
          <div className="students-section-shell card card-soft mb-4">
            <div className="students-section-shell-header mb-4">
              <div>
                <h5 className="section-title mb-1" style={{ fontSize: '1.1rem' }}>
                  {isEditing ? 'Edit Subjects' : 'Create Subjects'}
                </h5>
                <p className="students-section-copy mb-0">
                  Map subjects to School Level → Class → Group (if applicable) → Term.
                </p>
              </div>
            </div>

            <div className="students-section-form">
              {/* Row 1: Level / Class / Group */}
              <div className="row g-3 mb-3">
                {/* School Level */}
                <div className="col-md-3">
                  <label className="form-label fw-bold mb-1">School Level *</label>
                  <select
                    className="form-select"
                    value={subjectForm.school_level}
                    onChange={e => handleLevelChange(e.target.value)}
                  >
                    <option value="">Select Level</option>
                    <option value="Primary">Primary (Class 1–5)</option>
                    <option value="Middle">Middle (Class 6–9)</option>
                    <option value="Secondary">Secondary (Class 10–12)</option>
                  </select>
                </div>

                {/* Class */}
                <div className="col-md-3">
                  <label className="form-label fw-bold mb-1">Class *</label>
                  <select
                    className="form-select"
                    value={subjectForm.class_id}
                    disabled={!subjectForm.school_level}
                    onChange={e => setSubjectForm(prev => ({ ...prev, class_id: e.target.value, group_id: '' }))}
                  >
                    <option value="">Select Class</option>
                    {filteredClasses.map(c => (
                      <option key={c.id} value={c.id}>{c.class_name}</option>
                    ))}
                  </select>
                </div>

                {/* Group — only for Class 11 & 12 */}
                {isHigherSec && (
                  <div className="col-md-3">
                    <label className="form-label fw-bold mb-1">Group *</label>
                    <select
                      className="form-select"
                      value={subjectForm.group_id}
                      onChange={e => setSubjectForm(prev => ({ ...prev, group_id: e.target.value }))}
                    >
                      <option value="">Select Group</option>
                      {filteredGroups.map(g => (
                        <option key={g.id} value={g.id}>{g.group_name}</option>
                      ))}
                    </select>
                    <div className="text-muted small mt-1">Applies to all sections in this group.</div>
                  </div>
                )}

                {/* Term — Primary & Middle only */}
                {isTermBased && subjectForm.class_id && (
                  <div className="col-md-3">
                    <label className="form-label fw-bold mb-1">Term *</label>
                    <select
                      className="form-select"
                      value={subjectForm.term}
                      onChange={e => setSubjectForm(prev => ({ ...prev, term: e.target.value }))}
                    >
                      <option value="">Select Term</option>
                      <option value="Term 1">Term 1</option>
                      <option value="Term 2">Term 2</option>
                      <option value="Term 3">Term 3</option>
                    </select>
                  </div>
                )}

                {/* Secondary: show "Full Year" badge */}
                {isSecondary && subjectForm.class_id && (
                  <div className="col-md-3">
                    <label className="form-label fw-bold mb-1">Term</label>
                    <div className="form-control bg-light text-muted fw-semibold">Full Year</div>
                  </div>
                )}
              </div>

              {/* Row 2: Category + Subject inputs */}
              <div className="border rounded p-4 bg-light">
                {/* Category */}
                <div className="row g-3 mb-4">
                  <div className="col-md-4">
                    <label className="form-label fw-bold mb-1">Category *</label>
                    <select
                      className="form-select"
                      value={subjectForm.category_id}
                      onChange={e => setSubjectForm(prev => ({ ...prev, category_id: e.target.value }))}
                    >
                      <option value="">Select Category</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.category_name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Subject column headers */}
                <div className="row mb-2">
                  <div className="col-6">
                    <label className="form-label fw-bold mb-1">Subject Title *</label>
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-bold mb-1">
                      Subject Code <span className="text-muted fw-normal">(optional, must be unique)</span>
                    </label>
                  </div>
                </div>

                {/* Primary subject row */}
                <div className="d-flex gap-2 align-items-center mb-2">
                  <input
                    className="form-control"
                    style={{ flex: '1 1 50%' }}
                    placeholder="e.g. Mathematics"
                    value={subjectForm.subject_title}
                    onChange={e => setSubjectForm(prev => ({ ...prev, subject_title: e.target.value }))}
                  />
                  <input
                    className="form-control"
                    style={{ flex: '1 1 50%' }}
                    placeholder="e.g. MATH101 (optional)"
                    value={subjectForm.subject_code}
                    onChange={e => setSubjectForm(prev => ({ ...prev, subject_code: e.target.value }))}
                  />
                  {/* Spacer to align with remove buttons below */}
                  <div style={{ width: '38px', flexShrink: 0 }}></div>
                </div>

                {/* Extra subject rows */}
                {subjectForm.extraSubjects.map((ex, idx) => (
                  <div key={idx} className="d-flex gap-2 align-items-center mb-2">
                    <input
                      className="form-control"
                      style={{ flex: '1 1 50%' }}
                      placeholder="Subject Title"
                      value={ex.title}
                      onChange={e => updateExtra(idx, 'title', e.target.value)}
                    />
                    <input
                      className="form-control"
                      style={{ flex: '1 1 50%' }}
                      placeholder="Subject Code (optional)"
                      value={ex.code}
                      onChange={e => updateExtra(idx, 'code', e.target.value)}
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

                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary mt-3 fw-bold"
                  onClick={addExtraRow}
                >
                  <i className="bi bi-plus-lg me-1"></i> Add another subject
                </button>
              </div>

              {/* Action buttons */}
              <div className="mt-4 d-flex justify-content-end gap-2">
                {isEditing ? (
                  <>
                    <button type="button" className="btn btn-outline-secondary fw-bold px-4" onClick={cancelEdit}>
                      Cancel Edit
                    </button>
                    <button type="button" className="btn btn-warning text-dark fw-bold px-4" onClick={updateSubjects}>
                      Update Entry
                    </button>
                  </>
                ) : (
                  <button type="button" className="btn btn-primary students-button fw-bold px-4" onClick={saveSubjects}>
                    Submit Subjects
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── CONFIGURED SUBJECTS TABLE ── */}
        {groupedSubjects.length > 0 && (
          <section className="setup-section mb-4">
            <div className="students-table-panel card card-soft mb-4">
              <div className="students-table-panel-header mb-3">
                <div>
                  <p className="students-table-panel-title mb-1 text-white">Configured Subjects</p>
                  <p className="students-table-panel-copy mb-0">
                    Review previously created subjects mapped to their respective classes and terms.
                  </p>
                </div>
              </div>

              <div className="table-responsive">
                <table className="table students-table align-middle mb-0">
                  <thead>
                    <tr className="text-uppercase" style={{ fontSize: '0.82rem' }}>
                      <th className="fw-bold py-3 text-secondary ps-3" style={{ minWidth: '80px' }}>Level</th>
                      <th className="fw-bold py-3 text-secondary" style={{ minWidth: '100px' }}>Class</th>
                      <th className="fw-bold py-3 text-secondary" style={{ minWidth: '130px' }}>Group</th>
                      <th className="fw-bold py-3 text-secondary" style={{ minWidth: '90px' }}>Term</th>
                      <th className="fw-bold py-3 text-secondary" style={{ minWidth: '260px' }}>Categories & Subjects</th>
                      <th className="fw-bold py-3 text-secondary" style={{ minWidth: '140px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedSubjects.map(group => {
                      const catEntries = Object.entries(group.categories)
                      return catEntries.map(([catName, catsubs], idx) => (
                        <tr key={`${group.id}_${catName}`} className="align-middle border-bottom">
                          {idx === 0 && (
                            <>
                              <td rowSpan={catEntries.length} className="ps-3 fw-semibold border-end-0">
                                <span className="badge bg-secondary bg-opacity-10 text-secondary px-2 py-1">
                                  {group.school_level}
                                </span>
                              </td>
                              <td rowSpan={catEntries.length} className="fw-bold border-end-0">
                                {group.class_name}
                              </td>
                              <td rowSpan={catEntries.length} className="border-end-0">
                                {group.group_name ? (
                                  <span className="badge bg-primary bg-opacity-10 text-primary px-2 py-1">
                                    {group.group_name}
                                  </span>
                                ) : (
                                  <span className="text-muted small">—</span>
                                )}
                              </td>
                              <td rowSpan={catEntries.length} className="border-end-0">
                                <span className="badge bg-light text-dark border px-2 py-1">
                                  {group.term}
                                </span>
                              </td>
                            </>
                          )}

                          {/* Clickable category box */}
                          <td className="py-3 border-end-0">
                            <div
                              className="border rounded px-3 py-2"
                              style={{
                                backgroundColor: '#f9fbff',
                                borderColor: '#d3e0f5',
                                cursor: 'pointer',
                              }}
                              onClick={() => openViewModal(catName, catsubs, group)}
                              title={`View ${catName} subjects`}
                            >
                              <div className="fw-bold text-dark mb-1">{catName}</div>
                              <div className="text-primary small fw-semibold" style={{ fontSize: '0.8rem' }}>
                                <i className="bi bi-eye me-1"></i>
                                {catsubs.length} subject{catsubs.length !== 1 ? 's' : ''} — click to view
                              </div>
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-3">
                            <div className="d-flex gap-2 flex-wrap">
                              <button
                                type="button"
                                className="btn btn-sm rounded-pill px-3 fw-bold"
                                style={{ color: '#4c6496', border: '1px solid #d3e0f5', backgroundColor: '#f9fbff', fontSize: '0.8rem' }}
                                onClick={() => handleEditGroup(catsubs)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm rounded-pill px-3 fw-bold text-danger"
                                style={{ border: '1px solid #f5d3d3', backgroundColor: '#fff9f9', fontSize: '0.8rem' }}
                                onClick={() => setConfirmModal({ isOpen: true, type: 'SUBJECT_GROUP', payload: catsubs.map(s => s.id) })}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* ── CONFIRMATION MODAL ── */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, type: null, payload: null })}
        onConfirm={handleConfirmDelete}
        title={confirmModal.type === 'CATEGORY' ? 'Delete Category' : 'Delete Subjects'}
        message={`Are you sure you want to delete ${confirmModal.type === 'CATEGORY' ? 'this category' : 'the selected subject(s)'}? This action cannot be undone.`}
        confirmText="Confirm Delete"
      />

      {/* ── VIEW MODAL ── */}
      {viewModalData.isOpen && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
          onClick={e => { if (e.target === e.currentTarget) setViewModalData(p => ({ ...p, isOpen: false })) }}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content shadow-lg" style={{ borderRadius: '16px', border: 'none', overflow: 'hidden' }}>
              {/* Header */}
              <div
                className="modal-header border-0 pb-0 text-white"
                style={{ background: 'linear-gradient(135deg, #4c6496, #2d3b59)', padding: '24px 32px' }}
              >
                <div className="flex-grow-1">
                  <p className="mb-0 fw-bold" style={{ fontSize: '0.72rem', letterSpacing: '1.5px', opacity: 0.7 }}>
                    SUBJECT CATEGORY
                  </p>
                  <h4 className="mb-1 fw-bold text-white text-uppercase" style={{ letterSpacing: '2px' }}>
                    {viewModalData.categoryName}
                  </h4>
                  <p className="mb-0 fw-semibold" style={{ fontSize: '0.9rem', color: '#e0e7ff' }}>
                    {viewModalData.subtitle}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-sm ms-3 align-self-start mt-1"
                  style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white', border: 'none', borderRadius: '8px', padding: '4px 12px' }}
                  onClick={() => setViewModalData(p => ({ ...p, isOpen: false }))}
                >
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>

              {/* Body */}
              <div className="modal-body bg-white p-0" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                {viewModalData.loading ? (
                  <div className="p-5 text-center text-muted fw-bold">Loading subjects…</div>
                ) : (
                  <table className="table mb-0 align-middle table-hover">
                    <thead>
                      <tr>
                        <th className="bg-white pt-4 pb-2 ps-4 fw-bold border-0" style={{ width: '60px', color: '#6c757d', fontSize: '0.85rem' }}>No.</th>
                        <th className="bg-white pt-4 pb-2 fw-bold border-0" style={{ color: '#6c757d', fontSize: '0.85rem' }}>Subject</th>
                        <th className="bg-white pt-4 pb-2 fw-bold border-0" style={{ color: '#6c757d', fontSize: '0.85rem' }}>Code</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewModalData.subjects.length === 0 ? (
                        <tr>
                          <td colSpan="3" className="text-center py-5 text-muted fw-bold">
                            No subjects found.
                          </td>
                        </tr>
                      ) : (
                        viewModalData.subjects.map((sub, idx) => (
                          <tr key={sub.id}>
                            <td className="ps-4 py-3 text-secondary fw-bold">{idx + 1}</td>
                            <td className="py-3 fw-semibold">{sub.subject_title}</td>
                            <td className="py-3 text-muted">
                              {sub.subject_code ? (
                                <span className="badge bg-light text-dark border px-2">{sub.subject_code}</span>
                              ) : '—'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
                <div className="pb-3"></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdShellAdmin>
  )
}
