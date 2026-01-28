import React, { useState, useEffect, useMemo } from 'react'
import TransportShell from '../../components/TransportShell'
import { supabase } from '../../../supabaseClient'
import { toast } from 'react-toastify'

export default function TransportReports() {
    const [allocations, setAllocations] = useState([])
    const [loading, setLoading] = useState(true)
    const [studentSearch, setStudentSearch] = useState('')
    const [routeSearch, setRouteSearch] = useState('')
    const [boardingPointSearch, setBoardingPointSearch] = useState('')

    useEffect(() => {
        fetchAllocations()
    }, [])

    useEffect(() => {
        setBoardingPointSearch('')
    }, [routeSearch])

    const fetchAllocations = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('student_transport')
                .select(`
                    id,
                    created_at,
                    route_id,
                    boarding_point_id,
                    status,
                    students (
                        id,
                        full_name, 
                        student_id, 
                        course_name, 
                        group_name, 
                        academic_year
                    ),
                    transport_routes (
                        id,
                        route_no, 
                        route_name,
                        vehicle_register_no,
                        seats_available
                    ),
                    transport_route_boarding_points (
                        id,
                        name,
                        departure_time
                    )
                `)
                .eq('status', 'CONFIRMED')
                .order('created_at', { ascending: false })

            if (error) throw error
            setAllocations(data || [])

        } catch (error) {
            console.error('Error fetching allocations:', error)
            toast.error('Failed to load reports data')
        } finally {
            setLoading(false)
        }
    }

    const uniqueRoutes = useMemo(() => {
        const routes = allocations
            .map(item => item.transport_routes?.route_no)
            .filter(Boolean)
        return [...new Set(routes)].sort()
    }, [allocations])

    const uniqueBoardingPoints = useMemo(() => {
        let filtered = allocations
        if (routeSearch) {
            filtered = allocations.filter(item => item.transport_routes?.route_no === routeSearch)
        }
        const points = filtered
            .map(item => item.transport_route_boarding_points?.name)
            .filter(Boolean)
        return [...new Set(points)].sort()
    }, [allocations, routeSearch])

    const filteredAllocations = allocations.filter(item => {
        const sSearch = studentSearch.toLowerCase()
        const rSearch = routeSearch.toLowerCase()
        const bSearch = boardingPointSearch

        const studentName = item.students?.full_name?.toLowerCase() || ''
        const studentId = item.students?.student_id?.toLowerCase() || ''
        const routeNo = item.transport_routes?.route_no?.toLowerCase() || ''
        const boardingPoint = item.transport_route_boarding_points?.name || ''

        const matchesStudent = !sSearch || studentName.includes(sSearch) || studentId.includes(sSearch)
        const matchesRoute = !rSearch || routeNo === rSearch
        const matchesBoardingPoint = !bSearch || boardingPoint === bSearch

        return matchesStudent && matchesRoute && matchesBoardingPoint
    })

    const selectedRouteDetails = useMemo(() => {
        if (!routeSearch) return null
        return allocations.find(item => item.transport_routes?.route_no === routeSearch)?.transport_routes
    }, [routeSearch, allocations])

    const routeStats = useMemo(() => {
        if (!selectedRouteDetails || !routeSearch) return null

        const totalSeats = selectedRouteDetails.seats_available || 0
        const reserved = allocations.filter(a => a.transport_routes?.route_no === routeSearch).length
        const available = totalSeats - reserved

        return { totalSeats, reserved, available }
    }, [selectedRouteDetails, routeSearch, allocations])

    return (
        <TransportShell brandTitle="Transport Management" brandSubtitle="Transport Reports">
            <div className="container-fluid px-0">
                <div className="row justify-content-center">
                    <div className="col-12">
                        <div className="transport-card shadow-sm border-0">
                            <div className="transport-card__header py-3 px-4 text-white">
                                <h5 className="mb-0 fw-bold">Transport Reports</h5>
                            </div>

                            <div className="p-3 bg-light border-bottom">
                                <div className="row g-3">
                                    <div className="col-md-4">
                                        <label className="form-label text-muted small fw-bold text-uppercase">Filter by Route Number</label>
                                        <div className="input-group">
                                            <span className="input-group-text bg-white border"><i className="bi bi-bus-front"></i></span>
                                            <select
                                                className="form-select border"
                                                value={routeSearch}
                                                onChange={(e) => setRouteSearch(e.target.value)}
                                            >
                                                <option value="">Select Route No</option>
                                                {uniqueRoutes.map(route => (
                                                    <option key={route} value={route}>{route}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label text-muted small fw-bold text-uppercase">Filter by Boarding Point</label>
                                        <div className="input-group">
                                            <span className="input-group-text bg-white border"><i className="bi bi-geo-alt"></i></span>
                                            <select
                                                className="form-select border"
                                                value={boardingPointSearch}
                                                onChange={(e) => setBoardingPointSearch(e.target.value)}
                                            >
                                                <option value="">Select Boarding Point</option>
                                                {uniqueBoardingPoints.map(point => (
                                                    <option key={point} value={point}>{point}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label text-muted small fw-bold text-uppercase">Search by Student ID</label>
                                        <div className="input-group">
                                            <span className="input-group-text bg-white border"><i className="bi bi-search"></i></span>
                                            <input
                                                type="text"
                                                className="form-control border"
                                                placeholder="Enter Student ID..."
                                                value={studentSearch}
                                                onChange={(e) => setStudentSearch(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Route Details Display */}
                                {selectedRouteDetails && (
                                    <div className="row mt-3">
                                        <div className="col-12">
                                            <div className="bg-white rounded border p-3">
                                                <div className="row g-3">
                                                    {/* Left Column: Route Basic Info */}
                                                    <div className="col-12 col-md-6 border-end-md">
                                                        <div className="d-flex flex-column gap-2">
                                                            <div className="d-flex align-items-center">
                                                                <span className="text-uppercase fw-semibold" style={{ minWidth: '160px' }}>ROUTE NUMBER</span>
                                                                <span className="mx-2">:</span>
                                                                <span>{selectedRouteDetails.route_no}</span>
                                                            </div>
                                                            <div className="d-flex align-items-center">
                                                                <span className="text-uppercase fw-semibold" style={{ minWidth: '160px' }}>ROUTE NAME</span>
                                                                <span className="mx-2">:</span>
                                                                <span>{selectedRouteDetails.route_name}</span>
                                                            </div>
                                                            <div className="d-flex align-items-center">
                                                                <span className="text-uppercase fw-semibold" style={{ minWidth: '160px' }}>VEHICLE NUMBER</span>
                                                                <span className="mx-2">:</span>
                                                                <span>{selectedRouteDetails.vehicle_register_no || '-'}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Right Column: Capacity Stats */}
                                                    <div className="col-12 col-md-6 ps-md-4">
                                                        {routeStats && (
                                                            <div className="d-flex flex-column gap-2">
                                                                <div className="d-flex align-items-center">
                                                                    <span className="text-uppercase fw-semibold" style={{ minWidth: '160px' }}>TOTAL SEATS</span>
                                                                    <span className="mx-2">:</span>
                                                                    <span>{routeStats.totalSeats}</span>
                                                                </div>
                                                                <div className="d-flex align-items-center">
                                                                    <span className="text-uppercase fw-semibold" style={{ minWidth: '160px' }}>RESERVED</span>
                                                                    <span className="mx-2">:</span>
                                                                    <span>{routeStats.reserved}</span>
                                                                </div>
                                                                <div className="d-flex align-items-center">
                                                                    <span className="text-uppercase fw-semibold" style={{ minWidth: '160px' }}>AVAILABLE</span>
                                                                    <span className="mx-2">:</span>
                                                                    <span className={routeStats.available <= 0 ? 'text-danger fw-bold' : ''}>{routeStats.available}</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="card-body p-0">
                                <div className="table-responsive">
                                    <table className="table table-bordered table-hover align-middle mb-0">
                                        <thead className="transport-card__header text-white">
                                            <tr>
                                                <th className="ps-4 py-3 fw-bold text-white text-uppercase border-end-0 fs-6" style={{ width: '60px' }}>S.No</th>
                                                <th className="py-3 fw-bold text-white text-uppercase border-start-0 border-end-0 fs-6">Student ID</th>
                                                <th className="py-3 fw-bold text-white text-uppercase border-start-0 border-end-0 fs-6">Student Name</th>
                                                <th className="py-3 fw-bold text-white text-uppercase border-start-0 border-end-0 fs-6">Route No</th>
                                                <th className="py-3 fw-bold text-white text-uppercase border-start-0 border-end-0 fs-6">Boarding Point</th>
                                                <th className="py-3 fw-bold text-white text-uppercase border-start-0 fs-6">Boarding Time</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {loading ? (
                                                <tr>
                                                    <td colSpan="6" className="text-center py-5">
                                                        <div className="spinner-border text-primary" role="status">
                                                            <span className="visually-hidden">Loading...</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : filteredAllocations.length > 0 ? (
                                                filteredAllocations.map((item, index) => (
                                                    <tr key={item.id || index}>
                                                        <td className="ps-4 fw-bold text-dark">{index + 1}</td>
                                                        <td className="text-dark fw-bold">{item.students?.student_id || '-'}</td>
                                                        <td className="text-dark fw-semibold">{item.students?.full_name}</td>
                                                        <td className="text-dark fw-bold">{item.transport_routes?.route_no}</td>
                                                        <td className="text-dark">{item.transport_route_boarding_points?.name}</td>
                                                        <td className="text-dark font-monospace">{item.transport_route_boarding_points?.departure_time}</td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="6" className="text-center py-5 text-muted">
                                                        <div className="d-flex flex-column align-items-center opacity-50">
                                                            <i className="bi bi-person-x fs-4 mb-2"></i>
                                                            <p className="mb-0 small">No records found matching your search.</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </TransportShell>
    )
}
