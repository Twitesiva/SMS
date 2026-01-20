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
            // Define a vibrant color palette for all charts
            const palette = [
                '#4c75f2', // Blue
                '#42d29d',
                '#d63384', // Green
                '#f3ba2f', // Yellow
                '#ff7b7b', // Red
                '#36a2eb', // Sky
                '#fd7e14', // Orange
                '#20c997', // Teal
                '#6f42c1', // Purple
                // Pink
                '#0dcaf0'  // Cyan
            ];

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
                // We fetch both direct text columns and foreign key relations to handle all data scenarios
                const { data: studentsData, error: studentsError } = await supabase
                    .from('students')
                    .select(`
                        id,
                        group_name,
                        course_name,
                        groups:groups!students_group_id_fkey(group_name),
                        courses:courses!fk_students_course(course_name)
                    `)

                // Fetch group and course reference data to resolve codes to names
                const [{ data: groupsRef }, { data: coursesRef }] = await Promise.all([
                    supabase.from('groups').select('group_name, group_code'),
                    supabase.from('courses').select('course_name, course_code')
                ]);

                if (studentsError) console.error('Students Fetch Error:', studentsError)

                if (studentsData) {
                    // Create lookup maps for group validation and code resolution
                    const validGroupNames = new Set(groupsRef?.map(g => g.group_name) || []);
                    const groupCodeToNameMap = (groupsRef || []).reduce((acc, g) => {
                        if (g.group_code) acc[g.group_code.toLowerCase()] = g.group_name;
                        acc[String(g.group_code)] = g.group_name;
                        return acc;
                    }, {});

                    // Create lookup maps for course validation and code resolution
                    const validCourseNames = new Set(coursesRef?.map(c => c.course_name) || []);
                    const courseCodeToNameMap = (coursesRef || []).reduce((acc, c) => {
                        if (c.course_code) acc[c.course_code.toLowerCase()] = c.course_name;
                        acc[String(c.course_code)] = c.course_name;
                        return acc;
                    }, {});

                    console.log('Group Ref Map:', groupCodeToNameMap);
                    console.log('Course Ref Map:', courseCodeToNameMap);

                    // Map students to their group/course names with fallbacks
                    const processedStudents = studentsData.map(s => {
                        let gName = s.groups?.group_name || s.group_name;
                        let cName = s.courses?.course_name || s.course_name;

                        // Normalize Group Name
                        if (gName) {
                            if (!validGroupNames.has(gName)) {
                                const mappedName = groupCodeToNameMap[String(gName).toLowerCase()] || groupCodeToNameMap[String(gName)];
                                gName = mappedName || null; // Nullify if it can't be resolved to a valid name
                            }
                        }

                        // Normalize Course Name
                        if (cName) {
                            if (!validCourseNames.has(cName)) {
                                const mappedName = courseCodeToNameMap[String(cName).toLowerCase()] || courseCodeToNameMap[String(cName)];
                                cName = mappedName || null; // Nullify if it can't be resolved to a valid name
                            }
                        }

                        return { group_name: gName, course_name: cName };
                    }).filter(s => s.group_name && s.course_name); // Filter out students with unresolved names

                    console.log('Processed Students (Filtered):', processedStudents);

                    const groupByGroup = processedStudents.reduce((acc, curr) => {
                        const g = curr.group_name;
                        acc[g] = (acc[g] || 0) + 1;
                        return acc;
                    }, {});

                    const groupByCourse = processedStudents.reduce((acc, curr) => {
                        const c = curr.course_name;
                        acc[c] = (acc[c] || 0) + 1;
                        return acc;
                    }, {});

                    console.log('Group Counts:', groupByGroup);
                    console.log('Course Counts:', groupByCourse);

                    setStudentChartData({
                        group: {
                            labels: ['Students'],
                            datasets: Object.keys(groupByGroup).map((key, i) => ({
                                label: key,
                                data: [groupByGroup[key]],
                                backgroundColor: palette[i % palette.length],
                                borderRadius: 6,
                                barPercentage: 0.6,
                                categoryPercentage: 0.9
                            }))
                        },
                        course: {
                            labels: ['Students'],
                            datasets: Object.keys(groupByCourse).map((key, i) => ({
                                label: key,
                                data: [groupByCourse[key]],
                                backgroundColor: palette[i % palette.length],
                                borderRadius: 6,
                                barPercentage: 0.6,
                                categoryPercentage: 0.9
                            }))
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
                        labels: ['Staff'],
                        datasets: Object.keys(groupByDesig).map((key, i) => ({
                            label: key.replace(/_/g, ' '),
                            data: [groupByDesig[key]],
                            backgroundColor: palette[i % palette.length],
                            borderRadius: 6,
                            barPercentage: 0.6,
                            categoryPercentage: 0.9
                        }))
                    })
                }

                // 3. Payment Status (from student_fee_payments, strictly Fees)
                const { data: paymentData, error: paymentError } = await supabase
                    .from('student_fee_payments')
                    .select('student_id')
                    .eq('payment_status', 'success')
                    .not('academic_fee_id', 'is', null) // Filter for Academic Fees only
                    .limit(5000)

                if (paymentError) console.error('Payment Fetch Error:', paymentError)

                if (paymentData) {
                    // Count unique students who have made a successful payment
                    const uniquePaidStudents = new Set(paymentData.map(p => p.student_id)).size
                    const totalStudents = studentCount || 0
                    const unpaidCount = Math.max(0, totalStudents - uniquePaidStudents)

                    setPaymentChartData({
                        labels: ['Paid', 'Unpaid'],
                        datasets: [{
                            label: 'Academic Fees',
                            data: [uniquePaidStudents, unpaidCount],
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
            legend: {
                display: true,
                position: 'bottom',
                labels: {
                    color: '#000000',
                    font: { weight: 'bold', size: 11 },
                    padding: 20,
                    usePointStyle: true,
                    pointStyle: 'circle'
                }
            },
            title: { display: false }
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: { color: 'rgba(0,0,0,0.05)' },
                ticks: { stepSize: 1 }
            },
            x: { display: false }
        },
        maintainAspectRatio: false
    }

    const doughnutOptions = {
        responsive: true,
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    color: '#000000',
                    font: { weight: 'bold', size: 11 },
                    padding: 20,
                    usePointStyle: true,
                    pointStyle: 'circle'
                }
            }
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
            path: "/admin-portal/groups-courses"
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
                                    <h3>Fee Payment Status</h3>
                                    <p className="text-muted mb-0">Academic fee collection overview</p>
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
