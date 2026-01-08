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
            <div className="desktop-container" style={{ overflowX: 'hidden' }}>

                {/* Header */}
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <h3 className="fw-bold mb-1" style={{ letterSpacing: '-0.5px' }}>EXAM MANAGEMENT SYSTEM</h3>
                    </div>
                    <div className="text-secondary small">
                        Admin / Reports
                    </div>
                </div>

                {/* Filters Card */}
                <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: '12px' }}>
                    <div className="card-body p-4">
                        <div className="row g-3">
                            <div className="col-md-3">
                                <label className="form-label fw-semibold text-muted small text-uppercase">Academic Year</label>
                                <select
                                    className="form-select border-light bg-light fw-medium"
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(e.target.value)}
                                >
                                    <option value="">Select Year</option>
                                    {academicYears.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                            <div className="col-md-3">
                                <label className="form-label fw-semibold text-muted small text-uppercase">Group</label>
                                <select
                                    className="form-select border-light bg-light fw-medium"
                                    value={selectedGroup}
                                    onChange={(e) => { setSelectedGroup(e.target.value); setSelectedCourse(''); }}
                                >
                                    <option value="">Select Group</option>
                                    {groups.map(g => <option key={g.group_name} value={g.group_name}>{g.group_name}</option>)}
                                </select>
                            </div>
                            <div className="col-md-2">
                                <label className="form-label fw-semibold text-muted small text-uppercase">Course</label>
                                <select
                                    className="form-select border-light bg-light fw-medium"
                                    value={selectedCourse}
                                    onChange={(e) => setSelectedCourse(e.target.value)}
                                    disabled={!selectedGroup}
                                >
                                    <option value="">Select Course</option>
                                    {availableCourses.map(c => <option key={c.course_code} value={c.course_name}>{c.course_name}</option>)}
                                </select>
                            </div>
                            <div className="col-md-2">
                                <label className="form-label fw-semibold text-muted small text-uppercase">Semester</label>
                                <select
                                    className="form-select border-light bg-light fw-medium"
                                    value={selectedSemester}
                                    onChange={(e) => setSelectedSemester(e.target.value)}
                                >
                                    <option value="">Select Semester</option>
                                    {[1, 2, 3, 4, 5, 6].map(s => <option key={s} value={s}>Semester {s}</option>)}
                                </select>
                            </div>
                            <div className="col-md-2">
                                <label className="form-label fw-semibold text-muted small text-uppercase">Payment Status</label>
                                <select
                                    className="form-select border-light bg-light fw-medium"
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
                        {/* Group Chart */}
                        <div className="col-md-3">
                            <div className="card h-100 border-0 shadow-sm p-3" style={{ borderRadius: '12px' }}>
                                <h6 className="fw-bold text-muted mb-3 font-monospace">Group</h6>
                                <div style={{ position: 'relative', height: '180px', width: '100%' }}>
                                    <Bar
                                        data={chartData.groupChart}
                                        options={{
                                            responsive: true,
                                            maintainAspectRatio: false,
                                            plugins: { legend: { display: false } },
                                            scales: { x: { display: false }, y: { display: true } }
                                        }}
                                    />
                                </div>
                                <div className="text-center mt-2 small text-muted">{filteredStudents[0]?.group_name || 'Computer Science'}</div>
                            </div>
                        </div>

                        {/* Course Chart */}
                        <div className="col-md-3">
                            <div className="card h-100 border-0 shadow-sm p-3" style={{ borderRadius: '12px' }}>
                                <h6 className="fw-bold text-muted mb-3 font-monospace">Course</h6>
                                <div style={{ position: 'relative', height: '180px', width: '100%' }}>
                                    <Bar
                                        data={chartData.courseChart}
                                        options={{
                                            responsive: true,
                                            maintainAspectRatio: false,
                                            plugins: { legend: { display: false } },
                                            scales: { x: { display: false }, y: { display: true } }
                                        }}
                                    />
                                </div>
                                <div className="text-center mt-2 small text-muted">{filteredStudents[0]?.course_name || 'BSC'}</div>
                            </div>
                        </div>

                        {/* Semester Chart */}
                        <div className="col-md-3">
                            <div className="card h-100 border-0 shadow-sm p-3" style={{ borderRadius: '12px' }}>
                                <h6 className="fw-bold text-muted mb-3 font-monospace">Semester</h6>
                                <div className="d-flex justify-content-center align-items-center" style={{ height: '180px' }}>
                                    <div style={{ width: '140px', height: '140px' }}>
                                        <Pie
                                            data={chartData.semesterChart}
                                            options={{
                                                responsive: true,
                                                maintainAspectRatio: false,
                                                plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 } } } }
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Payment Status Chart */}
                        <div className="col-md-3">
                            <div className="card h-100 border-0 shadow-sm p-3" style={{ borderRadius: '12px' }}>
                                <h6 className="fw-bold text-muted mb-3 font-monospace">Payment Status</h6>
                                <div className="d-flex justify-content-center align-items-center" style={{ height: '180px' }}>
                                    <div style={{ width: '140px', height: '140px' }}>
                                        <Pie
                                            data={chartData.paymentChart}
                                            options={{
                                                responsive: true,
                                                maintainAspectRatio: false,
                                                plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 } } } }
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Student Table */}
                <div className="card border-0 shadow-sm" style={{ borderRadius: '12px', overflow: 'hidden' }}>
                    <div className="card-header bg-primary text-white p-3 border-0">
                        <div className="d-flex justify-content-between align-items-center">
                            <h5 className="mb-0 fw-bold" style={{ letterSpacing: '0.5px' }}>STUDENTS</h5>
                            <span className="badge bg-white text-primary rounded-pill px-3">{filteredStudents.length} students listed</span>
                        </div>
                        <div className="small opacity-75 mt-1">Detailed list of students matching the current filters.</div>
                    </div>
                    <div className="table-responsive">
                        <table className="table table-hover mb-0 align-middle">
                            <thead className="bg-light text-uppercase small fw-bold text-secondary">
                                <tr style={{ letterSpacing: '0.5px' }}>
                                    <th className="py-3 px-4 border-0">Student ID</th>
                                    <th className="py-3 px-4 border-0">Name</th>
                                    <th className="py-3 px-4 border-0">Hall Ticket</th>
                                    <th className="py-3 px-4 border-0">Group</th>
                                    <th className="py-3 px-4 border-0">Course</th>
                                    <th className="py-3 px-4 border-0">Academic Year</th>
                                    <th className="py-3 px-4 border-0">Semester</th>
                                    <th className="py-3 px-4 border-0 text-center">Payment Status</th>
                                    <th className="py-3 px-4 border-0 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <tr>
                                        <td colSpan="9" className="text-center py-5 text-muted">Loading data...</td>
                                    </tr>
                                ) : filteredStudents.length > 0 ? (
                                    filteredStudents.map((student, idx) => (
                                        <tr key={student.id} className={idx % 2 === 0 ? '' : 'bg-light bg-opacity-10'}>
                                            <td className="px-4 fw-medium text-dark">{student.student_id}</td>
                                            <td className="px-4 fw-semibold text-primary">{student.full_name}</td>
                                            <td className="px-4 font-monospace small">{student.hall_ticket_no}</td>
                                            <td className="px-4 text-muted">{student.group_name}</td>
                                            <td className="px-4 text-muted">{student.course_name}</td>
                                            <td className="px-4 text-muted">{student.academic_year}</td>
                                            <td className="px-4 text-muted">Semester {student.current_semester}</td>
                                            <td className="px-4 text-center">
                                                <span className={`badge rounded-pill px-3 py-2 
                                            ${student.paymentStatus === 'Paid' ? 'bg-success' :
                                                        student.paymentStatus === 'Partial' ? 'bg-warning text-dark' : 'bg-danger'}
                                        `}>
                                                    {student.paymentStatus}
                                                </span>
                                            </td>
                                            <td className="px-4 text-center">
                                                <span className={`badge rounded-pill px-3 py-2 ${student.status === 'ACTIVE' ? 'bg-success bg-opacity-75' : 'bg-secondary'}`}>
                                                    {student.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="9" className="text-center py-5 text-muted">No records found. Please adjust filters.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    {filteredStudents.length > 0 && !isLoading && (
                        <div className="card-footer bg-white border-0 py-3 text-center">
                            <button className="btn btn-sm btn-outline-secondary" onClick={() => window.print()}>
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
