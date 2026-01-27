import { useEffect, useState } from 'react';
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
    const [editingId, setEditingId] = useState(null);
    const [deleteModal, setDeleteModal] = useState({ show: false, id: null });
    
    const [filterBlock, setFilterBlock] = useState('');
    const [filterType, setFilterType] = useState('');

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
        const payload = { 
            block_id: form.block_id,
            floor_no: parseInt(form.floor_no),
            room_no: form.room_no,
            room_type: form.room_type,
            bed_count: parseInt(form.bed_count),
            status: form.status
        };

        if (editingId) {
            const { error } = await supabase.from('hostel_rooms').update(payload).eq('id', editingId);
            if (error) toast.error(error.message);
            else {
                toast.success('Room updated successfully');
                resetForm();
                fetchData();
            }
        } else {
            const { error } = await supabase.from('hostel_rooms').insert([payload]);
            if (error) toast.error(error.message);
            else {
                toast.success('Room created successfully');
                resetForm();
                fetchData();
            }
        }
    };

    const resetForm = () => {
        setEditingId(null);
        setForm({ id: '', block_id: '', floor_no: 0, room_no: '', room_type: 'NON_AC', bed_count: 1, status: 'AVAILABLE' });
    };

    const handleEdit = (room) => {
        setForm(room);
        setEditingId(room.id);
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

    const filteredRooms = rooms.filter(r => {
        return (filterBlock ? r.block_id.toString() === filterBlock.toString() : true) &&
               (filterType ? r.room_type === filterType : true);
    });

    return (
        <HostelShell brandTitle="HOSTEL MANAGEMENT">
            <div className="desktop-container">
                <h4 className="mb-4">Hostel Rooms</h4>

                <section className="setup-section mb-4">
                    <div className="students-section-shell card card-soft mb-4">
                        <div className="students-section-shell-header mb-3">
                            <div>
                                <h5 className="section-title mb-1" style={{ fontSize: '1.1rem' }}>
                                    {editingId ? 'Edit Room' : 'Add New Room'}
                                </h5>
                                <p className="students-section-copy mb-0">Define rooms within each block and their capacity.</p>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="students-section-form row g-3">
                            <div className="col-md-3">
                                <label className="form-label fw-bold mb-1">Block</label>
                                <select 
                                    className="form-select" 
                                    value={form.block_id} 
                                    onChange={(e) => setForm({ ...form, block_id: e.target.value })}
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
                                <input 
                                    type="number" 
                                    className="form-control" 
                                    value={form.floor_no} 
                                    onChange={(e) => setForm({ ...form, floor_no: e.target.value })} 
                                    required 
                                />
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
                            <div className="col-md-1">
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
                            <div className="col-md-2">
                                <label className="form-label fw-bold mb-1">Status</label>
                                <select 
                                    className="form-select" 
                                    value={form.status} 
                                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                                    required
                                >
                                    <option value="AVAILABLE">AVAILABLE</option>
                                    <option value="MAINTENANCE">MAINTENANCE</option>
                                    <option value="INACTIVE">INACTIVE</option>
                                </select>
                            </div>
                            <div className="col-12 mt-3 d-flex gap-2 justify-content-end">
                                <button type="submit" className="btn btn-primary students-button px-5">
                                    {editingId ? 'Update Room' : 'Add Room'}
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
                            <div className="d-flex gap-2">
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
                            <div className="table-responsive">
                                <table className="table align-middle">
                                    <thead>
                                        <tr className="text-muted small text-uppercase fw-bold">
                                            <th>Block</th>
                                            <th>Room No</th>
                                            <th>Floor</th>
                                            <th>Type</th>
                                            <th>Beds</th>
                                            <th>Status</th>
                                            <th className="text-end">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRooms.length === 0 ? (
                                            <tr><td colSpan="7" className="text-center py-4">No rooms found</td></tr>
                                        ) : (
                                            filteredRooms.map((room) => (
                                                <tr key={room.id}>
                                                    <td>{room.hostel_blocks?.block_name}</td>
                                                    <td className="fw-bold fs-6">{room.room_no}</td>
                                                    <td>{room.floor_no}</td>
                                                    <td>
                                                        <span className={`students-section-badge ${room.room_type === 'AC' ? 'students-section-badge-course' : 'students-section-badge-category'}`}>
                                                            {room.room_type}
                                                        </span>
                                                    </td>
                                                    <td>{room.bed_count}</td>
                                                    <td>
                                                        <span className={`badge ${room.status === 'AVAILABLE' ? 'bg-success' : room.status === 'MAINTENANCE' ? 'bg-warning' : 'bg-danger'}`}>
                                                            {room.status}
                                                        </span>
                                                    </td>
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
                        )}
                    </div>
                </section>
            </div>

            <ConfirmationModal
                isOpen={deleteModal.show}
                onClose={() => setDeleteModal({ show: false, id: null })}
                onConfirm={handleDelete}
                message="Are you sure you want to delete this room? All associated beds and active allocations will be affected."
            />
        </HostelShell>
    );
}
