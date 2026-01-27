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
    const [isLoading, setIsLoading] = useState(true)
    const [registeringId, setRegisteringId] = useState(null)
    const [existingRegistration, setExistingRegistration] = useState(null)

    useEffect(() => {
        if (student) {
            fetchTransportData()
            checkExistingRegistration()
        }
    }, [student])

    useEffect(() => {
        if (!searchTerm) {
            setFilteredPoints(boardingPoints)
        } else {
            const lowerTerm = searchTerm.toLowerCase()
            const filtered = boardingPoints.filter(point =>
                point.name.toLowerCase().includes(lowerTerm) ||
                point.transport_routes?.route_name.toLowerCase().includes(lowerTerm) ||
                point.transport_routes?.route_no.toLowerCase().includes(lowerTerm)
            )
            setFilteredPoints(filtered)
        }
    }, [searchTerm, boardingPoints])

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
                        academic_year
                    )
                `)
                .order('name')

            if (error) throw error
            setBoardingPoints(data || [])
            setFilteredPoints(data || [])
        } catch (error) {
            console.error('Error fetching transport data:', error)
            toast.error('Failed to load transport details')
        } finally {
            setIsLoading(false)
        }
    }

    const checkExistingRegistration = async () => {
        try {
            const { data, error } = await supabase
                .from('student_transport')
                .select(`
                    *,
                    transport_routes (route_name, route_no),
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

    const handleRegister = async (point) => {
        if (!student) return

        // Use student's academic year if available, otherwise use route's or current (assuming logic)
        // For now, let's use the route's academic year as transport is usually tied to it
        const academicYear = point.transport_routes?.academic_year || student.academic_year

        setRegisteringId(point.id)
        try {
            // Check if already registered (double check)
            if (existingRegistration) {
                // Determine if we should update or block. User said "registration", usually implies new.
                // Or maybe update if they want to change route.
                // Let's allow update for flexibility, but warn/ask? 
                // For this implementation, I'll do an upsert or delete-then-insert style update logic
                // But specifically for 'student_transport', let's assume one route per student per year.

                const { error: updateError } = await supabase
                    .from('student_transport')
                    .update({
                        route_id: point.route_id,
                        boarding_point_id: point.id,
                        academic_year: academicYear
                    })
                    .eq('id', existingRegistration.id)

                if (updateError) throw updateError
                toast.success('Transport route updated successfully')
            } else {
                const { error: insertError } = await supabase
                    .from('student_transport')
                    .insert([{
                        student_id: student.id,
                        route_id: point.route_id,
                        boarding_point_id: point.id,
                        academic_year: academicYear
                    }])

                if (insertError) throw insertError

                // specific logic to update student status
                await supabase
                    .from('students')
                    .update({ is_transport: true })
                    .eq('id', student.id)

                toast.success('Registered for transport successfully')
            }

            // Refresh registration status
            checkExistingRegistration()

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
                        <p className="students-section-copy mb-0">Search and select your boarding point</p>
                    </div>
                </div>

                <div className="card students-section-card mb-4">
                    <div className="card-body p-4">
                        {existingRegistration && (
                            <div className="alert alert-info d-flex align-items-center mb-4" role="alert">
                                <i className="bi bi-info-circle-fill me-2 fs-4"></i>
                                <div>
                                    <strong>Current Registration:</strong><br />
                                    Route: {existingRegistration.transport_routes?.route_name} ({existingRegistration.transport_routes?.route_no}) <br />
                                    Boarding Point: {existingRegistration.transport_route_boarding_points?.name} <br />
                                    Time: {existingRegistration.transport_route_boarding_points?.departure_time}
                                </div>
                            </div>
                        )}

                        <div className="mb-4">
                            <label className="form-label fw-bold">Find Boarding Point</label>
                            <div className="input-group">
                                <span className="input-group-text bg-white border-end-0">
                                    <i className="bi bi-search text-muted"></i>
                                </span>
                                <input
                                    type="text"
                                    className="form-control border-start-0 ps-0"
                                    placeholder="Search by area, route name or number..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div className="form-text">Type your area name to see available bus routes</div>
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
                                            <th className="py-3 ps-4">Route Info</th>
                                            <th className="py-3">Boarding Point</th>
                                            <th className="py-3">Departure Time</th>
                                            <th className="py-3 text-end pe-4">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredPoints.length === 0 ? (
                                            <tr>
                                                <td colSpan="4" className="text-center py-5 text-muted">
                                                    No boarding points found matching your search.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredPoints.map(point => (
                                                <tr key={point.id}>
                                                    <td className="ps-4">
                                                        <div className="fw-bold text-dark">{point.transport_routes?.route_name}</div>
                                                        <div className="small text-muted">No: {point.transport_routes?.route_no}</div>
                                                    </td>
                                                    <td>
                                                        <div className="fw-medium text-dark">{point.name}</div>
                                                    </td>
                                                    <td>
                                                        <span className="badge bg-light text-dark border">
                                                            <i className="bi bi-clock me-1"></i>
                                                            {point.departure_time}
                                                        </span>
                                                    </td>
                                                    <td className="text-end pe-4">
                                                        <button
                                                            className={`btn btn-sm ${existingRegistration?.boarding_point_id === point.id ? 'btn-success disabled' : 'btn-primary'}`}
                                                            onClick={() => handleRegister(point)}
                                                            disabled={registeringId === point.id || existingRegistration?.boarding_point_id === point.id}
                                                        >
                                                            {existingRegistration?.boarding_point_id === point.id ? (
                                                                <>
                                                                    <i className="bi bi-check-circle me-1"></i> Selected
                                                                </>
                                                            ) : registeringId === point.id ? (
                                                                <>
                                                                    <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                                                                    Saving...
                                                                </>
                                                            ) : (
                                                                <>
                                                                    Select
                                                                </>
                                                            )}
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </StudentShell>
    )
}
