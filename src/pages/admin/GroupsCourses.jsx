import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/mockApi'
import { supabase } from '../../../supabaseClient'
import AdShellAdmin from '../../components/AdShellAdmin'

import GroupsCoursesSection from '../exam/GroupsCourses'
import '../exam/Dashboard.css'
import './Setup.css'
import './AdminContent.css'
import { showToast } from '../../store/ui'
import { validateRequiredFields } from '../../lib/validation'
import ConfirmationModal from '../../components/ConfirmationModal'



const buildGroupNameMap = (groups = []) => {
  return (groups || []).reduce((acc, group) => {
    const code = group.code || group.group_code || group.groupName || ''
    const name = group.name || group.group_name || group.groupName || ''
    if (code) acc[code] = name || code
    return acc
  }, {})
}

const enrichCourseRecord = (course = {}, groupNameByCode = {}) => {
  const code = course.group_name || course.groupCode || course.group_code || ''
  return {
    ...course,
    groupCode: code,
    groupName: groupNameByCode[code] || code
  }
}

export default function GroupsCourses() {
  const [groups, setGroups] = useState([])
  const [courses, setCourses] = useState([])
  const [groupForm, setGroupForm] = useState({
    id: '',
    category: '',
    code: '',
    name: '',
    years: 0,
    semesters: 0
  })
  const [editingGroupId, setEditingGroupId] = useState('')
  const [courseForm, setCourseForm] = useState({
    id: '',
    groupCode: '',
    groupName: '',
    courseCode: '',
    courseName: '',
    semesters: 6
  })
  const [editingCourseId, setEditingCourseId] = useState('')

  // Delete Modal State
  const [deleteConfirmation, setDeleteConfirmation] = useState({
    show: false,
    type: null, // 'group' | 'course'
    id: null,
    message: ''
  })

  useEffect(() => {
    const loadData = async () => {
      try {
        const [groupRows, courseRows] = await Promise.all([
          api.listGroups?.() || [],
          api.listCourses?.() || []
        ])
        setGroups(groupRows || [])
        setCourses(courseRows || [])
      } catch (error) {
        console.error('Failed to load groups and courses:', error)
        showToast(error?.message || 'Failed to load groups and courses', { type: 'danger' })
      }
    }

    loadData()
  }, [])

  const groupNameByCode = useMemo(() => buildGroupNameMap(groups), [groups])
  const coursesWithNames = useMemo(
    () => courses.map((course) => enrichCourseRecord(course, groupNameByCode)),
    [courses, groupNameByCode]
  )

  const saveGroup = async () => {
    if (
      !validateRequiredFields({
        'Group code': groupForm.code,
        'Group name': groupForm.name
      })
    )
      return

    const code = groupForm.code.toUpperCase()
    const payload = {
      code,
      name: groupForm.name,
      category: groupForm.category,
      years: Number(groupForm.years) || 0,
      semesters: Number(groupForm.semesters) || 0
    }

    if (editingGroupId) {
      try {
        const updated = await api.updateGroup?.(editingGroupId, payload)
        if (updated) {
          setGroups((prev) =>
            prev.map((g) => (g.id === editingGroupId ? updated : g))
          )
          showToast('Updated successfully', {
            type: 'success',
            title: 'Group'
          })
        }
      } catch (error) {
        console.error('Error updating group:', error)
        showToast(error?.message || 'Error updating group', {
          type: 'danger'
        })
      }
      setEditingGroupId('')
    } else {
      if (groups.some((g) => g.code === code)) {
        showToast('Group code already exists.', {
          type: 'danger',
          title: 'Duplicate code'
        })
        return
      }

      try {
        const created = await api.addGroup(payload)
        if (created) {
          setGroups((prev) => [...prev, created])
          showToast('Group created Successfully', {
            type: 'success',
            title: 'Group'
          })
        }
      } catch (error) {
        console.error('Error adding group:', error)
        showToast(error?.message || 'Error adding group', { type: 'danger' })
      }
    }

    setGroupForm({
      id: '',
      category: '',
      code: '',
      name: '',
      years: 0,
      semesters: 0
    })
  }

  const editGroup = (group) => {
    setGroupForm(group)
    setEditingGroupId(group.id)
  }

  const saveCourse = async () => {
    const {
      groupCode,
      courseCode,
      courseName,
      semesters: semCount
    } = courseForm

    if (
      !validateRequiredFields({
        'Group code': groupCode,
        'Course code': courseCode,
        'Course name': courseName,
        'Number of semesters': semCount
      })
    )
      return

    const code = courseCode.toUpperCase()

    const selectedGroup =
      groups.find((g) => (g.groupCode || g.code || g.group_code) === groupCode) ||
      groups.find((g) => (g.group_name || g.name) === courseForm.groupName)
    const groupNameValue =
      selectedGroup?.group_name ||
      selectedGroup?.name ||
      selectedGroup?.groupName ||
      courseForm.groupName ||
      groupNameByCode[groupCode] ||
      groupCode

    const payload = {
      code,
      name: courseName,
      group_name: groupNameValue,
      semesters: Number(semCount) || 0
    }

    if (editingCourseId) {
      try {
        const updated = await api.updateCourse?.(editingCourseId, payload)
        if (updated) {
          setCourses((prev) =>
            prev.map((c) => (c.id === editingCourseId ? updated : c))
          )
          showToast('Updated successfully', {
            type: 'success',
            title: 'Course'
          })
        }
      } catch (error) {
        console.error('Error updating course:', error)
        showToast(error?.message || 'Error updating course', {
          type: 'danger'
        })
      }
      setEditingCourseId('')
    } else {
      if (courses.some((c) => (c.courseCode || c.code) === code)) return

      try {
        const created = await api.addCourse(payload)
        if (created) {
          setCourses((prev) => [...prev, created])
          showToast('Course created Successfully', {
            type: 'success',
            title: 'Course'
          })
        }
      } catch (error) {
        console.error('Error adding course:', error)
        showToast(error?.message || 'Error adding course', { type: 'danger' })
      }
    }

    setCourseForm({
      id: '',
      groupCode: '',
      groupName: '',
      courseCode: '',
      courseName: '',
      semesters: 6
    })
  }

  const editCourse = (course) => {
    setCourseForm({
      id: course.id,
      groupCode: course.groupCode || course.group_code || course.group_name || '',
      groupName: course.groupName || course.group_name || course.groupName || '',
      courseCode: course.courseCode || course.code || '',
      courseName: course.courseName || course.name || '',
      semesters: course.semesters ?? course.number_semesters ?? 6
    })
    setEditingCourseId(course.id)
  }

  const confirmDelete = async () => {
    const { type, id } = deleteConfirmation
    if (!type || !id) return

    if (type === 'group') {
      setGroups((prev) => prev.filter((g) => g.id !== id))
      try {
        await api.deleteGroup?.(id)
        showToast('Group deleted successfully', { type: 'success', title: 'Group' })
      } catch (error) {
        console.error('Error deleting group:', error)
        showToast(error?.message || 'Error deleting group', { type: 'danger' })
      }
    } else if (type === 'course') {
      setCourses((prev) => prev.filter((c) => c.id !== id))
      try {
        await api.deleteCourse?.(id)
        showToast('Course deleted successfully', { type: 'success', title: 'Course' })
      } catch (error) {
        console.error('Error deleting course:', error)
        showToast(error?.message || 'Error deleting course', { type: 'danger' })
      }
    }
    closeDeleteModal()
  }

  const closeDeleteModal = () => {
    setDeleteConfirmation({ show: false, type: null, id: null, message: '' })
  }

  const deleteGroup = (id) => {
    setDeleteConfirmation({
      show: true,
      type: 'group',
      id,
      message: 'Are you sure you want to delete this group?'
    })
  }

  const deleteCourse = (id) => {
    setDeleteConfirmation({
      show: true,
      type: 'course',
      id,
      message: 'Are you sure you want to delete this course?'
    })
  }

  return (
    <AdShellAdmin
      brandTitle="ADMIN PORTAL"
      footerTitle="Admin Management Studio"
      footerSubtitle="Crafted for Vijayam College"
    >
      <div className="desktop-container" style={{ overflowX: 'hidden' }}>
        <h4 className="mb-4">Groups & Courses Creation</h4>

        <div className="row g-4 justify-content-center mx-0">
          <div className="col-12">
            <GroupsCoursesSection
              groupForm={groupForm}
              setGroupForm={setGroupForm}
              editingGroupId={editingGroupId}
              setEditingGroupId={setEditingGroupId}
              groups={groups}
              saveGroup={saveGroup}
              editGroup={editGroup}
              deleteGroup={deleteGroup}
              courseForm={courseForm}
              setCourseForm={setCourseForm}
              editingCourseId={editingCourseId}
              setEditingCourseId={setEditingCourseId}
              courses={coursesWithNames}
              saveCourse={saveCourse}
              editCourse={editCourse}
              deleteCourse={deleteCourse}
            />
          </div>
        </div>
      </div>
      <ConfirmationModal
        isOpen={deleteConfirmation.show}
        onClose={closeDeleteModal}
        onConfirm={confirmDelete}
        title="Confirm Delete"
        message={deleteConfirmation.message}
        confirmText="Confirm Delete"
        cancelText="Cancel"
      />
    </AdShellAdmin>
  )
}





