import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import HostelShell from '../../components/HostelShell';
import ConfirmationModal from '../../components/ConfirmationModal';
import HostelPreloader from '../../components/HostelPreloader';
import { toast } from 'react-toastify';

export default function HostelRooms() {
    const [rooms, setRooms] = useState([]);
    const [blocks, setBlocks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ id: '', block_id: '', floor_no: 0, room_no: '', room_type: 'NON_AC', bed_count: 1, status: 'AVAILABLE' });
    const [roomRows, setRoomRows] = useState([{ key: Date.now(), room_type: 'NON_AC', room_no: '', bed_count: 1 }]);
    const [editingId, setEditingId] = useState(null);
    const [deleteModal, setDeleteModal] = useState({ show: false, id: null });
    const [saveModal, setSaveModal] = useState({ show: false, payload: null, isEdit: false, details: null });
    const [saving, setSaving] = useState(false);

    const [filterBlock, setFilterBlock] = useState('');
    const [filterType, setFilterType] = useState('');
    const [showAllRooms, setShowAllRooms] = useState(false);
    const selectedBlock = blocks.find((block) => String(block.id) === String(form.block_id));
    const maxFloor = selectedBlock?.total_floors ?? null;
    const floorOptions = useMemo(() => {
        if (!selectedBlock) return [];
        const max = Number(selectedBlock.total_floors);
        if (!Number.isFinite(max) || max < 0) return [];
        return Array.from({ length: max + 1 }, (_, index) => index);
    }, [selectedBlock]);
    const formatFloorLabel = (floorNo) => {
        const value = Number(floorNo);
        if (!Number.isFinite(value) || value < 0) return '';
        if (value === 0) return 'Ground Floor';
        if (value === 1) return 'First Floor';
        if (value === 2) return 'Second Floor';
        if (value === 3) return 'Third Floor';
        return `Floor ${value}`;
    };

    useEffect(() => {
        fetchData();
    }, []);


    const fetchData = async () => {
        setLoading(true);
        const [blocksRes, roomsRes] = await Promise.all([
            supabase.from('hostel_blocks').select('*').order('block_name'),
            supabase.from('hostel_rooms').select('*, hostel_blocks(block_name)').order('room_no')
        ]);

        if (blocksRes.error) toast.error(blocksRes.error.message);
        else setBlocks(blocksRes.data || []);

        if (roomsRes.error) toast.error(roomsRes.error.message);
        else setRooms(roomsRes.data || []);

        setLoading(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const floorValue = Number(form.floor_no);

        if (!form.block_id) {
            toast.error('Please select a block.');
            return;
        }
        if (form.floor_no === '') {
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

        if (editingId) {
            const trimmedRoomNo = String(form.room_no || '').trim();
            const bedValue = Number(form.bed_count);
            if (!trimmedRoomNo) {
                toast.error('Please enter a room number.');
                return;
            }
            if (!Number.isInteger(bedValue) || bedValue < 1) {
                toast.error('Bed count must be a whole number of at least 1.');
                return;
            }

            const payload = {
                block_id: form.block_id,
                floor_no: parseInt(form.floor_no),
                room_no: trimmedRoomNo,
                room_type: form.room_type,
                bed_count: parseInt(form.bed_count),
                status: form.status
            };
            const blockName = selectedBlock?.block_name || '—';
            const floorLabel = floorValue === 0 ? 'Ground Floor' : `Floor ${floorValue}`;
            const typeLabel = form.room_type === 'AC' ? 'AC' : 'Non AC';
            const details = {
                blockName,
                roomNo: trimmedRoomNo,
                floorLabel,
                typeLabel,
                bedValue
            };

            setSaveModal({ show: true, payload, isEdit: true, details });
            return;
        }

        const sanitizedRows = roomRows
            .map((row) => ({
                key: row.key,
                room_no: String(row.room_no || '').trim(),
                room_type: row.room_type || 'NON_AC',
                bed_count: Number(row.bed_count)
            }))
            .filter((row) => row.room_no !== '');

        if (sanitizedRows.length === 0) {
            toast.error('Please enter at least one room.');
            return;
        }

        const duplicateCheck = new Set();
        for (const row of sanitizedRows) {
            if (!Number.isInteger(row.bed_count) || row.bed_count < 1) {
                toast.error('Bed count must be a whole number of at least 1.');
                return;
            }
            const key = row.room_no.toLowerCase();
            if (duplicateCheck.has(key)) {
                toast.error(`Duplicate room number: ${row.room_no}`);
                return;
            }
            duplicateCheck.add(key);
        }

        const payload = sanitizedRows.map((row) => ({
            block_id: form.block_id,
            floor_no: parseInt(form.floor_no),
            room_no: row.room_no,
            room_type: row.room_type,
            bed_count: parseInt(row.bed_count),
            status: form.status
        }));

        const blockName = selectedBlock?.block_name || '—';
        const floorLabel = floorValue === 0 ? 'Ground Floor' : `Floor ${floorValue}`;
        const details = payload.map((row) => ({
            blockName,
            roomNo: row.room_no,
            floorLabel,
            typeLabel: row.room_type === 'AC' ? 'AC' : 'Non AC',
            bedValue: row.bed_count
        }));

        setSaveModal({ show: true, payload, isEdit: false, details });
    };
    const resetForm = () => {
        setEditingId(null);
        setForm({ id: '', block_id: '', floor_no: 0, room_no: '', room_type: 'NON_AC', bed_count: 1, status: 'AVAILABLE' });
        setRoomRows([{ key: Date.now(), room_type: 'NON_AC', room_no: '', bed_count: 1 }]);
    };

    const handleEdit = (room) => {
        setForm(room);
        setEditingId(room.id);
        setRoomRows([{ key: Date.now(), room_type: 'NON_AC', room_no: '', bed_count: 1 }]);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async () => {
        const { error } = await supabase.from('hostel_rooms').delete().eq('id', deleteModal.id);
        if (error) toast.error(error.message);
        else {
            toast.success('Room deleted successfully');
            setDeleteModal({ show: false, id: null });
            fetchData();
        }
    };

    const handleConfirmSave = async () => {
        if (!saveModal.payload) return;
        setSaving(true);

        try {
            if (saveModal.isEdit) {
                const { error } = await supabase.from('hostel_rooms').update(saveModal.payload).eq('id', editingId);
                if (error) throw error;
                toast.success('Room updated successfully');
            } else {
                const { data: roomData, error: roomError } = await supabase
                    .from('hostel_rooms')
                    .insert(saveModal.payload)
                    .select();

                if (roomError) throw roomError;

                const beds = [];
                (roomData || []).forEach((room) => {
                    for (let i = 0; i < Number(room.bed_count || 0); i += 1) {
                        beds.push({
                            room_id: room.id,
                            bed_no: String(i + 1),
                            status: 'AVAILABLE'
                        });
                    }
                });

                if (beds.length > 0) {
                    const { error: bedError } = await supabase.from('hostel_beds').insert(beds);
                    if (bedError) {
                        console.error('Error creating beds:', bedError);
                        toast.warning('Room created but beds could not be generated.');
                    } else {
                        toast.success('Rooms and beds created successfully');
                    }
                } else {
                    toast.success('Rooms created successfully');
                }
            }
            resetForm();
            fetchData();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setSaving(false);
            setSaveModal({ show: false, payload: null, isEdit: false, details: null });
        }
    };

    const filteredRooms = rooms.filter(r => {
        return (filterBlock ? r.block_id.toString() === filterBlock.toString() : true) &&
            (filterType ? r.room_type === filterType : true);
    });
    const visibleRooms = showAllRooms ? filteredRooms : filteredRooms.slice(0, 2);

    return (
        <HostelShell brandTitle="HOSTEL MANAGEMENT">
            <div className="desktop-container">
                <h4 className="mb-4">Room Creation</h4>

                <section className="setup-section mb-4">
                    <div className="students-section-shell card card-soft mb-4">
                        <div className="students-section-shell-header mb-3">
                            <div>
                                <h5 className="section-title mb-1" style={{ fontSize: '1.1rem' }}>
                                    {editingId ? 'Edit Room' : 'Add New Room'}
                                </h5>
                            </div>
                        </div>


                        <form onSubmit={handleSubmit} className="students-section-form row g-3">
                            <div className="col-md-4">
                                <label className="form-label fw-bold mb-1">Block</label>
                                <select
                                    className="form-select"
                                    value={form.block_id}
                                    onChange={(e) => setForm({ ...form, block_id: e.target.value, floor_no: '' })}
                                    required
                                >
                                    <option value="">Select Block</option>
                                    {blocks.map(b => (
                                        <option key={b.id} value={b.id}>{b.block_name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-md-2">
                                <label className="form-label fw-bold mb-1">Floor No</label>
                                <select
                                    className="form-select"
                                    value={form.floor_no}
                                    onChange={(e) => setForm({ ...form, floor_no: e.target.value })}
                                    required
                                >
                                    <option value="">Select Floor</option>
                                    {floorOptions.map((floor) => (
                                        <option key={floor} value={floor}>
                                            {floor === 0 ? 'Ground Floor' : `Floor ${floor}`}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {editingId ? (
                                <>
                                    <div className="col-md-2">
                                        <label className="form-label fw-bold mb-1">Type</label>
                                        <select
                                            className="form-select"
                                            value={form.room_type}
                                            onChange={(e) => setForm({ ...form, room_type: e.target.value })}
                                            required
                                        >
                                            <option value="NON_AC">Non AC</option>
                                            <option value="AC">AC</option>
                                        </select>
                                    </div>
                                    <div className="col-md-2">
                                        <label className="form-label fw-bold mb-1">Room No</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="e.g. 101"
                                            value={form.room_no}
                                            onChange={(e) => setForm({ ...form, room_no: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="col-md-2">
                                        <label className="form-label fw-bold mb-1">Beds</label>
                                        <input
                                            type="number"
                                            className="form-control"
                                            value={form.bed_count}
                                            onChange={(e) => setForm({ ...form, bed_count: e.target.value })}
                                            min="1"
                                            required
                                        />
                                    </div>
                                </>
                            ) : (
                                <div className="col-12">
                                    <div className="row g-3">
                                        {roomRows.map((row, index) => (
                                            <div className="col-12" key={row.key}>
                                                <div className="row g-3 align-items-end">
                                                    <div className="col-md-3">
                                                        <label className="form-label fw-bold mb-1">Type</label>
                                                        <select
                                                            className="form-select"
                                                            value={row.room_type}
                                                            onChange={(e) => {
                                                                const next = [...roomRows];
                                                                next[index] = { ...next[index], room_type: e.target.value };
                                                                setRoomRows(next);
                                                            }}
                                                            required
                                                        >
                                                            <option value="NON_AC">Non AC</option>
                                                            <option value="AC">AC</option>
                                                        </select>
                                                    </div>
                                                    <div className="col-md-4">
                                                        <label className="form-label fw-bold mb-1">Room No</label>
                                                        <input
                                                            type="text"
                                                            className="form-control"
                                                            placeholder="e.g. 101"
                                                            value={row.room_no}
                                                            onChange={(e) => {
                                                                const next = [...roomRows];
                                                                next[index] = { ...next[index], room_no: e.target.value };
                                                                setRoomRows(next);
                                                            }}
                                                            required
                                                        />
                                                    </div>
                                                    <div className="col-md-3">
                                                        <label className="form-label fw-bold mb-1">Beds</label>
                                                        <input
                                                            type="number"
                                                            className="form-control"
                                                            value={row.bed_count}
                                                            onChange={(e) => {
                                                                const next = [...roomRows];
                                                                next[index] = { ...next[index], bed_count: e.target.value };
                                                                setRoomRows(next);
                                                            }}
                                                            min="1"
                                                            required
                                                        />
                                                    </div>
                                                    <div className="col-md-2 d-flex justify-content-end">
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-danger"
                                                            onClick={() => {
                                                                const next = roomRows.filter((_, i) => i !== index);
                                                                setRoomRows(next.length > 0 ? next : [{ key: Date.now(), room_type: 'NON_AC', room_no: '', bed_count: 1 }]);
                                                            }}
                                                            disabled={roomRows.length === 1}
                                                        >
                                                            Remove
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-3">
                                        <button
                                            type="button"
                                            className="btn btn-outline-primary"
                                            onClick={() => setRoomRows([...roomRows, { key: Date.now(), room_type: 'NON_AC', room_no: '', bed_count: 1 }])}
                                        >
                                            Add another room
                                        </button>
                                    </div>
                                </div>
                            )}
                            <div className="col-12 mt-3 d-flex gap-2 justify-content-end">
                                <button type="submit" className="btn btn-primary students-button px-5">
                                    {editingId ? 'Update Room' : 'Add Rooms'}
                                </button>
                                {editingId && (
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary students-button px-5"
                                        onClick={resetForm}
                                    >
                                        Cancel
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>

                    <div className="students-section-shell card card-soft">
                        <div className="students-section-shell-header mb-3 d-flex justify-content-between align-items-center">
                            <h5 className="section-title mb-0" style={{ fontSize: '1.1rem' }}>Room List</h5>
                            <div className="d-flex gap-2 align-items-center">
                                <select className="form-select form-select-sm" style={{ width: '150px' }} value={filterBlock} onChange={(e) => setFilterBlock(e.target.value)}>
                                    <option value="">All Blocks</option>
                                    {blocks.map(b => (
                                        <option key={b.id} value={b.id}>{b.block_name}</option>
                                    ))}
                                </select>
                                <select className="form-select form-select-sm" style={{ width: '120px' }} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                                    <option value="">All Types</option>
                                    <option value="AC">AC</option>
                                    <option value="NON_AC">Non AC</option>
                                </select>
                            </div>
                        </div>
                        {loading ? (
                            <HostelPreloader
                                title="Loading hostel rooms"
                                subtitle="Fetching blocks and room availability."
                            />
                        ) : (
                            <>
                                <div className="table-responsive">
                                    <table className="table align-middle">
                                        <thead>
                                            <tr className="text-white text-uppercase fw-bold" style={{ background: 'linear-gradient(180deg, #606c88 0%, #3f4c6b 50%, #606c88 100%)', fontSize: '1.1rem' }}>
                                                <th className="py-3 px-3 border-0" style={{ backgroundColor: 'transparent', color: 'white' }}>Block</th>
                                                <th className="py-3 px-3 border-0" style={{ backgroundColor: 'transparent', color: 'white' }}>Floor</th>
                                                <th className="py-3 px-3 border-0" style={{ backgroundColor: 'transparent', color: 'white' }}>Type</th>
                                                <th className="py-3 px-3 border-0" style={{ backgroundColor: 'transparent', color: 'white' }}>Room No</th>
                                                <th className="py-3 px-3 border-0" style={{ backgroundColor: 'transparent', color: 'white' }}>Beds</th>
                                                <th className="py-3 px-3 border-0 text-end" style={{ backgroundColor: 'transparent', color: 'white' }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredRooms.length === 0 ? (
                                                <tr><td colSpan="6" className="text-center py-4">No rooms found</td></tr>
                                            ) : (
                                                visibleRooms.map((room) => (
                                                    <tr key={room.id}>
                                                        <td>{room.hostel_blocks?.block_name}</td>
                                                        <td>{formatFloorLabel(room.floor_no)}</td>
                                                        <td>
                                                            <span className={`students-section-badge ${room.room_type === 'AC' ? 'students-section-badge-course' : 'students-section-badge-category'}`}>
                                                                {room.room_type?.replace(/_/g, ' ')}
                                                            </span>
                                                        </td>
                                                        <td className="fw-bold fs-6">{room.room_no}</td>
                                                        <td>{room.bed_count}</td>
                                                        <td className="text-end">
                                                            <div className="d-flex justify-content-end gap-2">
                                                                <button
                                                                    className="btn btn-sm btn-outline-primary students-button-sm"
                                                                    onClick={() => handleEdit(room)}
                                                                >
                                                                    <i className="bi bi-pencil"></i>
                                                                </button>
                                                                <button
                                                                    className="btn btn-sm btn-outline-danger students-button-sm"
                                                                    onClick={() => setDeleteModal({ show: true, id: room.id })}
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
                                {filteredRooms.length > 2 && (
                                    <div className="d-flex justify-content-end mt-3">
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-outline-secondary"
                                            onClick={() => setShowAllRooms(!showAllRooms)}
                                        >
                                            {showAllRooms ? 'Show Less' : 'View All'}
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </section>
            </div>

            <ConfirmationModal
                isOpen={saveModal.show}
                onClose={() => setSaveModal({ show: false, payload: null, isEdit: false, details: null })}
                onConfirm={handleConfirmSave}
                title={saveModal.isEdit ? 'CONFIRM ROOM UPDATE' : 'CONFIRM ROOM CREATION'}
                confirmText={saveModal.isEdit ? 'Update Room' : 'Add Rooms'}
                confirmButtonClass="btn-primary"
                isLoading={saving}
            >
                {Array.isArray(saveModal.details) ? (
                    <div className="d-flex flex-column gap-2">
                        <div className="fw-bold text-dark">Rooms: {saveModal.details.length}</div>
                        <div className="text-muted">
                            {saveModal.details.slice(0, 5).map((detail) => (
                                <div key={`${detail.roomNo}-${detail.typeLabel}`}>
                                    {detail.blockName} | Room {detail.roomNo} | {detail.floorLabel} | Type: {detail.typeLabel} | Beds: {detail.bedValue}
                                </div>
                            ))}
                            {saveModal.details.length > 5 && (
                                <div>...and {saveModal.details.length - 5} more</div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="d-flex flex-column gap-2">
                        <div className="fw-bold text-dark">
                            {saveModal.details?.blockName} | Room {saveModal.details?.roomNo}
                        </div>
                        <div className="text-muted">
                            {saveModal.details?.floorLabel} | Type: {saveModal.details?.typeLabel} | Beds: {saveModal.details?.bedValue}
                        </div>
                    </div>
                )}
            </ConfirmationModal>

            <ConfirmationModal
                isOpen={deleteModal.show}
                onClose={() => setDeleteModal({ show: false, id: null })}
                onConfirm={handleDelete}
                message="Are you sure you want to delete this room? All associated beds and active allocations will be affected."
            />
        </HostelShell>
    );
}

