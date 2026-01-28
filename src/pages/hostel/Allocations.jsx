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
    const [filters, setFilters] = useState({ block_id: '', room_type: '' });
    const [blocks, setBlocks] = useState([]);
    
    // New states for tabs and eligible students
    const [eligibleStudents, setEligibleStudents] = useState([]);
    const [loadingEligible, setLoadingEligible] = useState(false);
    const [eligibleSearch, setEligibleSearch] = useState('');
    const [showAllEligible, setShowAllEligible] = useState(false);
    
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
        if (error) toast.error('Failed to load eligible students');
        else setEligibleStudents(data || []);
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
        let query = supabase.from('v_hostel_available_beds')
            .select('*')
            .eq('academic_year', bookingForm.academic_year);
            
        if (filters.block_id) query = query.eq('block_id', filters.block_id);
        if (filters.room_type) query = query.eq('room_type', filters.room_type);
        
        if (student) {
            const gender = student.gender?.toUpperCase().startsWith('M') ? 'BOYS' : 'GIRLS';
            query = query.eq('block_gender', gender);
        }

        const { data } = await query.order('block_name').order('room_no');
        setAvailableBeds(data || []);
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
        // Fetch phone number
        const { data: studentData } = await supabase
            .from('students')
            .select('phone_number, academic_year')
            .eq('id', s.student_id)
            .single();

        setStudent({
            id: s.student_id,
            student_id: s.hall_ticket_no,
            full_name: s.full_name,
            gender: s.gender,
            phone_number: studentData?.phone_number || '—',
            is_hostel: true,
            hostel_type: s.hostel_type
        });

        if (studentData?.academic_year) {
            setBookingForm((prev) => ({ ...prev, academic_year: studentData.academic_year }));
        }

        setFilters(prev => ({ ...prev, room_type: s.hostel_type })); 
        fetchCurrentAllocation(s.student_id);
    };

    const filteredEligibleStudents = eligibleStudents.filter(s => {
        const q = eligibleSearch.toLowerCase();
        return (
            s.full_name?.toLowerCase().includes(q) ||
            s.hall_ticket_no?.toLowerCase().includes(q)
        );
    });

    return (
        <HostelShell brandTitle="HOSTEL MANAGEMENT">
            <div className="desktop-container">
                <h4 className="mb-4">Bed Allocations</h4>

                <section className="setup-section mb-4">
                    <div className="students-section-shell card card-soft mb-4">
                        <div className="card-body">

                                <>
                                    <div className="d-flex justify-content-between align-items-center mb-3">
                                        <div>
                                            <h5 className="section-title mb-1" style={{ fontSize: '1.1rem' }}>ELIGIBLE STUDENTS</h5>
                                            <p className="students-section-copy mb-0">Students who have successfully paid hostel fees.</p>
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
                                                        <th className="py-3 px-3 border-0" style={{ backgroundColor: 'transparent', color: 'white' }}>Gender</th>
                                                        <th className="py-3 px-3 border-0" style={{ backgroundColor: 'transparent', color: 'white' }}>Paid Type</th>
                                                        <th className="py-3 px-3 border-0" style={{ backgroundColor: 'transparent', color: 'white' }}>Payment Date</th>
                                                        <th className="py-3 px-3 border-0" style={{ backgroundColor: 'transparent', color: 'white' }}>Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredEligibleStudents.length === 0 ? (
                                                        <tr><td colSpan="6" className="text-center py-4 text-muted">No eligible students found matching filter.</td></tr>
                                                    ) : (
                                                        filteredEligibleStudents.slice(0, showAllEligible ? undefined : 2).map(s => (
                                                            <tr key={s.student_id}>
                                                                <td className="fw-bold text-primary">{s.hall_ticket_no}</td>
                                                                <td>{s.full_name}</td>
                                                                <td><span className="badge bg-light text-dark border">{s.gender}</span></td>
                                                                <td>
                                                                    <span className={`badge ${s.hostel_type === 'AC' ? 'bg-info text-dark' : 'bg-light text-dark border'}`}>
                                                                        {s.hostel_type?.replace(/_/g, ' ')}
                                                                    </span>
                                                                </td>
                                                                <td className="small text-muted">{new Date(s.last_payment_date).toLocaleDateString()}</td>
                                                                <td>
                                                                    <button 
                                                                        className="btn btn-sm btn-outline-primary"
                                                                        onClick={() => handleSelectEligibleStudent(s)}
                                                                    >
                                                                        Select
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))
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
                        <div className="row g-4">
                            <div className="col-md-5">
                                <div className="students-section-shell card card-soft h-100">
                                    <div className="students-section-shell-header border-bottom pb-3 mb-3 d-flex justify-content-between align-items-center">
                                        <h5 className="section-title mb-0" style={{ fontSize: '1.1rem' }}>Student Profile</h5>
                                        <div className="d-flex gap-2">
                                            <button className="btn btn-sm btn-outline-primary border-0" title="Edit Student">
                                                <i className="bi bi-pencil-square fs-5"></i>
                                            </button>
                                            <button className="btn btn-sm btn-outline-danger border-0" title="Delete Student">
                                                <i className="bi bi-trash-fill fs-5"></i>
                                            </button>
                                        </div>
                                    </div>
                                    <div className="py-2">
                                        <div className="d-flex align-items-center mb-4">
                                            <div className="bg-primary rounded-circle d-flex align-items-center justify-content-center text-white" style={{ width: '60px', height: '60px', fontSize: '1.5rem' }}>
                                                {student.full_name?.[0]}
                                            </div>
                                            <div className="ms-3">
                                                <h5 className="mb-1">{student.full_name}</h5>
                                                <span className="text-primary fw-bold small">{student.student_id}</span>
                                            </div>
                                        </div>
                                        <div className="d-flex flex-column gap-3">
                                            <div className="d-flex">
                                                <div className="text-muted small text-uppercase" style={{ minWidth: '120px' }}>Gender</div>
                                                <div className="fw-bold fs-6">: {student.gender}</div>
                                            </div>
                                            <div className="d-flex">
                                                <div className="text-muted small text-uppercase" style={{ minWidth: '120px' }}>Phone</div>
                                                <div className="fw-bold fs-6">: {student.phone_number}</div>
                                            </div>
                                            {student.hostel_type && (
                                                <div className="d-flex">
                                                    <div className="text-muted small text-uppercase" style={{ minWidth: '120px' }}>Fee Payment</div>
                                                    <div className="fw-bold fs-6">
                                                        : <span className={`badge ${student.hostel_type === 'AC' ? 'bg-info text-dark' : 'bg-light text-dark border'}`}>
                                                            PAID FOR {student.hostel_type?.replace(/_/g, ' ')}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="col-md-7">
                                <div className="students-section-shell card card-soft h-100">
                                    <div className="students-section-shell-header border-bottom pb-3 mb-3 d-flex justify-content-between align-items-center">
                                        <h5 className="section-title mb-0" style={{ fontSize: '1.1rem' }}>Allocation Details</h5>
                                        <div className="d-flex align-items-center gap-2">
                                            {currentAllocation && (
                                                <>
                                                    <button 
                                                        className="btn btn-sm btn-outline-primary border-0" 
                                                        onClick={() => setShowChangeModal(true)}
                                                        title="Edit Allocation"
                                                    >
                                                        <i className="bi bi-pencil-square fs-5"></i>
                                                    </button>
                                                    <button 
                                                        className="btn btn-sm btn-outline-danger border-0" 
                                                        onClick={handleVacate}
                                                        title="Delete Allocation (Vacate)"
                                                    >
                                                        <i className="bi bi-trash-fill fs-5"></i>
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="py-2 flex-grow-1">
                                        {currentAllocation ? (
                                            <div className="d-flex flex-column gap-3">
                                                <div className="p-3 bg-light rounded border-start border-4 border-primary">
                                                    <div className="d-flex flex-column gap-3">
                                                        <div className="d-flex">
                                                            <div className="text-muted small text-uppercase" style={{ minWidth: '130px' }}>Academic Year</div>
                                                            <div className="fw-bold fs-6">: {currentAllocation.academic_year}</div>
                                                        </div>
                                                        <div className="d-flex">
                                                            <div className="text-muted small text-uppercase" style={{ minWidth: '130px' }}>Block</div>
                                                            <div className="fw-bold fs-6">: {currentAllocation.hostel_beds?.hostel_rooms?.hostel_blocks?.block_name}</div>
                                                        </div>
                                                        <div className="d-flex">
                                                            <div className="text-muted small text-uppercase" style={{ minWidth: '130px' }}>Room & Bed</div>
                                                            <div className="fw-bold fs-6 text-primary">
                                                                : Room {currentAllocation.hostel_beds?.hostel_rooms?.room_no} | Bed {currentAllocation.hostel_beds?.bed_no}
                                                            </div>
                                                        </div>
                                                        <div className="d-flex">
                                                            <div className="text-muted small text-uppercase" style={{ minWidth: '130px' }}>Floor / Type</div>
                                                            <div className="fw-bold fs-6">: Floor {currentAllocation.hostel_beds?.hostel_rooms?.floor_no} | {currentAllocation.hostel_beds?.hostel_rooms?.room_type?.replace(/_/g, ' ')}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="d-flex gap-2">
                                                    <button className="btn btn-primary flex-grow-1" onClick={() => setShowChangeModal(true)}>Change Room</button>
                                                    <button className="btn btn-outline-danger flex-grow-1" onClick={handleVacate}>Vacate</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="h-100 d-flex flex-column align-items-center justify-content-center text-center py-4">
                                                <i className="bi bi-house-door display-4 text-muted mb-3 opacity-25"></i>
                                                <p className="text-muted mb-4">No active hostel allocation found for this student.</p>
                                                <div className="d-flex gap-3">
                                                    <button className="btn btn-outline-secondary px-4" onClick={() => setShowAllocateModal(true)}>
                                                        Allocate
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </section>
            </div>

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
                                    <div className="col-md-4">
                                        <label className="form-label fw-bold small text-muted text-uppercase">Academic Year</label>
                                        <select className="form-select" value={bookingForm.academic_year} onChange={(e) => setBookingForm({ ...bookingForm, academic_year: e.target.value })}>
                                            {years.map(y => <option key={y.academic_year} value={y.academic_year}>{y.academic_year}</option>)}
                                        </select>
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label fw-bold small text-muted text-uppercase">Block</label>
                                        <select className="form-select" value={filters.block_id} onChange={(e) => setFilters({ ...filters, block_id: e.target.value })}>
                                            <option value="">All Blocks</option>
                                            {blocks.filter(b => b.gender === (student.gender?.toUpperCase().startsWith('M') ? 'BOYS' : 'GIRLS')).map(b => (
                                                <option key={b.id} value={b.id}>{b.block_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label fw-bold small text-muted text-uppercase">Room Type</label>
                                        <select className="form-select" value={filters.room_type} onChange={(e) => setFilters({ ...filters, room_type: e.target.value })}>
                                            <option value="">All Types</option>
                                            <option value="AC">AC</option>
                                            <option value="NON_AC">Non AC</option>
                                        </select>
                                    </div>
                                </div>

                                <h6 className="fw-bold mb-3">
                                    Available Beds ({availableBeds.length})
                                </h6>
                                <div className="row g-2 overflow-auto" style={{ maxHeight: '300px' }}>
                                    {availableBeds.length === 0 ? (
                                        <div className="col-12 py-5 text-center bg-white rounded border">
                                            <p className="mb-0 text-muted">No available beds matching your filters.</p>
                                        </div>
                                    ) : (
                                        availableBeds.map(bed => (
                                            <div className="col-md-4 col-lg-3" key={bed.bed_id}>
                                                <div 
                                                    className={`card h-100 p-2 text-center shadow-sm select-card ${bookingForm.bed_id === bed.bed_id ? 'border-primary bg-primary bg-opacity-10' : 'border-light'}`}
                                                    style={{ cursor: 'pointer' }}
                                                    onClick={() => setBookingForm({ ...bookingForm, bed_id: bed.bed_id })}
                                                >
                                                    <div className="fw-bold">{bed.room_no} - {bed.bed_no}</div>
                                                    <div className="small text-muted">{bed.room_type?.replace(/_/g, ' ')}</div>
                                                    <div className="small opacity-75">{bed.block_name}</div>
                                                </div>
                                            </div>
                                        ))
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
            )}

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
        </HostelShell>
    );
}
