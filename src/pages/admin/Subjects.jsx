import { useEffect, useState } from 'react'
import AdShellAdmin from '../../components/AdShellAdmin'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../store/ui'
import ConfirmationModal from '../../components/ConfirmationModal'
import './AdminContent.css'

export default function Subjects() {
  const [academicYears, setAcademicYears] = useState([])
  const [classes, setClasses] = useState([])
  const [sections, setSections] = useState([])
  
  const [categories, setCategories] = useState([])
  const [categoryName, setCategoryName] = useState('')

  const [subjects, setSubjects] = useState([])

  const [subjectForm, setSubjectForm] = useState({
    academic_year_id: '',
    school_level: '',
    class_id: '',
    section_id: '',
    term: '',
    category_id: '',
    subject_title: '',
    subject_code: '',
    extraSubjects: []
  })

  const [confirmModalState, setConfirmModalState] = useState({ isOpen: false, type: null, payload: null })

  const loadInitialData = async () => {
    try {
      const { data: years } = await supabase.from('academic_years').select('id, year_name')
      if (years) setAcademicYears(years)

      const { data: cls } = await supabase.from('classes').select('id, class_name')
      if (cls) setClasses(cls)

      const { data: cats, error: catsError } = await supabase.from('subject_categories').select('id, category_name')
      if (cats) {
        setCategories(cats)
      } else if (catsError && catsError.code === '42P01') {
        // Table doesn't exist yet, ignore gracefully
        console.warn('subject_categories table is missing')
      }

      loadSubjects()
    } catch (err) {
      console.error('Error loading initial data', err)
    }
  }

  const loadSubjects = async () => {
    try {
      let { data: subs, error: subsError } = await supabase
        .from('subjects')
        .select(`
          id, subject_title, subject_code, term, school_level, academic_year_id, class_id, section_id, category_id,
          academic_years ( year_name ),
          classes ( class_name ),
          sections ( section_name ),
          subject_categories ( category_name )
        `)
      
      if (subsError) {
        console.error("Supabase subjects fetch error:", subsError)
        // Fallback to basic query if relation joins fail
        const fallback = await supabase.from('subjects').select('*')
        subs = fallback.data
        subsError = fallback.error
      }

      if (subs) {
        setSubjects(subs)
      } else if (subsError && subsError.code === '42P01') {
        // Table doesn't exist yet, ignore gracefully
        console.warn('subjects table is missing')
      } else if (subsError) {
        console.error("Supabase subjects fetch error basic:", subsError)
      }
    } catch (err) {
      console.error('Error loading subjects', err)
    }
  }

  useEffect(() => {
    loadInitialData()
  }, [])

  useEffect(() => {
    if (subjectForm.class_id) {
      const fetchSections = async () => {
        // Fetch mapped sections for this class
        const { data } = await supabase
          .from('class_sections')
          .select('sections(id, section_name)')
          .eq('class_id', subjectForm.class_id)
        
        if (data) {
          const uniqueSections = []
          const map = new Set()
          for (let row of data) {
            if (row.sections && !map.has(row.sections.id)) {
               map.add(row.sections.id)
               uniqueSections.push(row.sections)
            }
          }
          setSections(uniqueSections)
          setSubjectForm(prev => ({ ...prev, section_id: '' }))
        }
      }
      fetchSections()
    } else {
      setSections([])
      setSubjectForm(prev => ({ ...prev, section_id: '' }))
    }
  }, [subjectForm.class_id])

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
      
      if (data) {
        setCategories(prev => [...prev, data])
        setCategoryName('')
        showToast('Category added successfully', { type: 'success' })
      } else if (error) {
        showToast(error.message, { type: 'danger' })
      }
    } catch (err) {
      console.error(err)
      showToast('Error saving category. Have you created the subject_categories table?', { type: 'danger' })
    }
  }

  const handleConfirmDelete = async () => {
    const { type, payload } = confirmModalState
    if (type === 'CATEGORY') {
      const { error } = await supabase.from('subject_categories').delete().eq('id', payload)
      if (!error) {
        setCategories(categories.filter(c => c.id !== payload))
        showToast('Category deleted', { type: 'success' })
      } else {
        showToast(error.message, { type: 'danger' })
      }
    } else if (type === 'SUBJECT') {
      const { error } = await supabase.from('subjects').delete().eq('id', payload)
      if (!error) {
        setSubjects(subjects.filter(s => s.id !== payload))
        showToast('Subject deleted', { type: 'success' })
      } else {
        showToast(error.message, { type: 'danger' })
      }
    }
    setConfirmModalState({ isOpen: false, type: null, payload: null })
  }

  const selectedClassInfo = classes.find(c => String(c.id) === String(subjectForm.class_id));
  let classNumber = 0;
  if (selectedClassInfo) {
    const match = selectedClassInfo.class_name.match(/\d+/);
    if (match) classNumber = parseInt(match[0], 10);
  }
  const isLowerClass = subjectForm.class_id && classNumber <= 10;
  const isHigherClass = subjectForm.class_id && classNumber >= 11;

  const saveSubjects = async () => {
    const { academic_year_id, school_level, class_id, section_id, term, category_id, subject_title, subject_code } = subjectForm
    
    const finalSectionId = isLowerClass ? null : section_id;

    if (!academic_year_id || !school_level || !class_id || (isHigherClass && !finalSectionId) || !term || !category_id || !subject_title || !subject_code) {
      showToast('Please fill out all required fields marked with *', { type: 'warning' })
      return
    }

    const newSubjects = [];
    newSubjects.push({ title: subject_title.trim(), code: subject_code.trim() });
    for (const ex of subjectForm.extraSubjects) {
      if (ex.title.trim() && ex.code.trim()) {
         newSubjects.push({ title: ex.title.trim(), code: ex.code.trim() });
      }
    }

    for (const ns of newSubjects) {
      const duplicate = subjects.some(s => {
        const sameYear = String(s.academic_year_id || '') === String(academic_year_id);
        const sameClass = String(s.class_id || '') === String(class_id);
        const sameTerm = s.term === term;
        const sameTitle = (s.subject_title || '').toLowerCase() === ns.title.toLowerCase();
        
        if (isLowerClass) {
           return sameYear && sameClass && sameTerm && sameTitle;
        } else {
           const sameSection = String(s.section_id || '') === String(finalSectionId);
           return sameYear && sameClass && sameSection && sameTerm && sameTitle;
        }
      });
      if (duplicate) {
        showToast(`Subject "${ns.title}" already exists for this selection.`, { type: 'warning' });
        return;
      }
    }

    const payload = newSubjects.map(ns => ({
      academic_year_id,
      school_level,
      class_id,
      section_id: finalSectionId,
      term,
      category_id,
      subject_title: ns.title,
      subject_code: ns.code
    }));

    try {
      const { data, error } = await supabase.from('subjects').insert(payload).select()
      
      if (error) {
        showToast(error.message, { type: 'danger' })
      } else {
        showToast(`Successfully added ${payload.length} subject(s)`, { type: 'success' })
        setSubjectForm(prev => ({ ...prev, subject_title: '', subject_code: '', extraSubjects: [] }))
        loadSubjects()
      }
    } catch (err) {
      console.error(err)
      showToast('Failed to insert subjects. Make sure subjects table is created properly.', { type: 'danger' })
    }
  }

  return (
    <AdShellAdmin>
      <div className="desktop-container admin-content" style={{ overflowX: 'hidden' }}>
        <h4 className="mb-4">Subjects Overview</h4>

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

            <div className="students-section-form row g-3 align-items-end">
              <div className="col-md-6">
                <label className="form-label fw-bold mb-1">Category Name *</label>
                <input
                  className="form-control"
                  placeholder="e.g., Main"
                  value={categoryName}
                  onChange={e => setCategoryName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddCategory() }}
                />
              </div>
              <div className="col-md-6">
                <button type="button" className="btn btn-primary students-button" onClick={handleAddCategory}>
                  Add Category
                </button>
              </div>
            </div>

            {categories.length > 0 && (
              <div className="row g-3 mt-3">
                {categories.map(cat => (
                  <div key={cat.id} className="col-md-4">
                    <div className="card h-100 students-category-card">
                      <div className="card-body d-flex flex-column gap-3">
                        <div>
                          <p className="fw-bold mb-0 text-dark">{cat.category_name}</p>
                        </div>
                      </div>
                      <div className="mt-auto d-flex gap-2 flex-wrap">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger students-button students-button-sm flex-fill"
                          onClick={() => setConfirmModalState({ isOpen: true, type: 'CATEGORY', payload: cat.id })}
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

        <section className="setup-section mb-4">
          <div className="students-section-shell card card-soft mb-4">
            <div className="students-section-shell-header mb-3">
              <div>
                <h5 className="section-title mb-1" style={{ fontSize: '1.1rem' }}>Create Subjects</h5>
                <p className="students-section-copy mb-0">
                  Select your mapping layout and insert subject details separately per term.
                </p>
              </div>
            </div>

            <div className="students-section-form row g-3">
              <div className="col-md-3">
                <label className="form-label fw-bold mb-1">Academic Year *</label>
                <select
                  className="form-select"
                  value={subjectForm.academic_year_id}
                  onChange={(e) => setSubjectForm({ ...subjectForm, academic_year_id: e.target.value })}
                >
                  <option value="">Select Year</option>
                  {academicYears.map(y => <option key={y.id} value={y.id}>{y.year_name}</option>)}
                </select>
              </div>

              <div className="col-md-3">
                <label className="form-label fw-bold mb-1">School Level *</label>
                <select
                  className="form-select"
                  value={subjectForm.school_level}
                  onChange={(e) => setSubjectForm({ ...subjectForm, school_level: e.target.value })}
                >
                  <option value="">Select Level</option>
                  <option value="Primary">Primary</option>
                  <option value="Middle">Middle</option>
                  <option value="Secondary">Secondary</option>
                </select>
              </div>

              <div className="col-md-3">
                <label className="form-label fw-bold mb-1">Class *</label>
                <select
                  className="form-select"
                  value={subjectForm.class_id}
                  onChange={(e) => setSubjectForm({ ...subjectForm, class_id: e.target.value, section_id: '' })}
                >
                  <option value="">Select Class</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                </select>
              </div>

              {isHigherClass && (
                <div className="col-md-3">
                  <label className="form-label fw-bold mb-1">Section *</label>
                  <select
                    className="form-select"
                    value={subjectForm.section_id}
                    disabled={!subjectForm.class_id}
                    onChange={(e) => setSubjectForm({ ...subjectForm, section_id: e.target.value })}
                  >
                    <option value="">Select Section</option>
                    {sections.map(s => <option key={s.id} value={s.id}>{s.section_name}</option>)}
                  </select>
                  <div className="text-muted small mt-1">Subjects will be created for the selected section.</div>
                </div>
              )}

              {isLowerClass && (
                <div className="col-md-3 d-flex align-items-center">
                  <div className="text-primary small fw-bold mt-4">
                    Subjects will be applied to all sections of this class.
                  </div>
                </div>
              )}

              {!subjectForm.class_id && (
                <div className="col-md-3">
                  <label className="form-label fw-bold mb-1">Section *</label>
                  <select className="form-select" disabled>
                    <option value="">Select Section</option>
                  </select>
                </div>
              )}

              <div className="col-md-3">
                <label className="form-label fw-bold mb-1">Term *</label>
                <select
                  className="form-select"
                  value={subjectForm.term}
                  onChange={(e) => setSubjectForm({ ...subjectForm, term: e.target.value })}
                >
                  <option value="">Select Term</option>
                  <option value="Term 1">Term 1</option>
                  <option value="Term 2">Term 2</option>
                  <option value="Term 3">Term 3</option>
                </select>
              </div>

              <div className="col-md-3">
                <label className="form-label fw-bold mb-1">Category *</label>
                <select
                  className="form-select"
                  value={subjectForm.category_id}
                  onChange={(e) => setSubjectForm({ ...subjectForm, category_id: e.target.value })}
                >
                  <option value="">Select Category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.category_name}</option>)}
                </select>
              </div>

              <div className="col-md-6 border rounded p-3 bg-light">
                <div className="row mb-2">
                  <div className="col-6">
                    <label className="form-label fw-bold mb-1">Subject Title *</label>
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-bold mb-1">Subject Code *</label>
                  </div>
                </div>

                <div className="d-flex gap-2 align-items-center mb-2">
                  <input
                    className="form-control"
                    style={{ flex: "0 0 48%", minWidth: "48%" }}
                    placeholder="e.g. Mathematics"
                    value={subjectForm.subject_title}
                    onChange={(e) => setSubjectForm({ ...subjectForm, subject_title: e.target.value })}
                  />
                  <input
                    className="form-control"
                    style={{ flex: "0 0 50%", minWidth: "50%" }}
                    placeholder="e.g. MATH101"
                    value={subjectForm.subject_code}
                    onChange={(e) => setSubjectForm({ ...subjectForm, subject_code: e.target.value })}
                  />
                </div>

                {subjectForm.extraSubjects.map((ex, idx) => (
                  <div key={idx} className="d-flex gap-2 align-items-center mb-2">
                    <input
                      className="form-control"
                      style={{ flex: "0 0 44%", minWidth: "44%" }}
                      placeholder="Subject Title"
                      value={ex.title}
                      onChange={(e) => {
                        const newEx = [...subjectForm.extraSubjects]
                        newEx[idx].title = e.target.value
                        setSubjectForm({ ...subjectForm, extraSubjects: newEx })
                      }}
                    />
                    <input
                      className="form-control"
                      style={{ flex: "0 0 44%", minWidth: "44%" }}
                      placeholder="Subject Code"
                      value={ex.code}
                      onChange={(e) => {
                        const newEx = [...subjectForm.extraSubjects]
                        newEx[idx].code = e.target.value
                        setSubjectForm({ ...subjectForm, extraSubjects: newEx })
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-outline-danger btn-sm px-2"
                      onClick={() => {
                        const newEx = [...subjectForm.extraSubjects]
                        newEx.splice(idx, 1)
                        setSubjectForm({ ...subjectForm, extraSubjects: newEx })
                      }}
                    >
                      <i className="bi bi-x-lg"></i>
                    </button>
                  </div>
                ))}

                <button 
                  type="button" 
                  className="btn btn-sm btn-outline-primary mt-2 fw-bold"
                  onClick={() => setSubjectForm({ ...subjectForm, extraSubjects: [...subjectForm.extraSubjects, { title: '', code: '' }] })}
                >
                  <i className="bi bi-plus-lg me-1"></i> Add another subject
                </button>
              </div>
            </div>

            <div className="mt-3 text-end">
              <button type="button" className="btn btn-primary students-button fw-bold px-4" onClick={saveSubjects}>
                Add Entry
              </button>
            </div>
          </div>
        </section>

        {subjects.length > 0 && (
          <section className="setup-section mb-4">
            <div className="students-table-panel card card-soft mb-4">
              <div className="students-table-panel-header mb-3">
                <div>
                  <p className="students-table-panel-title mb-1 text-white">Saved Subjects</p>
                  <p className="students-table-panel-copy mb-0">Review previously created subjects combinations across all terms.</p>
                </div>
              </div>
              <div className="table-responsive">
                <table className="table students-table align-middle">
                  <thead>
                    <tr>
                      <th>Year</th>
                      <th>Level</th>
                      <th>Class/Section</th>
                      <th>Term</th>
                      <th>Category</th>
                      <th>Subject (Code)</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjects.map(s => (
                      <tr key={s.id}>
                        <td className="fw-semibold text-dark">{s.academic_years?.year_name || s.academic_year_id || '-'}</td>
                        <td>{s.school_level}</td>
                        <td>
                          {s.classes?.class_name || s.class_id || '-'}
                          {(s.sections?.section_name || s.section_id) ? <span className="text-muted fw-bold ms-1">({s.sections?.section_name || s.section_id})</span> : null}
                        </td>
                        <td><span className="badge bg-light text-dark border px-2 py-1">{s.term}</span></td>
                        <td>{s.subject_categories?.category_name || s.category_id || '-'}</td>
                        <td className="fw-bold text-dark">{s.subject_title} <span className="text-muted ms-1">({s.subject_code})</span></td>
                        <td className="text-end">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger py-1 px-2"
                            onClick={() => setConfirmModalState({ isOpen: true, type: 'SUBJECT', payload: s.id })}
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}
      </div>

      <ConfirmationModal
        isOpen={confirmModalState.isOpen}
        onClose={() => setConfirmModalState({ isOpen: false, type: null, payload: null })}
        onConfirm={handleConfirmDelete}
        title={confirmModalState.type === 'CATEGORY' ? "Delete Category" : "Delete Subject"}
        message={`Are you sure you want to delete this ${confirmModalState.type === 'CATEGORY' ? 'category' : 'subject'}? This action cannot be undone.`}
        confirmText="Confirm Delete"
      />
    </AdShellAdmin>
  )
}
