import { useState, useEffect } from 'react'
import { supabase } from '../../../supabaseClient'
import { useStudentAuth } from '../../store/studentAuth'
import StudentShell from '../../components/StudentShell'
import { toast } from 'react-toastify'
import './Student.css'

export default function StudentTransport() {
    const { student } = useStudentAuth()
    const [searchTerm, setSearchTerm] = useState('')
    const [boardingPoints, setBoardingPoints] = useState([])
    const [filteredPoints, setFilteredPoints] = useState([])
    const [hasSearched, setHasSearched] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [registeringId, setRegisteringId] = useState(null)
    const [existingRegistration, setExistingRegistration] = useState(null)
    // Modal & Fee State
    const [showModal, setShowModal] = useState(false)
    const [selectedPoint, setSelectedPoint] = useState(null)
    const [transportFee, setTransportFee] = useState(null)

    useEffect(() => {
        if (student) {
            fetchTransportData()
            checkExistingRegistration()
            fetchTransportFee()
        }
    }, [student])

    useEffect(() => {
        if (!searchTerm) {
            setFilteredPoints([]) // Or should this be empty or full? User said "below this sections should be shows if the input text is in database"
            // Interpreting as: if text exists, show matches. If empty, show nothing?
            // "if the input text is in database shows" -> suggests matches only.
            setFilteredPoints([])
        } else {
            const lowerTerm = searchTerm.toLowerCase().trim()
            if (!lowerTerm) {
                setFilteredPoints([])
                return
            }

            const filtered = boardingPoints.filter(point =>
                point.name.toLowerCase().startsWith(lowerTerm) ||
                point.transport_routes?.route_name.toLowerCase().startsWith(lowerTerm) ||
                point.transport_routes?.route_no.toLowerCase().startsWith(lowerTerm)
            )
            setFilteredPoints(filtered)
        }
    }, [searchTerm, boardingPoints])

    const handleSearch = () => {
        // This is now covered by the effect, but kept for button click if needed
        if (!searchTerm.trim()) {
            toast.warning('Please enter a search term')
        }
    }

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleSearch()
        }
    }

    const fetchTransportData = async () => {
        try {
            setIsLoading(true)
            // Fetch all boarding points with their route details
            const { data, error } = await supabase
                .from('transport_route_boarding_points')
                .select(`
                    id,
                    name,
                    departure_time,
                    route_id,
                    transport_routes (
                        id,
                        route_name,
                        route_no,
                        vehicle_register_no,
                        academic_year,
                        seats_available,
                        reserved_seats,
                        student_transport (count)
                    )
                `)
                .order('name')

            if (error) throw error
            setBoardingPoints(data || [])

            // setFilteredPoints(data || []) // Don't show by default
        } catch (error) {
            console.error('Error fetching transport data:', error)
            toast.error('Failed to load transport details')
        } finally {
            setIsLoading(false)
        }
    }

    const fetchTransportFee = async () => {
        if (!student?.academic_year) return
        try {
            const { data, error } = await supabase
                .from('transport_route_fares')
                .select('amount')
                .eq('academic_year', student.academic_year)
                .maybeSingle()

            if (!error && data) {
                setTransportFee(data.amount)
            }
        } catch (error) {
            console.error('Error fetching fee:', error)
        }
    }

    const checkExistingRegistration = async () => {
        try {
            const { data, error } = await supabase
                .from('student_transport')
                .select(`
                    *,
                    transport_routes (route_name, route_no, reserved_seats),
                    transport_route_boarding_points (name, departure_time)
                `)
                .eq('student_id', student.id)
                .maybeSingle()

            if (error) throw error
            setExistingRegistration(data)
        } catch (error) {
            console.error('Error checking registration:', error)
        }
    }

    const handleSelectPoint = (point) => {
        setSelectedPoint(point)
        setShowModal(true)
    }

    const handleConfirmRegistration = async () => {
        if (!student || !selectedPoint) return
        const point = selectedPoint
        const academicYear = point.transport_routes?.academic_year || student.academic_year

        // Check if route is full using reserved_seats
        const route = point.transport_routes
        const capacity = Number(route?.seats_available || 0)
        // Use reserved_seats if available, otherwise fallback to count (though user asked for reserved_seats)
        const currentReserved = route?.reserved_seats !== undefined ? Number(route.reserved_seats) : (route?.student_transport?.[0]?.count || 0)

        const isFull = currentReserved >= capacity
        const status = isFull ? 'NOT CONFIRMED' : 'CONFIRMED'

        setRegisteringId(point.id)
        try {
            if (existingRegistration) {
                // Update Logic
                const oldRouteId = existingRegistration.route_id
                const oldStatus = existingRegistration.status
                const oldReserved = existingRegistration.transport_routes?.reserved_seats || 0

                const { error: updateError } = await supabase
                    .from('student_transport')
                    .update({
                        route_id: point.route_id,
                        boarding_point_id: point.id,
                        academic_year: academicYear,
                        status: status
                    })
                    .eq('id', existingRegistration.id)

                if (updateError) throw updateError

                // Handle Counter Updates
                // 1. Decrement Old if it was confirmed
                if (oldStatus === 'CONFIRMED' && oldRouteId) {
                    // Check if we moved to a new route OR status changed (e.g. became waitlisted on new route)
                    // If route is same and status is same (CONFIRMED -> CONFIRMED), no change needed.
                    if (oldRouteId !== point.route_id || status !== oldStatus) {
                        await supabase.from('transport_routes')
                            .update({ reserved_seats: Math.max(0, oldReserved - 1) })
                            .eq('id', oldRouteId)
                    }
                }

                // 2. Increment New if it is confirmed
                if (status === 'CONFIRMED') {
                    // Increment if route switched or status switched (Waitlist -> Confirmed)
                    if (oldRouteId !== point.route_id || oldStatus !== 'CONFIRMED') {
                        await supabase.from('transport_routes')
                            .update({ reserved_seats: currentReserved + 1 })
                            .eq('id', point.route_id)
                    }
                }

                toast.success(isFull ? 'Added to waiting list successfully' : 'Transport route updated successfully')
            } else {
                // Insert Logic
                const { error: insertError } = await supabase
                    .from('student_transport')
                    .insert([{
                        student_id: student.id,
                        route_id: point.route_id,
                        boarding_point_id: point.id,
                        academic_year: academicYear,
                        status: status
                    }])

                if (insertError) throw insertError

                await supabase
                    .from('students')
                    .update({ is_transport: true })
                    .eq('id', student.id)

                // Increment Sequence if Confirmed
                if (status === 'CONFIRMED') {
                    await supabase.from('transport_routes')
                        .update({ reserved_seats: currentReserved + 1 })
                        .eq('id', point.route_id)
                }

                toast.success(isFull ? 'Added to waiting list successfully' : 'Registered for transport successfully')
            }

            // Refresh data
            await fetchTransportData()
            await checkExistingRegistration()
            setShowModal(false)
            setSelectedPoint(null)

        } catch (error) {
            console.error('Error registering for transport:', error)
            toast.error('Failed to register for transport')
        } finally {
            setRegisteringId(null)
        }
    }

    return (
        <StudentShell>
            <div className="students-section-shell">
                <div className="students-section-shell-header d-flex justify-content-between align-items-center">
                    <div>
                        <h2 className="mb-1">Transport Registration</h2>
                    </div>
                </div>

                <div className="card students-section-card mb-4">
                    <div className="card-body p-4">
                        {existingRegistration && (
                            <div className={`alert ${existingRegistration.status === 'CONFIRMED' ? 'alert-success border-success' : 'alert-warning border-warning'} bg-opacity-10 d-flex align-items-start mb-4 gap-3 p-4 rounded-3 shadow-sm`}>
                                <div className={`p-2 ${existingRegistration.status === 'CONFIRMED' ? 'bg-success' : 'bg-warning'} text-white rounded-circle d-flex align-items-center justify-content-center`} style={{ width: '40px', height: '40px' }}>
                                    <i className={`bi ${existingRegistration.status === 'CONFIRMED' ? 'bi-check-lg' : 'bi-clock-history'} fs-5`}></i>
                                </div>
                                <div className="flex-grow-1">
                                    <h5 className="alert-heading fw-bold mb-3 text-dark">
                                        Transport Registration Status: {existingRegistration.status === 'CONFIRMED' ? 'Confirmed' : 'Waitlisted'}
                                    </h5>

                                    <div className="row g-3">
                                        <div className="col-md-6">
                                            <div className="text-muted small text-uppercase fw-bold">Route Details</div>
                                            <div className="fw-bold fs-5 text-dark">{existingRegistration.transport_routes?.route_name}</div>
                                            <div className="text-dark">Route No: {existingRegistration.transport_routes?.route_no}</div>
                                            {existingRegistration.transport_routes?.vehicle_register_no && (
                                                <div className="text-dark"><i className="bi bi-truck me-1"></i> {existingRegistration.transport_routes?.vehicle_register_no}</div>
                                            )}
                                        </div>

                                        <div className="col-md-6">
                                            <div className="text-muted small text-uppercase fw-bold">Boarding Info</div>
                                            <div className="fw-bold fs-5 text-dark">{existingRegistration.transport_route_boarding_points?.name}</div>
                                            <div className="text-dark"><i className="bi bi-clock me-1"></i> {existingRegistration.transport_route_boarding_points?.departure_time}</div>
                                        </div>

                                        <div className="col-12 mt-3 pt-3 border-top border-opacity-25" style={{ borderColor: 'inherit' }}>
                                            <div className="d-flex justify-content-between align-items-center">
                                                <div>
                                                    <div className="text-muted small text-uppercase fw-bold">Annual Fee</div>
                                                    <div className="fs-4 fw-bold text-dark">
                                                        {transportFee ? `₹${Number(transportFee).toLocaleString()}` : <span className="text-muted fs-6">Not set</span>}
                                                    </div>
                                                </div>
                                                <span className={`badge ${existingRegistration.status === 'CONFIRMED' ? 'bg-success' : 'bg-warning text-dark'} px-3 py-2 rounded-pill`}>
                                                    {existingRegistration.status || 'Registered'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}



                        {!existingRegistration && (
                            <>
                                <div className="mb-4">
                                    <label className="form-label fw-bold">Find Boarding Point</label>
                                    <div className="input-group shadow-sm">
                                        <span className="input-group-text bg-white border-end-0 py-3 ps-4">
                                            <i className="bi bi-search text-muted fs-5"></i>
                                        </span>
                                        <input
                                            type="text"
                                            className="form-control border-start-0 ps-0 py-3"
                                            style={{ fontSize: '1.15rem' }}
                                            placeholder="Search by area, route name or number..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            onKeyPress={handleKeyPress}
                                        />
                                        <button
                                            className="btn btn-primary px-5 py-3 fw-bold"
                                            type="button"
                                            onClick={handleSearch}
                                        >
                                            Search
                                        </button>
                                    </div>
                                    <div className="text-muted mt-2 fs-6">Type your area name to see available bus routes</div>
                                </div>

                                {isLoading ? (
                                    <div className="text-center py-5">
                                        <div className="spinner-border text-primary" role="status">
                                            <span className="visually-hidden">Loading...</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="table-responsive rounded-3 border">
                                        <table className="table table-hover align-middle mb-0">
                                            <thead className="table-light">
                                                <tr>
                                                    <th className="py-3 ps-4" style={{ width: '60px' }}>S.No</th>
                                                    <th className="py-3">Boarding Point</th>
                                                    <th className="py-3">Departure Time</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredPoints.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="3" className="text-center py-5 text-muted">
                                                            {searchTerm ? 'No boarding points found matching your search.' : 'Type to search for boarding points.'}
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    filteredPoints.map((point, index) => (
                                                        <tr
                                                            key={point.id}
                                                            onClick={() => handleSelectPoint(point)}
                                                            style={{ cursor: 'pointer' }}
                                                            className={existingRegistration?.boarding_point_id === point.id ? 'table-success' : ''}
                                                        >
                                                            <td className="ps-4 fw-bold text-secondary">
                                                                {index + 1}
                                                            </td>
                                                            <td>
                                                                <div className="fw-medium text-dark">{point.name}</div>
                                                            </td>
                                                            <td>
                                                                <span className="badge bg-light text-dark border fs-6 px-3 py-2">
                                                                    <i className="bi bi-clock me-1"></i>
                                                                    {point.departure_time}
                                                                </span>
                                                                {existingRegistration?.boarding_point_id === point.id && (
                                                                    <span className="badge bg-success ms-2">Selected</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Confirmation Modal */}
            {showModal && selectedPoint && (
                <>
                    <div className="modal-backdrop fade show"></div>
                    <div className="modal fade show d-block" tabIndex="-1">
                        <div className="modal-dialog modal-dialog-centered">
                            <div className="modal-content">
                                <div className="modal-header border-0 pb-0">
                                    <h5 className="modal-title fw-bold">Confirm Selection</h5>
                                    <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
                                </div>
                                <div className="modal-body pt-2">


                                    <div className="bg-light p-3 rounded-3 mb-3">
                                        <div className="row g-2 fs-5">
                                            <div className="col-12">
                                                <span className="fw-bold">Route No : </span>
                                                <span>{selectedPoint.transport_routes?.route_no}</span>
                                            </div>
                                            <div className="col-12">
                                                <span className="fw-bold">Route Name : </span>
                                                <span>{selectedPoint.transport_routes?.route_name}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="d-flex justify-content-between align-items-center bg-white border p-3 rounded-3 mb-3">
                                        <div>
                                            <span className="text-muted d-block fs-6">Boarding Point</span>
                                            <div className="fw-bold text-primary fs-5">{selectedPoint.name}</div>
                                        </div>
                                        <div className="text-end">
                                            <span className="text-muted d-block fs-6">Time</span>
                                            <div className="badge bg-primary bg-opacity-10 text-primary fs-5">
                                                {selectedPoint.departure_time}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-light p-3 rounded-3 mb-3">
                                        <div className="row g-2 fs-5">
                                            {student?.academic_year && (
                                                <div className="col-12">
                                                    <span className="fw-bold">Academic Year : </span>
                                                    <span>{student.academic_year}</span>
                                                </div>
                                            )}
                                            <div className="col-12">
                                                <span className="fw-bold">Annual Transport Fee : </span>
                                                <span className="text-success fw-bold">{transportFee ? `₹${Number(transportFee).toLocaleString()}` : 'N/A'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {(() => {
                                        const route = selectedPoint.transport_routes
                                        const capacity = Number(route?.seats_available || 0)
                                        const reserved = route?.reserved_seats !== undefined ? Number(route.reserved_seats) : (route?.student_transport?.[0]?.count || 0)
                                        const isFull = reserved >= capacity

                                        return isFull ? (
                                            <div className="alert alert-warning border-warning bg-warning bg-opacity-10 d-flex align-items-center mb-0 mt-3" role="alert">
                                                <i className="bi bi-exclamation-triangle-fill me-2"></i>
                                                <div className="small fw-bold text-dark">This route is currently full. You can join the waiting list.</div>
                                            </div>
                                        ) : null
                                    })()}

                                </div>
                                <div className="modal-footer border-0 pt-0">
                                    <button type="button" className="btn btn-light" onClick={() => setShowModal(false)}>Cancel</button>

                                    {(() => {
                                        const route = selectedPoint.transport_routes
                                        const capacity = Number(route?.seats_available || 0)
                                        const reserved = route?.reserved_seats !== undefined ? Number(route.reserved_seats) : (route?.student_transport?.[0]?.count || 0)
                                        const isFull = reserved >= capacity

                                        return (
                                            <button
                                                type="button"
                                                className={`btn ${isFull ? 'btn-warning text-dark' : 'btn-primary'} px-4`}
                                                onClick={handleConfirmRegistration}
                                                disabled={!!registeringId}
                                            >
                                                {registeringId ? (
                                                    <>
                                                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                                        {isFull ? 'Joining Waitlist...' : 'Confirming...'}
                                                    </>
                                                ) : (isFull ? 'Confirm & Join Waitlist' : 'Confirm Registration')}
                                            </button>
                                        )
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </StudentShell>
    )
}
