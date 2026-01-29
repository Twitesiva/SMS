import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import HostelShell from '../../components/HostelShell';
import ConfirmationModal from '../../components/ConfirmationModal';
import HostelPreloader from '../../components/HostelPreloader';
import { toast } from 'react-toastify';

export default function RoomYearMapping() {
    const [years, setYears] = useState([]);
    const [selectedYear, setSelectedYear] = useState('');
    const [selectedStudyYear, setSelectedStudyYear] = useState('');
    const [blocks, setBlocks] = useState([]);
    const [selectedBlock, setSelectedBlock] = useState('');
    const [selectedFloor, setSelectedFloor] = useState('');
    const [selectedRoom, setSelectedRoom] = useState('');
    const [rooms, setRooms] = useState([]);
    const [mappings, setMappings] = useState({});
    const [loading, setLoading] = useState(false);
    const [allocatedRooms, setAllocatedRooms] = useState([]);
    const [allocatedLoading, setAllocatedLoading] = useState(false);
    const [editModal, setEditModal] = useState({ show: false, room: null });
    const [editForm, setEditForm] = useState({
        room_no: '',
        floor_no: '',
        room_type: 'NON_AC',
        bed_count: 1,
        status: 'AVAILABLE'
    });
    const [savingEdit, setSavingEdit] = useState(false);
    const [deleteModal, setDeleteModal] = useState({ show: false, room: null });
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        const [yearsRes, blocksRes] = await Promise.all([
            supabase.from('academic_year').select('academic_year').order('academic_year', { ascending: false }),
            supabase.from('hostel_blocks').select('*').order('block_name')
        ]);

        if (yearsRes.error) toast.error(yearsRes.error.message);
        else setYears(yearsRes.data || []);

        if (blocksRes.error) toast.error(blocksRes.error.message);
        else setBlocks(blocksRes.data || []);
    };

    useEffect(() => {
        if (selectedYear && selectedBlock) {
            fetchRoomsAndMappings();
        }
    }, [selectedYear, selectedBlock, selectedStudyYear]);

    useEffect(() => {
        setSelectedRoom('');
    }, [selectedYear, selectedBlock, selectedFloor, selectedStudyYear]);

    const fetchRoomsAndMappings = async () => {
        setLoading(true);
        const roomsRes = await supabase.from('hostel_rooms').select('*').eq('block_id', selectedBlock).order('room_no');

        if (roomsRes.error) toast.error(roomsRes.error.message);
        else setRooms(roomsRes.data || []);

        if (!selectedYear || !selectedStudyYear) {
            setMappings({});
            setLoading(false);
            return;
        }

        const mappingsRes = await supabase
            .from('hostel_room_year_mapping')
            .select('*')
            .eq('academic_year', selectedYear)
            .eq('year_of_study', Number(selectedStudyYear));

        if (mappingsRes.error) toast.error(mappingsRes.error.message);
        else {
            const mapObj = {};
            mappingsRes.data.forEach(m => {
                mapObj[m.room_id] = m.is_active;
            });
            setMappings(mapObj);
        }
        setLoading(false);
    };

    const fetchAllocatedRooms = async () => {
        setAllocatedLoading(true);
        let query = supabase
            .from('hostel_room_year_mapping')
            .select('room_id, academic_year, year_of_study, is_active, hostel_rooms ( id, room_no, floor_no, room_type, bed_count, block_id )')
            .eq('is_active', true);

        if (selectedYear) query = query.eq('academic_year', selectedYear);
        if (selectedStudyYear) query = query.eq('year_of_study', Number(selectedStudyYear));
        if (selectedBlock) query = query.eq('hostel_rooms.block_id', selectedBlock);
        if (selectedFloor !== '') query = query.eq('hostel_rooms.floor_no', Number(selectedFloor));
        if (selectedRoom) query = query.eq('room_id', selectedRoom);

        const { data, error } = await query;
        if (error) {
            toast.error(error.message);
            setAllocatedRooms([]);
            setAllocatedLoading(false);
            return;
        }

        const uniqueRooms = [];
        const seen = new Set();
        (data || []).forEach((row) => {
            const room = row.hostel_rooms;
            if (!room || seen.has(room.id)) return;
            seen.add(room.id);
            uniqueRooms.push(room);
        });

        setAllocatedRooms(uniqueRooms);
        setAllocatedLoading(false);
    };

    useEffect(() => {
        fetchAllocatedRooms();
    }, [selectedYear, selectedStudyYear, selectedBlock, selectedFloor, selectedRoom]);

    const toggleMapping = async (roomId) => {
        if (!selectedStudyYear) {
            toast.error('Please select Year of Study.');
            return;
        }
        const currentValue = mappings[roomId] ?? false;
        const newValue = !currentValue;

        const { data: existing } = await supabase.from('hostel_room_year_mapping')
            .select('id')
            .eq('room_id', roomId)
            .eq('academic_year', selectedYear)
            .eq('year_of_study', Number(selectedStudyYear))
            .maybeSingle();

        let error;
        if (existing) {
            const res = await supabase.from('hostel_room_year_mapping')
                .update({ is_active: newValue })
                .eq('id', existing.id);
            error = res.error;
        } else {
            const room = rooms.find(r => r.id === roomId);
            const res = await supabase.from('hostel_room_year_mapping')
                .insert([{
                    room_id: roomId,
                    academic_year: selectedYear,
                    year_of_study: Number(selectedStudyYear),
                    block_id: room?.block_id ?? null,
                    floor_no: room?.floor_no ?? null,
                    is_active: newValue
                }]);
            error = res.error;
        }

        if (error) toast.error(error.message);
        else {
            setMappings(prev => ({ ...prev, [roomId]: newValue }));
            toast.success(`Room ${rooms.find(r => r.id === roomId).room_no} ${newValue ? 'enabled' : 'disabled'} for ${selectedYear} (Year ${selectedStudyYear})`);
        }
    };

    const enableAll = async () => {
        if (!selectedYear || !selectedBlock || !selectedStudyYear) {
            toast.error('Please select Academic Year, Year of Study, and Block.');
            return;
        }
        if (filteredRooms.length === 0) {
            toast.error('No rooms available for the selected filters.');
            return;
        }
        const updates = filteredRooms.map(r => ({
            room_id: r.id,
            academic_year: selectedYear,
            year_of_study: Number(selectedStudyYear),
            block_id: r.block_id,
            floor_no: r.floor_no,
            is_active: true
        }));

        const { error } = await supabase.from('hostel_room_year_mapping').upsert(updates, { onConflict: 'room_id, academic_year, year_of_study' });
        if (error) toast.error(error.message);
        else {
            const blockName = blocks.find((b) => String(b.id) === String(selectedBlock))?.block_name || selectedBlock;
            toast.success(`Rooms enabled for ${blockName} (Year ${selectedStudyYear})`);
            fetchRoomsAndMappings();
        }
    };

    const handleEditRoom = (room) => {
        setEditForm({
            room_no: room.room_no ?? '',
            floor_no: room.floor_no ?? '',
            room_type: room.room_type || 'NON_AC',
            bed_count: room.bed_count ?? 1,
            status: room.status || 'AVAILABLE'
        });
        setEditModal({ show: true, room });
    };

    const closeEditModal = () => {
        if (savingEdit) return;
        setEditModal({ show: false, room: null });
    };

    const handleUpdateRoom = async () => {
        if (!editModal.room) return;
        const trimmedRoomNo = String(editForm.room_no || '').trim();
        const floorValue = Number(editForm.floor_no);
        const bedValue = Number(editForm.bed_count);

        if (!trimmedRoomNo) {
            toast.error('Please enter a room number.');
            return;
        }
        if (editForm.floor_no === '') {
            toast.error('Please select a floor.');
            return;
        }
        if (!Number.isInteger(floorValue) || floorValue < 0) {
            toast.error('Floor number must be a whole number of 0 or greater.');
            return;
        }
        if (maxFloor !== null && floorValue > Number(maxFloor)) {
            toast.error(`Floor number cannot exceed ${maxFloor} for the selected block.`);
            return;
        }
        if (!Number.isInteger(bedValue) || bedValue < 1) {
            toast.error('Bed count must be a whole number of at least 1.');
            return;
        }

        setSavingEdit(true);
        const payload = {
            room_no: trimmedRoomNo,
            floor_no: floorValue,
            room_type: editForm.room_type,
            bed_count: bedValue,
            status: editForm.status
        };
        const { error } = await supabase.from('hostel_rooms').update(payload).eq('id', editModal.room.id);
        if (error) toast.error(error.message);
        else {
            toast.success('Room updated successfully');
            setEditModal({ show: false, room: null });
            fetchRoomsAndMappings();
        }
        setSavingEdit(false);
    };

    const handleDeleteRoom = async () => {
        if (!deleteModal.room) return;
        setDeleting(true);
        const { error } = await supabase.from('hostel_rooms').delete().eq('id', deleteModal.room.id);
        if (error) toast.error(error.message);
        else {
            toast.success('Room deleted successfully');
            setDeleteModal({ show: false, room: null });
            fetchRoomsAndMappings();
        }
        setDeleting(false);
    };

    const selectedBlockDetails = blocks.find((block) => String(block.id) === String(selectedBlock));
    const maxFloor = selectedBlockDetails?.total_floors ?? null;

    const floorOptions = useMemo(() => {
        const floors = new Set();
        rooms.forEach((room) => {
            if (room.floor_no !== null && room.floor_no !== undefined) floors.add(room.floor_no);
        });
        return Array.from(floors).sort((a, b) => Number(a) - Number(b));
    }, [rooms]);

    const roomOptions = useMemo(() => {
        const filtered = selectedFloor
            ? rooms.filter((room) => String(room.floor_no) === String(selectedFloor))
            : rooms;
        return filtered
            .slice()
            .sort((a, b) => String(a.room_no).localeCompare(String(b.room_no), undefined, { numeric: true }));
    }, [rooms, selectedFloor]);

    const filteredRooms = rooms.filter((room) => {
        if (selectedFloor && String(room.floor_no) !== String(selectedFloor)) return false;
        if (selectedRoom && String(room.id) !== String(selectedRoom)) return false;
        return true;
    });

    return (
        <HostelShell brandTitle="HOSTEL MANAGEMENT">
            <div className="desktop-container">
                <h4 className="mb-4">Room Year Mapping</h4>

                <section className="setup-section mb-4">
                    <div className="students-section-shell card card-soft mb-4">
                        <div className="students-section-shell-header mb-3">
                            <div>
                                <h5 className="section-title mb-1" style={{ fontSize: '1.1rem' }}>Room Mapping</h5>
                            </div>
                        </div>

                        <div className="students-section-form row g-3">
                            <div className="col-md-4">
                                <label className="form-label fw-bold mb-1">Academic Year</label>
                                <select className="form-select" value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
                                    <option value="">Select Year</option>
                                    {years.map(y => <option key={y.academic_year} value={y.academic_year}>{y.academic_year}</option>)}
                                </select>
                            </div>
                            <div className="col-md-4">
                                <label className="form-label fw-bold mb-1">Year of Study</label>
                                <select className="form-select" value={selectedStudyYear} onChange={(e) => setSelectedStudyYear(e.target.value)}>
                                    <option value="">Select Year</option>
                                    {[1, 2, 3, 4].map((year) => (
                                        <option key={year} value={year}>{year}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-md-4">
                                <label className="form-label fw-bold mb-1">Block</label>
                                <select className="form-select" value={selectedBlock} onChange={(e) => setSelectedBlock(e.target.value)}>
                                    <option value="">Select Block</option>
                                    {blocks.map(b => <option key={b.id} value={b.id}>{b.block_name}</option>)}
                                </select>
                            </div>
                            <div className="col-md-4">
                                <label className="form-label fw-bold mb-1">Floor</label>
                                <select className="form-select" value={selectedFloor} onChange={(e) => setSelectedFloor(e.target.value)}>
                                    <option value="">All Floors</option>
                                    {floorOptions.map((floor) => (
                                        <option key={floor} value={floor}>
                                            {(() => {
                                                const f = Number(floor);
                                                if (f === 0) return 'Ground Floor';
                                                if (f === 1) return 'First Floor';
                                                if (f === 2) return 'Second Floor';
                                                return `Floor ${f}`;
                                            })()}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-md-4">
                                <label className="form-label fw-bold mb-1">Rooms</label>
                                <select className="form-select" value={selectedRoom} onChange={(e) => setSelectedRoom(e.target.value)}>
                                    <option value="">All Rooms</option>
                                    {roomOptions.map((room) => (
                                        <option key={room.id} value={room.id}>
                                            {room.room_no}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-md-4 d-flex align-items-end">
                                <button className="btn btn-outline-primary students-button w-100" onClick={enableAll} disabled={!selectedYear || !selectedBlock || !selectedStudyYear || loading}>
                                    Allocate rooms for this block
                                </button>
                            </div>
                        </div>
                    </div>

                    {!selectedYear || !selectedBlock || !selectedStudyYear ? null : (
                        <>
                            <div className="students-section-shell card card-soft">
                                <div className="students-section-shell-header mb-4">
                                    <h5 className="section-title mb-0" style={{ fontSize: '1.2rem' }}>
                                        Rooms Availability - {selectedYear}
                                    </h5>
                                </div>

                                {loading ? (
                                    <HostelPreloader
                                        title="Loading room availability"
                                        subtitle="Checking enabled rooms for the selected year."
                                    />
                                ) : (
                                    <div className="table-responsive">
                                        <table className="table align-middle">
                                            <thead>
                                                <tr
                                                    className="text-white text-uppercase fw-bold"
                                                    style={{ background: 'linear-gradient(180deg, #606c88 0%, #3f4c6b 50%, #606c88 100%)', fontSize: '1.1rem' }}
                                                >
                                                    <th className="py-3 px-3 border-0" style={{ backgroundColor: 'transparent', color: 'white' }}>Floor</th>
                                                    <th className="py-3 px-3 border-0" style={{ backgroundColor: 'transparent', color: 'white' }}>Room Type</th>
                                                    <th className="py-3 px-3 border-0" style={{ backgroundColor: 'transparent', color: 'white' }}>Room No</th>
                                                    <th className="py-3 px-3 border-0" style={{ backgroundColor: 'transparent', color: 'white' }}>Capacity</th>
                                                    <th className="py-3 px-3 border-0 text-center" style={{ backgroundColor: 'transparent', color: 'white' }}>Availability Status</th>
                                                    <th className="py-3 px-3 border-0 text-end" style={{ backgroundColor: 'transparent', color: 'white' }}>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredRooms.length === 0 ? (
                                                    <tr><td colSpan="6" className="text-center py-4">No rooms found in this block</td></tr>
                                                ) : (
                                                    filteredRooms.map((room) => (
                                                        <tr key={room.id}>
                                                            <td>{(() => {
                                                                const f = Number(room.floor_no);
                                                                if (f === 0) return 'Ground Floor';
                                                                if (f === 1) return 'First Floor';
                                                                if (f === 2) return 'Second Floor';
                                                                return `Floor ${f}`;
                                                            })()}</td>
                                                            <td>{room.room_type?.replace(/_/g, ' ')}</td>
                                                            <td className="fw-bold">{room.room_no}</td>
                                                            <td>{room.bed_count} Beds</td>
                                                            <td className="text-center">
                                                                <div className="form-check form-switch d-inline-block">
                                                                    <input
                                                                        className="form-check-input"
                                                                        type="checkbox"
                                                                        style={{ width: '2.5rem', height: '1.25rem', cursor: 'pointer' }}
                                                                        checked={mappings[room.id] === true}
                                                                        onChange={() => toggleMapping(room.id)}
                                                                    />
                                                                    <span className={`ms-2 fw-bold ${mappings[room.id] ? 'text-success' : 'text-danger'}`}>
                                                                        {mappings[room.id] ? 'ACTIVE' : 'INACTIVE'}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td className="text-end">
                                                                <div className="d-flex justify-content-end gap-2">
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-sm btn-outline-primary students-button-sm"
                                                                        onClick={() => handleEditRoom(room)}
                                                                    >
                                                                        <i className="bi bi-pencil"></i>
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-sm btn-outline-danger students-button-sm"
                                                                        onClick={() => setDeleteModal({ show: true, room })}
                                                                        disabled={deleting}
                                                                    >
                                                                        <i className="bi bi-trash"></i>
                                                                    </button>
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
                        </>
                    )}
                    {(allocatedLoading || allocatedRooms.length > 0) && (
                        <div className="students-section-shell card card-soft mt-4">
                            <div className="students-section-shell-header mb-4">
                                <h5 className="section-title mb-0" style={{ fontSize: '1.2rem' }}>
                                    Allocated Rooms{selectedYear ? ` - ${selectedYear}` : ''}
                                </h5>
                            </div>
                            {allocatedLoading ? (
                                <HostelPreloader
                                    title="Loading allocated rooms"
                                    subtitle="Collecting active rooms for the selected year."
                                />
                            ) : (
                                <div className="table-responsive">
                                    <table className="table align-middle">
                                        <thead>
                                            <tr
                                                className="text-white text-uppercase fw-bold"
                                                style={{ background: 'linear-gradient(180deg, #606c88 0%, #3f4c6b 50%, #606c88 100%)', fontSize: '1.1rem' }}
                                            >
                                                <th className="py-3 px-3 border-0" style={{ backgroundColor: 'transparent', color: 'white' }}>Floor</th>
                                                <th className="py-3 px-3 border-0" style={{ backgroundColor: 'transparent', color: 'white' }}>Room Type</th>
                                                <th className="py-3 px-3 border-0" style={{ backgroundColor: 'transparent', color: 'white' }}>Room No</th>
                                                <th className="py-3 px-3 border-0" style={{ backgroundColor: 'transparent', color: 'white' }}>Capacity</th>
                                                <th className="py-3 px-3 border-0 text-center" style={{ backgroundColor: 'transparent', color: 'white' }}>Availability Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {allocatedRooms.map((room) => (
                                                <tr key={room.id}>
                                                    <td>{(() => {
                                                        const f = Number(room.floor_no);
                                                        if (f === 0) return 'Ground Floor';
                                                        if (f === 1) return 'First Floor';
                                                        if (f === 2) return 'Second Floor';
                                                        return `Floor ${f}`;
                                                    })()}</td>
                                                    <td>{room.room_type?.replace(/_/g, ' ')}</td>
                                                    <td className="fw-bold">{room.room_no}</td>
                                                    <td>{room.bed_count} Beds</td>
                                                    <td className="text-center">
                                                        <span className="fw-bold text-success">ACTIVE</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </section>
            </div>
            {editModal.show && (
                <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }} tabIndex="-1">
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title fw-bold">Edit Room</h5>
                                <button type="button" className="btn-close" onClick={closeEditModal} aria-label="Close" disabled={savingEdit}></button>
                            </div>
                            <div className="modal-body">
                                <div className="row g-3">
                                    <div className="col-md-6">
                                        <label className="form-label fw-bold mb-1">Room No</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={editForm.room_no}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, room_no: e.target.value }))}
                                            disabled={savingEdit}
                                        />
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label fw-bold mb-1">Floor No</label>
                                        <input
                                            type="number"
                                            className="form-control"
                                            min="0"
                                            max={maxFloor ?? undefined}
                                            value={editForm.floor_no}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, floor_no: e.target.value }))}
                                            disabled={savingEdit}
                                        />
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label fw-bold mb-1">Room Type</label>
                                        <select
                                            className="form-select"
                                            value={editForm.room_type}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, room_type: e.target.value }))}
                                            disabled={savingEdit}
                                        >
                                            <option value="NON_AC">NON AC</option>
                                            <option value="AC">AC</option>
                                        </select>
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label fw-bold mb-1">Bed Count</label>
                                        <input
                                            type="number"
                                            className="form-control"
                                            min="1"
                                            value={editForm.bed_count}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, bed_count: e.target.value }))}
                                            disabled={savingEdit}
                                        />
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label fw-bold mb-1">Status</label>
                                        <select
                                            className="form-select"
                                            value={editForm.status}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                                            disabled={savingEdit}
                                        >
                                            <option value="AVAILABLE">AVAILABLE</option>
                                            <option value="MAINTENANCE">MAINTENANCE</option>
                                            <option value="INACTIVE">INACTIVE</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-outline-secondary" onClick={closeEditModal} disabled={savingEdit}>
                                    Cancel
                                </button>
                                <button type="button" className="btn btn-primary" onClick={handleUpdateRoom} disabled={savingEdit}>
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <ConfirmationModal
                isOpen={deleteModal.show}
                onClose={() => setDeleteModal({ show: false, room: null })}
                onConfirm={handleDeleteRoom}
                title="Confirm Room Deletion"
                confirmText="Delete Room"
                confirmButtonClass="btn-danger"
                isLoading={deleting}
                message={`Are you sure you want to delete room ${deleteModal.room?.room_no || ''}? This will remove all related mappings.`}
            />
        </HostelShell>
    );
}
