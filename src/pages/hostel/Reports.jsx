import { useEffect, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import HostelShell from '../../components/HostelShell';
import HostelPreloader from '../../components/HostelPreloader';
import { toast } from 'react-toastify';

export default function HostelReports() {
    const [residents, setResidents] = useState([]);
    const [allResidents, setAllResidents] = useState([]);
    const [allCapacity, setAllCapacity] = useState([]);
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
        }
    };

    useEffect(() => {
        if (selectedYear) fetchResidentsForYear(selectedYear);
    }, [selectedYear]);

    useEffect(() => {
        if (!selectedYear) return;
        fetchFilteredResidents();
    }, [selectedYear, residentBlockFilter, residentRoomFilter, residentFloorFilter, residentTypeFilter, allResidents]);

    useEffect(() => {
        setResidentBlockFilter('all');
        setResidentRoomFilter('all');
        setResidentFloorFilter('all');
        setResidentTypeFilter('all');
    }, [selectedYear]);

    const fetchResidentsForYear = async (year) => {
        setLoading(true);
        const residentsRes = await supabase.from('v_hostel_current_students').select('*').eq('academic_year', year);
        if (residentsRes.error) toast.error(residentsRes.error.message);
        else {
            const data = residentsRes.data || [];
            setAllResidents(data);
            setResidents(data);
        }
        await fetchCapacityForYear(year);
        setLoading(false);
    };

    const fetchCapacityForYear = async (year) => {
        const { data, error } = await supabase
            .from('hostel_room_year_mapping')
            .select(`
                floor_no,
                hostel_blocks!inner (block_name),
                hostel_rooms!inner (bed_count, room_no, room_type)
            `)
            .eq('academic_year', year)
            .eq('is_active', true);

        if (error) {
            console.error('Error fetching capacity:', error);
            toast.error("Failed to fetch capacity data");
        } else {
            setAllCapacity(data || []);
        }
    };

    const fetchFilteredResidents = async () => {
        if (!selectedYear) return;
        const isDefaultFilters = residentBlockFilter === 'all'
            && residentRoomFilter === 'all'
            && residentFloorFilter === 'all'
            && residentTypeFilter === 'all';

        if (isDefaultFilters) {
            setResidents(allResidents);
            return;
        }

        setLoading(true);
        let query = supabase.from('v_hostel_current_students').select('*').eq('academic_year', selectedYear);

        if (residentBlockFilter !== 'all') query = query.eq('block_name', residentBlockFilter);
        if (residentRoomFilter !== 'all') query = query.eq('room_no', residentRoomFilter);
        if (residentTypeFilter !== 'all') query = query.eq('room_type', residentTypeFilter);

        const { data, error } = await query;
        if (error) toast.error(error.message);
        else setResidents(data || []);
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

    const normalizeValue = (value) => String(value ?? '').trim();
    const residentBlockOptions = Array.from(new Set(allResidents.map(item => item.block_name).filter(Boolean)));
    const residentRoomOptions = Array.from(new Set(allResidents.map(item => item.room_no).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
    const residentFloorOptions = Array.from(new Set(allResidents.map(item => item.floor_no ?? item.floor).filter(item => item !== null && item !== undefined && item !== '')))
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
    const residentTypeOptions = Array.from(new Set(allResidents.map(item => item.room_type).filter(Boolean)));

    useEffect(() => {
        if (residentBlockFilter !== 'all' && !residentBlockOptions.includes(residentBlockFilter)) setResidentBlockFilter('all');
        if (residentRoomFilter !== 'all' && !residentRoomOptions.map(String).includes(residentRoomFilter)) setResidentRoomFilter('all');
        if (residentFloorFilter !== 'all' && !residentFloorOptions.map(String).includes(residentFloorFilter)) setResidentFloorFilter('all');
        if (residentTypeFilter !== 'all' && !residentTypeOptions.includes(residentTypeFilter)) setResidentTypeFilter('all');
    }, [residentBlockOptions, residentRoomOptions, residentFloorOptions, residentTypeOptions, residentBlockFilter, residentRoomFilter, residentFloorFilter, residentTypeFilter]);

    const filteredResidents = residents.filter(item => {
        const blockMatch = residentBlockFilter === 'all' || normalizeValue(item.block_name) === normalizeValue(residentBlockFilter);
        const roomMatch = residentRoomFilter === 'all' || normalizeValue(item.room_no) === normalizeValue(residentRoomFilter);
        const floorValue = item.floor_no ?? item.floor;
        const floorMatch = residentFloorFilter === 'all' || normalizeValue(floorValue) === normalizeValue(residentFloorFilter);
        const typeMatch = residentTypeFilter === 'all' || normalizeValue(item.room_type) === normalizeValue(residentTypeFilter);
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
                            <div className="p-4">
                                <div className="mb-4">
                                    <div
                                        className="d-flex align-items-center p-3"
                                        style={{
                                            background: headerGradient,
                                            borderRadius: '14px',
                                            color: '#ffffff'
                                        }}
                                    >
                                        <h5 className="section-title mb-0 text-white" style={{ fontSize: '1.1rem' }}>
                                            Resident Details
                                        </h5>
                                    </div>
                                </div>

                                <div className="row g-3 mb-4">
                                    <div className="col-md-2">
                                        <label className="form-label small text-muted text-uppercase fw-bold">Academic Year</label>
                                        <select
                                            className="form-select"
                                            value={selectedYear}
                                            onChange={(e) => setSelectedYear(e.target.value)}
                                        >
                                            <option value="">Select Year</option>
                                            {years.map(y => <option key={y.academic_year} value={y.academic_year}>{y.academic_year}</option>)}
                                        </select>
                                    </div>
                                    <div className="col-md-2">
                                        <label className="form-label small text-muted text-uppercase fw-bold">Block</label>
                                        <select
                                            className="form-select"
                                            value={residentBlockFilter}
                                            onChange={(e) => setResidentBlockFilter(e.target.value)}
                                        >
                                            <option value="all">All Blocks</option>
                                            {residentBlockOptions.map(block => (
                                                <option key={block} value={block}>{block}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-md-2">
                                        <label className="form-label small text-muted text-uppercase fw-bold">Floor</label>
                                        <select
                                            className="form-select"
                                            value={residentFloorFilter}
                                            onChange={(e) => setResidentFloorFilter(e.target.value)}
                                        >
                                            <option value="all">All Floors</option>
                                            {residentFloorOptions.map(floor => (
                                                <option key={floor} value={String(floor)}>{formatFloorLabel(floor)}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-md-2">
                                        <label className="form-label small text-muted text-uppercase fw-bold">Room</label>
                                        <select
                                            className="form-select"
                                            value={residentRoomFilter}
                                            onChange={(e) => setResidentRoomFilter(e.target.value)}
                                        >
                                            <option value="all">All Rooms</option>
                                            {residentRoomOptions.map(room => (
                                                <option key={room} value={String(room)}>{room}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-md-3">
                                        <label className="form-label small text-muted text-uppercase fw-bold">Room Type</label>
                                        <select
                                            className="form-select"
                                            value={residentTypeFilter}
                                            onChange={(e) => setResidentTypeFilter(e.target.value)}
                                        >
                                            <option value="all">All Types</option>
                                            {residentTypeOptions.map(type => (
                                                <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                {(() => {
                                    // Capacity Filtering Logic
                                    const filteredCapacity = allCapacity.filter(item => {
                                        const blockName = item.hostel_blocks?.block_name;
                                        const roomNo = item.hostel_rooms?.room_no;
                                        const roomType = item.hostel_rooms?.room_type;
                                        const floorVal = item.floor_no;

                                        const blockMatch = residentBlockFilter === 'all' || normalizeValue(blockName) === normalizeValue(residentBlockFilter);
                                        const roomMatch = residentRoomFilter === 'all' || normalizeValue(roomNo) === normalizeValue(residentRoomFilter);
                                        const floorMatch = residentFloorFilter === 'all' || normalizeValue(floorVal) === normalizeValue(residentFloorFilter);
                                        const typeMatch = residentTypeFilter === 'all' || normalizeValue(roomType) === normalizeValue(residentTypeFilter);

                                        return blockMatch && roomMatch && floorMatch && typeMatch;
                                    });

                                    const totalBeds = filteredCapacity.reduce((sum, item) => sum + (item.hostel_rooms?.bed_count || 0), 0);
                                    const reservedBeds = filteredResidents.length;
                                    const availableBeds = Math.max(0, totalBeds - reservedBeds);

                                    const statRowStyle = {
                                        display: 'flex',
                                        alignItems: 'center',
                                        fontSize: '1rem', // Increased font size
                                        color: '#000000', // Black color
                                        fontWeight: 'bold',
                                        marginBottom: '8px'
                                    };

                                    const labelStyle = {
                                        minWidth: '150px',
                                        textTransform: 'uppercase'
                                    };

                                    return (
                                        <div className="d-flex flex-column gap-1 mb-4">
                                            <div style={statRowStyle}>
                                                <div style={labelStyle}>Total Beds</div>
                                                <div>: {totalBeds}</div>
                                            </div>
                                            <div style={statRowStyle}>
                                                <div style={labelStyle}>Reserved Beds</div>
                                                <div>: {reservedBeds}</div>
                                            </div>
                                            <div style={statRowStyle}>
                                                <div style={labelStyle}>Available Beds</div>
                                                <div>: {availableBeds}</div>
                                            </div>
                                        </div>
                                    );
                                })()}
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
                                            <tr className="text-white text-uppercase fw-bold" style={{ background: headerGradient, fontSize: '1.1rem' }}>
                                                <th className="py-3 px-3 border-0 rounded-start" style={{ backgroundColor: 'transparent', color: 'white' }}>Student Name</th>
                                                <th className="py-3 px-3 border-0" style={{ backgroundColor: 'transparent', color: 'white' }}>Block</th>
                                                <th className="py-3 px-3 border-0" style={{ backgroundColor: 'transparent', color: 'white' }}>Room</th>
                                                <th className="py-3 px-3 border-0" style={{ backgroundColor: 'transparent', color: 'white' }}>Floor</th>
                                                <th className="py-3 px-3 border-0" style={{ backgroundColor: 'transparent', color: 'white' }}>Bed</th>
                                                <th className="py-3 px-3 border-0" style={{ backgroundColor: 'transparent', color: 'white' }}>Type</th>
                                                <th className="py-3 px-3 border-0 rounded-end" style={{ backgroundColor: 'transparent', color: 'white' }}>Allocated</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredResidents.length === 0 ? (
                                                <tr>
                                                    <td colSpan="7" className="text-center py-4">
                                                        {!selectedYear ? "Please select an academic year." : "No active residents in this session."}
                                                    </td>
                                                </tr>
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
                        <div className="modal-content border-0 shadow-lg">
                            <div className="modal-header p-3" style={modalHeaderStyle}>
                                <h5 className="modal-title fw-bold text-uppercase text-white" style={{ letterSpacing: '1px' }}>Resident Details</h5>
                                <button type="button" className="btn-close btn-close-white" onClick={closeResidentModal} aria-label="Close"></button>
                            </div>
                            <div className="modal-body p-4 bg-white">
                                {/* Student Profile Section */}
                                <div className="mb-4">
                                    <h6 className="text-uppercase text-muted fw-bold mb-3 small" style={{ letterSpacing: '1px' }}>Student Profile</h6>
                                    <div className="bg-light rounded p-4 border relative">
                                        <div className="d-flex flex-column gap-3">
                                            <div className="d-flex align-items-center">
                                                <small className="text-muted text-uppercase fw-bold" style={{ width: '130px', fontSize: '0.85rem' }}>Student Name</small>
                                                <span className="fw-bold text-dark fs-6">: {selectedResident.student_name || '-'}</span>
                                            </div>
                                            <div className="d-flex align-items-center">
                                                <small className="text-muted text-uppercase fw-bold" style={{ width: '130px', fontSize: '0.85rem' }}>Student ID</small>
                                                <span className="fw-bold text-dark fs-6">: {selectedResident.student_id || '-'}</span>
                                            </div>
                                            <div className="d-flex align-items-center">
                                                <small className="text-muted text-uppercase fw-bold" style={{ width: '130px', fontSize: '0.85rem' }}>Academic Year</small>
                                                <span className="fw-bold text-dark fs-6">: {selectedResident.academic_year || selectedYear || '-'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Allocation Details Section */}
                                <div className="mb-0">
                                    <h6 className="text-uppercase text-muted fw-bold mb-3 small" style={{ letterSpacing: '1px' }}>Allocation Details</h6>
                                    <div className="bg-light rounded p-4 border relative">
                                        <div className="d-flex flex-column gap-3">
                                            <div className="d-flex align-items-center">
                                                <small className="text-muted text-uppercase fw-bold" style={{ width: '130px', fontSize: '0.85rem' }}>Block</small>
                                                <span className="fw-bold text-dark fs-6">: {selectedResident.block_name || '-'}</span>
                                            </div>
                                            <div className="d-flex align-items-center">
                                                <small className="text-muted text-uppercase fw-bold" style={{ width: '130px', fontSize: '0.85rem' }}>Floor</small>
                                                <span className="fw-bold text-dark fs-6">: {formatFloorLabel(selectedResident.floor_no ?? selectedResident.floor)}</span>
                                            </div>
                                            <div className="d-flex align-items-center">
                                                <small className="text-muted text-uppercase fw-bold" style={{ width: '130px', fontSize: '0.85rem' }}>Room</small>
                                                <span className="fw-bold text-dark fs-6">: {selectedResident.room_no || '-'}</span>
                                            </div>
                                            <div className="d-flex align-items-center">
                                                <small className="text-muted text-uppercase fw-bold" style={{ width: '130px', fontSize: '0.85rem' }}>Bed</small>
                                                <span className="fw-bold text-dark fs-6">: {selectedResident.bed_no || '-'}</span>
                                            </div>
                                            <div className="d-flex align-items-center">
                                                <small className="text-muted text-uppercase fw-bold" style={{ width: '130px', fontSize: '0.85rem' }}>Room Type</small>
                                                <span className="fw-bold text-dark fs-6">: {formatRoomType(selectedResident.room_type)}</span>
                                            </div>
                                            <div className="d-flex align-items-center">
                                                <small className="text-muted text-uppercase fw-bold" style={{ width: '130px', fontSize: '0.85rem' }}>Allocated Date</small>
                                                <span className="fw-bold text-dark fs-6">: {selectedResident.allocated_at ? new Date(selectedResident.allocated_at).toLocaleDateString('en-GB') : '-'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer bg-light border-0">
                                <button type="button" className="btn btn-secondary px-4" onClick={closeResidentModal}>Close</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </HostelShell>
    );
}
