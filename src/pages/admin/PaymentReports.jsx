import React, { useState, useEffect, useMemo } from 'react';
import AdminShell from '../../components/AdminShell';
import { supabase } from '../../../supabaseClient';
import { toast, ToastContainer } from 'react-toastify';
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
    const [filteredStudents, setFilteredStudents] = useState([]);

    // --- Navigation Definition (Preserved) ---
    const adminNavGroups = [
        {
            title: 'Applications',
            static: true,
            items: [
                {
                    to: '/admin-portal/applications',
                    label: 'Applications',
                    icon: 'bi-inboxes'
                }
            ]
        },
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
        },
        {
            title: 'Circulars',
            static: true,
            items: [
                {
                    to: '/admin-portal/circulars',
                    label: 'Circulars',
                    icon: 'bi-megaphone'
                }
            ]
        },
        {
            title: 'Payment Reports',
            static: true,
            items: [
                {
                    to: '/admin-portal/payment-reports',
                    label: 'Payment Reports',
                    icon: 'bi-file-earmark-bar-graph'
                }
            ]
        },
    ]

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (selectedYear || selectedGroup || selectedCourse || selectedSemester || selectedPaymentStatus) {
            fetchReportData();
        }
    }, [selectedYear, selectedGroup, selectedCourse, selectedSemester, selectedPaymentStatus]);

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
            // 1. Fetch Students with necessary fields for fee mapping
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
                .eq('status', 'ACTIVE'); // Assuming we want active students

            if (selectedYear) query = query.eq('academic_year', selectedYear);
            if (selectedGroup) query = query.eq('group_name', selectedGroup);
            if (selectedCourse) query = query.eq('course_name', selectedCourse);
            if (selectedSemester) query = query.eq('current_semester', selectedSemester);

            const { data: studentsData, error } = await query;
            if (error) throw error;

            if (studentsData.length === 0) {
                setFilteredStudents([]);
                return;
            }

            const studentIds = studentsData.map(s => s.id);

            // 2. Fetch Fee Structures (Academic Fees) to know the target total
            // We fetch all potential fees matching the selected filters (or all if filters are broad)
            let feeQuery = supabase.from('academic_fees').select('*');
            if (selectedYear) feeQuery = feeQuery.eq('academic_year', selectedYear);

            const { data: feesData } = await feeQuery;

            // 3. Fetch Payments
            let paymentQuery = supabase
                .from('student_fee_payments')
                .select('student_id, amount_paid, payment_status, payment_mode')
                .in('student_id', studentIds)
                .eq('payment_status', 'success');

            const { data: paymentsData } = await paymentQuery;

            // 4. Calculate Status
            const processed = studentsData.map(student => {
                // Find applicable fee
                // Matching logic: academic_year, course_id, group_id, year_of_study.
                // Check if 'category' in fees table matches student.Category (if applicable)

                const applicableFee = feesData?.find(f =>
                    f.academic_year === student.academic_year &&
                    f.course_id === student.course_id &&
                    f.group_id === student.group_id &&
                    f.year_of_study === student.year_of_study &&
                    // Strict match on category if present in student
                    (student.Category ? f.category?.toLowerCase() === student.Category?.toLowerCase() : true)
                );

                const totalFee = applicableFee ? Number(applicableFee.total_fee) : 0;

                const studentPayments = paymentsData?.filter(p => p.student_id === student.id) || [];
                const totalPaid = studentPayments.reduce((sum, p) => sum + Number(p.amount_paid), 0);

                // Helper to check payment modes
                const hasPartialPayment = studentPayments.some(p => p.payment_mode?.toLowerCase() === 'partial');
                const hasFullPayment = studentPayments.some(p => p.payment_mode?.toLowerCase() === 'full');

                let status = 'Pending';

                if (totalPaid > 0) {
                    if (totalFee > 0) {
                        // We have a known fee target
                        if (totalPaid >= totalFee) {
                            status = 'Paid';
                        } else {
                            status = 'Partial';
                        }
                    } else {
                        // We do NOT know the fee target (missing fee structure)
                        // Use payment_mode heuristics
                        if (hasFullPayment) {
                            status = 'Paid';
                        } else if (hasPartialPayment) {
                            status = 'Partial';
                        } else {
                            // Default to Paid if unknown to be optimistic, but likely Partial if amount is small?
                            // Safest default for reporting is usually Paid if we don't know the fee, 
                            // BUT given the user report, let's treat explicit 'partial' as Partial.
                            // If ambiguous, default Paid.
                            status = 'Paid';
                        }
                    }
                }

                return {
                    ...student,
                    paymentStatus: status,
                    totalFee,
                    totalPaid
                };
            });

            // Apply Payment Status Filter if selected
            const finalFiltered = selectedPaymentStatus
                ? processed.filter(s => s.paymentStatus === selectedPaymentStatus)
                : processed;

            setFilteredStudents(finalFiltered);

        } catch (error) {
            console.error('Error fetching report data:', error);
            toast.error('Failed to generate report.');
        } finally {
            setIsLoading(false);
        }
    };

    // --- Charts Logic ---

    const chartData = useMemo(() => {
        if (!filteredStudents.length) return null;

        // 1. Group Chart Data
        const groupCounts = {};
        filteredStudents.forEach(s => {
            const g = s.group_name || 'Unknown';
            groupCounts[g] = (groupCounts[g] || 0) + 1;
        });

        const groupChart = {
            labels: Object.keys(groupCounts),
            datasets: [{
                label: 'Students',
                data: Object.values(groupCounts),
                backgroundColor: '#1f4e79', // Dark Blue
                borderRadius: 4
            }]
        };

        // 2. Course Chart Data
        const courseCounts = {};
        filteredStudents.forEach(s => {
            const c = s.course_name || 'Unknown';
            courseCounts[c] = (courseCounts[c] || 0) + 1;
        });

        const courseChart = {
            labels: Object.keys(courseCounts),
            datasets: [{
                label: 'Students',
                data: Object.values(courseCounts),
                backgroundColor: '#ed7d31', // Orange
                borderRadius: 4
            }]
        };

        // 3. Semester Chart Data (Pie)
        const semCounts = {};
        filteredStudents.forEach(s => {
            const sem = s.current_semester ? `Semester ${s.current_semester}` : 'Unknown';
            semCounts[sem] = (semCounts[sem] || 0) + 1;
        });

        const semesterChart = {
            labels: Object.keys(semCounts),
            datasets: [{
                data: Object.values(semCounts),
                backgroundColor: ['#1f4e79', '#2e75b6', '#9dc3e6', '#c9c9c9'], // Blues
                borderWidth: 1
            }]
        };

        // 4. Payment Chart All (Pie)
        // Usually helpful to see breakdown of current list.
        const payCounts = { Paid: 0, Partial: 0, Pending: 0 };
        filteredStudents.forEach(s => {
            if (s.paymentStatus === 'Paid') payCounts.Paid++;
            else if (s.paymentStatus === 'Partial') payCounts.Partial++;
            else payCounts.Pending++;
        });

        const paymentChart = {
            labels: ['Paid', 'Partial', 'Pending'],
            datasets: [{
                data: [payCounts.Paid, payCounts.Partial, payCounts.Pending],
                backgroundColor: ['#28a745', '#ffc107', '#dc3545'], // Green, Yellow, Red
                borderWidth: 1
            }]
        };

        return { groupChart, courseChart, semesterChart, paymentChart };

    }, [filteredStudents]);

    // Available Courses based on selected group
    const availableCourses = useMemo(() => {
        if (!selectedGroup) return courses;
        return courses.filter(c => c.group_name === selectedGroup);
    }, [courses, selectedGroup]);


    return (
        <AdminShell
            navGroups={adminNavGroups}
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
                                    onChange={(e) => setSelectedYear(e.target.value)}
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
                                    <div className="small fw-bold text-uppercase text-secondary text-center">Group Distribution</div>
                                </div>
                                <div className="card-body p-2 d-flex flex-column align-items-center justify-content-center">
                                    <div style={{ height: '160px', width: '100%' }}>
                                        <Bar
                                            data={chartData.groupChart}
                                            options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { display: true } } }}
                                        />
                                    </div>
                                    <div className="mt-2 small fw-bold text-muted">{filteredStudents[0]?.group_name || '-'}</div>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-3">
                            <div className="card shadow-sm border-0 h-100">
                                <div className="card-header bg-white py-2 border-bottom">
                                    <div className="small fw-bold text-uppercase text-secondary text-center">Course Distribution</div>
                                </div>
                                <div className="card-body p-2 d-flex flex-column align-items-center justify-content-center">
                                    <div style={{ height: '160px', width: '100%' }}>
                                        <Bar
                                            data={chartData.courseChart}
                                            options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { display: true } } }}
                                        />
                                    </div>
                                    <div className="mt-2 small fw-bold text-muted">{filteredStudents[0]?.course_name || '-'}</div>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-3">
                            <div className="card shadow-sm border-0 h-100">
                                <div className="card-header bg-white py-2 border-bottom">
                                    <div className="small fw-bold text-uppercase text-secondary text-center">Semester</div>
                                </div>
                                <div className="card-body p-2 d-flex align-items-center justify-content-center">
                                    <div style={{ width: '140px', height: '140px' }}>
                                        <Pie
                                            data={chartData.semesterChart}
                                            options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }}
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
                                    <div style={{ width: '140px', height: '140px' }}>
                                        <Pie
                                            data={chartData.paymentChart}
                                            options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }}
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
                                        <th className="py-3 px-3 text-uppercase small fw-bold text-secondary border-bottom">Student ID</th>
                                        <th className="py-3 px-3 text-uppercase small fw-bold text-secondary border-bottom">Name</th>
                                        <th className="py-3 px-3 text-uppercase small fw-bold text-secondary border-bottom">Hall Ticket</th>
                                        <th className="py-3 px-3 text-uppercase small fw-bold text-secondary border-bottom">Group</th>
                                        <th className="py-3 px-3 text-uppercase small fw-bold text-secondary border-bottom">Course</th>
                                        <th className="py-3 px-3 text-uppercase small fw-bold text-secondary border-bottom">Year</th>
                                        <th className="py-3 px-3 text-uppercase small fw-bold text-secondary border-bottom">Sem</th>
                                        <th className="py-3 px-3 text-uppercase small fw-bold text-secondary border-bottom text-center">Payment</th>
                                        <th className="py-3 px-3 text-uppercase small fw-bold text-secondary border-bottom text-center">Status</th>
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
        </AdminShell>
    );
}
