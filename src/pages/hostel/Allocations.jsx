import { useEffect, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import HostelShell from '../../components/HostelShell';
import ConfirmationModal from '../../components/ConfirmationModal';
import HostelPreloader from '../../components/HostelPreloader';
import { toast } from 'react-toastify';

export default function HostelAllocations() {

    const [searching, setSearching] = useState(false);
    const [student, setStudent] = useState(null);
    const [currentAllocation, setCurrentAllocation] = useState(null);

    const [showAllocateModal, setShowAllocateModal] = useState(false);
    const [showChangeModal, setShowChangeModal] = useState(false);
    const [availableBeds, setAvailableBeds] = useState([]);
    const [years, setYears] = useState([]);

    const [bookingForm, setBookingForm] = useState({ academic_year: '', bed_id: '' });
    const [filters, setFilters] = useState({ block_id: '', floor_no: '', room_type: '' });
    const [blocks, setBlocks] = useState([]);

    // New states for tabs and eligible students
    const [eligibleStudents, setEligibleStudents] = useState([]);
    const [loadingEligible, setLoadingEligible] = useState(false);
    const [eligibleSearch, setEligibleSearch] = useState('');
    const [eligibleHostelType, setEligibleHostelType] = useState('');
    const [eligibleYear, setEligibleYear] = useState('');
    const [eligibleGender, setEligibleGender] = useState('');
    const [showAllEligible, setShowAllEligible] = useState(false);

    // Track allocated students
    const [availableFloors, setAvailableFloors] = useState([]);

    // Track allocated students
    const [allocationMap, setAllocationMap] = useState({});

    useEffect(() => {
        fetchInitialData();
    }, []);
    const fetchInitialData = async () => {
        const [yearsData, blocksData] = await Promise.all([
            supabase.from('academic_year').select('academic_year').order('academic_year', { ascending: false }),
            supabase.from('hostel_blocks').select('*').order('block_name')
        ]);
        setYears(yearsData.data || []);
        setBlocks(blocksData.data || []);
        if (yearsData.data?.[0]) setBookingForm(prev => ({ ...prev, academic_year: yearsData.data[0].academic_year }));

        // Fetch eligible students initially
        fetchEligibleStudents();
    };

    const fetchEligibleStudents = async () => {
        setLoadingEligible(true);
        const { data, error } = await supabase.from('v_hostel_payment_eligible_students').select('*').order('full_name');
        if (error) {
            toast.error('Failed to load eligible students');
        } else {
            let enrichedData = data || [];

            if (enrichedData.length > 0) {
                const ids = enrichedData.map(s => s.student_id);

                // Fetch year of study for these students
                const { data: studentDetails } = await supabase
                    .from('students')
                    .select('id, year_of_study')
                    .in('id', ids);

                const yearMap = {};
                studentDetails?.forEach(s => {
                    yearMap[s.id] = s.year_of_study;
                });

                enrichedData = enrichedData.map(s => ({
                    ...s,
                    year_of_study: yearMap[s.student_id]
                }));

                const { data: allocs } = await supabase
                    .from('hostel_allocations')
                    .select('student_id, hostel_beds(hostel_rooms(room_no))')
                    .in('student_id', ids)
                    .eq('status', 'ACTIVE');

                const newMap = {};
                allocs?.forEach(a => {
                    const roomNo = a.hostel_beds?.hostel_rooms?.room_no;
                    if (roomNo) newMap[a.student_id] = `Room ${roomNo}`;
                });
                setAllocationMap(newMap);
            }
            setEligibleStudents(enrichedData);
        }
        setLoadingEligible(false);
    };



    const fetchCurrentAllocation = async (studentId) => {
        const { data: alloc } = await supabase.from('hostel_allocations')
            .select('*, hostel_beds(bed_no, hostel_rooms(room_no, floor_no, room_type, hostel_blocks(block_name)))')
            .eq('student_id', studentId)
            .eq('status', 'ACTIVE')
            .maybeSingle();

        setCurrentAllocation(alloc);
    };

    const fetchAvailableBeds = async () => {
        if (!bookingForm.academic_year) return;

        // 1. Fetch Rooms matching filters (EXCEPT FLOOR) to get all potential floors
        let roomQuery = supabase.from('hostel_rooms')
            .select(`
                *,
                hostel_blocks!inner ( * ),
                hostel_beds ( * )
            `)
            .order('room_no');

        if (filters.block_id) roomQuery = roomQuery.eq('block_id', filters.block_id);
        // REMOVED: if (filters.floor_no !== '') roomQuery = roomQuery.eq('floor_no', Number(filters.floor_no)); 
        if (filters.room_type) roomQuery = roomQuery.eq('room_type', filters.room_type);

        if (student) {
            const gender = student.gender?.toUpperCase().startsWith('M') ? 'BOYS' : 'GIRLS';
            roomQuery = roomQuery.eq('hostel_blocks.gender', gender);
        }

        const { data: rooms, error: roomError } = await roomQuery;
        if (roomError) {
            toast.error(roomError.message);
            return;
        }

        // 2. Fetch allocations for this year to map occupancy
        const { data: allocations, error: allocError } = await supabase.from('hostel_allocations')
            .select('bed_id')
            .eq('academic_year', bookingForm.academic_year)
            .eq('status', 'ACTIVE');

        if (allocError) {
            toast.error(allocError.message);
            return;
        }

        const occupiedBedIds = new Set(allocations.map(a => a.bed_id));

        // 3. Process rooms to include isOccupied flag for each bed
        const processedRooms = rooms.map(room => ({
            ...room,
            beds: (room.hostel_beds || [])
                .map(bed => ({
                    ...bed,
                    isOccupied: occupiedBedIds.has(bed.id)
                }))
                .sort((a, b) => String(a.bed_no).localeCompare(String(b.bed_no), undefined, { numeric: true }))
        }));

        // 4. Determine available floors from ALL matched rooms
        const uniqueFloors = [...new Set(processedRooms.map(r => r.floor_no))].sort((a, b) => a - b);
        setAvailableFloors(uniqueFloors);

        // 5. Filter rooms by selected floor for display
        let displayedRooms = processedRooms;
        if (filters.floor_no !== '') {
            displayedRooms = processedRooms.filter(r => r.floor_no === Number(filters.floor_no));
        }

        setAvailableBeds(displayedRooms);

        // Auto-select floor if only one floor is available
        if (uniqueFloors.length === 1 && filters.floor_no === '') {
            setFilters(prev => ({ ...prev, floor_no: uniqueFloors[0] }));
        }
    };

    useEffect(() => {
        if (showAllocateModal || showChangeModal) fetchAvailableBeds();
    }, [showAllocateModal, showChangeModal, filters, bookingForm.academic_year]);

    const handleAllocate = async () => {
        if (!bookingForm.academic_year) {
            toast.error('Please select an academic year.');
            return;
        }
        if (!bookingForm.bed_id) {
            toast.error('Please select a bed.');
            return;
        }
        setSearching(true);
        const { data, error } = await supabase.rpc('allocate_hostel_bed', {
            p_student_id: student.id,
            p_bed_id: bookingForm.bed_id,
            p_academic_year: bookingForm.academic_year
        });

        if (error) toast.error(error.message);
        else {
            toast.success('Bed allocated successfully');
            setShowAllocateModal(false);
            fetchCurrentAllocation(student.id);
        }
        setSearching(false);
    };

    const handleChangeBed = async () => {
        if (!bookingForm.academic_year) {
            toast.error('Please select an academic year.');
            return;
        }
        if (!bookingForm.bed_id) {
            toast.error('Please select a bed.');
            return;
        }
        setSearching(true);
        const { data, error } = await supabase.rpc('change_hostel_bed', {
            p_student_id: student.id,
            p_new_bed_id: bookingForm.bed_id,
            p_academic_year: bookingForm.academic_year
        });

        if (error) toast.error(error.message);
        else {
            toast.success('Bed changed successfully');
            setShowChangeModal(false);
            fetchCurrentAllocation(student.id);
        }
        setSearching(false);
    };

    const handleVacate = async () => {
        const { error } = await supabase.rpc('vacate_hostel', { p_student_id: student.id });
        if (error) toast.error(error.message);
        else {
            toast.success('Student vacated successfully');
            fetchCurrentAllocation(student.id);
        }
    };

    const handleAutoAllocate = async () => {
        if (!bookingForm.academic_year) {
            toast.error('Please select an academic year.');
            return;
        }
        if (!confirm('Are you sure you want to auto-allocate a bed based on student payment?')) return;
        setSearching(true);
        const { data, error } = await supabase.rpc('allocate_hostel_for_paid_student', {
            p_student_id: student.id,
            p_academic_year: bookingForm.academic_year
        });

        if (error) {
            toast.error(error.message);
        } else {
            toast.success('Bed auto-allocated successfully');
            fetchCurrentAllocation(student.id);
        }
        setSearching(false);
    };

    const handleSelectEligibleStudent = async (s) => {
        // Fetch phone number and year_of_study
        const { data: studentData } = await supabase
            .from('students')
            .select('phone_number, academic_year, year_of_study')
            .eq('id', s.student_id)
            .single();

        setStudent({
            id: s.student_id,
            student_id: s.hall_ticket_no,
            full_name: s.full_name,
            gender: s.gender,
            phone_number: studentData?.phone_number || '—',
            is_hostel: true,
            hostel_type: s.hostel_type,
            year_of_study: studentData?.year_of_study
        });

        let newFilters = { room_type: s.hostel_type, floor_no: '', block_id: '' };

        if (studentData?.academic_year) {
            setBookingForm((prev) => ({ ...prev, academic_year: studentData.academic_year }));

            // Autofetch Block and Floor based on Year Mapping
            if (studentData.year_of_study) {
                const { data: mappingData } = await supabase
                    .from('hostel_room_year_mapping')
                    .select('block_id, floor_no')
                    .eq('academic_year', studentData.academic_year)
                    .eq('year_of_study', studentData.year_of_study)
                    .eq('is_active', true);

                if (mappingData && mappingData.length > 0) {
                    // Find unique blocks
                    const uniqueBlocks = [...new Set(mappingData.map(m => m.block_id))];
                    if (uniqueBlocks.length === 1) {
                        newFilters.block_id = uniqueBlocks[0];

                        // If block is unique, check for unique floors
                        const uniqueFloors = [...new Set(mappingData.map(m => m.floor_no))];
                        if (uniqueFloors.length === 1) {
                            newFilters.floor_no = uniqueFloors[0];
                        }
                    }
                }
            }
        }

        setFilters(prev => ({ ...prev, ...newFilters }));
        fetchCurrentAllocation(s.student_id);
    };

    const filteredEligibleStudents = eligibleStudents.filter(s => {
        const q = eligibleSearch.toLowerCase();
        const matchesSearch = s.full_name?.toLowerCase().includes(q) ||
            s.hall_ticket_no?.toLowerCase().includes(q);
        const matchesType = eligibleHostelType ? s.hostel_type === eligibleHostelType : true;
        const matchesYear = eligibleYear ? String(s.year_of_study) === String(eligibleYear) : true;
        const normalizedGender = String(s.gender || '').trim().toUpperCase();
        const mappedGender = normalizedGender.startsWith('M') ? 'BOYS'
            : normalizedGender.startsWith('F') ? 'GIRLS'
                : normalizedGender;
        const matchesGender = eligibleGender ? mappedGender === eligibleGender : true;

        return matchesSearch && matchesType && matchesYear && matchesGender;
    });

    const uniqueYears = [...new Set(eligibleStudents.map(s => s.year_of_study).filter(Boolean))].sort((a, b) => a - b);

    return (
        <HostelShell brandTitle="HOSTEL MANAGEMENT">
            <div className="desktop-container">
                <h4 className="mb-4">Bed Allocations</h4>

                <section className="setup-section mb-4">
                    <div className="students-section-shell card card-soft mb-4">
                        <div className="card-body">

                            <>
                                <div className="d-flex flex-column gap-3 mb-4">
                                    <div
                                        className="d-flex justify-content-between align-items-center p-3"
                                        style={{
                                            background: 'linear-gradient(180deg, #606c88 0%, #3f4c6b 50%, #606c88 100%)',
                                            borderRadius: '14px',
                                            overflow: 'hidden',
                                            margin: '0 6px'
                                        }}
                                    >
                                        <div>
                                            <h5 className="section-title mb-1 text-white" style={{ fontSize: '1.1rem' }}>ELIGIBLE STUDENTS</h5>
                                        </div>
                                        <div style={{ width: '300px' }}>
                                            <input
                                                type="search"
                                                className="form-control"
                                                placeholder="Filter by name or ID..."
                                                value={eligibleSearch}
                                                onChange={(e) => setEligibleSearch(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <div className="row g-3 px-2">
                                        <div className="col-md-4">
                                            <label className="form-label fw-bold mb-1">Hostel Type</label>
                                            <select
                                                className="form-select"
                                                value={eligibleHostelType}
                                                onChange={(e) => setEligibleHostelType(e.target.value)}
                                            >
                                                <option value="">All Types</option>
                                                <option value="AC">AC</option>
                                                <option value="NON_AC">NON AC</option>
                                            </select>
                                        </div>
                                        <div className="col-md-4">
                                            <label className="form-label fw-bold mb-1">Year of Study</label>
                                            <select
                                                className="form-select"
                                                value={eligibleYear}
                                                onChange={(e) => setEligibleYear(e.target.value)}
                                            >
                                                <option value="">All Years</option>
                                                {uniqueYears.map(year => (
                                                    <option key={year} value={year}>{year}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="col-md-4">
                                            <label className="form-label fw-bold mb-1">Gender</label>
                                            <select
                                                className="form-select"
                                                value={eligibleGender}
                                                onChange={(e) => setEligibleGender(e.target.value)}
                                            >
                                                <option value="">All</option>
                                                <option value="BOYS">BOYS</option>
                                                <option value="GIRLS">GIRLS</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {loadingEligible ? (
                                    <HostelPreloader
                                        title="Loading eligible students"
                                        subtitle="Identifying students who paid hostel fees."
                                    />
                                ) : (
                                    <div className="table-responsive" style={{ maxHeight: '300px' }}>
                                        <table className="table table-hover align-middle">
                                            <thead className="sticky-top">
                                                <tr className="text-white text-uppercase fw-bold" style={{ background: 'linear-gradient(180deg, #606c88 0%, #3f4c6b 50%, #606c88 100%)', fontSize: '1.1rem' }}>
                                                    <th className="py-3 px-3 border-0" style={{ backgroundColor: 'transparent', color: 'white' }}>Student ID</th>
                                                    <th className="py-3 px-3 border-0" style={{ backgroundColor: 'transparent', color: 'white' }}>Name</th>
                                                    <th className="py-3 px-3 border-0" style={{ backgroundColor: 'transparent', color: 'white' }}>Year of Study</th>
                                                    <th className="py-3 px-3 border-0" style={{ backgroundColor: 'transparent', color: 'white' }}>Hostel Type</th>

                                                    <th className="py-3 px-3 border-0" style={{ backgroundColor: 'transparent', color: 'white' }}>Status</th>
                                                    <th className="py-3 px-3 border-0" style={{ backgroundColor: 'transparent', color: 'white' }}>Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredEligibleStudents.length === 0 ? (
                                                    <tr><td colSpan="6" className="text-center py-4 text-muted">No eligible students found matching filter.</td></tr>
                                                ) : (
                                                    filteredEligibleStudents.slice(0, showAllEligible ? undefined : 2).map(s => {
                                                        const allocatedRoom = allocationMap[s.student_id];
                                                        return (
                                                            <tr key={s.student_id}>
                                                                <td className="fw-bold text-primary">{s.hall_ticket_no}</td>
                                                                <td>{s.full_name}</td>
                                                                <td>{s.year_of_study}</td>
                                                                <td>{s.hostel_type?.replace(/_/g, ' ')}</td>

                                                                <td>
                                                                    {allocatedRoom ? (
                                                                        <span className="badge bg-success bg-opacity-10 text-success border border-success px-3 py-2 rounded-pill">
                                                                            {allocatedRoom}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="badge bg-warning bg-opacity-10 text-warning border border-warning px-3 py-2 rounded-pill">
                                                                            Pending
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td>
                                                                    {allocatedRoom ? (
                                                                        <button
                                                                            className="btn btn-sm btn-outline-primary px-4 fw-bold shadow-sm"
                                                                            onClick={() => handleSelectEligibleStudent(s)}
                                                                        >
                                                                            Edit
                                                                        </button>
                                                                    ) : (
                                                                        <button
                                                                            className="btn btn-sm btn-primary px-3 shadow-sm"
                                                                            onClick={() => handleSelectEligibleStudent(s)}
                                                                        >
                                                                            Allocate Room
                                                                        </button>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {!loadingEligible && filteredEligibleStudents.length > 2 && !showAllEligible && (
                                    <div className="text-center mt-3">
                                        <button
                                            className="btn btn-outline-primary btn-sm"
                                            onClick={() => setShowAllEligible(true)}
                                        >
                                            View All
                                        </button>
                                    </div>
                                )}
                            </>

                        </div>
                    </div>

                    {student && (
                        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
                            <div className="modal-dialog modal-lg modal-dialog-centered">
                                <div className="modal-content border-0 shadow-lg">
                                    <div className="modal-header modal-header-gradient p-3">
                                        <h5 className="modal-title fw-bold text-uppercase ls-1 text-white">Allocation Details</h5>
                                        <button type="button" className="btn-close btn-close-white" onClick={() => setStudent(null)}></button>
                                    </div>
                                    <div className="modal-body p-4 bg-white">

                                        {/* Student Profile Section */}
                                        <div className="mb-4">
                                            <h6 className="text-uppercase text-muted fw-bold mb-3 small letter-spacing-1">Student Profile</h6>
                                            <div className="bg-light rounded p-4 border relative">
                                                <div className="d-flex flex-column gap-3">
                                                    <div className="d-flex align-items-center">
                                                        <small className="text-muted text-uppercase fw-bold" style={{ width: '130px', fontSize: '0.85rem' }}>Student Name</small>
                                                        <span className="fw-bold text-dark fs-6">: {student.full_name}</span>
                                                    </div>
                                                    <div className="d-flex align-items-center">
                                                        <small className="text-muted text-uppercase fw-bold" style={{ width: '130px', fontSize: '0.85rem' }}>Student ID</small>
                                                        <span className="fw-bold text-dark fs-6">: {student.student_id}</span>
                                                    </div>
                                                    <div className="d-flex align-items-center">
                                                        <small className="text-muted text-uppercase fw-bold" style={{ width: '130px', fontSize: '0.85rem' }}>Gender</small>
                                                        <span className="fw-bold text-dark fs-6">: {student.gender}</span>
                                                    </div>
                                                    <div className="d-flex align-items-center">
                                                        <small className="text-muted text-uppercase fw-bold" style={{ width: '130px', fontSize: '0.85rem' }}>Phone</small>
                                                        <span className="fw-bold text-dark fs-6">: {student.phone_number}</span>
                                                    </div>
                                                    {student.hostel_type && (
                                                        <div className="d-flex align-items-center">
                                                            <small className="text-muted text-uppercase fw-bold" style={{ width: '130px', fontSize: '0.85rem' }}>Fee Payment</small>
                                                            <span className="fw-bold text-dark fs-6">
                                                                : <span className={student.hostel_type === 'AC' ? 'text-primary' : 'text-dark'}>
                                                                    PAID FOR {student.hostel_type?.replace(/_/g, ' ')}
                                                                </span>
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Allocation Details Section */}
                                        <div className="mb-4">
                                            <h6 className="text-uppercase text-muted fw-bold mb-3 small letter-spacing-1">Current Room Allocation</h6>

                                            {currentAllocation ? (
                                                <div className="bg-light rounded p-4 border relative">
                                                    <div className="d-flex flex-column gap-3">
                                                        <div className="d-flex align-items-center">
                                                            <small className="text-muted text-uppercase fw-bold" style={{ width: '130px', fontSize: '0.85rem' }}>Block</small>
                                                            <span className="fw-bold text-dark fs-6">: {currentAllocation.hostel_beds?.hostel_rooms?.hostel_blocks?.block_name}</span>
                                                        </div>
                                                        <div className="d-flex align-items-center">
                                                            <small className="text-muted text-uppercase fw-bold" style={{ width: '130px', fontSize: '0.85rem' }}>Floor</small>
                                                            <span className="fw-bold text-dark fs-6">: {(() => {
                                                                const f = Number(currentAllocation.hostel_beds?.hostel_rooms?.floor_no);
                                                                if (f === 0) return 'Ground Floor';
                                                                if (f === 1) return 'First Floor';
                                                                if (f === 2) return 'Second Floor';
                                                                return `Floor ${f}`;
                                                            })()}</span>
                                                        </div>
                                                        <div className="d-flex align-items-center">
                                                            <small className="text-muted text-uppercase fw-bold" style={{ width: '130px', fontSize: '0.85rem' }}>Room</small>
                                                            <span className="fw-bold text-dark fs-6">: {currentAllocation.hostel_beds?.hostel_rooms?.room_no}</span>
                                                        </div>
                                                        <div className="d-flex align-items-center">
                                                            <small className="text-muted text-uppercase fw-bold" style={{ width: '130px', fontSize: '0.85rem' }}>Bed</small>
                                                            <span className="fw-bold text-dark fs-6">: {currentAllocation.hostel_beds?.bed_no}</span>
                                                        </div>
                                                        <div className="d-flex align-items-center">
                                                            <small className="text-muted text-uppercase fw-bold" style={{ width: '130px', fontSize: '0.85rem' }}>Room Type</small>
                                                            <span className="fw-bold text-dark fs-6">: {currentAllocation.hostel_beds?.hostel_rooms?.room_type?.replace(/_/g, ' ')}</span>
                                                        </div>

                                                        <div className="mt-2 pt-3 border-top d-flex justify-content-end gap-2">
                                                            <button className="btn btn-primary px-4 shadow-sm" onClick={() => setShowChangeModal(true)}>
                                                                Change Room
                                                            </button>
                                                            <button className="btn btn-outline-danger px-4" onClick={handleVacate}>
                                                                Vacate
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-center py-5 bg-light rounded border border-dashed">
                                                    <i className="bi bi-exclamation-circle text-muted display-6 mb-3 d-block opacity-50"></i>
                                                    <p className="text-muted mb-3">No room currently allocated to this student.</p>
                                                    <button className="btn btn-primary px-5 shadow-sm" onClick={() => setShowAllocateModal(true)}>
                                                        Allocate Room
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </section>
            </div >

            {(showAllocateModal || showChangeModal) && (
                <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }}>
                    <div className="modal-dialog modal-lg modal-dialog-centered">
                        <div className="modal-content border-0 shadow-lg">
                            <div className="modal-header p-4 modal-header-gradient">
                                <h5 className="modal-title fw-bold">
                                    {showAllocateModal ? 'New Bed Allocation' : 'Change Bed Allocation'}
                                </h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => { setShowAllocateModal(false); setShowChangeModal(false); }}></button>
                            </div>
                            <div className="modal-body p-4 bg-light">
                                <div className="row g-3 mb-4 bg-white p-3 rounded border">
                                    <div className="col-md-3">
                                        <label className="form-label fw-bold small text-muted text-uppercase">Academic Year</label>
                                        <select className="form-select" value={bookingForm.academic_year} onChange={(e) => setBookingForm({ ...bookingForm, academic_year: e.target.value })}>
                                            {years.map(y => <option key={y.academic_year} value={y.academic_year}>{y.academic_year}</option>)}
                                        </select>
                                    </div>
                                    <div className="col-md-3">
                                        <label className="form-label fw-bold small text-muted text-uppercase">Block</label>
                                        <select className="form-select" value={filters.block_id} onChange={(e) => setFilters({ ...filters, block_id: e.target.value, floor_no: '' })}>
                                            <option value="">All Blocks</option>
                                            {blocks.filter(b => b.gender === (student.gender?.toUpperCase().startsWith('M') ? 'BOYS' : 'GIRLS')).map(b => (
                                                <option key={b.id} value={b.id}>{b.block_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-md-3">
                                        <label className="form-label fw-bold small text-muted text-uppercase">Room Type</label>
                                        <select className="form-select" value={filters.room_type} onChange={(e) => setFilters({ ...filters, room_type: e.target.value })}>
                                            <option value="">All Types</option>
                                            <option value="AC">AC</option>
                                            <option value="NON_AC">Non AC</option>
                                        </select>
                                    </div>
                                    <div className="col-md-3">
                                        <label className="form-label fw-bold small text-muted text-uppercase">Floor</label>
                                        <select className="form-select" value={filters.floor_no} onChange={(e) => setFilters({ ...filters, floor_no: e.target.value })}>
                                            <option value="">All Floors</option>
                                            {availableFloors.map((floor) => (
                                                <option key={floor} value={floor}>
                                                    {Number(floor) === 0 ? 'Ground Floor' : `Floor ${floor}`}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <h6 className="fw-bold mb-3">
                                    Available Rooms with Beds
                                </h6>
                                <div className="table-responsive" style={{ maxHeight: '300px' }}>
                                    {availableBeds.length === 0 ? (
                                        <div className="py-5 text-center bg-white rounded border">
                                            <p className="mb-0 text-muted">No rooms matching your filters.</p>
                                        </div>
                                    ) : (
                                        <table className="table table-bordered table-sm align-middle text-center">
                                            <thead className="sticky-top">
                                                <tr className="text-white text-uppercase fw-bold" style={{ background: 'linear-gradient(180deg, #606c88 0%, #3f4c6b 50%, #606c88 100%)', fontSize: '1.3rem' }}>
                                                    <th className="py-3 px-3 border-0" style={{ backgroundColor: 'transparent', color: 'white', width: '15%' }}>Floor</th>
                                                    <th className="py-3 px-3 border-0" style={{ backgroundColor: 'transparent', color: 'white', width: '20%' }}>Room No</th>
                                                    <th className="py-3 px-3 border-0" style={{ backgroundColor: 'transparent', color: 'white' }}>Availability</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {availableBeds.map(room => (
                                                    <tr key={room.id}>
                                                        <td className="fw-bold bg-white">{(() => {
                                                            const f = Number(room.floor_no);
                                                            if (f === 0) return 'Ground Floor';
                                                            if (f === 1) return 'First Floor';
                                                            if (f === 2) return 'Second Floor';
                                                            return `Floor ${f}`;
                                                        })()}</td>
                                                        <td className="fw-bold bg-white">{room.room_no}</td>
                                                        <td className="text-start">
                                                            <div className="d-flex flex-wrap gap-2">
                                                                {room.beds.map(bed => (
                                                                    <button
                                                                        key={bed.id}
                                                                        type="button"
                                                                        className={`btn btn-sm ${bed.isOccupied
                                                                            ? 'btn-danger opacity-75'
                                                                            : bookingForm.bed_id === bed.id
                                                                                ? 'btn-success'
                                                                                : 'btn-outline-success'
                                                                            }`}
                                                                        style={{ width: '40px' }}
                                                                        disabled={bed.isOccupied}
                                                                        onClick={() => !bed.isOccupied && setBookingForm({ ...bookingForm, bed_id: bed.id })}
                                                                        title={bed.isOccupied ? 'Occupied' : `Bed ${bed.bed_no}`}
                                                                    >
                                                                        {bed.bed_no}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                            <div className="modal-footer p-4 pt-0 bg-light border-0">
                                <button type="button" className="btn btn-light px-4" onClick={() => { setShowAllocateModal(false); setShowChangeModal(false); }}>Cancel</button>
                                <button
                                    type="button"
                                    className="btn btn-primary px-5"
                                    disabled={!bookingForm.bed_id || searching}
                                    onClick={showAllocateModal ? handleAllocate : handleChangeBed}
                                >
                                    {searching ? 'Processing...' : showAllocateModal ? 'Confirm Allocation' : 'Confirm Change'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )
            }

            <style>{`
                .select-card { transition: all 0.2s; }
                .select-card:hover { border-color: var(--bs-primary) !important; transform: translateY(-2px); }
                .select-card.border-primary { border-width: 2px !important; }
                .modal-header-gradient {
                    background: linear-gradient(180deg, #606c88 0%, #3f4c6b 50%, #606c88 100%) !important;
                    color: white !important;
                }
                .modal-header-gradient .modal-title {
                    color: white !important;
                }
            `}</style>
        </HostelShell >
    );
}
