import { useEffect, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import HostelShell from '../../components/HostelShell';
import HostelPreloader from '../../components/HostelPreloader';
import { toast } from 'react-toastify';

export default function HostelReports() {
    const [summary, setSummary] = useState([]);
    const [residents, setResidents] = useState([]);
    const [years, setYears] = useState([]);
    const [selectedYear, setSelectedYear] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        const { data: yearsData } = await supabase.from('academic_year').select('academic_year').order('academic_year', { ascending: false });
        if (yearsData) {
            setYears(yearsData);
            if (yearsData[0]) {
                const latest = yearsData[0].academic_year;
                setSelectedYear(latest);
                fetchStats(latest);
            }
        }
    };

    useEffect(() => {
        if (selectedYear) fetchStats(selectedYear);
    }, [selectedYear]);

    const fetchStats = async (year) => {
        setLoading(true);
        const [summaryRes, residentsRes] = await Promise.all([
            supabase.from('v_hostel_occupancy_summary').select('*').eq('academic_year', year),
            supabase.from('v_hostel_current_students').select('*').eq('academic_year', year)
        ]);

        if (summaryRes.error) toast.error(summaryRes.error.message);
        else setSummary(summaryRes.data || []);

        if (residentsRes.error) toast.error(residentsRes.error.message);
        else setResidents(residentsRes.data || []);
        
        setLoading(false);
    };

    const downloadCSV = () => {
        if (residents.length === 0) return;
        const headers = ['Student ID', 'Student Name', 'Block', 'Room No', 'Bed No', 'Room Type', 'Allocated At'];
        const rows = residents.map(r => [
            r.student_id,
            r.student_name,
            r.block_name,
            r.room_no,
            r.bed_no,
            r.room_type,
            new Date(r.allocated_at).toLocaleDateString('en-GB')
        ]);

        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `Hostel_Residents_${selectedYear}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const stats = summary.reduce((acc, curr) => {
        acc.total += curr.total_beds;
        acc.occupied += curr.occupied_beds;
        acc.available += curr.available_beds;
        return acc;
    }, { total: 0, occupied: 0, available: 0 });

    return (
        <HostelShell brandTitle="HOSTEL MANAGEMENT">
            <div className="desktop-container">
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <h4 className="mb-0">Hostel Reports & Summary</h4>
                    <div className="d-flex gap-2">
                        <select className="form-select form-select-sm" value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} style={{ width: '180px' }}>
                            {years.map(y => <option key={y.academic_year} value={y.academic_year}>{y.academic_year}</option>)}
                        </select>
                        <button className="btn btn-sm btn-outline-primary" onClick={downloadCSV} disabled={residents.length === 0}>
                            <i className="bi bi-download me-1"></i> Export CSV
                        </button>
                    </div>
                </div>

                <div className="row g-4 mb-4">
                    <div className="col-md-4">
                            <div className="card card-soft p-4 border-0 border-start border-4 border-primary shadow-sm h-100">
                            <div className="text-muted small text-uppercase fw-bold mb-1">Total Bed Capacity</div>
                            <div className="display-6 fw-bold text-dark">{stats.total}</div>
                            <div className="mt-2 small text-primary h6 mb-0">Across all blocks</div>
                        </div>
                    </div>
                    <div className="col-md-4">
                        <div className="card card-soft p-4 border-0 border-start border-4 border-danger shadow-sm h-100">
                            <div className="text-muted small text-uppercase fw-bold mb-1">Occupied Beds</div>
                            <div className="display-6 fw-bold text-danger">{stats.occupied}</div>
                                <div className="mt-2 small text-danger h6 mb-0">{stats.total > 0 ? ((stats.occupied / stats.total) * 100).toFixed(1) : 0}% Occupancy</div>
                        </div>
                    </div>
                    <div className="col-md-4">
                        <div className="card card-soft p-4 border-0 border-start border-4 border-success shadow-sm h-100">
                            <div className="text-muted small text-uppercase fw-bold mb-1">Available Beds</div>
                            <div className="display-6 fw-bold text-success">{stats.available}</div>
                                <div className="mt-2 small text-success h6 mb-0">Ready for allocation</div>
                        </div>
                    </div>
                </div>

                <div className="row g-4">
                    <div className="col-xl-5">
                        <div className="students-section-shell card card-soft h-100">
                            <h5 className="section-title mb-4" style={{ fontSize: '1.1rem' }}>Occupancy by Block & Type</h5>
                            {loading ? (
                                <HostelPreloader
                                    title="Loading occupancy summary"
                                    subtitle="Compiling block and room type totals."
                                />
                            ) : (
                                <div className="table-responsive">
                                    <table className="table align-middle small">
                                        <thead>
                                            <tr className="text-white text-uppercase fw-bold" style={{ background: 'linear-gradient(180deg, #606c88 0%, #3f4c6b 50%, #606c88 100%)' }}>
                                                <th className="py-2 px-3 border-0" style={{ backgroundColor: 'transparent', color: 'white' }}>Block</th>
                                                <th className="py-2 px-3 border-0" style={{ backgroundColor: 'transparent', color: 'white' }}>Type</th>
                                                <th className="py-2 px-3 border-0 text-center" style={{ backgroundColor: 'transparent', color: 'white' }}>Total</th>
                                                <th className="py-2 px-3 border-0 text-center" style={{ backgroundColor: 'transparent', color: 'white' }}>Used</th>
                                                <th className="py-2 px-3 border-0 text-center" style={{ backgroundColor: 'transparent', color: 'white' }}>Free</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {summary.map((row, idx) => (
                                                <tr key={idx}>
                                                    <td className="fw-bold">{row.block_name}</td>
                                                    <td>{row.room_type?.replace(/_/g, ' ')}</td>
                                                    <td className="text-center">{row.total_beds}</td>
                                                    <td className="text-center text-danger fw-bold">{row.occupied_beds}</td>
                                                    <td className="text-center text-success fw-bold">{row.available_beds}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="col-xl-7">
                        <div className="students-section-shell card card-soft h-100">
                            <h5 className="section-title mb-4" style={{ fontSize: '1.1rem' }}>Resident Details</h5>
                            {loading ? (
                                <HostelPreloader
                                    title="Loading resident details"
                                    subtitle="Fetching current hostel allocations."
                                />
                            ) : (
                                <div className="table-responsive" style={{ maxHeight: '500px' }}>
                                    <table className="table align-middle table-sm">
                                        <thead>
                                            <tr className="text-white text-uppercase fw-bold" style={{ fontSize: '0.75rem', background: 'linear-gradient(180deg, #606c88 0%, #3f4c6b 50%, #606c88 100%)' }}>
                                                <th className="py-2 px-3 border-0" style={{ backgroundColor: 'transparent', color: 'white' }}>Student</th>
                                                <th className="py-2 px-3 border-0" style={{ backgroundColor: 'transparent', color: 'white' }}>Block</th>
                                                <th className="py-2 px-3 border-0" style={{ backgroundColor: 'transparent', color: 'white' }}>Room-Bed</th>
                                                <th className="py-2 px-3 border-0" style={{ backgroundColor: 'transparent', color: 'white' }}>Allocated</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {residents.length === 0 ? (
                                                <tr><td colSpan="4" className="text-center py-4">No active residents in this session.</td></tr>
                                            ) : (
                                                residents.map((res, idx) => (
                                                    <tr key={idx}>
                                                        <td>
                                                            <div className="fw-bold">{res.student_name}</div>
                                                            <div className="small text-muted">{res.student_id}</div>
                                                        </td>
                                                        <td className="small">{res.block_name}</td>
                                                        <td>
                                                            <span className="fw-bold">{res.room_no}</span> - {res.bed_no}
                                                            <div className="small text-muted" style={{ fontSize: '0.7rem' }}>{res.room_type?.replace(/_/g, ' ')}</div>
                                                        </td>
                                                        <td className="small">{new Date(res.allocated_at).toLocaleDateString('en-GB')}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </HostelShell>
    );
}
