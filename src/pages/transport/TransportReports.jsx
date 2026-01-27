import React, { useState, useEffect } from 'react'
import TransportShell from '../../components/TransportShell'
import { supabase } from '../../../supabaseClient'
import { toast } from 'react-toastify'

export default function TransportReports() {
    const [searchTerm, setSearchTerm] = useState('')
    const [routeDetails, setRouteDetails] = useState(null)
    const [isLoading, setIsLoading] = useState(false)

    const handleSearch = async () => {
        if (!searchTerm) return

        setIsLoading(true)
        setRouteDetails(null)

        try {
            // First find the route
            const { data: routeData, error: routeError } = await supabase
                .from('transport_routes')
                .select('*')
                .ilike('route_no', searchTerm)
                .single()

            if (routeError) {
                if (routeError.code === 'PGRST116') {
                    toast.error('Route number not found.')
                } else {
                    console.error('Error fetching route:', routeError)
                    toast.error('Error searching for route.')
                }
                setIsLoading(false)
                return
            }

            if (!routeData) {
                toast.error('Route not found.')
                setIsLoading(false)
                return
            }

            // Now get students registered for this route
            const { data: studentsData, error: studentsError } = await supabase
                .from('student_transport')
                .select(`
                    id,
                    student_id,
                    boarding_point_id,
                    students (
                        full_name,
                        student_id,
                        course_name,
                        group_name,
                        academic_year
                    ),
                    transport_route_boarding_points (
                        name,
                        departure_time
                    )
                `)
                .eq('route_id', routeData.id)

            if (studentsError) {
                console.error('Error fetching registered students:', studentsError)
                toast.error('Error fetching student details.')
                setIsLoading(false)
                return
            }

            setRouteDetails({
                route: routeData,
                students: studentsData || []
            })


        } catch (error) {
            console.error('Unexpected error:', error)
            toast.error('An unexpected error occurred.')
        } finally {
            setIsLoading(false)
        }
    }

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleSearch()
        }
    }


    return (
        <TransportShell>
            <div className="container-fluid py-4">
                <div className="row mb-4">
                    <div className="col-12">
                        <h2 className="mb-2">Transport Reports</h2>
                        <p className="text-muted">Enter a route number to view registered students and route details.</p>
                    </div>
                </div>

                <div className="card shadow-sm border-0 mb-4">
                    <div className="card-body p-4">
                        <div className="row g-3">
                            <div className="col-md-6">
                                <label className="form-label fw-bold">Search Route</label>
                                <div className="input-group">
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="Enter Route Number (e.g., RR02)"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        onKeyPress={handleKeyPress}
                                    />
                                    <button
                                        className="btn btn-primary px-4"
                                        onClick={handleSearch}
                                        disabled={isLoading}
                                    >
                                        {isLoading ? 'Searching...' : 'Search'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {routeDetails && (
                    <div className="fade-in">
                        {/* Route Summary Card */}
                        <div className="card shadow-sm border-0 mb-4 bg-primary bg-opacity-10">
                            <div className="card-body p-4">
                                <h4 className="card-title text-primary fw-bold mb-4">Route Information : {routeDetails.route.route_name}</h4>
                                <div className="row g-4">
                                    <div className="col-md-3">
                                        <small className="text-muted d-block text-uppercase fw-bold mb-1">Route Number</small>
                                        <span className="fs-5 fw-bold text-dark">{routeDetails.route.route_no}</span>
                                    </div>
                                    <div className="col-md-3">
                                        <small className="text-muted d-block text-uppercase fw-bold mb-1">Bus Register No</small>
                                        <span className="fs-5 fw-bold text-dark">{routeDetails.route.vehicle_register_no || 'N/A'}</span>
                                    </div>
                                    <div className="col-md-3">
                                        <small className="text-muted d-block text-uppercase fw-bold mb-1">Total Seats</small>
                                        <span className="fs-5 fw-bold text-dark">{routeDetails.route.seats_available || 'N/A'}</span>
                                    </div>
                                    <div className="col-md-3">
                                        <small className="text-muted d-block text-uppercase fw-bold mb-1">Total Registered</small>
                                        <span className="fs-5 fw-bold text-primary">{routeDetails.students.length}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Students Table */}
                        <div className="card shadow-sm border-0">
                            <div className="card-header bg-white py-3">
                                <h5 className="mb-0 fw-bold">Registered Student List</h5>
                            </div>
                            <div className="table-responsive">
                                <table className="table table-hover align-middle mb-0">
                                    <thead className="table-light">
                                        <tr>
                                            <th className="py-3 ps-4">S.No</th>
                                            <th className="py-3">Student Name</th>
                                            <th className="py-3">Boarding Point</th>
                                            <th className="py-3">Time</th>
                                            <th className="py-3">Class Info</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {routeDetails.students.length > 0 ? (
                                            routeDetails.students.map((record, index) => (
                                                <tr key={record.id}>
                                                    <td className="ps-4 fw-bold text-secondary">{index + 1}</td>
                                                    <td>
                                                        <div className="fw-bold text-dark">{record.students?.full_name}</div>
                                                        <div className="small text-muted">{record.students?.student_id}</div>
                                                    </td>
                                                    <td className="fw-medium">{record.transport_route_boarding_points?.name}</td>
                                                    <td>
                                                        <span className="badge bg-light text-dark border">
                                                            {record.transport_route_boarding_points?.departure_time}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div className="small">
                                                            <div>{record.students?.course_name || '-'}</div>
                                                            <div className="text-muted">{record.students?.academic_year}</div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan="5" className="text-center py-5 text-muted">
                                                    No students registered for this route yet.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </TransportShell>
    )
}
