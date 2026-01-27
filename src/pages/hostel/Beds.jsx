import { useEffect, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import HostelShell from '../../components/HostelShell';
import ConfirmationModal from '../../components/ConfirmationModal';
import HostelPreloader from '../../components/HostelPreloader';
import { toast } from 'react-toastify';

export default function HostelBeds() {
    const [blocks, setBlocks] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [beds, setBeds] = useState([]);
    const [loading, setLoading] = useState(false);
    
    const [selectedBlock, setSelectedBlock] = useState('');
    const [selectedRoom, setSelectedRoom] = useState('');
    
    const [deleteModal, setDeleteModal] = useState({ show: false, id: null });
    const [generating, setGenerating] = useState(false);

    useEffect(() => {
        fetchBlocks();
    }, []);

    const fetchBlocks = async () => {
        const { data, error } = await supabase.from('hostel_blocks').select('*').order('block_name');
        if (error) toast.error(error.message);
        else setBlocks(data || []);
    };

    const fetchRooms = async (blockId) => {
        const { data, error } = await supabase.from('hostel_rooms')
            .select('*')
            .eq('block_id', blockId)
            .order('room_no');
        if (error) toast.error(error.message);
        else setRooms(data || []);
    };

    const fetchBeds = async (roomId) => {
        setLoading(true);
        const { data, error } = await supabase.from('hostel_beds')
            .select('*')
            .eq('room_id', roomId)
            .order('bed_no');
        if (error) toast.error(error.message);
        else setBeds(data || []);
        setLoading(false);
    };

    const handleBlockChange = (e) => {
        const id = e.target.value;
        setSelectedBlock(id);
        setSelectedRoom('');
        setRooms([]);
        setBeds([]);
        if (id) fetchRooms(id);
    };

    const handleRoomChange = (e) => {
        const id = e.target.value;
        setSelectedRoom(id);
        setBeds([]);
        if (id) fetchBeds(id);
    };

    const generateBeds = async () => {
        if (!selectedRoom) return;
        const room = rooms.find(r => r.id.toString() === selectedRoom.toString());
        if (!room) return;

        setGenerating(true);
        const newBeds = [];
        for (let i = 1; i <= room.bed_count; i++) {
            newBeds.push({
                room_id: room.id,
                bed_no: `B${i}`,
                status: 'AVAILABLE'
            });
        }

        const { error } = await supabase.from('hostel_beds').insert(newBeds);
        if (error) {
            if (error.code === '23505') toast.error('Beds already generated for this room');
            else toast.error(error.message);
        } else {
            toast.success(`${room.bed_count} beds generated successfully`);
            fetchBeds(selectedRoom);
        }
        setGenerating(false);
    };

    const toggleBedStatus = async (bed) => {
        const newStatus = bed.status === 'AVAILABLE' ? 'OCCUPIED' : 'AVAILABLE';
        
        // Safety check: if being set to AVAILABLE, check for active allocations
        if (newStatus === 'AVAILABLE') {
            const { data: active } = await supabase.from('hostel_allocations')
                .select('id')
                .eq('bed_id', bed.id)
                .eq('status', 'ACTIVE')
                .maybeSingle();
            
            if (active) {
                toast.warning('Cannot set to AVAILABLE: Bed has an active student allocation.');
                return;
            }
        }

        const { error } = await supabase.from('hostel_beds').update({ status: newStatus }).eq('id', bed.id);
        if (error) toast.error(error.message);
        else fetchBeds(selectedRoom);
    };

    const handleDeleteBed = async () => {
        const { error } = await supabase.from('hostel_beds').delete().eq('id', deleteModal.id);
        if (error) toast.error(error.message);
        else {
            toast.success('Bed deleted successfully');
            setDeleteModal({ show: false, id: null });
            fetchBeds(selectedRoom);
        }
    };

    return (
        <HostelShell brandTitle="HOSTEL MANAGEMENT">
            <div className="desktop-container">
                <h4 className="mb-4">Hostel Bed Management</h4>

                <section className="setup-section mb-4">
                    <div className="students-section-shell card card-soft mb-4">
                        <div className="students-section-shell-header mb-3">
                            <div>
                                <h5 className="section-title mb-1" style={{ fontSize: '1.1rem' }}>Select Room</h5>
                                <p className="students-section-copy mb-0">Choose a block and room to manage individual beds.</p>
                            </div>
                        </div>

                        <div className="students-section-form row g-3">
                            <div className="col-md-4">
                                <label className="form-label fw-bold mb-1">Block</label>
                                <select className="form-select" value={selectedBlock} onChange={handleBlockChange}>
                                    <option value="">Select Block</option>
                                    {blocks.map(b => <option key={b.id} value={b.id}>{b.block_name}</option>)}
                                </select>
                            </div>
                            <div className="col-md-4">
                                <label className="form-label fw-bold mb-1">Room</label>
                                <select className="form-select" value={selectedRoom} onChange={handleRoomChange} disabled={!selectedBlock}>
                                    <option value="">Select Room</option>
                                    {rooms.map(r => <option key={r.id} value={r.id}>{r.room_no} ({r.room_type})</option>)}
                                </select>
                            </div>
                            <div className="col-md-4 d-flex align-items-end">
                                <button 
                                    className="btn btn-primary students-button w-100" 
                                    onClick={generateBeds} 
                                    disabled={!selectedRoom || generating || beds.length > 0}
                                >
                                    {generating ? 'Generating...' : beds.length > 0 ? 'Beds Already Generated' : 'Auto-Generate Beds'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {selectedRoom && (
                        <div className="students-section-shell card card-soft">
                            <div className="students-section-shell-header mb-4 d-flex justify-content-between align-items-center">
                                <h5 className="section-title mb-0" style={{ fontSize: '1.2rem' }}>
                                    Beds in Room {rooms.find(r => r.id.toString() === selectedRoom.toString())?.room_no}
                                </h5>
                                <span className="badge bg-light text-dark border p-2 px-3">
                                    Total Beds: {beds.length}
                                </span>
                            </div>

                            <div className="row g-4">
                                {loading ? (
                                    <div className="col-12">
                                        <HostelPreloader
                                            title="Loading hostel beds"
                                            subtitle="Fetching bed availability for the selected room."
                                            cardCount={4}
                                        />
                                    </div>
                                ) : beds.length === 0 ? (
                                    <div className="col-12 text-center py-5">
                                        <i className="bi bi-inboxes display-4 text-muted"></i>
                                        <p className="mt-2 text-muted">No beds found. Use the auto-generate button above.</p>
                                    </div>
                                ) : (
                                    beds.map((bed) => (
                                        <div className="col-md-4 col-xl-3" key={bed.id}>
                                            <div className={`card h-100 p-3 border-2 ${bed.status === 'OCCUPIED' ? 'border-danger bg-light' : 'border-success'}`}>
                                                <div className="d-flex justify-content-between align-items-center mb-3">
                                                    <div className="fw-bold fs-4">{bed.bed_no}</div>
                                                    <span className={`badge ${bed.status === 'AVAILABLE' ? 'bg-success' : 'bg-danger'}`}>
                                                        {bed.status}
                                                    </span>
                                                </div>
                                                <div className="mt-auto d-flex gap-2">
                                                    <button 
                                                        className={`btn btn-sm ${bed.status === 'AVAILABLE' ? 'btn-outline-danger' : 'btn-outline-success'} flex-fill`}
                                                        onClick={() => toggleBedStatus(bed)}
                                                    >
                                                        Mark {bed.status === 'AVAILABLE' ? 'Occupied' : 'Available'}
                                                    </button>
                                                    <button 
                                                        className="btn btn-sm btn-outline-dark"
                                                        onClick={() => setDeleteModal({ show: true, id: bed.id })}
                                                    >
                                                        <i className="bi bi-trash"></i>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </section>
            </div>

            <ConfirmationModal
                isOpen={deleteModal.show}
                onClose={() => setDeleteModal({ show: false, id: null })}
                onConfirm={handleDeleteBed}
                message="Are you sure you want to delete this bed? This cannot be undone."
            />
        </HostelShell>
    );
}
