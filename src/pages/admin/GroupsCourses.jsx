import { useEffect, useMemo, useState } from 'react'
import AdShellAdmin from '../../components/AdShellAdmin'
import GroupsCoursesSection from '../exam/GroupsCourses'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../store/ui'
import ConfirmationModal from '../../components/ConfirmationModal'
import '../exam/Dashboard.css'
import './Setup.css'
import './AdminContent.css'

export default function GroupsCourses() {
  const [classes, setClasses] = useState([])
  const [sections, setSections] = useState([])
  const [mappings, setMappings] = useState([])
  const [academicYears, setAcademicYears] = useState([])
  const [allGroups, setAllGroups] = useState([])

  const [groupForm, setGroupForm] = useState({
    id: '',
    category: '',
    categoryId: '',
    code: '',
    name: '',
    sections: '',
  })
  const [editingGroupId, setEditingGroupId] = useState('')

  const [courseForm, setCourseForm] = useState({
    id: '',
    groupCode: '',
    groupName: '',
    courseCode: '',
    courseName: '',
    academicYearId: '',
  })
  const [editingCourseId, setEditingCourseId] = useState('')

  const [deleteConfirmation, setDeleteConfirmation] = useState({
    show: false,
    type: null,
    id: null,
    message: ''
  })

  const loadData = async () => {
    try {
      // Fetch classes with their sections via class_sections relation
      // Note: Relation name is usually the table name or specified FK name. 
      // If "sections" fails, it might be "class_sections". Using junction table format for safety.
      const { data: classRows, error: classError } = await supabase
        .from("classes")
        .select(`
          id,
          class_name,
          class_number,
          category_id,
          school_level,
          class_sections(
            id,
            academic_year_id,
            sections(id, section_name, group_id)
          )
        `)
        .order("class_name");

      if (classError) throw classError;

      const { data: allSecs, error: secError } = await supabase
        .from("sections")
        .select("*")
        .order("section_name");
      
      if (secError) throw secError;

      const { data: years, error: yearError } = await supabase
        .from("academic_years")
        .select("*")
        .order("year_name");

      if (yearError) throw yearError;

      const { data: groups, error: groupError } = await supabase
        .from("groups")
        .select("*")
        .order("group_name");

      if (groupError) throw groupError;

      setClasses(classRows || []);
      setSections(allSecs || []);
      setAcademicYears(years || []);
      setAllGroups(groups || []);

      // Flatten mappings for the UI expectation
      const flattenedMappings = [];
      classRows.forEach(c => {
        (c.class_sections || []).forEach(cs => {
          flattenedMappings.push({
            id: cs.id,
            classId: c.id,
            sectionId: cs.sections?.id,
            sectionName: cs.sections?.section_name,
            academicYearId: cs.academic_year_id,
            groupId: cs.sections?.group_id,
            classNumber: c.class_number,
            className: c.class_name
          });
        });
      });
      setMappings(flattenedMappings);

    } catch (error) {
      console.error('Failed to load data:', error)
      showToast(error?.message || 'Failed to load data', { type: 'danger' })
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const sectionsWithClass = useMemo(() => {
    const classById = classes.reduce((acc, row) => {
      acc[row.id] = row
      return acc
    }, {})

    return (mappings || []).map((row) => ({
      id: row.id,
      classId: row.classId,
      sectionId: row.sectionId,
      academicYearId: row.academicYearId,
      groupCode: String(classById[row.classId]?.class_number || row.classNumber || ''),
      groupName: classById[row.classId]?.class_name || row.className || '',
      courseCode: row.sectionName || '',
      courseName: row.sectionName || '',
    }))
  }, [mappings, classes])

  const saveGroup = async () => {
    const classNumber = Number(groupForm.code)
    if (!Number.isInteger(classNumber) || classNumber < 1 || classNumber > 12) {
      showToast('Class must be between 1 and 12.', { type: 'warning' })
      return
    }

    if (!groupForm.category) {
      showToast('School Level is required.', { type: 'warning' })
      return
    }

    if (!groupForm.name?.trim()) {
      showToast('Class Name is required.', { type: 'warning' })
      return
    }

    if (!groupForm.sections?.trim()) {
      showToast('Section is required.', { type: 'warning' })
      return
    }

    try {
      // 1. Create/Update Class
      let savedClass;
      const classPayload = {
        class_number: classNumber,
        class_name: groupForm.name,
        school_level: groupForm.category,
        category_id: groupForm.categoryId || null
      };

      if (editingGroupId) {
        const { data, error } = await supabase
          .from("classes")
          .update(classPayload)
          .eq("id", editingGroupId)
          .select()
          .single();
        if (error) throw error;
        savedClass = data;
      } else {
        const existingClass = classes.find(c => Number(c.class_number) === classNumber);
        if (existingClass) {
          savedClass = existingClass;
        } else {
          const { data, error } = await supabase
            .from("classes")
            .insert([classPayload])
            .select()
            .single();
          if (error) throw error;
          savedClass = data;
        }
      }

      // 2. Section handling (1-10 directly, 11-12 usually via group but base section creation is same)
      const sectionName = groupForm.sections.trim();
      let savedSection;

      const { data: existingSec, error: secFetchError } = await supabase
        .from("sections")
        .select()
        .eq("section_name", sectionName)
        .maybeSingle();
      
      if (existingSec) {
        savedSection = existingSec;
      } else {
        const { data, error } = await supabase
          .from("sections")
          .insert([{ section_name: sectionName }])
          .select()
          .single();
        if (error) throw error;
        savedSection = data;
      }

      // 3. Mapping
      const currentYearId = academicYears?.[0]?.id || null;
      const { error: mapError } = await supabase
        .from("class_sections")
        .upsert([{
          class_id: savedClass.id,
          section_id: savedSection.id,
          academic_year_id: currentYearId
        }], { onConflict: 'class_id,section_id,academic_year_id' });
      
      if (mapError) throw mapError;

      showToast('Class and section combination saved successfully', { type: 'success' })
      setGroupForm({ id: '', category: '', categoryId: '', code: '', name: '', sections: '' })
      setEditingGroupId('')
      await loadData()
    } catch (error) {
      console.error('Failed to save class:', error)
      showToast(error?.message || 'Failed to save class', { type: 'danger' })
    }
  }

  // Exposed for the section component to handle group-specific saves
  useEffect(() => {
    window.handleSaveWithGroup = async (groupId) => {
      const classNumber = Number(groupForm.code)
      if (!Number.isInteger(classNumber) || classNumber < 1 || classNumber > 12) {
        showToast('Class must be between 1 and 12.', { type: 'warning' })
        return
      }

      try {
        // 1. Create Class
        const classPayload = {
          class_number: classNumber,
          class_name: groupForm.name,
          school_level: groupForm.category,
        };

        let savedClass;
        const existingClass = classes.find(c => Number(c.class_number) === classNumber);
        if (existingClass) {
          savedClass = existingClass;
        } else {
          const { data, error } = await supabase.from("classes").insert([classPayload]).select().single();
          if (error) throw error;
          savedClass = data;
        }

        // 2. Process Group (for HS)
        if (groupId && (classNumber === 11 || classNumber === 12)) {
           // Group already exists because it's passed from child
        }

        // 3. Create Section inside the group
        const sectionName = groupForm.sections.trim();
        let savedSection;
        
        const { data: existingSec } = await supabase.from("sections").select().eq("section_name", sectionName).eq("group_id", groupId).maybeSingle();
        if (existingSec) {
          savedSection = existingSec;
        } else {
          const { data, error } = await supabase.from("sections").insert([{ section_name: sectionName, group_id: groupId }]).select().single();
          if (error) throw error;
          savedSection = data;
        }

        // 4. Map it
        const currentYearId = academicYears?.[0]?.id || null;
        const { error: mapError } = await supabase.from("class_sections").upsert([{
          class_id: savedClass.id,
          section_id: savedSection.id,
          academic_year_id: currentYearId,
          group_id: groupId
        }], { onConflict: 'class_id,section_id,academic_year_id' });
        
        if (mapError) throw mapError;

        showToast('Updated successfully with group', { type: 'success' })
        setGroupForm({ id: '', category: '', categoryId: '', code: '', name: '', sections: '' })
        setEditingGroupId('')
        await loadData()
      } catch (error) {
        console.error('Failed to save class with group:', error)
        showToast(error?.message || 'Failed to save class', { type: 'danger' })
      }
    };
    return () => { delete window.handleSaveWithGroup; };
  }, [groupForm, editingGroupId, classes, sections, academicYears]);


  const editGroup = (group) => {
    setGroupForm({
      id: group.id,
      category: group.category || group.school_level || '',
      categoryId: group.category_id || '',
      code: String(group.class_number || group.code || ''),
      name: group.class_name || group.name || '',
      sections: '', // Form is for single combinations now
    })
    setEditingGroupId(group.id)
  }

  const saveCourse = async () => {
    if (!courseForm.groupCode || !courseForm.courseCode) {
      showToast('Select class and section.', { type: 'warning' })
      return
    }

    const selectedClass = classes.find((row) => String(row.class_number || row.code) === String(courseForm.groupCode))
    if (!selectedClass) {
      showToast('Invalid class selection.', { type: 'danger' })
      return
    }

    const selectedSection = sections.find((row) => String(row.section_name || row.courseName) === String(courseForm.courseCode))
    if (!selectedSection) {
      showToast('Invalid section selection.', { type: 'danger' })
      return
    }

    try {
      if (editingCourseId) {
        await supabase.from("class_sections").delete().eq("id", editingCourseId);
      }

      const { error } = await supabase.from("class_sections").insert([{
        class_id: selectedClass.id,
        section_id: selectedSection.id,
        academic_year_id: courseForm.academicYearId ? Number(courseForm.academicYearId) : null,
      }]);

      if (error) throw error;

      setCourseForm({
        id: '',
        groupCode: '',
        groupName: '',
        courseCode: '',
        courseName: '',
        academicYearId: '',
      })
      setEditingCourseId('')
      showToast('Class-section mapping saved successfully', { type: 'success' })
      await loadData()
    } catch (error) {
      console.error('Failed to save class-section mapping:', error)
      showToast(error?.message || 'Failed to save class-section mapping', { type: 'danger' })
    }
  }

  const editCourse = (mapping) => {
    setCourseForm({
      id: mapping.id,
      groupCode: String(mapping.groupCode || ''),
      groupName: mapping.groupName || '',
      courseCode: mapping.courseCode || '',
      courseName: mapping.courseName || '',
      academicYearId: String(mapping.academicYearId || ''),
    })
    setEditingCourseId(mapping.id)
  }

  const confirmDelete = async () => {
    const { type, id } = deleteConfirmation
    try {
      if (type === 'group') {
        const { error } = await supabase.from("classes").delete().eq("id", id);
        if (error) throw error;
        showToast('Class deleted successfully', { type: 'success' })
      }
      if (type === 'course') {
        const { error } = await supabase.from("class_sections").delete().eq("id", id);
        if (error) throw error;
        showToast('Class-section mapping deleted successfully', { type: 'success' })
      }
      await loadData()
    } catch (error) {
      console.error('Delete failed:', error)
      showToast(error?.message || 'Delete failed', { type: 'danger' })
    }
    setDeleteConfirmation({ show: false, type: null, id: null, message: '' })
  }

  const deleteGroup = (id) => {
    setDeleteConfirmation({ show: true, type: 'group', id, message: 'Are you sure you want to delete this class?' })
  }

  const deleteCourse = (id) => {
    setDeleteConfirmation({ show: true, type: 'course', id, message: 'Are you sure you want to delete this class-section mapping?' })
  }

  return (
    <AdShellAdmin
      brandTitle="ADMIN PORTAL"
      footerTitle="Admin Management Studio"
      footerSubtitle="Crafted for Vijayam College"
    >
      <div className="desktop-container" style={{ overflowX: 'hidden' }}>
        <h4 className="mb-4">Classes & Sections Creation</h4>

        <div className="row g-4 justify-content-center mx-0">
          <div className="col-12">
            <GroupsCoursesSection
              groupForm={groupForm}
              setGroupForm={setGroupForm}
              editingGroupId={editingGroupId}
              setEditingGroupId={setEditingGroupId}
              groups={classes}
              saveGroup={saveGroup}
              editGroup={editGroup}
              deleteGroup={deleteGroup}
              courseForm={courseForm}
              setCourseForm={setCourseForm}
              editingCourseId={editingCourseId}
              setEditingCourseId={setEditingCourseId}
              courses={sectionsWithClass}
              saveCourse={saveCourse}
              editCourse={editCourse}
              deleteCourse={deleteCourse}
              sections={sections}
              allGroups={allGroups}
              loadData={loadData}
              academicYears={academicYears}
            />
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={deleteConfirmation.show}
        onClose={() => setDeleteConfirmation({ show: false, type: null, id: null, message: '' })}
        onConfirm={confirmDelete}
        title="Confirm Delete"
        message={deleteConfirmation.message}
        confirmText="Confirm Delete"
        cancelText="Cancel"
      />
    </AdShellAdmin>
  )
}
