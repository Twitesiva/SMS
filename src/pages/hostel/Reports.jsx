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
    const [blockFilter, setBlockFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');
    const [residentBlockFilter, setResidentBlockFilter] = useState('all');
    const [residentTypeFilter, setResidentTypeFilter] = useState('all');
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

    const blockOptions = Array.from(new Set(summary.map(item => item.block_name).filter(Boolean)));
    const typeOptions = Array.from(new Set(summary.map(item => item.room_type).filter(Boolean)));
    const residentBlockOptions = Array.from(new Set(residents.map(item => item.block_name).filter(Boolean)));
    const residentTypeOptions = Array.from(new Set(residents.map(item => item.room_type).filter(Boolean)));

    const filteredSummary = summary.filter(item => {
        const blockMatch = blockFilter === 'all' || item.block_name === blockFilter;
        const typeMatch = typeFilter === 'all' || item.room_type === typeFilter;
        return blockMatch && typeMatch;
    });

    const filteredResidents = residents.filter(item => {
        const blockMatch = residentBlockFilter === 'all' || item.block_name === residentBlockFilter;
        const typeMatch = residentTypeFilter === 'all' || item.room_type === residentTypeFilter;
        return blockMatch && typeMatch;
    });

    const headerGradient = 'linear-gradient(180deg, #606c88 0%, #3f4c6b 50%, #606c88 100%)';
    const rowShadow = '0 8px 18px rgba(15, 32, 39, 0.08)';
    const rowBg = '#f6f9fc';

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

                <div className="row g-4">
                    <div className="col-12">
                        <div className="students-section-shell card card-soft h-100" style={{ borderRadius: '18px', border: '1px solid rgba(32, 58, 67, 0.1)' }}>
                            <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-3">
                                <div>
                                    <h5 className="section-title mb-1" style={{ fontSize: '1.1rem' }}>Occupancy by Block & Type</h5>
                                    <div className="small text-muted">Filter by block and room type to drill down.</div>
                                </div>
                                <div className="d-flex gap-2">
                                    <select
                                        className="form-select form-select-sm"
                                        value={blockFilter}
                                        onChange={(e) => setBlockFilter(e.target.value)}
                                        style={{ minWidth: '140px' }}
                                    >
                                        <option value="all">All Blocks</option>
                                        {blockOptions.map(block => (
                                            <option key={block} value={block}>{block}</option>
                                        ))}
                                    </select>
                                    <select
                                        className="form-select form-select-sm"
                                        value={typeFilter}
                                        onChange={(e) => setTypeFilter(e.target.value)}
                                        style={{ minWidth: '140px' }}
                                    >
                                        <option value="all">All Types</option>
                                        {typeOptions.map(type => (
                                            <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            {loading ? (
                                <HostelPreloader
                                    title="Loading occupancy summary"
                                    subtitle="Compiling block and room type totals."
                                />
                            ) : (
                                <div className="table-responsive">
                                    <table className="table align-middle small" style={{ borderCollapse: 'separate', borderSpacing: '0 10px', marginBottom: 0 }}>
                                        <thead>
                                            <tr className="text-white text-uppercase fw-bold" style={{ background: headerGradient, letterSpacing: '0.08em', fontSize: '0.72rem' }}>
                                                <th className="py-2 px-3 border-0 rounded-start" style={{ backgroundColor: 'transparent', color: 'white' }}>Block</th>
                                                <th className="py-2 px-3 border-0" style={{ backgroundColor: 'transparent', color: 'white' }}>Type</th>
                                                <th className="py-2 px-3 border-0 text-center" style={{ backgroundColor: 'transparent', color: 'white' }}>Total</th>
                                                <th className="py-2 px-3 border-0 text-center" style={{ backgroundColor: 'transparent', color: 'white' }}>Used</th>
                                                <th className="py-2 px-3 border-0 text-center rounded-end" style={{ backgroundColor: 'transparent', color: 'white' }}>Free</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredSummary.map((row, idx) => (
                                                <tr key={idx} style={{ background: rowBg }}>
                                                    <td className="fw-bold rounded-start" style={{ boxShadow: rowShadow, whiteSpace: 'nowrap' }}>{row.block_name}</td>
                                                    <td style={{ boxShadow: rowShadow, whiteSpace: 'nowrap' }}>{row.room_type?.replace(/_/g, ' ')}</td>
                                                    <td className="text-center" style={{ boxShadow: rowShadow }}>{row.total_beds}</td>
                                                    <td className="text-center fw-bold" style={{ color: '#b42318', boxShadow: rowShadow }}>{row.occupied_beds}</td>
                                                    <td className="text-center fw-bold rounded-end" style={{ color: '#027a48', boxShadow: rowShadow }}>{row.available_beds}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {!loading && filteredSummary.length === 0 && (
                                        <div className="text-center small text-muted py-3">No records match these filters.</div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="col-12">
                        <div className="students-section-shell card card-soft h-100" style={{ borderRadius: '18px', border: '1px solid rgba(32, 58, 67, 0.1)' }}>
                            <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-3">
                                <div>
                                    <h5 className="section-title mb-1" style={{ fontSize: '1.1rem' }}>Resident Details</h5>
                                    <div className="small text-muted">Single-line rows with quick filters.</div>
                                </div>
                                <div className="d-flex gap-2">
                                    <select
                                        className="form-select form-select-sm"
                                        value={residentBlockFilter}
                                        onChange={(e) => setResidentBlockFilter(e.target.value)}
                                        style={{ minWidth: '150px' }}
                                    >
                                        <option value="all">All Blocks</option>
                                        {residentBlockOptions.map(block => (
                                            <option key={block} value={block}>{block}</option>
                                        ))}
                                    </select>
                                    <select
                                        className="form-select form-select-sm"
                                        value={residentTypeFilter}
                                        onChange={(e) => setResidentTypeFilter(e.target.value)}
                                        style={{ minWidth: '150px' }}
                                    >
                                        <option value="all">All Types</option>
                                        {residentTypeOptions.map(type => (
                                            <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            {loading ? (
                                <HostelPreloader
                                    title="Loading resident details"
                                    subtitle="Fetching current hostel allocations."
                                />
                            ) : (
                                <div className="table-responsive" style={{ maxHeight: '500px' }}>
                                    <table className="table align-middle table-sm" style={{ borderCollapse: 'separate', borderSpacing: '0 10px', marginBottom: 0 }}>
                                        <thead>
                                            <tr className="text-white text-uppercase fw-bold" style={{ fontSize: '0.72rem', background: headerGradient, letterSpacing: '0.08em' }}>
                                                <th className="py-2 px-3 border-0 rounded-start" style={{ backgroundColor: 'transparent', color: 'white' }}>Student Name</th>
                                                <th className="py-2 px-3 border-0" style={{ backgroundColor: 'transparent', color: 'white' }}>Block</th>
                                                <th className="py-2 px-3 border-0" style={{ backgroundColor: 'transparent', color: 'white' }}>Room</th>
                                                <th className="py-2 px-3 border-0" style={{ backgroundColor: 'transparent', color: 'white' }}>Bed</th>
                                                <th className="py-2 px-3 border-0" style={{ backgroundColor: 'transparent', color: 'white' }}>Type</th>
                                                <th className="py-2 px-3 border-0 rounded-end" style={{ backgroundColor: 'transparent', color: 'white' }}>Allocated</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredResidents.length === 0 ? (
                                                <tr><td colSpan="6" className="text-center py-4">No active residents in this session.</td></tr>
                                            ) : (
                                                filteredResidents.map((res, idx) => (
                                                    <tr key={idx} style={{ background: rowBg }}>
                                                        <td className="fw-bold rounded-start" style={{ boxShadow: rowShadow, whiteSpace: 'nowrap' }}>{res.student_name}</td>
                                                        <td style={{ boxShadow: rowShadow, whiteSpace: 'nowrap' }}>{res.block_name}</td>
                                                        <td style={{ boxShadow: rowShadow, whiteSpace: 'nowrap' }}>{res.room_no}</td>
                                                        <td style={{ boxShadow: rowShadow, whiteSpace: 'nowrap' }}>{res.bed_no}</td>
                                                        <td style={{ boxShadow: rowShadow, whiteSpace: 'nowrap' }}>{res.room_type?.replace(/_/g, ' ')}</td>
                                                        <td className="rounded-end" style={{ boxShadow: rowShadow, whiteSpace: 'nowrap' }}>{new Date(res.allocated_at).toLocaleDateString('en-GB')}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                    {!loading && filteredResidents.length === 0 && residents.length > 0 && (
                                        <div className="text-center small text-muted py-3">No records match these filters.</div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </HostelShell>
    );
}
