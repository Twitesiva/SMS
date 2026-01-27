import { useEffect, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import HostelShell from '../../components/HostelShell';
import HostelPreloader from '../../components/HostelPreloader';
import { toast } from 'react-toastify';

export default function HostelApplications() {
    const [applications, setApplications] = useState([]);
    const [years, setYears] = useState([]);
    const [loading, setLoading] = useState(true);
    
    const [filterYear, setFilterYear] = useState('');
    const [filterStatus, setFilterStatus] = useState('PENDING');

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        const { data: yearsData } = await supabase.from('academic_year').select('academic_year').order('academic_year', { ascending: false });
        setYears(yearsData || []);
        if (yearsData?.[0]) setFilterYear(yearsData[0].academic_year);
    };

    useEffect(() => {
        if (filterYear) fetchApplications();
    }, [filterYear, filterStatus]);

    const fetchApplications = async () => {
        setLoading(true);
        let query = supabase.from('student_hostel_applications')
            .select('*, students(full_name, student_id, gender, phone_number)')
            .eq('academic_year', filterYear);

        if (filterStatus) {
            query = query.eq('status', filterStatus);
        }

        const { data, error } = await query.order('applied_at', { ascending: false });
        if (error) toast.error(error.message);
        else setApplications(data || []);
        setLoading(false);
    };

    const handleStatusChange = async (id, newStatus) => {
        const { error } = await supabase.from('student_hostel_applications')
            .update({ status: newStatus })
            .eq('id', id);

        if (error) toast.error(error.message);
        else {
            toast.success(`Application ${newStatus.toLowerCase()} successfully`);
            fetchApplications();
        }
    };

    return (
        <HostelShell brandTitle="HOSTEL MANAGEMENT">
            <div className="desktop-container">
                <h4 className="mb-4">Hostel Applications</h4>

                <section className="setup-section">
                    <div className="students-section-shell card card-soft mb-4">
                        <div className="students-section-shell-header d-flex justify-content-between align-items-center mb-0">
                            <div>
                                <h5 className="section-title mb-1" style={{ fontSize: '1.1rem' }}>Application Management</h5>
                                <p className="students-section-copy mb-0">Review and approve student requests for hostel accommodation.</p>
                            </div>
                            <div className="d-flex gap-3">
                                <div>
                                    <label className="small fw-bold text-muted mb-1 d-block text-uppercase">Academic Year</label>
                                    <select className="form-select form-select-sm" value={filterYear} onChange={(e) => setFilterYear(e.target.value)} style={{ minWidth: '150px' }}>
                                        {years.map(y => <option key={y.academic_year} value={y.academic_year}>{y.academic_year}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="small fw-bold text-muted mb-1 d-block text-uppercase">Status</label>
                                    <select className="form-select form-select-sm" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ minWidth: '150px' }}>
                                        <option value="">All Statuses</option>
                                        <option value="PENDING">Pending</option>
                                        <option value="APPROVED">Approved</option>
                                        <option value="REJECTED">Rejected</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="students-section-shell card card-soft">
                        {loading ? (
                            <HostelPreloader
                                title="Loading hostel applications"
                                subtitle="Fetching student requests and approval status."
                            />
                        ) : (
                            <div className="table-responsive">
                                <table className="table align-middle">
                                    <thead>
                                        <tr className="text-muted small text-uppercase fw-bold">
                                            <th>Applied Date</th>
                                            <th>Student Details</th>
                                            <th>Gender</th>
                                            <th className="text-center">Req. Type</th>
                                            <th className="text-center">Status</th>
                                            <th className="text-end">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {applications.length === 0 ? (
                                            <tr><td colSpan="6" className="text-center py-5">No applications found for selected filters.</td></tr>
                                        ) : (
                                            applications.map((app) => (
                                                <tr key={app.id}>
                                                    <td className="small">{new Date(app.applied_at).toLocaleDateString('en-GB')}</td>
                                                    <td>
                                                        <div className="fw-bold fs-6">{app.students?.full_name}</div>
                                                        <div className="text-muted small">{app.students?.student_id} | {app.students?.phone_number}</div>
                                                    </td>
                                                    <td>
                                                        <span className={`students-section-badge ${app.students?.gender?.startsWith('M') ? 'bg-info bg-opacity-10 text-info' : 'bg-danger bg-opacity-10 text-danger'}`}>
                                                            {app.students?.gender}
                                                        </span>
                                                    </td>
                                                    <td className="text-center">
                                                        <span className={`badge ${app.wants_ac ? 'bg-primary' : 'bg-secondary'}`}>
                                                            {app.wants_ac ? 'AC' : 'Non AC'}
                                                        </span>
                                                    </td>
                                                    <td className="text-center">
                                                        <span className={`badge ${app.status === 'PENDING' ? 'bg-warning' : app.status === 'APPROVED' ? 'bg-success' : 'bg-danger'}`}>
                                                            {app.status}
                                                        </span>
                                                    </td>
                                                    <td className="text-end">
                                                        <div className="d-flex justify-content-end gap-2">
                                                            {app.status === 'PENDING' && (
                                                                <>
                                                                    <button className="btn btn-sm btn-success px-3" onClick={() => handleStatusChange(app.id, 'APPROVED')}>
                                                                        Approve
                                                                    </button>
                                                                    <button className="btn btn-sm btn-danger px-3" onClick={() => handleStatusChange(app.id, 'REJECTED')}>
                                                                        Reject
                                                                    </button>
                                                                </>
                                                            )}
                                                            {app.status !== 'PENDING' && (
                                                                <button className="btn btn-sm btn-outline-secondary" onClick={() => handleStatusChange(app.id, 'PENDING')}>
                                                                    Mark Pending
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </HostelShell>
    );
}
