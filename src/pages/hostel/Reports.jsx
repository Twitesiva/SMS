import { useEffect, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import HostelShell from '../../components/HostelShell';
import HostelPreloader from '../../components/HostelPreloader';
import { toast } from 'react-toastify';

export default function HostelReports() {
    const [residents, setResidents] = useState([]);
    const [years, setYears] = useState([]);
    const [selectedYear, setSelectedYear] = useState('');
    const [residentBlockFilter, setResidentBlockFilter] = useState('all');
    const [residentRoomFilter, setResidentRoomFilter] = useState('all');
    const [residentFloorFilter, setResidentFloorFilter] = useState('all');
    const [residentTypeFilter, setResidentTypeFilter] = useState('all');
    const [loading, setLoading] = useState(false);
    const [selectedResident, setSelectedResident] = useState(null);

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
        const residentsRes = await supabase.from('v_hostel_current_students').select('*').eq('academic_year', year);
        if (residentsRes.error) toast.error(residentsRes.error.message);
        else setResidents(residentsRes.data || []);
        
        setLoading(false);
    };

    const downloadCSV = () => {
        if (residents.length === 0) return;
        const headers = ['Student ID', 'Student Name', 'Block', 'Room No', 'Floor', 'Bed No', 'Room Type', 'Allocated At'];
        const rows = residents.map(r => [
            r.student_id,
            r.student_name,
            r.block_name,
            r.room_no,
            r.floor_no ?? r.floor ?? '',
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

    const residentBlockOptions = Array.from(new Set(residents.map(item => item.block_name).filter(Boolean)));
    const residentRoomOptions = Array.from(new Set(residents.map(item => item.room_no).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
    const residentFloorOptions = Array.from(new Set(residents.map(item => item.floor_no ?? item.floor).filter(item => item !== null && item !== undefined && item !== '')))
        .sort((a, b) => {
            const numA = Number(a);
            const numB = Number(b);
            const aIsNum = Number.isFinite(numA);
            const bIsNum = Number.isFinite(numB);
            if (aIsNum && bIsNum) return numA - numB;
            if (aIsNum) return -1;
            if (bIsNum) return 1;
            return String(a).localeCompare(String(b));
        });
    const residentTypeOptions = Array.from(new Set(residents.map(item => item.room_type).filter(Boolean)));

    const filteredResidents = residents.filter(item => {
        const blockMatch = residentBlockFilter === 'all' || item.block_name === residentBlockFilter;
        const roomMatch = residentRoomFilter === 'all' || String(item.room_no) === residentRoomFilter;
        const floorValue = item.floor_no ?? item.floor;
        const floorMatch = residentFloorFilter === 'all' || String(floorValue) === residentFloorFilter;
        const typeMatch = residentTypeFilter === 'all' || item.room_type === residentTypeFilter;
        return blockMatch && roomMatch && floorMatch && typeMatch;
    });

    const headerGradient = 'linear-gradient(180deg, #606c88 0%, #3f4c6b 50%, #606c88 100%)';
    const rowShadow = '0 8px 18px rgba(15, 32, 39, 0.08)';
    const rowBg = '#f6f9fc';
    const filterRowStyle = {
        display: 'flex',
        gap: '10px',
        alignItems: 'center',
        flexWrap: 'wrap'
    };
    const filterSelectStyle = { minWidth: '160px', flex: '1 1 160px' };
    const formatFloorLabel = (value) => {
        if (value === null || value === undefined || value === '') return '-';
        const floorNumber = Number(value);
        if (!Number.isFinite(floorNumber)) return String(value);
        return floorNumber === 0 ? 'Ground' : `Floor ${floorNumber}`;
    };
    const formatRoomType = (value) => value?.replace(/_/g, ' ') || '-';
    const closeResidentModal = () => setSelectedResident(null);
    const modalHeaderStyle = { background: headerGradient, color: '#ffffff' };

    return (
        <HostelShell brandTitle="HOSTEL MANAGEMENT">
            <div className="desktop-container">
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <h4 className="mb-0">Hostel Reports & Summary</h4>
                    <button className="btn btn-sm btn-outline-primary" onClick={downloadCSV} disabled={residents.length === 0}>
                        <i className="bi bi-download me-1"></i> Export CSV
                    </button>
                </div>

                <div className="row g-4">
                    <div className="col-12">
                        <div className="students-section-shell card card-soft h-100" style={{ borderRadius: '18px', border: '1px solid rgba(32, 58, 67, 0.1)' }}>
                            <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-3">
                                <div>
                                    <h5
                                        className="section-title mb-1"
                                        style={{
                                            fontSize: '1.1rem',
                                            color: '#ffffff',
                                            background: headerGradient,
                                            padding: '6px 14px',
                                            borderRadius: '999px',
                                            display: 'inline-flex',
                                            alignItems: 'center'
                                        }}
                                    >
                                        Resident Details
                                    </h5>
                                </div>
                                <div style={filterRowStyle}>
                                    <select
                                        className="form-select form-select-sm"
                                        value={selectedYear}
                                        onChange={(e) => setSelectedYear(e.target.value)}
                                        style={filterSelectStyle}
                                    >
                                        {years.map(y => <option key={y.academic_year} value={y.academic_year}>{y.academic_year}</option>)}
                                    </select>
                                    <select
                                        className="form-select form-select-sm"
                                        value={residentBlockFilter}
                                        onChange={(e) => setResidentBlockFilter(e.target.value)}
                                        style={filterSelectStyle}
                                    >
                                        <option value="all">All Blocks</option>
                                        {residentBlockOptions.map(block => (
                                            <option key={block} value={block}>{block}</option>
                                        ))}
                                    </select>
                                    <select
                                        className="form-select form-select-sm"
                                        value={residentFloorFilter}
                                        onChange={(e) => setResidentFloorFilter(e.target.value)}
                                        style={filterSelectStyle}
                                    >
                                        <option value="all">All Floors</option>
                                        {residentFloorOptions.map(floor => (
                                            <option key={floor} value={String(floor)}>{formatFloorLabel(floor)}</option>
                                        ))}
                                    </select>
                                    <select
                                        className="form-select form-select-sm"
                                        value={residentRoomFilter}
                                        onChange={(e) => setResidentRoomFilter(e.target.value)}
                                        style={filterSelectStyle}
                                    >
                                        <option value="all">All Rooms</option>
                                        {residentRoomOptions.map(room => (
                                            <option key={room} value={String(room)}>{room}</option>
                                        ))}
                                    </select>
                                    <select
                                        className="form-select form-select-sm"
                                        value={residentTypeFilter}
                                        onChange={(e) => setResidentTypeFilter(e.target.value)}
                                        style={filterSelectStyle}
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
                                                <th className="py-2 px-3 border-0" style={{ backgroundColor: 'transparent', color: 'white' }}>Floor</th>
                                                <th className="py-2 px-3 border-0" style={{ backgroundColor: 'transparent', color: 'white' }}>Bed</th>
                                                <th className="py-2 px-3 border-0" style={{ backgroundColor: 'transparent', color: 'white' }}>Type</th>
                                                <th className="py-2 px-3 border-0 rounded-end" style={{ backgroundColor: 'transparent', color: 'white' }}>Allocated</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredResidents.length === 0 ? (
                                                <tr><td colSpan="7" className="text-center py-4">No active residents in this session.</td></tr>
                                            ) : (
                                                filteredResidents.map((res, idx) => (
                                                    <tr
                                                        key={idx}
                                                        style={{ background: rowBg, cursor: 'pointer' }}
                                                        onClick={() => setSelectedResident(res)}
                                                    >
                                                        <td className="fw-bold rounded-start" style={{ boxShadow: rowShadow, whiteSpace: 'nowrap' }}>{res.student_name}</td>
                                                        <td style={{ boxShadow: rowShadow, whiteSpace: 'nowrap' }}>{res.block_name}</td>
                                                        <td style={{ boxShadow: rowShadow, whiteSpace: 'nowrap' }}>{res.room_no}</td>
                                                        <td style={{ boxShadow: rowShadow, whiteSpace: 'nowrap' }}>{formatFloorLabel(res.floor_no ?? res.floor)}</td>
                                                        <td style={{ boxShadow: rowShadow, whiteSpace: 'nowrap' }}>{res.bed_no}</td>
                                                        <td style={{ boxShadow: rowShadow, whiteSpace: 'nowrap' }}>{formatRoomType(res.room_type)}</td>
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

            {selectedResident && (
                <div
                    className="modal d-block hostel-resident-modal"
                    style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }}
                    tabIndex="-1"
                    role="dialog"
                    onClick={closeResidentModal}
                >
                    <div className="modal-dialog modal-lg modal-dialog-centered" role="document" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-content border-0 shadow" style={{ overflow: 'hidden' }}>
                            <div className="modal-header text-white" style={modalHeaderStyle}>
                                <div>
                                    <h5
                                        className="modal-title fw-bold mb-0 text-white"
                                        style={{ textTransform: 'uppercase', color: '#ffffff' }}
                                    >
                                        Resident Details
                                    </h5>
                                </div>
                                <button type="button" className="btn-close btn-close-white" onClick={closeResidentModal} aria-label="Close"></button>
                            </div>
                            <div className="modal-body" style={{ background: '#f8fafc' }}>
                                <div className="row g-3">
                                    <div className="col-md-6">
                                        <div className="p-3 bg-white border rounded-3 h-100">
                                            <div className="text-muted small text-uppercase">Student Name</div>
                                            <div className="fw-semibold">{selectedResident.student_name || '-'}</div>
                                        </div>
                                    </div>
                                    <div className="col-md-6">
                                        <div className="p-3 bg-white border rounded-3 h-100">
                                            <div className="text-muted small text-uppercase">Student ID</div>
                                            <div className="fw-semibold">{selectedResident.student_id || '-'}</div>
                                        </div>
                                    </div>
                                    <div className="col-md-6">
                                        <div className="p-3 bg-white border rounded-3 h-100">
                                            <div className="text-muted small text-uppercase">Academic Year</div>
                                            <div className="fw-semibold">{selectedResident.academic_year || selectedYear || '-'}</div>
                                        </div>
                                    </div>
                                    <div className="col-md-6">
                                        <div className="p-3 bg-white border rounded-3 h-100">
                                            <div className="text-muted small text-uppercase">Block</div>
                                            <div className="fw-semibold">{selectedResident.block_name || '-'}</div>
                                        </div>
                                    </div>
                                    <div className="col-md-4">
                                        <div className="p-3 bg-white border rounded-3 h-100">
                                            <div className="text-muted small text-uppercase">Room</div>
                                            <div className="fw-semibold">{selectedResident.room_no || '-'}</div>
                                        </div>
                                    </div>
                                    <div className="col-md-4">
                                        <div className="p-3 bg-white border rounded-3 h-100">
                                            <div className="text-muted small text-uppercase">Floor</div>
                                            <div className="fw-semibold">{formatFloorLabel(selectedResident.floor_no ?? selectedResident.floor)}</div>
                                        </div>
                                    </div>
                                    <div className="col-md-4">
                                        <div className="p-3 bg-white border rounded-3 h-100">
                                            <div className="text-muted small text-uppercase">Bed</div>
                                            <div className="fw-semibold">{selectedResident.bed_no || '-'}</div>
                                        </div>
                                    </div>
                                    <div className="col-md-6">
                                        <div className="p-3 bg-white border rounded-3 h-100">
                                            <div className="text-muted small text-uppercase">Room Type</div>
                                            <div className="fw-semibold">{formatRoomType(selectedResident.room_type)}</div>
                                        </div>
                                    </div>
                                    <div className="col-md-6">
                                        <div className="p-3 bg-white border rounded-3 h-100">
                                            <div className="text-muted small text-uppercase">Allocated</div>
                                            <div className="fw-semibold">
                                                {selectedResident.allocated_at ? new Date(selectedResident.allocated_at).toLocaleDateString('en-GB') : '-'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer bg-light">
                                <button type="button" className="btn btn-secondary" onClick={closeResidentModal}>Close</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </HostelShell>
    );
}
