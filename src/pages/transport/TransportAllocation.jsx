import React, { useEffect, useState, useMemo } from 'react'
import TransportShell from '../../components/TransportShell'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../store/ui'

export default function TransportAllocation() {
    const [allocations, setAllocations] = useState([])
    const [loading, setLoading] = useState(true)
    const [studentSearch, setStudentSearch] = useState('')
    const [routeSearch, setRouteSearch] = useState('')
    const [boardingPointFilter, setBoardingPointFilter] = useState('')

    // Edit Modal State
    const [showEditModal, setShowEditModal] = useState(false)
    const [editingAllocation, setEditingAllocation] = useState(null)
    const [editFormData, setEditFormData] = useState({ route_id: '', boarding_point_id: '' })
    const [availableRoutes, setAvailableRoutes] = useState([])
    const [availableBoardingPoints, setAvailableBoardingPoints] = useState([])
    const [loadingPoints, setLoadingPoints] = useState(false)
    const [boardingPointSearch, setBoardingPointSearch] = useState('')

    // Delete Modal State
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [allocationToDelete, setAllocationToDelete] = useState(null)

    useEffect(() => {
        fetchAllocations()
        fetchRoutes()
    }, [])

    useEffect(() => {
        setBoardingPointFilter('')
    }, [routeSearch])

    const fetchRoutes = async () => {
        try {
            const { data, error } = await supabase
                .from('transport_routes')
                .select('id, route_no, route_name')
                .order('route_no')

            if (error) throw error
            setAvailableRoutes(data || [])
        } catch (error) {
            console.error('Error fetching routes:', error)
        }
    }

    const fetchAllBoardingPoints = async () => {
        try {
            setLoadingPoints(true)
            const { data, error } = await supabase
                .from('transport_route_boarding_points')
                .select(`
                    id, 
                    name, 
                    departure_time,
                    route_id,
                    transport_routes (
                        route_no,
                        route_name
                    )
                `)
                .order('departure_time')

            if (error) throw error
            setAvailableBoardingPoints(data || [])
        } catch (error) {
            console.error('Error fetching boarding points:', error)
        } finally {
            setLoadingPoints(false)
        }
    }

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
                        vehicle_register_no
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
            showToast('Failed to load allocations', 'error')
        } finally {
            setLoading(false)
        }
    }

    const deleteAllocation = (id) => {
        setAllocationToDelete(id)
        setShowDeleteModal(true)
    }

    const confirmDelete = async () => {
        if (!allocationToDelete) return

        try {
            const { error } = await supabase
                .from('student_transport')
                .delete()
                .eq('id', allocationToDelete)

            if (error) throw error

            setAllocations(prev => prev.filter(a => a.id !== allocationToDelete))
            showToast('Allocation removed successfully', 'success')
            setShowDeleteModal(false)
            setAllocationToDelete(null)
        } catch (error) {
            console.error('Error removing allocation:', error)
            showToast('Failed to remove allocation', 'error')
        }
    }

    const handleEdit = (item) => {
        setEditingAllocation(item)
        setEditFormData({
            route_id: '',
            boarding_point_id: ''
        })
        setBoardingPointSearch('')
        fetchAllBoardingPoints()
        setShowEditModal(true)
    }

    const handleUpdate = async () => {
        if (!editFormData.route_id || !editFormData.boarding_point_id) {
            showToast('Please select both route and boarding point', 'warning')
            return
        }

        try {
            const { error } = await supabase
                .from('student_transport')
                .update({
                    route_id: editFormData.route_id,
                    boarding_point_id: editFormData.boarding_point_id
                })
                .eq('id', editingAllocation.id)

            if (error) throw error

            showToast('Allocation updated successfully', 'success')
            setShowEditModal(false)
            fetchAllocations() // Refresh list
        } catch (error) {
            console.error('Error updating allocation:', error)
            showToast('Failed to update allocation', 'error')
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
        const bFilter = boardingPointFilter

        const studentName = item.students?.full_name?.toLowerCase() || ''
        const studentId = item.students?.student_id?.toLowerCase() || ''
        const routeNo = item.transport_routes?.route_no?.toLowerCase() || ''
        const boardingPoint = item.transport_route_boarding_points?.name || ''

        const matchesStudent = !sSearch || studentName.includes(sSearch) || studentId.includes(sSearch)
        const matchesRoute = !rSearch || routeNo === rSearch
        const matchesBoardingPoint = !bFilter || boardingPoint === bFilter

        return matchesStudent && matchesRoute && matchesBoardingPoint
    })

    const filteredBoardingPoints = useMemo(() => {
        if (!boardingPointSearch.trim()) return availableBoardingPoints

        const searchLower = boardingPointSearch.toLowerCase()
        return availableBoardingPoints.filter(point =>
            point.name.toLowerCase().includes(searchLower) ||
            point.transport_routes?.route_no?.toLowerCase().includes(searchLower)
        )
    }, [boardingPointSearch, availableBoardingPoints])

    const selectedRouteDetails = useMemo(() => {
        if (!routeSearch) return null
        return allocations.find(item => item.transport_routes?.route_no === routeSearch)?.transport_routes
    }, [routeSearch, allocations])

    return (
        <TransportShell brandTitle="Transport Management" brandSubtitle="Transport Allocation">
            <div className="container-fluid px-0">
                <div className="row justify-content-center">
                    <div className="col-12">
                        <div className="transport-card shadow-sm border-0">
                            <div className="transport-card__header py-3 px-4 text-white">
                                <h5 className="mb-0 fw-bold">Transport Allocation</h5>
                            </div>

                            <div className="p-3 bg-light border-bottom">
                                <div className="row g-3">
                                    <div className="col-md-4">
                                        <label className="form-label text-muted small fw-bold text-uppercase">Filter by Route No</label>
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
                                                value={boardingPointFilter}
                                                onChange={(e) => setBoardingPointFilter(e.target.value)}
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
                                                <div className="row g-2">
                                                    <div className="col-12">
                                                        <div className="d-flex">
                                                            <span className="text-uppercase fw-semibold" style={{ minWidth: '160px' }}>ROUTE NUMBER</span>
                                                            <span className="mx-2">:</span>
                                                            <span>{selectedRouteDetails.route_no}</span>
                                                        </div>
                                                    </div>
                                                    <div className="col-12">
                                                        <div className="d-flex">
                                                            <span className="text-uppercase fw-semibold" style={{ minWidth: '160px' }}>ROUTE NAME</span>
                                                            <span className="mx-2">:</span>
                                                            <span>{selectedRouteDetails.route_name}</span>
                                                        </div>
                                                    </div>
                                                    <div className="col-12">
                                                        <div className="d-flex">
                                                            <span className="text-uppercase fw-semibold" style={{ minWidth: '160px' }}>VEHICLE NUMBER</span>
                                                            <span className="mx-2">:</span>
                                                            <span>{selectedRouteDetails.vehicle_register_no || '-'}</span>
                                                        </div>
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
                                                <th className="ps-4 py-3 fw-bold text-white text-uppercase border-end-0 fs-6">S.No</th>
                                                <th className="py-3 fw-bold text-white text-uppercase border-start-0 border-end-0 fs-6">Student ID</th>
                                                <th className="py-3 fw-bold text-white text-uppercase border-start-0 border-end-0 fs-6">Student Name</th>
                                                <th className="py-3 fw-bold text-white text-uppercase border-start-0 border-end-0 fs-6">Route No</th>
                                                <th className="py-3 fw-bold text-white text-uppercase border-start-0 border-end-0 fs-6">Boarding Point</th>
                                                <th className="py-3 fw-bold text-white text-uppercase border-start-0 fs-6">Boarding Time</th>
                                                <th className="py-3 fw-bold text-white text-uppercase border-start-0 fs-6 text-center">Actions</th>
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
                                                        <td className="text-center">
                                                            <div className="d-flex justify-content-center gap-2">
                                                                <button
                                                                    className="btn btn-outline-primary rounded p-0"
                                                                    onClick={() => handleEdit(item)}
                                                                    title="Edit"
                                                                    style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}
                                                                >
                                                                    <i className="bi bi-pencil"></i>
                                                                </button>
                                                                <button
                                                                    className="btn btn-outline-danger rounded p-0"
                                                                    onClick={() => deleteAllocation(item.id)}
                                                                    title="Delete"
                                                                    style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}
                                                                >
                                                                    <i className="bi bi-trash"></i>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="6" className="text-center py-5 text-muted">
                                                        <div className="d-flex flex-column align-items-center opacity-50">
                                                            <i className="bi bi-person-x fs-4 mb-2"></i>
                                                            <p className="mb-0 small">No allocations found matching your search.</p>
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

                {/* Edit Modal */}
                {showEditModal && editingAllocation && (
                    <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                        <div className="modal-dialog modal-dialog-centered modal-lg">
                            <div className="modal-content border-0 shadow-lg">
                                <div className="modal-header text-white" style={{ background: '#606c88' }}>
                                    <h5 className="modal-title fw-bold">Edit Transport Allocation</h5>
                                    <button type="button" className="btn-close btn-close-white" onClick={() => setShowEditModal(false)}></button>
                                </div>
                                <div className="modal-body p-4">
                                    {/* Current Allocation Section */}
                                    <div className="mb-4">
                                        <label className="form-label fw-bold text-dark text-uppercase mb-2" style={{ fontSize: '1rem' }}>Old Boarding Point</label>
                                        <div className="bg-light p-3 rounded-3">
                                            <div className="row g-3">
                                                <div className="col-12">
                                                    <div className="d-flex align-items-center">
                                                        <span className="text-dark fw-bold text-uppercase me-2" style={{ fontSize: '1rem' }}>ROUTE NAME :</span>
                                                        <span className="text-dark" style={{ fontSize: '1.25rem' }}>{editingAllocation.transport_routes?.route_name}</span>
                                                    </div>
                                                </div>
                                                <div className="col-12">
                                                    <div className="d-flex align-items-center">
                                                        <span className="text-dark fw-bold text-uppercase me-2" style={{ fontSize: '1rem' }}>ROUTE NO :</span>
                                                        <span className="text-dark" style={{ fontSize: '1.25rem' }}>{editingAllocation.transport_routes?.route_no}</span>
                                                    </div>
                                                </div>
                                                <div className="col-12">
                                                    <div className="d-flex align-items-center">
                                                        <span className="text-dark fw-bold text-uppercase me-2" style={{ fontSize: '1rem' }}>BOARDING POINT :</span>
                                                        <span className="text-dark" style={{ fontSize: '1.25rem' }}>{editingAllocation.transport_route_boarding_points?.name}</span>
                                                    </div>
                                                </div>
                                                <div className="col-12">
                                                    <div className="d-flex align-items-center">
                                                        <span className="text-dark fw-bold text-uppercase me-2" style={{ fontSize: '1rem' }}>BOARDING TIME :</span>
                                                        <span className="text-dark" style={{ fontSize: '1.25rem' }}>{editingAllocation.transport_route_boarding_points?.departure_time}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Boarding Point Search and Selection */}
                                    <div className="mb-4">
                                        <div>
                                            <label className="form-label fw-bold text-dark text-uppercase" style={{ fontSize: '1rem' }}>New Boarding Point</label>
                                            <div className="input-group mb-3">
                                                <span className="input-group-text bg-white">
                                                    <i className="bi bi-search"></i>
                                                </span>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    placeholder="Search for new boarding point..."
                                                    value={boardingPointSearch}
                                                    onChange={(e) => setBoardingPointSearch(e.target.value)}
                                                />
                                            </div>

                                            <div className="table-responsive border rounded" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                                <table className="table table-hover mb-0">
                                                    <thead style={{ background: '#606c88' }} className="sticky-top">
                                                        <tr>
                                                            <th className="py-2 text-white text-uppercase fw-bold" style={{ fontSize: '0.85rem' }}>Route No</th>
                                                            <th className="py-2 text-white text-uppercase fw-bold" style={{ fontSize: '0.85rem' }}>Boarding Point</th>
                                                            <th className="py-2 text-white text-uppercase fw-bold" style={{ fontSize: '0.85rem' }}>Departure Time</th>
                                                            <th className="py-2 text-center text-white text-uppercase fw-bold" style={{ fontSize: '0.85rem' }}>Select</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {loadingPoints ? (
                                                            <tr>
                                                                <td colSpan="4" className="text-center py-4">
                                                                    <div className="spinner-border spinner-border-sm text-primary" role="status">
                                                                        <span className="visually-hidden">Loading...</span>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ) : filteredBoardingPoints.length === 0 ? (
                                                            <tr>
                                                                <td colSpan="4" className="text-center py-4 text-muted">
                                                                    {boardingPointSearch ? 'No boarding points found' : 'No boarding points available'}
                                                                </td>
                                                            </tr>
                                                        ) : (
                                                            filteredBoardingPoints.map(point => (
                                                                <tr
                                                                    key={point.id}
                                                                    onClick={() => setEditFormData({ route_id: point.route_id, boarding_point_id: point.id })}
                                                                    style={{ cursor: 'pointer' }}
                                                                    className={editFormData.boarding_point_id === point.id ? 'table-active' : ''}
                                                                >
                                                                    <td className="fw-bold text-primary">{point.transport_routes?.route_no}</td>
                                                                    <td className="fw-medium">{point.name}</td>
                                                                    <td>
                                                                        <span className="badge bg-light text-dark border">
                                                                            <i className="bi bi-clock me-1"></i>
                                                                            {point.departure_time}
                                                                        </span>
                                                                    </td>
                                                                    <td className="text-center">
                                                                        {editFormData.boarding_point_id === point.id && (
                                                                            <i className="bi bi-check-circle-fill text-success"></i>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            ))
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer bg-light">
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                                    <button
                                        type="button"
                                        className="btn text-white px-4"
                                        style={{ background: '#606c88' }}
                                        onClick={handleUpdate}
                                        disabled={!editFormData.route_id || !editFormData.boarding_point_id}
                                    >
                                        <i className="bi bi-check-circle me-2"></i>
                                        Click to Confirm
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Delete Confirmation Modal */}
                {showDeleteModal && (
                    <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }} tabIndex="-1">
                        <div className="modal-dialog modal-dialog-centered">
                            <div className="modal-content border-0 shadow">
                                <div className="modal-header border-0 pb-0">
                                    <h5 className="modal-title fw-bold text-uppercase">CONFIRM DELETE</h5>
                                    <button
                                        type="button"
                                        className="btn-close"
                                        onClick={() => setShowDeleteModal(false)}
                                        aria-label="Close"
                                    ></button>
                                </div>
                                <div className="modal-body py-4">
                                    <p className="mb-0">
                                        Are you sure you want to remove this allocation?
                                    </p>
                                </div>
                                <div className="modal-footer border-0 pt-0 justify-content-end gap-2">
                                    <button
                                        type="button"
                                        className="btn btn-light border px-4"
                                        onClick={() => setShowDeleteModal(false)}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-danger px-4"
                                        onClick={confirmDelete}
                                    >
                                        Remove Allocation
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </TransportShell>
    )
}
