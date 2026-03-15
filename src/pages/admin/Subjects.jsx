import { useEffect, useState, useMemo } from 'react'
import AdShellAdmin from '../../components/AdShellAdmin'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../store/ui'
import ConfirmationModal from '../../components/ConfirmationModal'
import './AdminContent.css'

export default function Subjects() {
  const [academicYears, setAcademicYears] = useState([])
  const [classes, setClasses] = useState([])
  const [allClassSections, setAllClassSections] = useState([])

  const [categories, setCategories] = useState([])
  const [categoryName, setCategoryName] = useState('')

  const [subjects, setSubjects] = useState([])
  const [loadError, setLoadError] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState({})

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

  const [isEditing, setIsEditing] = useState(false)
  const [viewModalData, setViewModalData] = useState({ isOpen: false, loading: false, categoryName: '', subtitle: '', subjects: [] })
  const [confirmModalState, setConfirmModalState] = useState({ isOpen: false, type: null, payload: null })

  const loadInitialData = async () => {
    try {
      const [
        { data: years, error: yErr },
        { data: cls, error: cErr },
        { data: cats, error: catErr },
        { data: clsSec, error: csErr }
      ] = await Promise.all([
        supabase.from('academic_years').select('id, year_name'),
        supabase.from('classes').select('id, class_name, category_id'),
        supabase.from('subject_categories').select('id, category_name'),
        supabase.from('class_sections').select('class_id, section_id, sections(id, section_name)')
      ]);

      if (yErr || cErr || catErr || csErr) {
        if (yErr) console.error("Years error:", yErr);
        if (cErr) console.error("Classes error:", cErr);
        if (catErr && catErr.code !== '42P01') console.error("Categories error:", catErr);
        if (csErr && csErr.code !== '42P01') console.error("ClassSections error:", csErr);
        setLoadError(true);
      }

      if (years) setAcademicYears(years)
      if (cls) setClasses(cls)
      if (cats) setCategories(cats)
      if (clsSec) setAllClassSections(clsSec)

      loadSubjects()
    } catch (err) {
      console.error('Error loading initial data', err)
      setLoadError(true)
    }
  }

  const loadSubjects = async () => {
    try {
      let { data: subs, error: subsError } = await supabase
        .from('subjects')
        .select(`
          id, subject_title, subject_code, term, school_level, academic_year_id, class_id, section_id, category_id,
          academic_years!subjects_academic_year_id_fkey(year_name),
          classes!subjects_class_id_fkey(class_name),
          sections!subjects_section_id_fkey(section_name),
          subject_categories!subjects_category_id_fkey(category_name)
        `)

      if (subsError) {
        console.error("Supabase subjects fetch error:", subsError)
        const fallback = await supabase.from('subjects').select('*')
        subs = fallback.data
        subsError = fallback.error
      }

      if (subs) {
        setSubjects(subs || [])
      } else if (subsError && subsError.code === '42P01') {
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

  const filteredClasses = useMemo(() => {
    if (!subjectForm.school_level) return classes;
    return classes.filter(c => {
      if (c.category_id && String(c.category_id).toLowerCase() === subjectForm.school_level.toLowerCase()) return true;
      const match = c.class_name.match(/\d+/);
      if (!match) return true;
      const num = parseInt(match[0], 10);
      const lvl = subjectForm.school_level.toLowerCase();
      if (lvl === 'primary') return num >= 1 && num <= 5;
      if (lvl === 'middle') return num >= 6 && num <= 8;
      if (lvl === 'secondary') return num >= 9 && num <= 12;
      return true;
    });
  }, [classes, subjectForm.school_level]);

  const filteredSections = useMemo(() => {
    if (!subjectForm.class_id) return [];
    return allClassSections
      .filter(cs => String(cs.class_id) === String(subjectForm.class_id))
      .map(cs => cs.sections)
      .filter(Boolean)
      .reduce((acc, current) => acc.some(item => item.id === current.id) ? acc : [...acc, current], []);
  }, [allClassSections, subjectForm.class_id]);

  const groupedSubjects = useMemo(() => {
    const groups = {};
    subjects.forEach(s => {
      const yearStr = s.academic_years?.year_name || 'Unknown Year';
      const classStr = s.classes?.class_name || 'Unknown Class';
      const sectionStr = s.section_id ? (s.sections?.section_name || 'Unknown Section') : 'All';
      const termStr = s.term || '-';
      const key = `${s.academic_year_id}_${s.class_id}_${s.section_id || 'all'}_${s.term}_${s.school_level}`;

      if (!groups[key]) {
        groups[key] = {
          id: key,
          academic_year: yearStr,
          school_level: s.school_level || '-',
          class_name: classStr,
          section_name: sectionStr,
          term: termStr,
          categories: {},
          subjectIds: []
        };
      }

      const catName = s.subject_categories?.category_name || 'Unknown Category';
      if (!groups[key].categories[catName]) {
        groups[key].categories[catName] = [];
      }
      groups[key].categories[catName].push(s);
      groups[key].subjectIds.push(s.id);
    });

    return Object.values(groups);
  }, [subjects]);

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
    } else if (type === 'SUBJECT_GROUP') {
      const { error } = await supabase.from('subjects').delete().in('id', payload)
      if (!error) {
        setSubjects(subjects.filter(s => !payload.includes(s.id)))
        showToast('Subjects deleted', { type: 'success' })
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

  const handleEditCategoryGroup = (subs) => {
    if (!subs || subs.length === 0) return;
    const first = subs[0];
    const extras = subs.slice(1).map(s => ({ title: s.subject_title, code: s.subject_code }));
    setSubjectForm({
      academic_year_id: first.academic_year_id || '',
      school_level: first.school_level || '',
      class_id: first.class_id || '',
      section_id: first.section_id || '',
      term: first.term || '',
      category_id: first.category_id || '',
      subject_title: first.subject_title || '',
      subject_code: first.subject_code || '',
      extraSubjects: extras
    });
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const openViewModal = async (catName, subs, group) => {
    if (!subs || subs.length === 0) return;
    const first = subs[0];

    const subtitle = `${group.academic_year} • ${group.class_name}${group.section_name !== 'All' ? ` (${group.section_name})` : ''} • ${group.term}`;
    setViewModalData({ isOpen: true, loading: true, categoryName: catName, subtitle, subjects: [] });

    let q = supabase.from('subjects').select('id, subject_title, subject_code')
      .eq('academic_year_id', first.academic_year_id)
      .eq('class_id', first.class_id)
      .eq('term', first.term);

    if (first.category_id) {
      q = q.eq('category_id', first.category_id);
    } else {
      q = q.is('category_id', null);
    }

    if (first.section_id) {
      q = q.eq('section_id', first.section_id);
    } else {
      q = q.is('section_id', null);
    }

    q = q.order('subject_title', { ascending: true });

    const { data, error } = await q;
    if (!error && data) {
      setViewModalData(prev => ({ ...prev, loading: false, subjects: data }));
    } else {
      console.error("Error fetching modal subjects:", error);
      setViewModalData(prev => ({ ...prev, loading: false, subjects: [] }));
      showToast("Failed to load subjects", { type: 'danger' });
    }
  }

  const updateSubjects = async () => {
    const { academic_year_id, school_level, class_id, section_id, term, category_id, subject_title, subject_code } = subjectForm;
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

    try {
      let deleteQuery = supabase.from('subjects').delete()
        .eq('academic_year_id', academic_year_id)
        .eq('class_id', class_id)
        .eq('term', term)
        .eq('category_id', category_id);

      if (finalSectionId) {
        deleteQuery = deleteQuery.eq('section_id', finalSectionId);
      } else {
        deleteQuery = deleteQuery.is('section_id', null);
      }

      const { error: deleteError } = await deleteQuery;
      if (deleteError) throw deleteError;

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

      const { error: insertError } = await supabase.from('subjects').insert(payload);
      if (insertError) throw insertError;

      showToast(`Successfully updated entry with ${payload.length} subject(s)`, { type: 'success' });
      setSubjectForm(prev => ({ ...prev, subject_title: '', subject_code: '', extraSubjects: [] }));
      setIsEditing(false);
      loadSubjects();

    } catch (err) {
      console.error(err);
      showToast('Failed to update subjects. Ensure database relationships are intact.', { type: 'danger' });
    }
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

        {loadError && (
          <div className="alert alert-danger mb-4 fw-bold">
            <i className="bi bi-exclamation-triangle-fill me-2"></i> Unable to load academic data. Please refresh the page.
          </div>
        )}

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
            <div className="students-section-shell-header mb-4">
              <div>
                <h5 className="section-title mb-1" style={{ fontSize: '1.1rem' }}>Create Subjects</h5>
                <p className="students-section-copy mb-0">
                  Select your mapping layout and insert subject details separately per term.
                </p>
              </div>
            </div>

            <div className="students-section-form">
              <div className="row g-3 mb-4">
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
                    onChange={(e) => setSubjectForm({ ...subjectForm, school_level: e.target.value, class_id: '', section_id: '' })}
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
                    {filteredClasses.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                  </select>
                </div>

                {isHigherClass && (
                  <div className="col-md-3">
                    <label className="form-label fw-bold mb-1">Section *</label>
                    <select
                      className="form-select"
                      value={subjectForm.section_id}
                      onChange={(e) => setSubjectForm({ ...subjectForm, section_id: e.target.value })}
                    >
                      <option value="">Select Section</option>
                      {filteredSections.map(s => <option key={s.id} value={s.id}>{s.section_name}</option>)}
                    </select>
                    <div className="text-muted small mt-1 fw-bold">Subjects will be created for the selected section.</div>
                  </div>
                )}

                {isLowerClass && (
                  <div className="col-md-3 d-flex align-items-center">
                    <div className="text-primary small fw-bold mt-4">
                      Subjects will apply to all sections of this class.
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
              </div>

              <div className="border rounded p-4 bg-light">
                <div className="row g-3 mb-4">
                  <div className="col-md-6">
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

                  <div className="col-md-6">
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
                </div>

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
                  className="btn btn-sm btn-outline-primary mt-3 fw-bold"
                  onClick={() => setSubjectForm({ ...subjectForm, extraSubjects: [...subjectForm.extraSubjects, { title: '', code: '' }] })}
                >
                  <i className="bi bi-plus-lg me-1"></i> Add another subject
                </button>
              </div>

              <div className="mt-4 text-end">
                {isEditing ? (
                  <div className="d-flex justify-content-end gap-2">
                    <button type="button" className="btn btn-outline-secondary fw-bold px-4" onClick={() => { setIsEditing(false); setSubjectForm({ ...subjectForm, subject_title: '', subject_code: '', extraSubjects: [] }); }}>Cancel Edit</button>
                    <button type="button" className="btn btn-warning text-dark fw-bold px-4" onClick={updateSubjects}>Update Entry</button>
                  </div>
                ) : (
                  <button type="button" className="btn btn-primary students-button fw-bold px-4" onClick={saveSubjects}>
                    Submit Subjects
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {groupedSubjects.length > 0 && (
          <section className="setup-section mb-4">
            <div className="students-table-panel card card-soft mb-4">
              <div className="students-table-panel-header mb-3">
                <div>
                  <p className="students-table-panel-title mb-1 text-white">Configured Configurations</p>
                  <p className="students-table-panel-copy mb-0">Review previously created subjects mapped to their respective classes and terms.</p>
                </div>
              </div>
              <div className="table-responsive">
                <table className="table students-table align-middle">
                  <thead>
                    <tr className="text-uppercase" style={{ fontSize: '0.85rem' }}>
                      <th className="fw-bold py-3 text-secondary">Academic Year</th>
                      <th className="fw-bold py-3 text-secondary">Level</th>
                      <th className="fw-bold py-3 text-secondary">Class</th>
                      <th className="fw-bold py-3 text-secondary">Section</th>
                      <th className="fw-bold py-3 text-secondary">Term</th>
                      <th className="fw-bold py-3 text-secondary" style={{ minWidth: '250px' }}>Categories & Subjects</th>
                      <th className="fw-bold py-3 text-secondary">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedSubjects.map(group => {
                      const categoryEntries = Object.entries(group.categories);
                      return categoryEntries.map(([catName, catsubs], index) => (
                        <tr key={`${group.id}_${catName}`} className="align-middle border-bottom">
                          {index === 0 && (
                            <>
                              <td rowSpan={categoryEntries.length} className="fw-semibold text-dark border-end-0">{group.academic_year}</td>
                              <td rowSpan={categoryEntries.length} className="border-end-0">{group.school_level}</td>
                              <td rowSpan={categoryEntries.length} className="fw-bold border-end-0">{group.class_name}</td>
                              <td rowSpan={categoryEntries.length} className="border-end-0">
                                {group.section_name === 'All' ? (
                                  <span className="badge bg-light text-dark px-2 py-1 border">All</span>
                                ) : (
                                  group.section_name
                                )}
                              </td>
                              <td rowSpan={categoryEntries.length} className="border-end-0"><span className="badge bg-light text-dark border px-2 py-1">{group.term}</span></td>
                            </>
                          )}
                          <td className="pt-3 pb-3 border-end-0">
                            <div className="border rounded px-3 py-2" style={{ backgroundColor: '#f9fbff', borderColor: '#d3e0f5' }}>
                              <div className="fw-bold text-dark">{catName}</div>
                              <button
                                type="button"
                                className="btn btn-sm btn-link text-decoration-none p-0 text-dark fw-semibold mt-1"
                                style={{ fontSize: '0.85rem' }}
                                onClick={() => openViewModal(catName, catsubs, group)}
                              >
                                Click to view
                              </button>
                            </div>
                          </td>
                          <td className="pt-3 pb-3">
                            <div className="d-flex gap-2">
                              <button
                                type="button"
                                className="btn btn-sm rounded-pill px-3 fw-bold align-items-center d-flex gap-1"
                                style={{ color: '#4c6496', border: '1px solid #d3e0f5', backgroundColor: '#f9fbff', fontSize: '0.8rem' }}
                                onClick={() => handleEditCategoryGroup(catsubs)}
                                title={`Edit ${catName}`}
                              >
                                Edit {catName}
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm rounded-pill px-3 fw-bold text-danger align-items-center d-flex gap-1"
                                style={{ border: '1px solid #f5d3d3', backgroundColor: '#fff9f9', fontSize: '0.8rem' }}
                                onClick={() => setConfirmModalState({ isOpen: true, type: 'SUBJECT_GROUP', payload: catsubs.map(s => s.id) })}
                                title="Delete Group"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ));
                    })}
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
        title={confirmModalState.type === 'CATEGORY' ? "Delete Category" : confirmModalState.type === 'SUBJECT_GROUP' ? "Delete Group" : "Delete Subject"}
        message={`Are you sure you want to delete ${confirmModalState.type === 'CATEGORY' ? 'this category' : 'the selected subject(s)'}? This action cannot be undone.`}
        confirmText="Confirm Delete"
      />

      {/* View Modal Overlay */}
      {viewModalData.isOpen && (
        <div className="modal-backdrop fade show" style={{ backdropFilter: 'blur(5px)' }}></div>
      )}

      {/* View Modal Container */}
      <div className={`modal fade ${viewModalData.isOpen ? 'show d-block' : ''}`} tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content shadow-lg text-white" style={{ borderRadius: '16px', border: 'none', background: 'transparent' }}>
            <div className="modal-header border-0 pb-0" style={{ background: 'linear-gradient(135deg, #4c6496, #2d3b59)', borderTopLeftRadius: '16px', borderTopRightRadius: '16px', padding: '24px 32px' }}>
              <div>
                <p className="mb-0 fw-bold" style={{ fontSize: '0.75rem', letterSpacing: '1px' }}>SUB-CATEGORY SUBJECTS</p>
                <h3 className="mb-1 fw-bold text-white text-uppercase" style={{ letterSpacing: '2px' }}>{viewModalData.categoryName}</h3>
                <p className="mb-0 fw-semibold" style={{ fontSize: '0.9rem', color: '#e0e7ff' }}>{viewModalData.subtitle}</p>
              </div>
              <button
                type="button"
                className="btn btn-sm align-self-start mt-1"
                style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white', border: 'none', borderRadius: '8px', padding: '4px 12px' }}
                onClick={() => setViewModalData(prev => ({ ...prev, isOpen: false }))}
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="modal-body bg-white text-dark p-0" style={{ borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px', maxHeight: '60vh', overflowY: 'auto' }}>
              {viewModalData.loading ? (
                <div className="p-5 text-center text-muted fw-bold">Loading subjects...</div>
              ) : (
                <table className="table mb-0 align-middle table-hover">
                  <thead>
                    <tr>
                      <th className="border-0 bg-white pt-4 pb-2 ps-4 fw-bold" style={{ width: '80px', color: '#6c757d', fontSize: '0.85rem' }}>S.No</th>
                      <th className="border-0 bg-white pt-4 pb-2 fw-bold" style={{ color: '#6c757d', fontSize: '0.85rem' }}>Subjects</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewModalData.subjects.map((sub, idx) => (
                      <tr key={sub.id}>
                        <td className="ps-4 fw-bold py-3 text-secondary">{idx + 1}</td>
                        <td className="fw-bold py-3">{sub.subject_code} - {sub.subject_title}</td>
                      </tr>
                    ))}
                    {viewModalData.subjects.length === 0 && (
                      <tr>
                        <td colSpan="2" className="text-center py-5 text-muted fw-bold">No subjects mapped to this selection.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
              <div className="pb-4 bg-white" style={{ borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px' }}></div>
            </div>
          </div>
        </div>
      </div>
    </AdShellAdmin>
  )
}
