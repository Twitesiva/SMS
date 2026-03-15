import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/mockApi'
import { supabase } from '../../../supabaseClient'
import AdShellAdmin from '../../components/AdShellAdmin'

import '../exam/Dashboard.css'
import './Setup.css'
import './AdminContent.css'
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
    const [counts, setCounts] = useState({ classes: 0, teachers: 0 })
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
                const { count: teacherCount } = await supabase
                    .from('staff')
                    .select('*', { count: 'exact', head: true })

                const { count: classCount } = await supabase
                    .from('classes')
                    .select('*', { count: 'exact', head: true })

                const { count: sectionCount } = await supabase
                    .from('sections')
                    .select('*', { count: 'exact', head: true })

                setCounts({
                    classes: classCount || 0,
                    sections: sectionCount || 0,
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

                // 1. Class/Section Distribution (from class_sections)
                const { data: classSectionRows, error: classSectionError } = await supabase
                    .from('class_sections')
                    .select(`
                        id,
                        classes:classes(class_name),
                        sections:sections(section_name)
                    `)

                if (classSectionError) console.error('Class-Section Fetch Error:', classSectionError)

                if (classSectionRows) {
                    const groupByClass = classSectionRows.reduce((acc, curr) => {
                        const className = curr.classes?.class_name || 'Unassigned'
                        acc[className] = (acc[className] || 0) + 1
                        return acc
                    }, {})

                    const groupBySection = classSectionRows.reduce((acc, curr) => {
                        const sectionName = curr.sections?.section_name || 'Unassigned'
                        acc[sectionName] = (acc[sectionName] || 0) + 1
                        return acc
                    }, {})

                    setStudentChartData({
                        group: {
                            labels: ['Mappings'],
                            datasets: Object.keys(groupByClass).map((key, i) => ({
                                label: key,
                                data: [groupByClass[key]],
                                backgroundColor: palette[i % palette.length],
                                borderRadius: 6,
                                barPercentage: 0.6,
                                categoryPercentage: 0.9
                            }))
                        },
                        course: {
                            labels: ['Mappings'],
                            datasets: Object.keys(groupBySection).map((key, i) => ({
                                label: key,
                                data: [groupBySection[key]],
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
                    .from('staff')
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
                    const totalStudents = classCount || 0
                    const unpaidCount = Math.max(0, totalStudents - uniquePaidStudents)

                    setPaymentChartData({
                        labels: ['Paid', 'Unpaid'],
                        datasets: [{
                            label: 'College Fees',
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
                    padding: 10,
                    usePointStyle: true,
                    pointStyle: 'circle',
                    boxWidth: 8
                }
            }
        },
        layout: {
            padding: 0
        },
        cutout: '60%',
        maintainAspectRatio: false
    }

    const metrics = [
        {
            label: "Total Classes",
            value: counts.classes,
            detail: "Configured classes",
            icon: "bi-people-fill",
            path: "/admin-portal/groups-courses"
        },
        {
            label: "Total Staffs",
            value: counts.teachers,
            detail: "All active staff",
            icon: "bi-person-workspace",
            path: "/admin-portal/staff"
        },
        {
            label: "Total Classes",
            value: groups.length,
            detail: "Class records",
            icon: "bi-building",
            path: "/admin-portal/groups-courses"
        },
        {
            label: "Total Sections",
            value: courses.length,
            detail: "Section records",
            icon: "bi-book-half",
            path: "/admin-portal/groups-courses"
        },
    ]

    return (
        <AdShellAdmin>
            <div className="desktop-container admin-content" style={{ overflowX: 'hidden' }}>
                <h4 className="mb-4">Admin Dashboard</h4>

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
                                    <p className="mb-0 fw-bold">{metric.detail}</p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>

                <section className="px-4 mb-5">
                    <div className="row g-4 overflow-hidden">
                        {/* Students Chart */}
                        <div className="col-lg-4">
                            <article className="dashboard-chart-card card-shadow h-100" style={{ minHeight: '400px' }}>
                                <div className="dashboard-chart-header">
                                    <div className="d-flex justify-content-between align-items-center w-100">
                                        <div className="dashboard-chart-link">
                                            <h3>Class-Section Classification</h3>
                                            <p className="mb-0 fw-bold">Configured mappings overview</p>
                                        </div>
                                        <div className="btn-group btn-group-sm">
                                            <button
                                                className={`btn ${studentView === 'group' ? 'btn-primary' : 'btn-outline-primary'}`}
                                                onClick={() => setStudentView('group')}
                                            >
                                                Class
                                            </button>
                                            <button
                                                className={`btn ${studentView === 'course' ? 'btn-primary' : 'btn-outline-primary'}`}
                                                onClick={() => setStudentView('course')}
                                            >
                                                Section
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
                                        <div className="d-flex align-items-center justify-content-center h-100 text-dark fw-bold">Loading...</div>
                                    )}
                                </div>
                            </article>
                        </div>

                        {/* Staff Chart */}
                        <div className="col-lg-4">
                            <article className="dashboard-chart-card card-shadow h-100" style={{ minHeight: '400px' }}>
                                <div className="dashboard-chart-header">
                                    <Link to="/admin-portal/staff" className="dashboard-chart-link">
                                        <h3>Staff Classification</h3>
                                        <p className="mb-0 fw-bold">Teachers by designation</p>
                                    </Link>
                                </div>
                                <div className="dashboard-chart-wrapper">
                                    {staffChartData ? (
                                        <Bar data={staffChartData} options={barOptions} />
                                    ) : (
                                        <div className="d-flex align-items-center justify-content-center h-100 text-dark fw-bold">Loading...</div>
                                    )}
                                </div>
                            </article>
                        </div>

                        {/* Payment Chart */}
                        <div className="col-lg-4">
                            <article
                                className="dashboard-chart-card dashboard-chart-card--link card-shadow h-100"
                                style={{ minHeight: '400px', display: 'flex', flexDirection: 'column' }}
                            >
                                <div className="dashboard-chart-header">
                                    <div className="dashboard-chart-link">
                                        <h3>College Fees</h3>
                                        <p className="mb-0 fw-bold">College fee collection overview</p>
                                    </div>
                                </div>
                                <div className="dashboard-chart-wrapper" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {paymentChartData ? (
                                        <div style={{ width: '100%', height: '100%' }}>
                                            <Doughnut data={paymentChartData} options={doughnutOptions} />
                                        </div>
                                    ) : (
                                        <div className="d-flex align-items-center justify-content-center h-100 text-dark fw-bold">Loading...</div>
                                    )}
                                </div>
                            </article>
                        </div>
                    </div>
                </section>
            </div>
        </AdShellAdmin>
    )
}
