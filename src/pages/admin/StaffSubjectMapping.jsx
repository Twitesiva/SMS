import { useState, useEffect } from 'react'
import { supabase } from '../../../supabaseClient'
import AdminShell from '../../components/AdminShell'
import crestPrimary from '../../assets/media/images.png'
import { toast, ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

// --- Navigation Definition (Consistent across Admin pages) ---
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
    },    {
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
        title: 'Department',
        static: true,
        items: [
            {
                to: '/admin-portal/department',
                label: 'Department',
                icon: 'bi-diagram-3'
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
    const [academicYears, setAcademicYears] = useState([])
    const [courses, setCourses] = useState([])
    const [groups, setGroups] = useState([])
    const [subjects, setSubjects] = useState([])
    const [teachers, setTeachers] = useState([])

    const [selectedYear, setSelectedYear] = useState('')
    const [selectedGroup, setSelectedGroup] = useState('') // This holds group_name for filtering
    const [selectedGroupId, setSelectedGroupId] = useState(null) // Holds actual group_id
    const [selectedCourse, setSelectedCourse] = useState('') // This holds course_code for filtering
    const [selectedCourseId, setSelectedCourseId] = useState(null) // Holds actual course_id
    const [selectedSemester, setSelectedSemester] = useState('')

    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)

    // Mapping state: { subjectId: teacherId }
    // We'll store mappings in a Map or Object for quick access
    // But since we iterate over subjects, maybe just enriching subjects is easier?
    // Let's keep existing pattern but load from teacher_subject_mapping table.

    useEffect(() => {
        fetchInitialData()
    }, [])

    useEffect(() => {
        if (selectedYear && selectedCourse && selectedSemester && selectedGroup) {
            fetchSubjectsAndMappings()
        } else {
            setSubjects([])
        }
    }, [selectedYear, selectedCourse, selectedSemester, selectedGroup])

    const fetchInitialData = async () => {
        try {
            setLoading(true)
            const { data: years } = await supabase.from('academic_year').select('academic_year')
            const { data: grps } = await supabase.from('groups').select('group_name, group_id')
            const { data: tchs } = await supabase.from('teachers').select('id, full_name, staff_id').eq('status', 'ACTIVE')

            setAcademicYears(years || [])
            setGroups(grps || [])
            setTeachers(tchs || [])
        } catch (error) {
            console.error('Error fetching initial data', error)
            toast.error('Failed to load initial data')
        } finally {
            setLoading(false)
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
                .eq('academic_year', selectedYear)
                .eq('course_name', selectedCourse) // Use course_code as stored in subjects? Check schema. USUALLY course_name holds code in this system based on prev files.
                .eq('semester_number', selectedSemester)
                .order('subject_name')

            if (subjectError) throw subjectError

            if (!subjectData || subjectData.length === 0) {
                setSubjects([])
                return
            }

            // 2. Fetch Existing Mappings
            // We need IDs for group and course to query mapping table accurately
            const groupId = selectedGroupId || findGroupId(selectedGroup)
            const courseId = selectedCourseId || findCourseId(selectedCourse) // Note: course_code matches 'selectedCourse'

            // Ideally we should have IDs. If not, we might fail to save correctly.
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

            // Create lookup for existing mappings
            const mappingMap = new Map()
            mappingData?.forEach(m => {
                mappingMap.set(m.subject_id, m.teacher_id)
            })

            // Merge data
            const mergedSubjects = subjectData.map(sub => ({
                ...sub,
                teacher_id: mappingMap.get(sub.id) || '' // Pre-fill if exists
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
        setSubjects(prev => prev.map(sub =>
            sub.id === subjectId ? { ...sub, teacher_id: staffId } : sub
        ))
    }

    const saveAssignments = async () => {
        if (!selectedGroup || !selectedCourse || !selectedSemester) {
            toast.error('Please select all filters first')
            return
        }

        // Resolving IDs again to be safe
        const groupId = groups.find(g => g.group_name === selectedGroup)?.group_id
        const courseId = courses.find(c => c.course_code === selectedCourse)?.course_id

        if (!groupId || !courseId) {
            toast.error('Invalid Group or Course selection (ID not found)')
            return
        }

        try {
            setSaving(true)

            // Prepare upsert payloads
            // The table has a unique constraint on (teacher_id, subject_id, ...) ? 
            // NO, the unique constraint is on (teacher_id, subject_id, course_id, group_id, semester).
            // Wait, that means ONE teacher per subject-course-group-sem combo?
            // Actually, standard requirement is usually ONE teacher for a subject in a class.
            // So unique constraint (subject_id, course_id, group_id, semester) would make sense to prevent multiple teachers?
            // But the provided schema says: unique (teacher_id, subject_id, course_id, group_id, semester). 
            // This means a teacher can't be assigned TWICE to the SAME subject in the same context. 
            // But it DOES allows multiple teachers for the same subject? 
            // USUALLY for a simple mapping UI, we want to assign ONE teacher per subject.
            // We will perform a DELETE based on subject/course/group/sem before inserting new to ensure replacement, 
            // OR we rely on upsert if we had a Primary Key. But we don't know the ID of existing mapping easily without fetching it.

            // Strategy:
            // For each subject in the list:
            // 1. If teacher_id is selected: Upsert/Insert
            // 2. If teacher_id is empty/removed: Delete existing active mapping for this subject?

            // Safer Approach given the schema:
            // We want to ensure for this (subject, group, course, sem) there is arguably only one active teacher (based on UI dropdown).
            // So first, disable/delete existing active mappings for these subjects in this context.

            const subjectIds = subjects.map(s => s.id)

            // 1. Deactivate/Delete old mappings for these subjects in this context
            // We'll just delete them for simplicity to keep table clean, or set is_active false.
            // Let's delete to avoid clutter if history isn't critical, or just upsert if we can match unique keys.
            // Since unique key includes 'teacher_id', upserting is tricky if we change teachers (it would create a NEW row for new teacher, old one remains).
            // So we MUST delete old active mappings for these subjects first.

            await supabase
                .from('teacher_subject_mapping')
                .delete()
                .in('subject_id', subjectIds)
                .eq('group_id', groupId)
                .eq('course_id', courseId)
                .eq('semester', selectedSemester)

            console.log('Cleared old mappings')

            // 2. Insert new mappings
            const newMappings = subjects
                .filter(sub => sub.teacher_id) // Only those with a teacher assigned
                .map(sub => ({
                    teacher_id: sub.teacher_id,
                    subject_id: sub.id,
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
            fetchSubjectsAndMappings() // Refresh
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
                        <div className="col-md-3">
                            <label className="form-label fw-semibold">Academic Year</label>
                            <select
                                className="form-select"
                                value={selectedYear}
                                onChange={e => setSelectedYear(e.target.value)}
                            >
                                <option value="">Select Year</option>
                                {academicYears.map(y => (
                                    <option key={y.academic_year} value={y.academic_year}>{y.academic_year}</option>
                                ))}
                            </select>
                        </div>

                        <div className="col-md-3">
                            <label className="form-label fw-semibold">Group</label>
                            <select
                                className="form-select"
                                value={selectedGroup}
                                onChange={e => {
                                    const val = e.target.value
                                    setSelectedGroup(val)
                                    // Find and set ID immediately for clarity, though we resolve it later too
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

                        <div className="col-md-3">
                            <label className="form-label fw-semibold">Course</label>
                            <select
                                className="form-select"
                                value={selectedCourse}
                                onChange={e => {
                                    const val = e.target.value
                                    setSelectedCourse(val)
                                    // Find and set ID
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

                        <div className="col-md-3">
                            <label className="form-label fw-semibold">Semester</label>
                            <select
                                className="form-select"
                                value={selectedSemester}
                                onChange={e => setSelectedSemester(e.target.value)}
                            >
                                <option value="">Select Semester</option>
                                {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                                    <option key={s} value={s}>Semester {s}</option>
                                ))}
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
                                        <th>Subject Code</th>
                                        <th>Subject Name</th>
                                        <th>Type</th>
                                        <th>Assigned Staff</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {subjects.map((subject, index) => (
                                        <tr key={subject.id || subject.subject_id || subject.subject_code || `${subject.subject_name || 'subject'}-${index}`}>
                                            <td>{subject.subject_code || subject.code || '-'}</td>
                                            <td>{subject.subject_name}</td>
                                            <td>{subject.subject_type || '-'}</td>
                                            <td>
                                                <select
                                                    className="form-select"
                                                    value={subject.teacher_id || ''}
                                                    onChange={e => handleStaffAssignment(subject.id, e.target.value)}
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

