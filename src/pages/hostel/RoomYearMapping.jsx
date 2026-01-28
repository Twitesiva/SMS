import { useEffect, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import HostelShell from '../../components/HostelShell';
import HostelPreloader from '../../components/HostelPreloader';
import { toast } from 'react-toastify';

export default function RoomYearMapping() {
    const [years, setYears] = useState([]);
    const [selectedYear, setSelectedYear] = useState('');
    const [blocks, setBlocks] = useState([]);
    const [selectedBlock, setSelectedBlock] = useState('');
    const [rooms, setRooms] = useState([]);
    const [mappings, setMappings] = useState({});
    const [loading, setLoading] = useState(false);

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
    }, [selectedYear, selectedBlock]);

    const fetchRoomsAndMappings = async () => {
        setLoading(true);
        const [roomsRes, mappingsRes] = await Promise.all([
            supabase.from('hostel_rooms').select('*').eq('block_id', selectedBlock).order('room_no'),
            supabase.from('hostel_room_year_mapping').select('*').eq('academic_year', selectedYear)
        ]);

        if (roomsRes.error) toast.error(roomsRes.error.message);
        else setRooms(roomsRes.data || []);

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

    const toggleMapping = async (roomId) => {
        const currentValue = mappings[roomId] ?? false;
        const newValue = !currentValue;

        const { data: existing } = await supabase.from('hostel_room_year_mapping')
            .select('id')
            .eq('room_id', roomId)
            .eq('academic_year', selectedYear)
            .maybeSingle();

        let error;
        if (existing) {
            const res = await supabase.from('hostel_room_year_mapping')
                .update({ is_active: newValue })
                .eq('id', existing.id);
            error = res.error;
        } else {
            const res = await supabase.from('hostel_room_year_mapping')
                .insert([{ room_id: roomId, academic_year: selectedYear, is_active: newValue }]);
            error = res.error;
        }

        if (error) toast.error(error.message);
        else {
            setMappings(prev => ({ ...prev, [roomId]: newValue }));
            toast.success(`Room ${rooms.find(r => r.id === roomId).room_no} ${newValue ? 'enabled' : 'disabled'} for ${selectedYear}`);
        }
    };

    const enableAll = async () => {
        const updates = rooms.map(r => ({
            room_id: r.id,
            academic_year: selectedYear,
            is_active: true
        }));
        
        const { error } = await supabase.from('hostel_room_year_mapping').upsert(updates, { onConflict: 'room_id, academic_year' });
        if (error) toast.error(error.message);
        else {
            toast.success(`All rooms enabled for ${selectedBlock}`);
            fetchRoomsAndMappings();
        }
    };

    return (
        <HostelShell brandTitle="HOSTEL MANAGEMENT">
            <div className="desktop-container">
                <h4 className="mb-4">Room Year Mapping</h4>

                <section className="setup-section mb-4">
                    <div className="students-section-shell card card-soft mb-4">
                        <div className="students-section-shell-header mb-3">
                            <div>
                                <h5 className="section-title mb-1" style={{ fontSize: '1.1rem' }}>Session Setup</h5>
                                <p className="students-section-copy mb-0">Enable specific rooms for the selected academic year.</p>
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
                                <label className="form-label fw-bold mb-1">Block</label>
                                <select className="form-select" value={selectedBlock} onChange={(e) => setSelectedBlock(e.target.value)}>
                                    <option value="">Select Block</option>
                                    {blocks.map(b => <option key={b.id} value={b.id}>{b.block_name}</option>)}
                                </select>
                            </div>
                            <div className="col-md-4 d-flex align-items-end">
                                <button className="btn btn-outline-primary students-button w-100" onClick={enableAll} disabled={!selectedYear || !selectedBlock || loading}>
                                    Enable All Rooms in this Block
                                </button>
                            </div>
                        </div>
                    </div>

                    {!selectedYear || !selectedBlock ? (
                        <div className="students-section-shell card card-soft text-center py-5">
                            <i className="bi bi-calendar-check display-1 text-muted opacity-25"></i>
                            <h5 className="mt-3 text-muted">Please select Academic Year and Block to start mapping.</h5>
                        </div>
                    ) : (
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
                                            <tr className="text-muted small text-uppercase fw-bold">
                                                <th>Room No</th>
                                                <th>Floor</th>
                                                <th>Room Type</th>
                                                <th>Capacity</th>
                                                <th className="text-center">Availability Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rooms.length === 0 ? (
                                                <tr><td colSpan="5" className="text-center py-4">No rooms found in this block</td></tr>
                                            ) : (
                                                rooms.map((room) => (
                                                    <tr key={room.id}>
                                                        <td className="fw-bold">{room.room_no}</td>
                                                        <td>Floor {room.floor_no}</td>
                                                        <td>{room.room_type?.replace(/_/g, ' ')}</td>
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
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </section>
            </div>
        </HostelShell>
    );
}
