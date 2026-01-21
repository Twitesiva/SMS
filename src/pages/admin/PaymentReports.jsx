import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/mockApi';
import { supabase } from '../../../supabaseClient';
import AdShellAdmin from '../../components/AdShellAdmin';
import crestPrimary from '../../assets/media/images.png';
import '../exam/Dashboard.css';
import './Setup.css';
import './AdminContent.css';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
);

export default function PaymentReports() {
    const [isLoading, setIsLoading] = useState(false);
    const [date] = useState(new Date());

    // Dropdown Data
    const [academicYears, setAcademicYears] = useState([]);
    const [groups, setGroups] = useState([]);
    const [courses, setCourses] = useState([]);

    // Filters
    const [selectedYear, setSelectedYear] = useState('');
    const [selectedGroup, setSelectedGroup] = useState('');
    const [selectedCourse, setSelectedCourse] = useState('');
    const [selectedSemester, setSelectedSemester] = useState('');
    const [selectedPaymentStatus, setSelectedPaymentStatus] = useState(''); // 'Paid' | 'Pending' | ''

    // Main Data
    // Main Data
    const [allStudents, setAllStudents] = useState([]); // Master list for the year
    const [filteredStudents, setFilteredStudents] = useState([]);

    // --- Navigation Definition (Preserved) ---


    useEffect(() => {
        fetchInitialData();
    }, []);

    // Trigger fetch only when Year changes
    useEffect(() => {
        if (selectedYear) {
            fetchReportData();
        }
    }, [selectedYear]);

    // Client-side filtering for Table
    useEffect(() => {
        let res = allStudents;
        if (selectedGroup) res = res.filter(s => s.group_name === selectedGroup);
        if (selectedCourse) res = res.filter(s => s.course_name === selectedCourse);
        if (selectedSemester) res = res.filter(s => String(s.current_semester) === String(selectedSemester));
        if (selectedPaymentStatus) res = res.filter(s => s.paymentStatus === selectedPaymentStatus);
        setFilteredStudents(res);
    }, [allStudents, selectedGroup, selectedCourse, selectedSemester, selectedPaymentStatus]);

    const fetchInitialData = async () => {
        try {
            const { data: ay } = await supabase.from('academic_year').select('academic_year').order('academic_year', { ascending: false });
            const { data: gr } = await supabase.from('groups').select('group_name, group_code');
            const { data: cr } = await supabase.from('courses').select('course_name, course_code, group_name');

            if (ay) setAcademicYears(ay.map(item => item.academic_year));
            if (gr) setGroups(gr);
            if (cr) setCourses(cr);
        } catch (error) {
            console.error('Error fetching initial data:', error);
            toast.error('Failed to load filter options.');
        }
    };

    const fetchReportData = async () => {
        setIsLoading(true);
        try {
            // 1. Fetch Students (active, for selected year)
            let query = supabase
                .from('students')
                .select(`
          id,
          student_id,
          full_name,
          hall_ticket_no,
          group_name,
          course_name,
          academic_year,
          current_semester,
          status,
          admission_status,
          course_id,
          group_id,
          year_of_study,
          Category
        `)
                .eq('status', 'ACTIVE');

            if (selectedYear) query = query.eq('academic_year', selectedYear);

            // REMOVED: Server-side narrowing by Group/Course/Sem to allow charts to see full context

            const { data: studentsData, error } = await query;
            if (error) throw error;

            if (!studentsData || studentsData.length === 0) {
                setAllStudents([]);
                return;
            }

            const studentIds = studentsData.map(s => s.id);

            // 2. Fetch Fee Structures
            let feeQuery = supabase.from('academic_fees').select('*');
            if (selectedYear) feeQuery = feeQuery.eq('academic_year', selectedYear);

            const { data: feesData } = await feeQuery;

            // 3. Fetch Payments
            // Note: In a large system, fetching ALL payments for a year might be heavy. 
            // Optimizations: Filter by payment date or use a summary view.
            // For now, fetching by studentIds in chunks is safer if list > 1000, but Supabase handles simple IN decently.
            const { data: paymentsData } = await supabase
                .from('student_fee_payments')
                .select('student_id, amount_paid, payment_status, payment_mode')
                .in('student_id', studentIds) // Supabase limit is high for IN clause, usually safe for <10k IDs
                .eq('payment_status', 'success');

            // 4. Calculate Status
            const processed = studentsData.map(student => {
                const applicableFee = feesData?.find(f =>
                    f.academic_year === student.academic_year &&
                    f.course_id === student.course_id &&
                    f.group_id === student.group_id &&
                    f.year_of_study === student.year_of_study &&
                    (student.Category ? f.category?.toLowerCase() === student.Category?.toLowerCase() : true)
                );

                const totalFee = applicableFee ? Number(applicableFee.total_fee) : 0;
                const studentPayments = paymentsData?.filter(p => p.student_id === student.id) || [];
                const totalPaid = studentPayments.reduce((sum, p) => sum + Number(p.amount_paid), 0);

                const hasPartialPayment = studentPayments.some(p => p.payment_mode?.toLowerCase() === 'partial');
                const hasFullPayment = studentPayments.some(p => p.payment_mode?.toLowerCase() === 'full');

                let status = 'Pending';
                if (totalPaid > 0) {
                    if (totalFee > 0) {
                        if (totalPaid >= totalFee) status = 'Paid';
                        else status = 'Partial';
                    } else {
                        if (hasFullPayment) status = 'Paid';
                        else if (hasPartialPayment) status = 'Partial';
                        else status = 'Paid';
                    }
                }

                return {
                    ...student,
                    paymentStatus: status,
                    totalFee,
                    totalPaid
                };
            });

            setAllStudents(processed);

        } catch (error) {
            console.error('Error fetching report data:', error);
            toast.error('Failed to generate report.');
        } finally {
            setIsLoading(false);
        }
    };

    // --- Charts Logic ---
    const chartData = useMemo(() => {
        if (!allStudents.length) return null;

        const validGroupNames = new Set(groups.map(g => g.group_name));
        const validCourseNames = new Set(courses.map(c => c.course_name));
        const colors = ['#1f4e79', '#ed7d31', '#a5a5a5', '#ffc000', '#5b9bd5', '#70ad47', '#264478', '#9e480e', '#636363', '#997300'];

        // 1. Group Chart Data (Show All Groups for the Year)
        const groupCounts = {};
        allStudents.forEach(s => {
            const g = s.group_name;
            if (g && validGroupNames.has(g)) {
                groupCounts[g] = (groupCounts[g] || 0) + 1;
            }
        });

        const groupChart = {
            labels: [''],
            datasets: Object.keys(groupCounts).map((group, i) => ({
                label: group,
                data: [groupCounts[group]],
                // If we show ALL bars, but highlight the selected one, that's good.
                // Or just keep colors distinct as before.
                backgroundColor: selectedGroup && selectedGroup !== group ? '#e0e0e0' : colors[i % colors.length],
                borderRadius: 4,
                barPercentage: 0.8,
                categoryPercentage: 0.9
            }))
        };

        // 2. Course Chart Data (Show All Courses for Selected Group)
        const coursesBase = selectedGroup
            ? allStudents.filter(s => s.group_name === selectedGroup)
            : allStudents;

        const courseCounts = {};
        coursesBase.forEach(s => {
            const c = s.course_name;
            if (c && validCourseNames.has(c)) {
                courseCounts[c] = (courseCounts[c] || 0) + 1;
            }
        });

        const courseChart = {
            labels: [''],
            datasets: Object.keys(courseCounts).map((course, i) => ({
                label: course,
                data: [courseCounts[course]],
                backgroundColor: (selectedCourse && selectedCourse !== course) ? '#e0e0e0' : colors[(i + 2) % colors.length],
                borderRadius: 4,
                barPercentage: 0.8,
                categoryPercentage: 0.9
            }))
        };

        // 3. Semester Chart Data (Show Semesters for Selected Course)
        const semBase = selectedCourse
            ? coursesBase.filter(s => s.course_name === selectedCourse)
            : coursesBase;

        const semCounts = {};
        semBase.forEach(s => {
            const sem = s.current_semester ? `Semester ${s.current_semester}` : 'Unknown';
            semCounts[sem] = (semCounts[sem] || 0) + 1;
        });

        const semesterChart = {
            labels: Object.keys(semCounts),
            datasets: [{
                data: Object.values(semCounts),
                backgroundColor: Object.keys(semCounts).map((label) => {
                    const semNum = label.replace('Semester ', '');
                    if (selectedSemester && String(semNum) !== String(selectedSemester)) return '#e0e0e0';
                    return '#1f4e79'; // or specific color mapping
                }),
                borderWidth: 1
            }]
        };

        // 4. Payment Chart (Show Status for Selected Semester context)
        const paymentBase = selectedSemester
            ? semBase.filter(s => String(s.current_semester) === String(selectedSemester))
            : semBase;

        const payCounts = { Paid: 0, Partial: 0, Pending: 0 };
        paymentBase.forEach(s => {
            if (s.paymentStatus === 'Paid') payCounts.Paid++;
            else if (s.paymentStatus === 'Partial') payCounts.Partial++;
            else payCounts.Pending++;
        });

        const paymentChart = {
            labels: ['Paid', 'Partial', 'Pending'],
            datasets: [{
                data: [payCounts.Paid, payCounts.Partial, payCounts.Pending],
                backgroundColor: ['Paid', 'Partial', 'Pending'].map(status => {
                    if (selectedPaymentStatus && selectedPaymentStatus !== status) return '#e0e0e0';
                    if (status === 'Paid') return '#28a745';
                    if (status === 'Partial') return '#ffc107';
                    return '#dc3545';
                }),
                borderWidth: 1
            }]
        };

        return { groupChart, courseChart, semesterChart, paymentChart };

    }, [allStudents, groups, courses, selectedGroup, selectedCourse, selectedSemester, selectedPaymentStatus]);

    // Available Courses based on selected group
    const availableCourses = useMemo(() => {
        if (!selectedGroup) return courses;
        return courses.filter(c => c.group_name === selectedGroup);
    }, [courses, selectedGroup]);


    return (
        <AdShellAdmin
            brandTitle="Admin Management Console"
            brandSubtitle="Chittoor"
            footerTitle="Admin Management Studio"
            footerSubtitle="Crafted for Vijayam College"
        >
            <div className="container-fluid p-4">

                {/* Header */}
                <div className="d-flex justify-content-between align-items-center mb-4 border-bottom pb-3">
                    <div>
                        <h4 className="fw-bold text-dark mb-1">Payment Reports</h4>
                        <div className="text-muted small">Generate and view student fee payment status reports</div>
                    </div>
                </div>

                {/* Filters Bar */}
                <div className="card shadow-sm border-0 mb-4">
                    <div className="card-header bg-white py-3 border-bottom">
                        <div className="d-flex align-items-center gap-2">
                            <i className="bi bi-funnel text-primary"></i>
                            <h6 className="mb-0 fw-bold text-dark">Report Filters</h6>
                        </div>
                    </div>
                    <div className="card-body p-3">
                        <div className="row g-3">
                            <div className="col-md-3">
                                <label className="form-label small fw-bold text-secondary text-uppercase mb-1">Academic Year</label>
                                <select
                                    className="form-select form-select-sm"
                                    value={selectedYear}
                                    onChange={(e) => {
                                        setSelectedYear(e.target.value);
                                        setSelectedGroup('');
                                        setSelectedCourse('');
                                        setSelectedSemester('');
                                        setSelectedPaymentStatus('');
                                    }}
                                >
                                    <option value="">Select Year</option>
                                    {academicYears.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                            <div className="col-md-3">
                                <label className="form-label small fw-bold text-secondary text-uppercase mb-1">Group</label>
                                <select
                                    className="form-select form-select-sm"
                                    value={selectedGroup}
                                    onChange={(e) => { setSelectedGroup(e.target.value); setSelectedCourse(''); }}
                                >
                                    <option value="">Select Group</option>
                                    {groups.map(g => <option key={g.group_name} value={g.group_name}>{g.group_name}</option>)}
                                </select>
                            </div>
                            <div className="col-md-2">
                                <label className="form-label small fw-bold text-secondary text-uppercase mb-1">Course</label>
                                <select
                                    className="form-select form-select-sm"
                                    value={selectedCourse}
                                    onChange={(e) => setSelectedCourse(e.target.value)}
                                    disabled={!selectedGroup}
                                >
                                    <option value="">Select Course</option>
                                    {availableCourses.map(c => <option key={c.course_code} value={c.course_name}>{c.course_name}</option>)}
                                </select>
                            </div>
                            <div className="col-md-2">
                                <label className="form-label small fw-bold text-secondary text-uppercase mb-1">Semester</label>
                                <select
                                    className="form-select form-select-sm"
                                    value={selectedSemester}
                                    onChange={(e) => setSelectedSemester(e.target.value)}
                                >
                                    <option value="">Select Semester</option>
                                    {[1, 2, 3, 4, 5, 6].map(s => <option key={s} value={s}>Semester {s}</option>)}
                                </select>
                            </div>
                            <div className="col-md-2">
                                <label className="form-label small fw-bold text-secondary text-uppercase mb-1">Status</label>
                                <select
                                    className="form-select form-select-sm"
                                    value={selectedPaymentStatus}
                                    onChange={(e) => setSelectedPaymentStatus(e.target.value)}
                                >
                                    <option value="">All Status</option>
                                    <option value="Paid">Paid</option>
                                    <option value="Partial">Partial</option>
                                    <option value="Pending">Pending</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Charts Row */}
                {chartData && (
                    <div className="row g-4 mb-4">
                        <div className="col-md-3">
                            <div className="card shadow-sm border-0 h-100">
                                <div className="card-header bg-white py-2 border-bottom">
                                    <div className="small fw-bold text-uppercase text-secondary text-center">Group</div>
                                </div>
                                <div className="card-body p-2 d-flex flex-column align-items-center justify-content-center">
                                    <div style={{ height: '160px', width: '100%' }}>
                                        <Bar
                                            data={chartData.groupChart}
                                            options={{
                                                responsive: true,
                                                maintainAspectRatio: false,
                                                onClick: (event, elements, chart) => {
                                                    if (elements && elements.length > 0) {
                                                        const datasetIndex = elements[0].datasetIndex;
                                                        const label = chart.data.datasets[datasetIndex].label;
                                                        if (label) {
                                                            setSelectedGroup(label);
                                                            setSelectedCourse('');
                                                        }
                                                    }
                                                },
                                                plugins: {
                                                    legend: {
                                                        display: true,
                                                        position: 'top',
                                                        align: 'end',
                                                        labels: { boxWidth: 12, font: { size: 10 } }
                                                    }
                                                },
                                                scales: {
                                                    x: { display: false },
                                                    y: { display: true }
                                                }
                                            }}
                                        />
                                    </div>
                                    <div className="mt-2 small fw-bold text-muted text-center">
                                        {selectedGroup || (chartData.groupChart.datasets.length > 1 ? 'All Groups' : (chartData.groupChart.datasets[0]?.label || '-'))}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-3">
                            <div className="card shadow-sm border-0 h-100">
                                <div className="card-header bg-white py-2 border-bottom">
                                    <div className="small fw-bold text-uppercase text-secondary text-center">Course</div>
                                </div>
                                <div className="card-body p-2 d-flex flex-column align-items-center justify-content-center">
                                    <div style={{ height: '160px', width: '100%' }}>
                                        <Bar
                                            data={chartData.courseChart}
                                            options={{
                                                responsive: true,
                                                maintainAspectRatio: false,
                                                onClick: (event, elements, chart) => {
                                                    if (elements && elements.length > 0) {
                                                        const datasetIndex = elements[0].datasetIndex;
                                                        const label = chart.data.datasets[datasetIndex].label;
                                                        if (label) setSelectedCourse(label);
                                                    }
                                                },
                                                plugins: {
                                                    legend: {
                                                        display: true,
                                                        position: 'top',
                                                        align: 'end',
                                                        labels: { boxWidth: 12, font: { size: 10 } }
                                                    }
                                                },
                                                scales: {
                                                    x: { display: false },
                                                    y: { display: true }
                                                }
                                            }}
                                        />
                                    </div>
                                    <div className="mt-2 small fw-bold text-muted text-center">
                                        {selectedCourse || (chartData.courseChart.datasets.length > 1 ? 'All Courses' : (chartData.courseChart.datasets[0]?.label || '-'))}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-3">
                            <div className="card shadow-sm border-0 h-100">
                                <div className="card-header bg-white py-2 border-bottom">
                                    <div className="small fw-bold text-uppercase text-secondary text-center">Semester</div>
                                </div>
                                <div className="card-body p-2 d-flex align-items-center justify-content-center">
                                    <div style={{ width: '100%', height: '160px' }}>
                                        <Pie
                                            data={chartData.semesterChart}
                                            options={{
                                                responsive: true,
                                                maintainAspectRatio: false,
                                                onClick: (event, elements, chart) => {
                                                    if (elements && elements.length > 0) {
                                                        const index = elements[0].index;
                                                        const label = chart.data.labels[index];
                                                        const semNum = label.replace('Semester ', '');
                                                        setSelectedSemester(semNum);
                                                    }
                                                },
                                                plugins: {
                                                    legend: {
                                                        display: true,
                                                        position: 'top',
                                                        align: 'end',
                                                        labels: { boxWidth: 10, font: { size: 9 } }
                                                    }
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-3">
                            <div className="card shadow-sm border-0 h-100">
                                <div className="card-header bg-white py-2 border-bottom">
                                    <div className="small fw-bold text-uppercase text-secondary text-center">Payment Status</div>
                                </div>
                                <div className="card-body p-2 d-flex align-items-center justify-content-center">
                                    <div style={{ width: '100%', height: '160px' }}>
                                        <Pie
                                            data={chartData.paymentChart}
                                            options={{
                                                responsive: true,
                                                maintainAspectRatio: false,
                                                onClick: (event, elements, chart) => {
                                                    if (elements && elements.length > 0) {
                                                        const index = elements[0].index;
                                                        const label = chart.data.labels[index];
                                                        setSelectedPaymentStatus(label);
                                                    }
                                                },
                                                plugins: {
                                                    legend: {
                                                        display: true,
                                                        position: 'top',
                                                        align: 'end',
                                                        labels: { boxWidth: 10, font: { size: 9 } }
                                                    }
                                                }
                                            }}
                                        />
                                    </div>
                                    {/* Minimal Legend if needed or keep default tooltip */}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Table Card */}
                <div className="card shadow-sm border-0">
                    <div className="card-header bg-white py-3 border-bottom d-flex justify-content-between align-items-center">
                        <div className="d-flex align-items-center gap-2">
                            <i className="bi bi-table text-primary"></i>
                            <h6 className="mb-0 fw-bold text-dark">Student Detail Report</h6>
                        </div>
                        <span className="badge bg-light text-dark border">Total: {filteredStudents.length}</span>
                    </div>
                    <div className="card-body p-0">
                        <div className="table-responsive">
                            <table className="table table-striped table-hover mb-0 align-middle user-select-none">
                                <thead className="bg-light">
                                    <tr>
                                        <th className="py-3 px-3 text-uppercase small fw-bolder text-dark border-bottom">Student ID</th>
                                        <th className="py-3 px-3 text-uppercase small fw-bolder text-dark border-bottom">Name</th>
                                        <th className="py-3 px-3 text-uppercase small fw-bolder text-dark border-bottom">Hall Ticket</th>
                                        <th className="py-3 px-3 text-uppercase small fw-bolder text-dark border-bottom">Group</th>
                                        <th className="py-3 px-3 text-uppercase small fw-bolder text-dark border-bottom">Course</th>
                                        <th className="py-3 px-3 text-uppercase small fw-bolder text-dark border-bottom">Year</th>
                                        <th className="py-3 px-3 text-uppercase small fw-bolder text-dark border-bottom">Sem</th>
                                        <th className="py-3 px-3 text-uppercase small fw-bolder text-dark border-bottom text-center">Payment</th>
                                        <th className="py-3 px-3 text-uppercase small fw-bolder text-dark border-bottom text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLoading ? (
                                        <tr><td colSpan="9" className="text-center py-5 text-muted">Loading data...</td></tr>
                                    ) : filteredStudents.length > 0 ? (
                                        filteredStudents.map((student) => (
                                            <tr key={student.id}>
                                                <td className="px-3 fw-bold font-monospace text-primary small">{student.student_id}</td>
                                                <td className="px-3 fw-bold text-dark">{student.full_name}</td>
                                                <td className="px-3 font-monospace small">{student.hall_ticket_no}</td>
                                                <td className="px-3 small">{student.group_name}</td>
                                                <td className="px-3 small">{student.course_name}</td>
                                                <td className="px-3 small">{student.academic_year}</td>
                                                <td className="px-3 small">Sem {student.current_semester}</td>
                                                <td className="px-3 text-center">
                                                    <span className={`badge border rounded-pill px-3 fw-normal
                                                        ${student.paymentStatus === 'Paid' ? 'bg-success-subtle text-success border-success' :
                                                            student.paymentStatus === 'Partial' ? 'bg-warning-subtle text-warning-emphasis border-warning' :
                                                                'bg-danger-subtle text-danger border-danger'}`}
                                                    >
                                                        {student.paymentStatus}
                                                    </span>
                                                </td>
                                                <td className="px-3 text-center">
                                                    <span className={`badge border rounded-pill px-3 fw-normal ${student.status === 'ACTIVE' ? 'bg-light text-dark border-secondary' : 'bg-secondary text-white'}`}>
                                                        {student.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr><td colSpan="9" className="text-center py-5 text-muted">No records found. Adjust filters to view data.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    {filteredStudents.length > 0 && !isLoading && (
                        <div className="card-footer bg-white text-end py-3 border-top">
                            <button className="btn btn-sm btn-dark" onClick={() => window.print()}>
                                <i className="bi bi-printer me-2"></i> Print Report
                            </button>
                        </div>
                    )}
                </div>

                <ToastContainer />
            </div>
        </AdShellAdmin>
    );
}
