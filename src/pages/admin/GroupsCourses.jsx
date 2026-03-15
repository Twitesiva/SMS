import { useEffect, useMemo, useState } from 'react'
import AdShellAdmin from '../../components/AdShellAdmin'
import GroupsCoursesSection from '../exam/GroupsCourses'
import { api } from '../../lib/mockApi'
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

  const [groupForm, setGroupForm] = useState({
    id: '',
    category: '',
    categoryId: '',
    code: '',
    name: '',
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
      const [classRows, sectionRows, mappingRows, yearRows] = await Promise.all([
        api.listGroups?.() || [],
        api.listCourses?.() || [],
        api.listClassSections?.() || [],
        api.listAcademicYears?.() || [],
      ])
      setClasses(classRows || [])
      setSections(sectionRows || [])
      setMappings(mappingRows || [])
      setAcademicYears(yearRows || [])
    } catch (error) {
      console.error('Failed to load classes/sections data:', error)
      showToast(error?.message || 'Failed to load classes/sections data', { type: 'danger' })
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

    const payload = {
      code: String(classNumber),
      name: groupForm.name || `Class ${classNumber}`,
      category: groupForm.category || '',
      category_id: groupForm.categoryId || null,
    }

    try {
      if (editingGroupId) {
        await api.updateGroup(editingGroupId, payload)
        showToast('Class updated successfully', { type: 'success' })
      } else {
        await api.addGroup(payload)
        showToast('Class added successfully', { type: 'success' })
      }
      setGroupForm({ id: '', category: '', categoryId: '', code: '', name: '' })
      setEditingGroupId('')
      await loadData()
    } catch (error) {
      console.error('Failed to save class:', error)
      showToast(error?.message || 'Failed to save class', { type: 'danger' })
    }
  }

  const editGroup = (group) => {
    setGroupForm({
      id: group.id,
      category: group.category || group.school_level || '',
      categoryId: group.category_id || '',
      code: String(group.class_number || group.code || ''),
      name: group.class_name || group.name || '',
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
        await api.deleteClassSection(editingCourseId)
      }

      await api.addClassSection({
        classId: selectedClass.id,
        sectionId: selectedSection.id,
        academicYearId: courseForm.academicYearId ? Number(courseForm.academicYearId) : null,
      })

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
        await api.deleteGroup?.(id)
        showToast('Class deleted successfully', { type: 'success' })
      }
      if (type === 'course') {
        await api.deleteClassSection?.(id)
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
