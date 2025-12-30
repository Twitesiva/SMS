import AdminShell from '../../components/AdminShell'
import crestPrimary from '../../assets/media/images.png'
import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../../../supabaseClient'
import { toast } from 'react-toastify'


const adminNavGroups = [
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

export default function FeesCreation() {
    const [isLoading, setIsLoading] = useState(true)
    const [years, setYears] = useState([])
    const [groups, setGroups] = useState([])
    const [courses, setCourses] = useState([])

    const [selectedYear, setSelectedYear] = useState('')
    const [selectedGroup, setSelectedGroup] = useState('')
    const [selectedCourse, setSelectedCourse] = useState('')

    const [fees, setFees] = useState({})

    useEffect(() => {
        fetchMasterData()
    }, [])

    const fetchMasterData = async () => {
        try {
            setIsLoading(true)

            // Fetch Academic Years
            const { data: yearsData, error: yearsError } = await supabase
                .from('academic_year')
                .select('*')
                .order('academic_year', { ascending: false })
            if (yearsError) throw yearsError
            setYears(yearsData || [])

            // Fetch Groups
            const { data: groupsData, error: groupsError } = await supabase
                .from('groups')
                .select('group_id, group_name, group_code')
                .order('group_name')
            if (groupsError) throw groupsError
            setGroups(groupsData || [])

            // Fetch Courses
            const { data: coursesData, error: coursesError } = await supabase
                .from('courses')
                .select('*')
                .order('course_name')
            if (coursesError) throw coursesError
            setCourses(coursesData || [])

        } catch (error) {
            console.error('Error fetching data:', error)
            toast.error('Failed to load master data')
        } finally {
            setIsLoading(false)
        }
    }

    // Filter courses based on selected group
    const availableCourses = useMemo(() => {
        if (!selectedGroup) return []
        const groupObj = groups.find(g => g.group_id.toString() === selectedGroup)
        if (!groupObj) return []

        // Filter courses where group_name matches
        return courses.filter(c => c.group_name === groupObj.group_name)
    }, [selectedGroup, groups, courses])

    // Handle Group Change
    const handleGroupChange = (e) => {
        setSelectedGroup(e.target.value)
        setSelectedCourse('')
        setFees({})
    }

    // Handle Course Change
    const handleCourseChange = (e) => {
        const courseId = e.target.value
        setSelectedCourse(courseId)

        // Initialize fees inputs based on duration
        const course = courses.find(c => c.course_id.toString() === courseId)
        if (course && course.duration_years) {
            const initialFees = {}
            for (let i = 1; i <= course.duration_years; i++) {
                initialFees[i] = ''
            }
            setFees(initialFees)
        } else {
            setFees({})
        }
    }

    const handleFeeChange = (year, value) => {
        setFees(prev => ({
            ...prev,
            [year]: value
        }))
    }

    const handleReset = () => {
        setSelectedYear('')
        setSelectedGroup('')
        setSelectedCourse('')
        setFees({})
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        // Validation
        if (!selectedYear || !selectedGroup || !selectedCourse) {
            toast.error('Please fill all required fields')
            return
        }

        // Logic to save fees structure would go here
        console.log('Submitting Fees Structure:', {
            academic_year_id: selectedYear,
            group_id: selectedGroup,
            course_id: selectedCourse,
            fees_breakdown: fees
        })
        toast.success('Fees structure saved successfully (Console Log)')
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
                        <p className="setup-hero-copy mb-3">Collect, verify, and onboard applicants with confidence.</p>
                        <div className="setup-hero-chips d-flex flex-wrap gap-2 justify-content-center">
                            <span className="setup-hero-chip text-uppercase">SMART EXAMINATION PLATFORM</span>
                            <span className="setup-hero-chip text-uppercase">ADMISSIONS CONTROL</span>
                            <span className="setup-hero-chip text-uppercase">APPLICATIONS ADMIN CONSOLE</span>
                        </div>
                    </div>
                </section>

                <div className="row g-4 justify-content-center mx-0">
                    <div className="col-12">
                        {/* Fee Structure Creation Card */}
                        <div className="card card-soft p-4">
                            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                                <div>
                                    <h4 className="mb-1">Student Fees creation</h4>
                                    <p className="text-muted mb-0">Manage and create fee structures.</p>
                                </div>
                                <button type="button" className="btn btn-outline-secondary" onClick={handleReset}>Reset</button>
                            </div>

                            {isLoading ? (
                                <div className="text-center p-5">
                                    <div className="spinner-border text-primary" role="status">
                                        <span className="visually-hidden">Loading...</span>
                                    </div>
                                </div>
                            ) : (
                                <form className="row g-3" onSubmit={handleSubmit}>
                                    {/* Academic Year */}
                                    <div className="col-md-4">
                                        <label className="form-label">Academic Year <span className="text-danger">*</span></label>
                                        <select
                                            className="form-select"
                                            value={selectedYear}
                                            onChange={(e) => setSelectedYear(e.target.value)}
                                            required
                                        >
                                            <option value="" disabled>Select Year</option>
                                            {years.map(year => (
                                                <option key={year.id} value={year.id}>{year.academic_year}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Group */}
                                    <div className="col-md-4">
                                        <label className="form-label">Group <span className="text-secondary small">({groups.length} found)</span> <span className="text-danger">*</span></label>
                                        <select
                                            className="form-select"
                                            value={selectedGroup}
                                            onChange={handleGroupChange}
                                            required
                                        >
                                            <option value="" disabled>Select Group</option>
                                            {groups.map(group => (
                                                <option key={group.group_id} value={group.group_id}>{group.group_name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Course */}
                                    <div className="col-md-4">
                                        <label className="form-label">Course <span className="text-danger">*</span></label>
                                        <select
                                            className="form-select"
                                            value={selectedCourse}
                                            onChange={handleCourseChange}
                                            disabled={!selectedGroup}
                                            required
                                        >
                                            <option value="" disabled>Select Course</option>
                                            {availableCourses.map(course => (
                                                <option key={course.course_id} value={course.course_id}>{course.course_name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Dynamic Fees Inputs */}
                                    {selectedCourse && Object.keys(fees).length > 0 && (
                                        <div className="col-12 mt-4">
                                            <h5 className="mb-3">Fee Breakdown (Per Year)</h5>
                                            <div className="row g-3">
                                                {Object.keys(fees).map((year) => (
                                                    <div key={year} className="col-md-4">
                                                        <label className="form-label">Year {year} Fee <span className="text-danger">*</span></label>
                                                        <div className="input-group">
                                                            <span className="input-group-text">₹</span>
                                                            <input
                                                                type="number"
                                                                className="form-control"
                                                                placeholder="Enter amount"
                                                                value={fees[year]}
                                                                onChange={(e) => handleFeeChange(year, e.target.value)}
                                                                min="0"
                                                                required
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="col-12 d-flex justify-content-end gap-2 mt-4">
                                        <button type="submit" className="btn btn-primary">Save Fee Structure</button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AdminShell>
    )
}
