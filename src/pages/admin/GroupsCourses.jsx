import { useEffect, useMemo, useState } from 'react'
import AdminShell from '../../components/AdminShell'
import crestPrimary from '../../assets/media/images.png'
import GroupsCoursesSection from '../exam/GroupsCourses'
import { api } from '../../lib/mockApi'
import { showToast } from '../../store/ui'
import { validateRequiredFields } from '../../lib/validation'

const adminNavGroups = [
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
  }, {
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
    title: 'Class Time Table',
    static: true,
    items: [
      {
        to: '/admin-portal/class-time-table',
        label: 'Class Time Table',
        icon: 'bi-calendar-date'
      }
    ]
  }
]

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

  const deleteGroup = async (id) => {
    setGroups((prev) => prev.filter((g) => g.id !== id))
    try {
      await api.deleteGroup?.(id)
      showToast('Group deleted successfully', {
        type: 'success',
        title: 'Group'
      })
    } catch (error) {
      console.error('Error deleting group:', error)
      showToast(error?.message || 'Error deleting group', { type: 'danger' })
    }
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

  const deleteCourse = async (id) => {
    setCourses((prev) => prev.filter((c) => c.id !== id))
    try {
      await api.deleteCourse?.(id)
      showToast('Course deleted successfully', {
        type: 'success',
        title: 'Course'
      })
    } catch (error) {
      console.error('Error deleting course:', error)
      showToast(error?.message || 'Error deleting course', { type: 'danger' })
    }
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
            <p className="setup-hero-copy mb-3">Define groups and courses that drive fee structures.</p>
            <div className="setup-hero-chips d-flex flex-wrap gap-2 justify-content-center">
              <span className="setup-hero-chip text-uppercase">SMART EXAMINATION PLATFORM</span>
              <span className="setup-hero-chip text-uppercase">ADMISSIONS CONTROL</span>
              <span className="setup-hero-chip text-uppercase">APPLICATIONS ADMIN CONSOLE</span>
            </div>
          </div>
        </section>

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
    </AdminShell>
  )
}




