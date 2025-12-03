import { useMemo, useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'

export default function SubjectsSection({
  subjectForm,
  setSubjectForm,
  groups,
  coursesForGroup,
  semForCourse,
  // Sub-categories props
  categories: subCategories,
  setCategories,
  catItems,
  setCatItems,
  categoryName,
  setCategoryName,
  editingCategory,
  setEditingCategory,
  deleteCategory,
  saveCategory,
  // Subjects props
  pendingSubjects,
  subjects,
  editingSubjectId,
  saveSubject,
  submitPendingSubjects,
  editPendingSubject,
  deletePendingSubject,
  editSubject,
  deleteSubject,
  onCancelSubjectEdit
}) {
  const [programmeCategory, setProgrammeCategory] = useState('')
  const [academicYears, setAcademicYears] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  
  // Fetch academic years from Supabase
  useEffect(() => {
    const fetchAcademicYears = async () => {
      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('academic_year')
          .select('*')
          .order('academic_year', { ascending: false })

        if (error) throw error
        
        setAcademicYears(data || [])
      } catch (err) {
        console.error('Error fetching academic years:', err)
        setError('Failed to load academic years')
      } finally {
        setLoading(false)
      }
    }
    
    fetchAcademicYears()
  }, [])

  const yearNameById = useMemo(() => (academicYears || []).reduce((acc, year) => {
    if (year?.academic_year) acc[year.id] = year.academic_year
    return acc
  }, {}), [academicYears])
  const selectedYearName = yearNameById[subjectForm.academicYearId] || ''
  const getDisplayYear = (subject) => subject.academicYearName || yearNameById[subject.academicYearId] || subject.academicYearId || '-'
  const yearOptions = useMemo(() => {
    const activeList = (academicYears || []).filter(year => year?.active !== false)
    if (!subjectForm.academicYearId) return activeList
    
    const hasSelected = activeList.some(year => String(year.id) === String(subjectForm.academicYearId))
    if (hasSelected) return activeList
    
    const selectedYear = (academicYears || []).find(year => 
      String(year.id) === String(subjectForm.academicYearId)
    )
    return selectedYear ? [...activeList, selectedYear] : activeList
  }, [academicYears, subjectForm.academicYearId])
  const selectedYear = academicYears.find(
    (year) => String(year.id) === String(subjectForm.academicYearId)
  )
  useEffect(() => {
    if (selectedYear?.category) {
      setProgrammeCategory(selectedYear.category.toUpperCase())
    }
  }, [selectedYear])

  const filteredYearOptions = yearOptions.filter(
    (year) => {
      const yearCategory = year.category || year.Category || '';
      return !programmeCategory || !yearCategory || yearCategory.toUpperCase() === programmeCategory;
    }
  )
  if (
    selectedYear &&
    !filteredYearOptions.some((year) => String(year.id) === String(selectedYear.id))
  ) {
    filteredYearOptions.push(selectedYear)
  }

  const filteredGroupOptions = groups.filter((group) => {
    const categoryValue = (group.category || group.Category || "").toUpperCase()
    const matchesCategory =
      !programmeCategory || !categoryValue || categoryValue === programmeCategory
    const matchesSelection =
      subjectForm.groupCode &&
      [group.groupCode, group.code, group.group_code]
        .map((v) => String(v || ""))
        .includes(String(subjectForm.groupCode))
    return matchesCategory || matchesSelection
  })
  const getSemesterLabel = (subject) => {
    const raw = subject?.semester ?? subject?.semester_number ?? subject?.semesterNumber ?? ''
    if (raw === undefined || raw === null || raw === '') return '-'
    const numeric = Number(raw)
    return Number.isNaN(numeric) ? raw : numeric
  }
  const extraNames = subjectForm.extraSubjectNames || []
  const extraCodes = subjectForm.extraSubjectCodes || []
  const groupNameByCode = useMemo(() => groups.reduce((acc, group) => {
    const code = group.groupCode || group.code || group.group_code || ''
    if (!code) return acc
    acc[code] = group.name || group.group_name || group.groupName || code
    return acc
  }, {}), [groups])
  const displayGroupName = (code) => groupNameByCode[code] || code || '-'
  const buildComboRows = (items = []) => {
    const comboMap = new Map()
    items.forEach(item => {
      const comboKey = [
        item.academicYearId || item.academic_year || '',
        item.groupCode || item.group_code || '',
        item.courseCode || item.course_name || '',
        item.semester === undefined || item.semester === null ? '' : item.semester
      ].join('::')
      
      const base = comboMap.get(comboKey) || {
        comboKey,
        academicYearId: item.academicYearId || item.academic_year,
        academicYearName: item.academicYearName || item.academic_year,
        academicYear: item.academicYearName || item.academic_year,
        groupCode: item.groupCode || item.group_code,
        courseCode: item.courseCode || item.course_name,
        semester: item.semester,
        subjectIds: [],
        subjectNames: [],
        subjectCodes: [],
        subjectSelections: [],
        subjectId: item.subject_id || item.id,
        category: item.category,
        categoryId: item.category_id,
        feeCategory: item.feeCategory || item.fee_category,
        feeAmount: item.amount || item.feeAmount,
        categories: [] // Initialize categories array
      }

      // Add subject information
      if (item.subject_name) {
        base.subjectNames.push(item.subject_name)
      }
      if (item.subject_code) {
        base.subjectCodes.push(item.subject_code)
      }
      if (item.subject_id) {
        base.subjectIds.push(item.subject_id)
      }

      // Handle categories
      const categoryName = item.category || 'Uncategorised'
      let catEntry = base.categories.find(cat => cat.name === categoryName)
      if (!catEntry) {
        catEntry = {
          name: categoryName,
          subjects: [],
          source: item
        }
        base.categories.push(catEntry)
      }
      
      const itemSubjects = item.subjectNames?.length ? item.subjectNames : [item.subjectName].filter(Boolean)
      catEntry.subjects.push(...itemSubjects)

      comboMap.set(comboKey, base)
    })
    return Array.from(comboMap.values())
  }
  const pendingCombos = buildComboRows(pendingSubjects)
  const savedCombos = buildComboRows(subjects)
  const [modalCategory, setModalCategory] = useState(null)
  const [showAllSavedSubjects, setShowAllSavedSubjects] = useState(false)

  const openCategoryModal = (combo, category, subjects) => {
    setModalCategory({
      combo,
      category,
      subjects,
    })
  }

  const closeCategoryModal = () => setModalCategory(null)
  const updateExtraField = (idx, field, value) => {
    setSubjectForm(prev => {
      const names = [...(prev.extraSubjectNames || [])]
      const codes = [...(prev.extraSubjectCodes || [])]
      if (field === 'name') names[idx] = value
      else codes[idx] = value
      return {
        ...prev,
        extraSubjectNames: names,
        extraSubjectCodes: codes,
      }
    })
  }
  const removeExtraField = (idx) => {
    setSubjectForm(prev => {
      const names = [...(prev.extraSubjectNames || [])]
      const codes = [...(prev.extraSubjectCodes || [])]
      names.splice(idx, 1)
      codes.splice(idx, 1)
      return {
        ...prev,
        extraSubjectNames: names,
        extraSubjectCodes: codes,
      }
    })
  }
  const addExtraField = () => {
    setSubjectForm(prev => ({
      ...prev,
      extraSubjectNames: [...(prev.extraSubjectNames || []), ''],
      extraSubjectCodes: [...(prev.extraSubjectCodes || []), ''],
    }))
  }
  const renderSubjectRow = ({
    titleValue,
    onTitleChange,
    codeValue,
    onCodeChange,
    action,
    titlePlaceholder = "Subject title",
    codePlaceholder = "Subject code",
  }) => (
    <div className="d-flex gap-2 align-items-center">
      <input
        className="form-control"
        style={{ flex: "0 0 48%", minWidth: "48%" }}
        placeholder={titlePlaceholder}
        value={titleValue}
        onChange={onTitleChange}
      />
      <input
        className="form-control"
        style={{ flex: "0 0 50%", minWidth: "50%" }}
        placeholder={codePlaceholder}
        value={codeValue}
        onChange={onCodeChange}
      />
      {action}
    </div>
  );

  const extraInputFields = (
    <>
      {extraNames.map((value, idx) => (
        <div key={`extra-${idx}`} className="mt-2">
          {renderSubjectRow({
            titleValue: value,
            onTitleChange: (e) => updateExtraField(idx, 'name', e.target.value),
            codeValue: extraCodes[idx] || '',
            onCodeChange: (e) => updateExtraField(idx, 'code', e.target.value),
            action: (
            <button
              type="button"
              className="btn btn-outline-danger btn-sm"
              onClick={() => removeExtraField(idx)}
            >
              Remove
            </button>
          ),
          titlePlaceholder: `Subject ${idx + 2}`,
          })}
        </div>
      ))}
      <button type="button" className="btn btn-sm btn-outline-primary mt-3" onClick={addExtraField}>
        Add another subject
      </button>
    </>
  )
  return (
    <>
      <section className="setup-section mb-4">
        <div className="students-section-shell card card-soft mb-4">
          <div className="students-section-shell-header mb-3">
            <div>
              <h5 className="section-title mb-1">Sub-categories</h5>
              <p className="students-section-copy small mb-0">
                Organise subjects into meaningful buckets to keep assignments consistent.
              </p>
            </div>
          </div>
          <div className="students-section-form row g-3 align-items-start">
            <div className="col-md-6">
              <label className="form-label fw-bold mb-1">
                Sub-category Name <span className="text-danger">*</span>
              </label>
              <p className="text-uppercase text-muted small mb-1">
                {editingCategory ? 'Update existing sub-category' : 'Add a new sub-category'}
              </p>
              <div className="d-flex gap-2 flex-wrap">
                <input
                  className="form-control flex-grow-1"
                  placeholder="e.g., Languages"
                  required
                  value={categoryName}
                  onChange={e => setCategoryName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      saveCategory()
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn btn-primary students-button"
                  onClick={saveCategory}
                >
                  {editingCategory ? 'Update' : 'Add'}
                </button>
                {editingCategory && (
                  <button
                    type="button"
                    className="btn btn-outline-secondary students-button"
                    onClick={() => { setCategoryName(''); setEditingCategory('') }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
            <div className="col-md-6">
              <div>
                <p className="students-section-copy small mb-1 text-dark fw-semibold">
                  Add
                </p>
                <p className="text-muted small">
                  Organise subjects into sub-categories (e.g., Languages, Labs) for efficient allocation.
                </p>
              </div>
            </div>
          </div>
          <div className="row g-3 mt-3">
            {subCategories.map(cat => (
              <div key={cat} className="col-md-4">
                <div className="card h-100 students-category-card">
                  <div className="card-body d-flex flex-column gap-3">
                    <div>
                      <p className="fw-bold mb-1">{cat}</p>
                    </div>
                    <div className="mt-auto d-flex gap-2 flex-wrap">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary students-button students-button-sm flex-fill"
                        onClick={() => { setCategoryName(cat); setEditingCategory(cat) }}
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger students-button students-button-sm flex-fill"
                        onClick={() => deleteCategory(cat)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="setup-section mb-4">
        <div className="students-section-shell card card-soft mb-4">
          <div className="students-section-shell-header mb-3">
            <div>
              <h5 className="section-title mb-1">Subjects</h5>
              <p className="students-section-copy small mb-0">
                Flow from academic category and group to individual subject entries.
              </p>
            </div>
          </div>

          <div className="students-section-form row g-3">
            <div className="col-md-3">
              <label className="form-label fw-bold mb-1">Category *</label>
              <select
                className="form-select"
                value={programmeCategory}
                onChange={(e) => {
                  const value = e.target.value
                  setProgrammeCategory(value)
                  setSubjectForm({
                    ...subjectForm,
                    programmeCategory: value,
                    academicYearId: "",
                    academicYearName: "",
                    groupCode: "",
                    courseCode: "",
                    semester: ""
                  })
                }}
              >
                <option value="">Select category</option>
                <option value="UG">UG</option>
                <option value="PG">PG</option>
              </select>
            </div>

            <div className="col-md-3">
              <label className="form-label fw-bold mb-1">Academic Year *</label>
              {loading ? (
                <div className="form-control">Loading academic years...</div>
              ) : error ? (
                <div className="text-danger small">{error}</div>
              ) : (
                <>
                  <select
                    className="form-select"
                    required
                    value={subjectForm.academicYearId}
                    disabled={!programmeCategory || loading}
                    onChange={e => {
                      const value = e.target.value
                      const selected = academicYears.find(y => String(y.id) === String(value))
                      setSubjectForm({ 
                        ...subjectForm, 
                        academicYearId: value, 
                        academicYearName: selected?.academic_year || '' 
                      })
                    }}
                  >
                    <option value="">Select Year</option>
                    {yearOptions.map(year => (
                      <option key={year.id} value={year.id}>
                        {year.academic_year}
                      </option>
                    ))}
                  </select>
                  {!loading && academicYears.length === 0 && (
                    <div className="form-text text-muted">No academic years available</div>
                  )}
                </>
              )}
            </div>

            <div className="col-md-3">
              <label className="form-label fw-bold mb-1">Group *</label>
              <select
                className="form-select"
                required
                value={subjectForm.groupCode}
                disabled={!programmeCategory}
                onChange={e => setSubjectForm({ ...subjectForm, groupCode: e.target.value, courseCode: '', semester: '' })}
              >
                <option value="">Select Group</option>
                {filteredGroupOptions.map(g => (
                  <option key={g.id} value={g.code}>
                    {g.name || g.code}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-bold mb-1">Course *</label>
              <select
                className="form-select"
                required
                disabled={!subjectForm.groupCode}
                value={subjectForm.courseCode}
                onChange={e => {
                  const value = e.target.value
                  const selected = coursesForGroup.find(c => c.courseCode === value)
                  setSubjectForm({
                    ...subjectForm,
                    courseCode: value,
                    courseName: selected?.courseName || value,
                    semester: ''
                  })
                }}
              >
                <option value="">Select Course</option>
                {coursesForGroup.map(c => (
                  <option key={c.id} value={c.courseCode}>
                    {c.courseName || c.name || c.courseCode}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-bold mb-1">Semester *</label>
              <select
                className="form-select"
                required
                disabled={!subjectForm.courseCode}
                value={subjectForm.semester}
                onChange={e => setSubjectForm({ ...subjectForm, semester: e.target.value })}
              >
                <option value="">Select Semester</option>
                {semForCourse.map(s => (
                  <option key={s.id} value={s.number}>Semester {s.number}</option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-bold mb-1">Sub-category *</label>
              <select className="form-select" required value={subjectForm.category} onChange={e => setSubjectForm({ ...subjectForm, category: e.target.value, subjectSelections: [], subjectName: '' })}>
                <option value="">Select Sub-category</option>
                {subCategories.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="col-md-9">
              <div className="row mb-2">
                <div className="col-6">
                  <label className="form-label fw-bold mb-1">Subject Title *</label>
                </div>
                <div className="col-6">
                  <label className="form-label fw-bold mb-1">Subject code *</label>
                </div>
              </div>
              {(catItems[subjectForm.category] || []).length ? (
                <div className="subject-checkbox-group d-flex flex-column gap-3">
                  {catItems[subjectForm.category].map(item => {
                    const id = `subject-${item.id}`
                    return (
                      <div className="form-check d-flex justify-content-between align-items-center" key={item.id}>
                        <div>
                          <input
                            className="form-check-input me-2"
                            type="checkbox"
                            id={id}
                            checked={subjectForm.subjectSelections?.includes(item.name)}
                            onChange={() => setSubjectForm(prev => {
                              const selections = new Set(prev.subjectSelections || [])
                              if (selections.has(item.name)) selections.delete(item.name)
                              else selections.add(item.name)
                              return { ...prev, subjectSelections: Array.from(selections), subjectName: '' }
                            })}
                          />
                          <label className="form-check-label" htmlFor={id}>{item.name}</label>
                        </div>
                        <span className="text-muted small">{item.subjectCode || ''}</span>
                      </div>
                    )
                  })}
                  <div>
                    {renderSubjectRow({
                      titleValue: subjectForm.subjectName,
                      onTitleChange: (e) =>
                        setSubjectForm({
                          ...subjectForm,
                          subjectName: e.target.value,
                          subjectSelections: [],
                        }),
                      codeValue: subjectForm.subjectCode,
                      onCodeChange: (e) =>
                        setSubjectForm({ ...subjectForm, subjectCode: e.target.value }),
                      titlePlaceholder: "Or type custom subject",
                    })}
                  </div>
                  {extraInputFields}
                </div>
              ) : (
                <>
                  <div>
                    {renderSubjectRow({
                      titleValue: subjectForm.subjectName,
                      onTitleChange: (e) =>
                        setSubjectForm({ ...subjectForm, subjectName: e.target.value }),
                      codeValue: subjectForm.subjectCode,
                      onCodeChange: (e) =>
                        setSubjectForm({ ...subjectForm, subjectCode: e.target.value }),
                    })}
                  </div>
                  {extraInputFields}
                </>
              )}
            </div>
          </div>
          <div className="mt-2 text-end">
            <button type="button" className="btn btn-primary students-button" onClick={saveSubject}>
              {editingSubjectId ? 'Update Entry' : 'Add Entry'}
            </button>
            {editingSubjectId && (
              <button type="button" className="btn btn-outline-secondary students-button ms-2" onClick={onCancelSubjectEdit}>Cancel</button>
            )}
          </div>

          {(pendingCombos.length > 0 || savedCombos.length > 0) && (
            <div className="students-section-list mt-4">
              {pendingCombos.length > 0 && (
                <div className="students-section-card card card-soft mb-3">
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <h6 className="mb-0">Pending Subjects ({pendingCombos.length})</h6>
                      <button type="button" className="btn btn-primary students-button" onClick={submitPendingSubjects}>Submit All</button>
                    </div>
                    <div className="row g-3">
                      {pendingCombos.map(combo => (
                        <div className="col-12" key={combo.comboKey}>
                          <div className="card card-soft students-section-card">
                            <div className="card-body">
                            <div className="subjects-combo-header mb-3">
                              <div>
                                <strong>{combo.academicYear}</strong>
                              </div>
                              <div className="text-muted small">
                                {displayGroupName(combo.groupCode)} · {combo.courseName || combo.courseCode || '-'} · Sem {combo.semester}
                              </div>
                            </div>
                            {combo.categories.map(cat => (
                              <div key={`${combo.comboKey}-${cat.name}`} className="subjects-combo-category p-3 mb-2">
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                  <span className="fw-semibold">{cat.name}</span>
                                  <div className="d-flex gap-2">
                                    <button type="button" className="btn btn-sm btn-outline-primary students-button students-button-sm" onClick={() => editPendingSubject(cat.source)}>Edit</button>
                                    <button type="button" className="btn btn-sm btn-outline-danger students-button students-button-sm" onClick={() => deletePendingSubject(cat.source)}>Remove</button>
                                  </div>
                                </div>
                                <div className="subjects-combo-subjects text-muted small">
                                  <span className="text-uppercase small me-1">Subjects:</span>
                                  <span>{cat.subjects.filter(Boolean).join(', ') || '-'}</span>
                                </div>
                              </div>
                            ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {savedCombos.length > 0 && (
                <div className="students-table-panel card card-soft mb-4">
                  <div className="students-table-panel-header mb-3">
                    <div>
                      <p className="students-table-panel-title mb-1">Saved Subjects</p>
                      <p className="students-table-panel-copy small mb-0">
                        Review and manage the saved subject allocations for each academic group.
                      </p>
                    </div>
                  </div>
                  <div className="card-body">
                    <div className="table-responsive">
                      <table className="table table-hover align-middle">
                        <thead>
                          <tr>
                            <th>Academic Year</th>
                            <th>Group</th>
                            <th>Course</th>
                            <th>Semester</th>
                            <th>Categories & Subjects</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                      <tbody>
                        {(showAllSavedSubjects ? savedCombos : savedCombos.slice(0, 3)).map((combo, index) => {
                            // Group categories by semester
                            const categoriesByType = {};
                            combo.categories.forEach(cat => {
                              if (!categoriesByType[cat.name]) {
                                categoriesByType[cat.name] = [];
                              }
                              categoriesByType[cat.name].push(cat);
                            });
                            
                            return (
                              <tr key={`${combo.comboKey}-${index}`}>
                                <td>{combo.academicYear}</td>
                                <td>{displayGroupName(combo.groupCode)}</td>
                                <td>{combo.courseName || combo.courseCode || '-'}</td>
                                <td>Sem {combo.semester}</td>
                                <td>
                                  <div className="d-flex flex-column gap-2">
                                    {Object.entries(categoriesByType).map(([category, cats]) => (
                                      <button
                                        type="button"
                                        className="btn btn-outline-secondary students-button students-button-sm text-start"
                                        key={category}
                                        onClick={() => openCategoryModal(
                                          combo,
                                          category,
                                          cats.flatMap(cat => cat.subjects.filter(Boolean))
                                        )}
                                      >
                                        <span className="fw-semibold">{category}</span>
                                        <span className="text-muted small d-block">
                                          Click to view
                                        </span>
                                      </button>
                                    ))}
                                  </div>
                                </td>
                                <td>
                                  <div className="d-flex flex-column gap-2">
                                    {Object.entries(categoriesByType).map(([category, cats]) => (
                                      <div key={category} className="d-flex gap-2">
                                        <button 
                                          className="btn btn-sm btn-outline-primary students-button students-button-sm"
                                          onClick={() => editSubject(cats[0].source)}
                                        >
                                          Edit {category}
                                        </button>
                                        <button 
                                          className="btn btn-sm btn-outline-danger students-button students-button-sm"
                                          onClick={() => deleteSubject(cats[0].source)}
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {savedCombos.length > 3 && (
                      <div className="text-end mt-3">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary students-button"
                          onClick={() => setShowAllSavedSubjects((prev) => !prev)}
                        >
                          {showAllSavedSubjects ? "Show fewer" : `View all ${savedCombos.length}`}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
      {modalCategory && (
        <div className="students-modal-overlay" role="dialog" aria-modal="true">
          <div className="students-modal-dialog subjects-modal-dialog">
            <div className="students-modal-content">
              <div className="students-modal-header">
                <div>
                  <div className="students-modal-header-eyebrow">
                    Sub-category subjects
                  </div>
                  <h5 className="students-modal-header-title mb-1">
                    {modalCategory.category}
                  </h5>
                  <div className="students-modal-header-meta">
                    <span>
                      {modalCategory.combo.academicYear} · {displayGroupName(modalCategory.combo.groupCode)}
                    </span>
                    <span>
                      {modalCategory.combo.courseName || modalCategory.combo.courseCode || '-'} · Sem {modalCategory.combo.semester}
                    </span>
                  </div>
                </div>
                <button
                  className="students-modal-close"
                  type="button"
                  onClick={closeCategoryModal}
                >
                  &times;
                </button>
              </div>
              <div className="students-modal-body">
                {modalCategory.subjects.length ? (
                  <ul className="list-unstyled mb-0">
                    {modalCategory.subjects.map((subject, idx) => (
                      <li key={`${modalCategory.combo.comboKey}-${modalCategory.category}-${idx}`} className="mb-2 text-muted">
                        {subject}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted mb-0">
                    No subjects have been assigned to this sub-category yet.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
