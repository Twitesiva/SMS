import React, { useEffect, useState } from 'react'
import TransportShell from '../../components/TransportShell'
import { supabase } from '../../../supabaseClient'
import { Link } from 'react-router-dom'

export default function TransportNotifications() {
    const [notifications, setNotifications] = useState([])
    const [loading, setLoading] = useState(true)
    const [routeFilter, setRouteFilter] = useState('')
    const [boardingPointFilter, setBoardingPointFilter] = useState('')

    useEffect(() => {
        fetchNotifications()
    }, [])

    const fetchNotifications = async () => {
        try {
            setLoading(true)

            const { data, error } = await supabase
                .from('student_transport')
                .select(`
                    id,
                    created_at,
                    status,
                    student_id,
                    students (full_name, student_id, group_name),
                    transport_routes (route_no, route_name),
                    transport_route_boarding_points (name, departure_time)
                `)
                .neq('status', 'CONFIRMED')
                .order('created_at', { ascending: false })

            if (error) throw error

            const formattedNotifications = (data || []).map(item => ({
                id: item.id,
                route_no: item.transport_routes?.route_no || 'N/A',
                route_name: item.transport_routes?.route_name || 'N/A',
                student_name: item.students?.full_name || 'N/A',
                student_id: item.students?.student_id || 'N/A',
                boarding_point: item.transport_route_boarding_points?.name || 'N/A',
                boarding_time: item.transport_route_boarding_points?.departure_time || 'N/A',
                applied_at: new Date(item.created_at).toLocaleString(),
                status: item.status
            }))

            setNotifications(formattedNotifications)

        } catch (error) {
            console.error('Error fetching notifications:', error)
        } finally {
            setLoading(false)
        }
    }

    // Derived Filters
    const uniqueRoutes = [...new Set(notifications.map(n => n.route_no).filter(r => r !== 'N/A'))].sort()
    const uniqueBoardingPoints = [...new Set(notifications.map(n => n.boarding_point).filter(b => b !== 'N/A'))].sort()

    const filteredNotifications = notifications.filter(notif => {
        const matchesRoute = !routeFilter || notif.route_no === routeFilter
        const matchesPoint = !boardingPointFilter || notif.boarding_point === boardingPointFilter
        return matchesRoute && matchesPoint
    })

    return (
        <TransportShell brandTitle="Transport Management" brandSubtitle="Notifications">
            <div className="container-fluid px-0">
                <div className="row justify-content-center">
                    <div className="col-12">
                        <div className="transport-card shadow-sm border-0">
                            <div className="transport-card__header py-3 px-4 text-white d-flex justify-content-between align-items-center">
                                <h5 className="mb-0 fw-bold">Waiting List</h5>
                                <span className="badge bg-white text-primary rounded-pill">{filteredNotifications.length} New</span>
                            </div>

                            <div className="p-3 bg-light border-bottom">
                                <div className="row g-3">
                                    <div className="col-md-6">
                                        <label className="form-label text-muted small fw-bold text-uppercase">Filter by Route Number</label>
                                        <div className="input-group">
                                            <span className="input-group-text bg-white border"><i className="bi bi-bus-front"></i></span>
                                            <select
                                                className="form-select border"
                                                value={routeFilter}
                                                onChange={(e) => setRouteFilter(e.target.value)}
                                            >
                                                <option value="">All Routes</option>
                                                {uniqueRoutes.map(route => (
                                                    <option key={route} value={route}>{route}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label text-muted small fw-bold text-uppercase">Filter by Boarding Point</label>
                                        <div className="input-group">
                                            <span className="input-group-text bg-white border"><i className="bi bi-geo-alt"></i></span>
                                            <select
                                                className="form-select border"
                                                value={boardingPointFilter}
                                                onChange={(e) => setBoardingPointFilter(e.target.value)}
                                            >
                                                <option value="">All Boarding Points</option>
                                                {uniqueBoardingPoints.map(point => (
                                                    <option key={point} value={point}>{point}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="card-body p-0">
                                {loading ? (
                                    <div className="text-center py-5">
                                        <div className="spinner-border text-primary" role="status">
                                            <span className="visually-hidden">Loading...</span>
                                        </div>
                                    </div>
                                ) : filteredNotifications.length === 0 ? (
                                    <div className="text-center py-5 text-muted">
                                        <i className="bi bi-people fs-1 mb-3 d-block"></i>
                                        <p className="mb-0">No waiting list entries found</p>
                                    </div>
                                ) : (
                                    <div className="table-responsive">
                                        <table className="table table-hover align-middle mb-0">
                                            <thead className="transport-card__header text-white">
                                                <tr>
                                                    <th className="ps-4 py-3 fw-bold text-white text-uppercase border-end-0 fs-6">S.No</th>
                                                    <th className="py-3 fw-bold text-white text-uppercase border-start-0 border-end-0 fs-6">Student ID</th>
                                                    <th className="py-3 fw-bold text-white text-uppercase border-start-0 border-end-0 fs-6">Student Name</th>
                                                    <th className="py-3 fw-bold text-white text-uppercase border-start-0 border-end-0 fs-6">Route No</th>
                                                    <th className="py-3 fw-bold text-white text-uppercase border-start-0 border-end-0 fs-6">Boarding Point</th>
                                                    <th className="py-3 fw-bold text-white text-uppercase border-start-0 fs-6">Boarding Time</th>
                                                    <th className="py-3 fw-bold text-white text-uppercase border-start-0 fs-6">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredNotifications.map((notif, index) => (
                                                    <tr key={notif.id}>
                                                        <td className="ps-4 fw-bold text-dark">{index + 1}</td>
                                                        <td className="fw-bold text-dark">{notif.student_id}</td>
                                                        <td className="text-dark">{notif.student_name}</td>
                                                        <td className="fw-bold text-dark">{notif.route_no}</td>
                                                        <td className="text-dark">{notif.boarding_point}</td>
                                                        <td className="text-dark font-monospace">{notif.boarding_time}</td>
                                                        <td>
                                                            {notif.status === 'Overbooked' ? (
                                                                <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 rounded-pill px-3">
                                                                    Overbooked
                                                                </span>
                                                            ) : (
                                                                <span className="badge bg-warning bg-opacity-10 text-dark border border-warning border-opacity-25 rounded-pill px-3">
                                                                    {notif.status}
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </TransportShell>
    )
}
