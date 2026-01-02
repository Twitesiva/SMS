import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../../supabaseClient'
import AdminShell from '../../components/AdminShell'
import crestPrimary from '../../assets/media/images.png'
import { toast, ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

// --- Navigation Definition ---
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
    },
    {
        title: 'Class Time Table Creation',
        static: true,
        items: [
            {
                to: '/admin-portal/class-time-table-creation',
                label: 'Class Time Table Creation',
                icon: 'bi-calendar-plus'
            }
        ]
    }
]

export default function StaffSubjectMapping() {
    const [courses, setCourses] = useState([])
    const [groups, setGroups] = useState([])
    const [subjects, setSubjects] = useState([])
    const [teachers, setTeachers] = useState([])
    const [availableSemesters, setAvailableSemesters] = useState([])
    const [categories, setCategories] = useState([]) // Store category map

    const [selectedGroup, setSelectedGroup] = useState('')
    const [selectedGroupId, setSelectedGroupId] = useState(null)
    const [selectedCourse, setSelectedCourse] = useState('')
    const [selectedCourseId, setSelectedCourseId] = useState(null)
    const [selectedSemester, setSelectedSemester] = useState('')

    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        fetchInitialData()
    }, [])

    useEffect(() => {
        if (selectedCourse) {
            fetchAvailableSemesters(selectedCourse)
        } else {
            setAvailableSemesters([])
            setSelectedSemester('')
        }
    }, [selectedCourse])

    useEffect(() => {
        if (selectedCourse && selectedSemester && selectedGroup) {
            fetchSubjectsAndMappings()
        } else {
            setSubjects([])
        }
    }, [selectedCourse, selectedSemester, selectedGroup])

    const fetchInitialData = async () => {
        try {
            setLoading(true)
            const { data: grps } = await supabase.from('groups').select('group_name, group_id')
            const { data: tchs } = await supabase.from('teachers').select('id, full_name, staff_id').eq('status', 'ACTIVE')
            const { data: cats } = await supabase.from('subject_category').select('*') // Load categories

            setGroups(grps || [])
            setTeachers(tchs || [])
            setCategories(cats || [])
        } catch (error) {
            console.error('Error fetching initial data', error)
            toast.error('Failed to load initial data')
        } finally {
            setLoading(false)
        }
    }

    // Helper to get category name
    const getCategoryName = (catId) => {
        const cat = categories.find(c => c.category_id === catId || c.id === catId)
        return cat ? cat.category_name : '-'
    }

    const fetchAvailableSemesters = async (courseCode) => {
        try {
            const { data, error } = await supabase
                .from('subjects')
                .select('semester_number')
                .eq('course_name', courseCode)

            if (error) throw error

            const sems = new Set()
            data?.forEach(row => {
                if (row.semester_number) sems.add(row.semester_number)
            })

            const sortedSems = Array.from(sems).sort((a, b) => a - b)
            setAvailableSemesters(sortedSems)

        } catch (error) {
            console.error('Error fetching semesters', error)
        }
    }

    const findGroupId = (groupName) => {
        const grp = groups.find(g => g.group_name === groupName)
        return grp ? grp.group_id : null
    }

    const findCourseId = (courseCode) => {
        const crs = courses.find(c => c.course_code === courseCode)
        return crs ? crs.course_id : null
    }

    const fetchCourses = async (groupName) => {
        if (!groupName) {
            setCourses([])
            return
        }
        const { data } = await supabase
            .from('courses')
            .select('course_name, course_code, course_id')
            .eq('group_name', groupName)
        setCourses(data || [])
    }

    const fetchSubjectsAndMappings = async () => {
        try {
            setLoading(true)

            // 1. Fetch Subjects
            const { data: subjectData, error: subjectError } = await supabase
                .from('subjects')
                .select('*')
                .eq('course_name', selectedCourse)
                .eq('semester_number', selectedSemester)
                .order('subject_name')

            if (subjectError) throw subjectError

            if (!subjectData || subjectData.length === 0) {
                setSubjects([])
                return
            }

            // 2. Fetch Existing Mappings
            const groupId = selectedGroupId || findGroupId(selectedGroup)
            const courseId = selectedCourseId || findCourseId(selectedCourse)

            if (!groupId || !courseId) {
                console.warn('Group ID or Course ID missing for mapping query')
            }

            const { data: mappingData, error: mappingError } = await supabase
                .from('teacher_subject_mapping')
                .select('subject_id, teacher_id')
                .eq('course_id', courseId)
                .eq('group_id', groupId)
                .eq('semester', selectedSemester)
                .eq('is_active', true)

            if (mappingError) throw mappingError

            const mappingMap = new Map()
            mappingData?.forEach(m => {
                mappingMap.set(m.subject_id, m.teacher_id)
            })

            // Merge data with index for S.No
            const mergedSubjects = subjectData.map((sub, index) => ({
                ...sub,
                teacher_id: mappingMap.get(sub.subject_id || sub.id) || '', // Check both subject_id and id
                sNo: index + 1
            }))

            setSubjects(mergedSubjects)

        } catch (error) {
            console.error('Error fetching subjects/mappings', error)
            toast.error('Failed to load subjects and mappings')
        } finally {
            setLoading(false)
        }
    }

    const handleStaffAssignment = (subjectId, staffId) => {
        // subjectId passed here is usually 'id' or 'subject_id' from database
        // Ensure we match correct property
        setSubjects(prev => prev.map(sub =>
            (sub.id === subjectId || sub.subject_id === subjectId) ? { ...sub, teacher_id: staffId } : sub
        ))
    }

    const saveAssignments = async () => {
        if (!selectedGroup || !selectedCourse || !selectedSemester) {
            toast.error('Please select all filters first')
            return
        }

        const groupId = groups.find(g => g.group_name === selectedGroup)?.group_id
        const courseId = courses.find(c => c.course_code === selectedCourse)?.course_id

        if (!groupId || !courseId) {
            toast.error('Invalid Group or Course selection (ID not found)')
            return
        }

        try {
            setSaving(true)

            // Map subject IDs properly (prefer subject_id if available, else id)
            const subjectIds = subjects.map(s => s.subject_id || s.id)

            // 1. Deactivate/Delete old mappings
            await supabase
                .from('teacher_subject_mapping')
                .delete()
                .in('subject_id', subjectIds)
                .eq('group_id', groupId)
                .eq('course_id', courseId)
                .eq('semester', selectedSemester)

            // 2. Insert new mappings
            const newMappings = subjects
                .filter(sub => sub.teacher_id)
                .map(sub => ({
                    teacher_id: sub.teacher_id,
                    subject_id: sub.subject_id || sub.id,
                    course_id: courseId,
                    group_id: groupId,
                    semester: parseInt(selectedSemester),
                    is_active: true
                }))

            if (newMappings.length > 0) {
                const { error } = await supabase
                    .from('teacher_subject_mapping')
                    .insert(newMappings)

                if (error) throw error
            }

            toast.success('Subject mapping saved successfully!')

            // Refreshes reset
            setSelectedGroup('')
            setSelectedGroupId(null)
            setSelectedCourse('')
            setSelectedCourseId(null)
            setSelectedSemester('')
            setSubjects([]) // Explicitly clear, though useEffect will likely handle it

        } catch (error) {
            console.error('Error saving assignments', error)
            toast.error('Failed to save assignments.' + error.message)
        } finally {
            setSaving(false)
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
            <div className="desktop-container">
                <section className="setup-hero mb-4 text-center">
                    <div className="setup-hero-copywrap mx-auto text-center" style={{ maxWidth: '640px' }}>
                        <div className="admin-applications__crest mx-auto" aria-hidden="true">
                            <img src={crestPrimary} alt="Vijayam crest" />
                        </div>
                        <h3 className="setup-hero-title mb-2">Vijayam Arts & Science College</h3>
                        <p className="setup-hero-copy mb-3">Assign staff members to subjects.</p>
                    </div>
                </section>

                <div className="card card-soft p-4 mb-4">
                    <div className="row g-3">
                        <div className="col-md-4">
                            <label className="form-label fw-semibold">Group</label>
                            <select
                                className="form-select"
                                value={selectedGroup}
                                onChange={e => {
                                    const val = e.target.value
                                    setSelectedGroup(val)
                                    const grp = groups.find(g => g.group_name === val)
                                    setSelectedGroupId(grp ? grp.group_id : null)
                                    fetchCourses(val)
                                }}
                            >
                                <option value="">Select Group</option>
                                {groups.map(g => (
                                    <option key={g.group_id} value={g.group_name}>{g.group_name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="col-md-4">
                            <label className="form-label fw-semibold">Course</label>
                            <select
                                className="form-select"
                                value={selectedCourse}
                                onChange={e => {
                                    const val = e.target.value
                                    setSelectedCourse(val)
                                    const crs = courses.find(c => c.course_code === val)
                                    setSelectedCourseId(crs ? crs.course_id : null)
                                }}
                            >
                                <option value="">Select Course</option>
                                {courses.map(c => (
                                    <option key={c.course_code} value={c.course_code}>{c.course_name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="col-md-4">
                            <label className="form-label fw-semibold">Semester</label>
                            <select
                                className="form-select"
                                value={selectedSemester}
                                onChange={e => setSelectedSemester(e.target.value)}
                                disabled={!selectedCourse}
                            >
                                <option value="">Select Semester</option>
                                {availableSemesters.length > 0 ? (
                                    availableSemesters.map(s => (
                                        <option key={s} value={s}>Semester {s}</option>
                                    ))
                                ) : null}
                            </select>
                        </div>
                    </div>
                </div>

                {subjects.length > 0 ? (
                    <div className="card card-soft p-4">
                        <div className="d-flex justify-content-between align-items-center mb-4">
                            <h5 className="mb-0">Subject List</h5>
                            <button
                                className="btn btn-primary"
                                onClick={saveAssignments}
                                disabled={saving}
                            >
                                {saving ? 'Saving...' : 'Save Assignments'}
                            </button>
                        </div>

                        <div className="table-responsive">
                            <table className="table table-hover align-middle">
                                <thead>
                                    <tr>
                                        <th>S.No</th>
                                        <th>Subject</th>
                                        <th>Type</th>
                                        <th>Assigned Staff</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {subjects.map((subject, index) => (
                                        <tr key={subject.id || subject.subject_id || index}>
                                            <td className="fw-bold text-muted">{index + 1}</td>
                                            <td>
                                                <div className="d-flex flex-column">
                                                    <span className="fw-bold text-dark">
                                                        {subject.subject_code} - {subject.subject_name}
                                                    </span>
                                                    {/* Display sub-category if available */}
                                                    {getCategoryName(subject.category_id) !== '-' && (
                                                        <span className="small text-muted">
                                                            {getCategoryName(subject.category_id)}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td>
                                                <span className="badge bg-light text-dark border">
                                                    {/* If subject_type isn't in DB, fallback to category name logic or generic */}
                                                    {getCategoryName(subject.category_id)}
                                                </span>
                                            </td>
                                            <td>
                                                <select
                                                    className="form-select"
                                                    value={subject.teacher_id || ''}
                                                    onChange={e => handleStaffAssignment(subject.id || subject.subject_id, e.target.value)}
                                                >
                                                    <option value="">Select Staff</option>
                                                    {teachers.map(t => (
                                                        <option key={t.id} value={t.id}>
                                                            {t.full_name} ({t.staff_id})
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="text-center p-5 text-muted">
                        {selectedSemester ? (loading ? 'Loading...' : 'No subjects found for selection.') : 'Please select all filters to view subjects.'}
                    </div>
                )}

            </div>
            <ToastContainer position="top-right" autoClose={3000} />
        </AdminShell>
    )
}
