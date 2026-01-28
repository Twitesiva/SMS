import { useEffect, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import HostelShell from '../../components/HostelShell';
import ConfirmationModal from '../../components/ConfirmationModal';
import HostelPreloader from '../../components/HostelPreloader';
import { toast } from 'react-toastify';

export default function HostelBlocks() {
    const [blocks, setBlocks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ id: '', block_name: '', gender: 'BOYS', total_floors: 1 });
    const [editingId, setEditingId] = useState(null);
    const [deleteModal, setDeleteModal] = useState({ show: false, id: null });
    const [showAllBlocks, setShowAllBlocks] = useState(false);

    useEffect(() => {
        fetchBlocks();
    }, []);

    const fetchBlocks = async () => {
        setLoading(true);
        const { data, error } = await supabase.from('hostel_blocks').select('*').order('block_name');
        if (error) toast.error(error.message);
        else setBlocks(data || []);
        setLoading(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const trimmedName = String(form.block_name || '').trim();
        const totalFloors = Number(form.total_floors);

        if (!trimmedName) {
            toast.error('Please enter a block name.');
            return;
        }
        if (!Number.isInteger(totalFloors) || totalFloors < 0) {
            toast.error('Total floors must be a whole number of 0 or more.');
            return;
        }

        if (editingId) {
            const { data: existingRooms, error: roomsError } = await supabase
                .from('hostel_rooms')
                .select('floor_no')
                .eq('block_id', editingId);

            if (roomsError) {
                toast.error(roomsError.message);
                return;
            }

            const maxExistingFloor = Math.max(
                0,
                ...((existingRooms || []).map((room) => Number(room.floor_no)).filter((floor) => Number.isFinite(floor)))
            );
            if (totalFloors < maxExistingFloor) {
                toast.error(`Total floors cannot be less than existing floor ${maxExistingFloor}.`);
                return;
            }
        }

        const payload = { 
            block_name: trimmedName, 
            gender: form.gender, 
            total_floors: totalFloors 
        };

        if (editingId) {
            const { error } = await supabase.from('hostel_blocks').update(payload).eq('id', editingId);
            if (error) toast.error(error.message);
            else {
                toast.success('Block updated successfully');
                setEditingId(null);
                setForm({ id: '', block_name: '', gender: 'BOYS', total_floors: 1 });
                fetchBlocks();
            }
        } else {
            const { error } = await supabase.from('hostel_blocks').insert([payload]);
            if (error) toast.error(error.message);
            else {
                toast.success('Block created successfully');
                setForm({ id: '', block_name: '', gender: 'BOYS', total_floors: 1 });
                fetchBlocks();
            }
        }
    };

    const handleEdit = (block) => {
        setForm(block);
        setEditingId(block.id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async () => {
        const { error } = await supabase.from('hostel_blocks').delete().eq('id', deleteModal.id);
        if (error) toast.error(error.message);
        else {
            toast.success('Block deleted successfully');
            setDeleteModal({ show: false, id: null });
            fetchBlocks();
        }
    };

    return (
        <HostelShell brandTitle="HOSTEL MANAGEMENT">
            <div className="desktop-container">
                <h4 className="mb-4">Hostel Blocks</h4>

                <section className="setup-section mb-4">
                    <div className="students-section-shell card card-soft mb-4">
                        <div className="students-section-shell-header mb-3">
                            <div>
                                <h5 className="section-title mb-1" style={{ fontSize: '1.1rem' }}>
                                    {editingId ? 'Edit Block' : 'Add New Block'}
                                </h5>
                            </div>
                        </div>

                        {Number(form.total_floors) === 0 && (
                            <div className="alert alert-info py-2 mb-3" role="alert">
                                If total floors is 0, it is assigned as Ground Floor only.
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="students-section-form row g-3 align-items-end">
                            <div className="col-md-4">
                                <label className="form-label fw-bold mb-1">Block Name</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="e.g. Boys Hostel A"
                                    value={form.block_name}
                                    onChange={(e) => setForm({ ...form, block_name: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="col-md-3">
                                <label className="form-label fw-bold mb-1">Gender</label>
                                <select
                                    className="form-select"
                                    value={form.gender}
                                    onChange={(e) => setForm({ ...form, gender: e.target.value })}
                                    required
                                >
                                    <option value="BOYS">BOYS</option>
                                    <option value="GIRLS">GIRLS</option>
                                </select>
                            </div>
                            <div className="col-md-2">
                                <label className="form-label fw-bold mb-1">Total Floors</label>
                                <input
                                    type="number"
                                    className="form-control"
                                    value={form.total_floors}
                                    onChange={(e) => setForm({ ...form, total_floors: e.target.value })}
                                    min="0"
                                    required
                                />
                            </div>
                            <div className="col-md-3 d-flex gap-2">
                                <button type="submit" className="btn btn-primary students-button flex-fill">
                                    {editingId ? 'Update' : 'Add Block'}
                                </button>
                                {editingId && (
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary students-button flex-fill"
                                        onClick={() => {
                                            setEditingId(null);
                                            setForm({ id: '', block_name: '', gender: 'BOYS', total_floors: 1 });
                                        }}
                                    >
                                        Cancel
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>

                    <div className="students-section-shell card card-soft">
                        <div className="students-section-shell-header mb-3">
                            <h5 className="section-title mb-1" style={{ fontSize: '1.1rem' }}>Block List</h5>
                        </div>
                        {loading ? (
                            <HostelPreloader
                                title="Loading hostel blocks"
                                subtitle="Fetching block list and floor details."
                            />
                        ) : (
                            <div className="table-responsive">
                                <table className="table align-middle">
                                    <thead>
                                        <tr className="text-white text-uppercase fw-bold" style={{ background: 'linear-gradient(180deg, #606c88 0%, #3f4c6b 50%, #606c88 100%)', fontSize: '1.1rem' }}>
                                            <th className="py-3 px-3 border-0" style={{ backgroundColor: 'transparent', color: 'white' }}>Block Name</th>
                                            <th className="py-2 px-3 border-0" style={{ backgroundColor: 'transparent', color: 'white' }}>Gender</th>
                                            <th className="py-2 px-3 border-0" style={{ backgroundColor: 'transparent', color: 'white' }}>Floors</th>
                                            <th className="py-2 px-3 border-0 text-end" style={{ backgroundColor: 'transparent', color: 'white' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {blocks.length === 0 ? (
                                            <tr><td colSpan="4" className="text-center py-4">No blocks found</td></tr>
                                        ) : (
                                            blocks.slice(0, showAllBlocks ? undefined : 2).map((block) => (
                                                <tr key={block.id}>
                                                    <td className="fw-bold">{block.block_name}</td>
                                                    <td>
                                                        <span className={`students-section-badge ${block.gender === 'BOYS' ? 'students-section-badge-category' : 'students-section-badge-course'}`}>
                                                            {block.gender}
                                                        </span>
                                                    </td>
                                                    <td>{block.total_floors}</td>
                                                    <td className="text-end">
                                                        <div className="d-flex justify-content-end gap-2">
                                                            <button
                                                                className="btn btn-sm btn-outline-primary students-button-sm"
                                                                onClick={() => handleEdit(block)}
                                                            >
                                                                <i className="bi bi-pencil"></i>
                                                            </button>
                                                            <button
                                                                className="btn btn-sm btn-outline-danger students-button-sm"
                                                                onClick={() => setDeleteModal({ show: true, id: block.id })}
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
                        {blocks.length > 2 && !loading && (
                            <div className="text-center p-3 border-top">
                                <button
                                    className="btn btn-primary btn-sm"
                                    onClick={() => setShowAllBlocks(!showAllBlocks)}
                                >
                                    {showAllBlocks ? 'Show Less' : 'View All'}
                                </button>
                            </div>
                        )}
                    </div>
                </section>
            </div>

            <ConfirmationModal
                isOpen={deleteModal.show}
                onClose={() => setDeleteModal({ show: false, id: null })}
                onConfirm={handleDelete}
                message="Are you sure you want to delete this block? This may affect associated rooms and beds."
            />
        </HostelShell>
    );
}
