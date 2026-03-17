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
            group_id,
            sections(id, section_name)
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
            groupId: cs.group_id || null,   // group_id is on class_sections junction row
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
      groupId: row.groupId || null,          // ← needed for HS group filtering
      academicYearId: row.academicYearId,
      groupCode: String(classById[row.classId]?.class_number || row.classNumber || ''),
      groupName: classById[row.classId]?.class_name || row.className || '',
      courseCode: row.sectionName || '',
      courseName: row.sectionName || '',
    }))
  }, [mappings, classes])

  const saveGroup = async (groupIdFromUI = null) => {
    const classNumber = Number(groupForm.code)
    if (!Number.isInteger(classNumber) || classNumber < 1 || classNumber > 12) {
      showToast('Class must be between 1 and 12.', { type: 'warning' })
      return
    }

    if (!groupForm.category) {
      showToast('School Level is required.', { type: 'warning' })
      return
    }

    if (!groupForm.sections?.trim()) {
      showToast('Section is required.', { type: 'warning' })
      return
    }

    const isHS = classNumber === 11 || classNumber === 12;
    // For HS, group is required
    if (isHS && !groupIdFromUI) {
      showToast('Please select or create a group for Class 11/12.', { type: 'warning' })
      return
    }

    try {
      // 1. Ensure Class exists with correct name "Class {number}"
      const className = `Class ${classNumber}`;
      let savedClass;
      
      const { data: existingClass, error: fetchErr } = await supabase
        .from("classes")
        .select("*")
        .eq("class_number", classNumber)
        .maybeSingle();
      
      if (fetchErr) throw fetchErr;

      if (existingClass) {
        // Update if existing but name or level is different (optional, but keeps it consistent)
        const { data: updatedClass, error: updateErr } = await supabase
          .from("classes")
          .update({
            class_name: className,
            school_level: groupForm.category
          })
          .eq("id", existingClass.id)
          .select()
          .single();
        if (updateErr) throw updateErr;
        savedClass = updatedClass;
      } else {
        const { data: newClass, error: insertErr } = await supabase
          .from("classes")
          .insert([{
            class_number: classNumber,
            class_name: className,
            school_level: groupForm.category
          }])
          .select()
          .single();
        if (insertErr) throw insertErr;
        savedClass = newClass;
      }

      // 2. Section handling
      // Note: In this schema, it seems sections can exist across different classes/groups
      // or we might need unique section records. Based on existing code, we select/insert by name.
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

      // Check if this class-section combination already exists in class_sections
      const currentYearId = academicYears?.[0]?.id || null;
      const { data: existingMapping, error: checkError } = await supabase
        .from("class_sections")
        .select("id")
        .eq("class_id", savedClass.id)
        .eq("section_id", savedSection.id)
        .eq("academic_year_id", currentYearId)
        .maybeSingle();
      
      if (checkError) throw checkError;
      
      // Only show error if mapping already exists
      if (existingMapping) {
        showToast(`Class ${classNumber} section ${sectionName} already exists`, { type: 'warning' })
        return;
      }

      // 3. Mapping in class_sections junction table
      const mappingPayload = {
        class_id: savedClass.id,
        section_id: savedSection.id,
        academic_year_id: currentYearId,
        group_id: isHS ? groupIdFromUI : null
      };

      const { error: mapError } = await supabase
        .from("class_sections")
        .insert([mappingPayload]);
      
      if (mapError) {
        // Handle unique constraint violation
        if (mapError.code === '23505') {
          showToast(`Class ${classNumber} section ${sectionName} already exists`, { type: 'warning' })
          return;
        }
        throw mapError;
      }

      showToast(`Class ${classNumber} section ${sectionName} saved successfully`, { type: 'success' })
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
    window.handleSaveWithGroup = saveGroup;
    return () => { delete window.handleSaveWithGroup; };
  }, [groupForm, academicYears]);


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
        if (error) {
          // Check for foreign key constraint violation (Supabase/Postgres code 23503)
          if (error.code === '23503') {
            showToast('This class cannot be deleted because it is already used in subjects or other records. Please delete those mappings first.', { type: 'danger' });
            return;
          }
          throw error;
        }
        showToast('Class deleted successfully', { type: 'success' })
      }
      if (type === 'course') {
        const { error } = await supabase.from("class_sections").delete().eq("id", id);
        if (error) {
          if (error.code === '23503') {
            showToast('This mapping cannot be deleted because it is already referenced in other modules (like Timetable).', { type: 'danger' });
            return;
          }
          throw error;
        }
        showToast('Class-section mapping deleted successfully', { type: 'success' })
      }
      await loadData()
    } catch (error) {
      console.error('Delete failed:', error)
      showToast(error?.message || 'Delete failed', { type: 'danger' })
    } finally {
      setDeleteConfirmation({ show: false, type: null, id: null, message: '' })
    }
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
