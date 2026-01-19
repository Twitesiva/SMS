import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/mockApi'
import { supabase } from '../../../supabaseClient'
import AdShellAdmin from '../../components/AdShellAdmin'
import crestPrimary from '../../assets/media/images.png'
import '../exam/Dashboard.css'
import './Setup.css'
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
} from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
)

export default function MainDashboard() {
    // State for dashboard metrics
    const [counts, setCounts] = useState({ students: 0, teachers: 0 })
    const [groups, setGroups] = useState([])
    const [courses, setCourses] = useState([])

    // Chart States
    const [studentView, setStudentView] = useState('group') // 'group' or 'course'
    const [studentChartData, setStudentChartData] = useState(null)
    const [staffChartData, setStaffChartData] = useState(null)
    const [paymentChartData, setPaymentChartData] = useState(null)

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch counts
                const { count: studentCount } = await supabase
                    .from('students')
                    .select('*', { count: 'exact', head: true })

                const { count: teacherCount } = await supabase
                    .from('teachers')
                    .select('*', { count: 'exact', head: true })

                setCounts({
                    students: studentCount || 0,
                    teachers: teacherCount || 0
                })

                // Fetch groups and courses for counts
                const [cs, gs] = await Promise.all([
                    api.listCourses(),
                    api.listGroups?.() || []
                ])
                setCourses(cs || [])
                setGroups(gs || [])

                // --- Chart Data Fetching ---

                // 1. Students Distribution
                const { data: studentsData } = await supabase
                    .from('students')
                    .select('group_name, course_name')

                if (studentsData) {
                    const groupByGroup = studentsData.reduce((acc, curr) => {
                        const g = curr.group_name || 'Unknown'
                        acc[g] = (acc[g] || 0) + 1
                        return acc
                    }, {})

                    const groupByCourse = studentsData.reduce((acc, curr) => {
                        const c = curr.course_name || 'Unknown'
                        acc[c] = (acc[c] || 0) + 1
                        return acc
                    }, {})

                    setStudentChartData({
                        group: {
                            labels: Object.keys(groupByGroup),
                            datasets: [{
                                label: 'Students by Group',
                                data: Object.values(groupByGroup),
                                backgroundColor: '#4c75f2',
                                borderRadius: 6,
                            }]
                        },
                        course: {
                            labels: Object.keys(groupByCourse),
                            datasets: [{
                                label: 'Students by Course',
                                data: Object.values(groupByCourse),
                                backgroundColor: '#a569bd',
                                borderRadius: 6,
                            }]
                        }
                    })
                }

                // 2. Staff Distribution
                const { data: teachersData } = await supabase
                    .from('teachers')
                    .select('designation')

                if (teachersData) {
                    const groupByDesig = teachersData.reduce((acc, curr) => {
                        const d = curr.designation || 'Other'
                        acc[d] = (acc[d] || 0) + 1
                        return acc
                    }, {})

                    setStaffChartData({
                        labels: Object.keys(groupByDesig),
                        datasets: [{
                            label: 'Staff by Designation',
                            data: Object.values(groupByDesig),
                            backgroundColor: ['#4c75f2', '#a569bd', '#42d29d', '#f3ba2f', '#ff7b7b'],
                            borderRadius: 6,
                        }]
                    })
                }

                // 3. Payment Status (from Admissions)
                const { data: admissionsData } = await supabase
                    .from('admissions')
                    .select('admission_fee_paid')

                if (admissionsData) {
                    const paidCount = admissionsData.filter(a => a.admission_fee_paid).length
                    const unpaidCount = admissionsData.length - paidCount

                    setPaymentChartData({
                        labels: ['Paid', 'Unpaid'],
                        datasets: [{
                            label: 'Admission Fees',
                            data: [paidCount, unpaidCount],
                            backgroundColor: ['#42d29d', '#ff7b7b'],
                            borderRadius: 6,
                        }]
                    })
                }

            } catch (err) {
                console.error('Error fetching dashboard data', err)
            }
        }
        fetchData()
    }, [])

    const barOptions = {
        responsive: true,
        plugins: {
            legend: { display: false },
            title: { display: false }
        },
        scales: {
            y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
            x: { grid: { display: false } }
        },
        maintainAspectRatio: false
    }

    const doughnutOptions = {
        responsive: true,
        plugins: {
            legend: { position: 'bottom' }
        },
        maintainAspectRatio: false
    }

    const metrics = [
        {
            label: "Total Students",
            value: counts.students,
            detail: "All enrolled learners",
            icon: "bi-people-fill",
            path: "/admin-portal/students"
        },
        {
            label: "Total Staffs",
            value: counts.teachers,
            detail: "All active staff",
            icon: "bi-person-workspace",
            path: "/admin-portal/staff"
        },
        {
            label: "Total Groups",
            value: groups.length,
            detail: "Academic groups",
            icon: "bi-building",
            path: "/admin-portal/groups-courses"
        },
        {
            label: "Total Courses",
            value: courses.length,
            detail: "Active academic programs",
            icon: "bi-book-half",
            path: "/admin-portal/subjects"
        },
    ]

    return (
        <AdShellAdmin>
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

                <section className="px-4 mb-5">
                    <div className="dashboard-cards">
                        {metrics.map((metric) => (
                            <Link
                                key={metric.label}
                                to={metric.path}
                                className="dashboard-card card-shadow dashboard-card-link"
                                style={{ textDecoration: 'none' }}
                            >
                                <div className="dashboard-card-icon">
                                    <i className={`bi ${metric.icon}`}></i>
                                </div>
                                <div>
                                    <div className="dashboard-card-value">{metric.value}</div>
                                    <div className="dashboard-card-label">{metric.label}</div>
                                    <p className="text-muted mb-0 small">{metric.detail}</p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>

                <section className="px-4 mb-5">
                    <div className="dashboard-chart-row">
                        {/* Students Chart */}
                        <article className="dashboard-chart-card card-shadow" style={{ minHeight: '400px' }}>
                            <div className="dashboard-chart-header">
                                <div className="d-flex justify-content-between align-items-center w-100">
                                    <div>
                                        <h3>Student Classification</h3>
                                        <p className="text-muted mb-0">Enrolled students status</p>
                                    </div>
                                    <div className="btn-group btn-group-sm">
                                        <button
                                            className={`btn ${studentView === 'group' ? 'btn-primary' : 'btn-outline-primary'}`}
                                            onClick={() => setStudentView('group')}
                                        >
                                            Group
                                        </button>
                                        <button
                                            className={`btn ${studentView === 'course' ? 'btn-primary' : 'btn-outline-primary'}`}
                                            onClick={() => setStudentView('course')}
                                        >
                                            Course
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="dashboard-chart-wrapper">
                                {studentChartData && studentChartData[studentView] ? (
                                    <Bar
                                        key={studentView}
                                        data={studentChartData[studentView]}
                                        options={barOptions}
                                    />
                                ) : (
                                    <div className="d-flex align-items-center justify-content-center h-100 text-muted">Loading...</div>
                                )}
                            </div>
                        </article>

                        {/* Staff Chart */}
                        <article className="dashboard-chart-card card-shadow" style={{ minHeight: '400px' }}>
                            <div className="dashboard-chart-header">
                                <div>
                                    <h3>Staff Classification</h3>
                                    <p className="text-muted mb-0">Teachers by designation</p>
                                </div>
                            </div>
                            <div className="dashboard-chart-wrapper">
                                {staffChartData ? (
                                    <Bar data={staffChartData} options={barOptions} />
                                ) : (
                                    <div className="d-flex align-items-center justify-content-center h-100 text-muted">Loading...</div>
                                )}
                            </div>
                        </article>

                        {/* Payment Chart */}
                        <article className="dashboard-chart-card card-shadow" style={{ minHeight: '400px' }}>
                            <div className="dashboard-chart-header">
                                <div>
                                    <h3>Admission Payment Status</h3>
                                    <p className="text-muted mb-0">Fee collection overview</p>
                                </div>
                            </div>
                            <div className="dashboard-chart-wrapper">
                                {paymentChartData ? (
                                    <div style={{ maxWidth: '300px', margin: '0 auto', height: '100%' }}>
                                        <Doughnut data={paymentChartData} options={doughnutOptions} />
                                    </div>
                                ) : (
                                    <div className="d-flex align-items-center justify-content-center h-100 text-muted">Loading...</div>
                                )}
                            </div>
                        </article>
                    </div>
                </section>
            </div>
        </AdShellAdmin>
    )
}
