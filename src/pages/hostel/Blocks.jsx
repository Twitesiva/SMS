import { useEffect, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import HostelShell from '../../components/HostelShell';
import ConfirmationModal from '../../components/ConfirmationModal';
import HostelPreloader from '../../components/HostelPreloader';
import { toast } from 'react-toastify';

export default function HostelBlocks() {
    const [blocks, setBlocks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ id: '', block_name: '', gender: '', floor_start: 0, floor_end: 0 });
    const [editingId, setEditingId] = useState(null);
    const [deleteModal, setDeleteModal] = useState({ show: false, id: null });
    const [showAllBlocks, setShowAllBlocks] = useState(false);
    const [detailModal, setDetailModal] = useState({ show: false, block: null });
    const [saveModal, setSaveModal] = useState({ show: false, payload: null, isEdit: false });
    const [saving, setSaving] = useState(false);

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
        const floorStart = Number(form.floor_start);
        const floorEnd = Number(form.floor_end);

        if (!trimmedName) {
            toast.error('Please enter a block name.');
            return;
        }
        if (!form.gender) {
            toast.error('Please select a gender.');
            return;
        }
        if (floorStart !== 0) {
            toast.error('Floor start must be 0.');
            return;
        }
        if (!Number.isInteger(floorEnd) || floorEnd < 0) {
            toast.error('Last floor must be a whole number of 0 or more.');
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
            if (floorEnd < maxExistingFloor) {
                toast.error(`Total floors cannot be less than existing floor ${maxExistingFloor}.`);
                return;
            }
        }

        const payload = {
            block_name: trimmedName,
            gender: form.gender,
            total_floors: floorEnd
        };

        setSaveModal({ show: true, payload, isEdit: Boolean(editingId) });
    };

    const handleEdit = (block) => {
        setForm({
            id: block.id,
            block_name: block.block_name,
            gender: block.gender,
            floor_start: 0,
            floor_end: Number(block.total_floors ?? 0)
        });
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

    const handleConfirmSave = async () => {
        if (!saveModal.payload) return;
        setSaving(true);

        try {
            if (saveModal.isEdit) {
                const { error } = await supabase.from('hostel_blocks').update(saveModal.payload).eq('id', editingId);
                if (error) throw error;
                toast.success('Block updated successfully');
                setEditingId(null);
            } else {
                const { error } = await supabase.from('hostel_blocks').insert([saveModal.payload]);
                if (error) throw error;
                toast.success('Block created successfully');
            }
            setForm({ id: '', block_name: '', gender: '', floor_start: 0, floor_end: 0 });
            fetchBlocks();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setSaving(false);
            setSaveModal({ show: false, payload: null, isEdit: false });
        }
    };

    const formatFloorLabel = (floorNo) => {
        const value = Number(floorNo);
        if (!Number.isFinite(value) || value < 0) return '';

        const ordinals = [
            'Ground', 'First', 'Second', 'Third', 'Fourth', 'Fifth',
            'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth',
            'Eleventh', 'Twelfth', 'Thirteenth', 'Fourteenth',
            'Fifteenth', 'Sixteenth', 'Seventeenth', 'Eighteenth',
            'Nineteenth', 'Twentieth'
        ];

        if (value < ordinals.length) {
            return `${ordinals[value]} Floor`;
        }
        return `Floor ${value}`;
    };

    const formatFloorRange = (totalFloors) => {
        const value = Number(totalFloors);
        if (!Number.isFinite(value) || value < 0) return '';
        const count = value + 1;
        return `${count} floor${count === 1 ? '' : 's'}`;
    };

    const getFloorList = (totalFloors) => Array.from(
        { length: Number(totalFloors) + 1 },
        (_, index) => formatFloorLabel(index)
    );

    const openDetails = (block) => {
        setDetailModal({ show: true, block });
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
                                    {editingId ? 'Edit Block' : 'Add New Block with Floors'}
                                </h5>
                            </div>
                        </div>

                        <div className="alert alert-info py-2 mb-3" role="alert">
                            Floors start from 0 (Ground) up to the last floor you enter.
                        </div>

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
                                    <option value="">Select Gender</option>
                                    <option value="BOYS">BOYS</option>
                                    <option value="GIRLS">GIRLS</option>
                                </select>
                            </div>
                            <div className="col-md-2">
                                <label className="form-label fw-bold mb-1">Start Floor (Fixed: 0)</label>
                                <input
                                    type="number"
                                    className="form-control"
                                    value={form.floor_start}
                                    readOnly
                                />
                            </div>
                            <div className="col-md-2">
                                <label className="form-label fw-bold mb-1">Last Floor Number</label>
                                <input
                                    type="number"
                                    className="form-control"
                                    value={form.floor_end}
                                    onChange={(e) => setForm({ ...form, floor_end: e.target.value })}
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
                                            setForm({ id: '', block_name: '', gender: '', floor_start: 0, floor_end: 0 });
                                        }}
                                    >
                                        Cancel
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>

                    <div className="students-section-shell card card-soft">
                        <div className="mb-3">
                            <h5 className="section-title fw-bold mb-1" style={{ fontSize: '1.3rem' }}>Block List</h5>
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
                                                <tr key={block.id} style={{ cursor: 'pointer' }} onClick={() => openDetails(block)}>
                                                    <td className="fw-bold">{block.block_name}</td>
                                                    <td className="fw-bold">{block.gender}</td>
                                                    <td>{formatFloorRange(block.total_floors)}</td>
                                                    <td className="text-end">
                                                        <div className="d-flex justify-content-end gap-2">
                                                            <button
                                                                className="btn btn-sm btn-outline-primary students-button-sm"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleEdit(block);
                                                                }}
                                                            >
                                                                <i className="bi bi-pencil"></i>
                                                            </button>
                                                            <button
                                                                className="btn btn-sm btn-outline-danger students-button-sm"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setDeleteModal({ show: true, id: block.id });
                                                                }}
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

            {saveModal.show && (
                <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }}>
                    <div className="modal-dialog modal-dialog-centered modal-lg">
                        <div className="modal-content border-0 shadow-lg block-details-modal">
                            <div className="modal-header" style={{ background: 'linear-gradient(180deg, #606c88 0%, #3f4c6b 50%, #606c88 100%)', color: 'white' }}>
                                <h5 className="modal-title fw-bold text-uppercase" style={{ color: '#ffffff' }}>
                                    {saveModal.isEdit ? 'CONFIRM BLOCK UPDATE' : 'CONFIRM NEW BLOCK'}
                                </h5>
                                <button
                                    type="button"
                                    className="btn-close btn-close-white"
                                    onClick={() => setSaveModal({ show: false, payload: null, isEdit: false })}
                                    aria-label="Close"
                                ></button>
                            </div>
                            <div className="modal-body p-4 bg-white">
                                <div className="p-3 bg-light border rounded">
                                    <div className="d-flex flex-column gap-3">
                                        <div className="d-flex align-items-center">
                                            <small className="text-muted text-uppercase fw-bold" style={{ width: '140px', fontSize: '0.85rem' }}>Block Name</small>
                                            <span className="fw-bold text-dark fs-6">: {saveModal.payload?.block_name}</span>
                                        </div>
                                        <div className="d-flex align-items-center">
                                            <small className="text-muted text-uppercase fw-bold" style={{ width: '140px', fontSize: '0.85rem' }}>Gender</small>
                                            <span className="fw-bold text-dark fs-6">: {saveModal.payload?.gender}</span>
                                        </div>
                                        <div className="d-flex align-items-center">
                                            <small className="text-muted text-uppercase fw-bold" style={{ width: '140px', fontSize: '0.85rem' }}>Total Floors</small>
                                            <span className="fw-bold text-dark fs-6">: {formatFloorRange(saveModal.payload?.total_floors)}</span>
                                        </div>
                                        <div className="d-flex align-items-start">
                                            <small className="text-muted text-uppercase fw-bold mt-1" style={{ width: '140px', fontSize: '0.85rem' }}>Floors</small>
                                            <div className="fw-bold text-dark fs-6 d-flex">
                                                <ul className="mb-0 ps-3">
                                                    {Array.from(
                                                        { length: Number(saveModal.payload?.total_floors ?? 0) + 1 },
                                                        (_, index) => (
                                                            <li key={index}>{formatFloorLabel(index)}</li>
                                                        )
                                                    )}
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer bg-light border-0">
                                <button
                                    type="button"
                                    className="btn btn-outline-secondary px-4"
                                    onClick={() => setSaveModal({ show: false, payload: null, isEdit: false })}
                                    disabled={saving}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary px-4"
                                    onClick={handleConfirmSave}
                                    disabled={saving}
                                >
                                    {saving ? 'Saving...' : (saveModal.isEdit ? 'Update Block' : 'Add Block')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {detailModal.show && detailModal.block && (
                <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content block-details-modal">
                            <div
                                className="modal-header"
                                style={{ background: 'linear-gradient(180deg, #606c88 0%, #3f4c6b 50%, #606c88 100%)', color: 'white' }}
                            >
                                <h5 className="modal-title fw-bold">Block Details</h5>
                                <button
                                    type="button"
                                    className="btn-close btn-close-white"
                                    onClick={() => setDetailModal({ show: false, block: null })}
                                    aria-label="Close"
                                ></button>
                            </div>
                            <div className="modal-body">
                                <div className="mb-3">
                                    <div className="bg-light rounded p-4 border">
                                        <div className="d-flex flex-column gap-3">
                                            <div className="d-flex align-items-center">
                                                <small className="text-muted text-uppercase fw-bold" style={{ width: '140px', fontSize: '0.85rem' }}>Block Name</small>
                                                <span className="fw-bold text-dark fs-6">: {detailModal.block.block_name}</span>
                                            </div>
                                            <div className="d-flex align-items-center">
                                                <small className="text-muted text-uppercase fw-bold" style={{ width: '140px', fontSize: '0.85rem' }}>Gender</small>
                                                <span className="fw-bold text-dark fs-6">: {detailModal.block.gender}</span>
                                            </div>
                                            <div className="d-flex align-items-center">
                                                <small className="text-muted text-uppercase fw-bold" style={{ width: '140px', fontSize: '0.85rem' }}>Total Floors</small>
                                                <span className="fw-bold text-dark fs-6">: {formatFloorRange(detailModal.block.total_floors)}</span>
                                            </div>
                                            <div className="d-flex align-items-start">
                                                <small className="text-muted text-uppercase fw-bold" style={{ width: '140px', fontSize: '0.85rem' }}>Floors</small>
                                                <div className="fw-bold text-dark fs-6">
                                                    {(() => {
                                                        const floors = getFloorList(detailModal.block.total_floors);
                                                        if (floors.length === 0) return null;
                                                        return (
                                                            <>
                                                                <div>: {floors[0]}</div>
                                                                {floors.slice(1).map((floor, index) => (
                                                                    <div key={`${floor}-${index}`} style={{ paddingLeft: '12px' }}>
                                                                        {floor}
                                                                    </div>
                                                                ))}
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button
                                    type="button"
                                    className="btn btn-outline-secondary"
                                    onClick={() => setDetailModal({ show: false, block: null })}
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <style>{`
                .block-details-modal .modal-title {
                    color: #ffffff !important;
                }
            `}</style>
        </HostelShell>
    );
}
