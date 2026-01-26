import { useEffect, useState } from "react";
import AdminShell from "../../components/AdminShell";
import { supabase } from "../../../supabaseClient";

export default function History() {
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        setLoading(true);
        setError("");

        supabase
            .from("activity_logs")
            .select("id, user_id, role, action, page, description, created_at")
            .in('action', ['LOGIN', 'SESSION_ACTIVITY'])
            .order("created_at", { ascending: false })
            .limit(100)
            .then(({ data, error }) => {
                if (!active) return;
                if (error) {
                    setError(error.message);
                    setLoading(false);
                    return;
                }

                const logs = data || [];
                if (logs.length > 0) {
                    const userIds = [...new Set(logs.map((log) => log.user_id).filter(Boolean))];
                    if (userIds.length > 0) {
                        supabase
                            .from("profiles")
                            .select("id, full_name, role")
                            .in("id", userIds)
                            .then(({ data: profilesData }) => {
                                if (!active) return;
                                const profileMap = {};
                                (profilesData || []).forEach((p) => {
                                    profileMap[p.id] = p;
                                });
                                const enrichedLogs = logs.map((log) => ({
                                    ...log,
                                    profile: profileMap[log.user_id] || null,
                                }));
                                setActivities(enrichedLogs);
                                setLoading(false);
                            });
                    } else {
                        setActivities(logs);
                        setLoading(false);
                    }
                } else {
                    setActivities([]);
                    setLoading(false);
                }
            });

        return () => {
            active = false;
        };
    }, []);

    return (
        <AdminShell>
            <div className="container-fluid p-0">
                <h2 className="mb-4">System History</h2>

                {error && (
                    <div className="alert alert-danger" role="alert">
                        {error}
                    </div>
                )}

                <div className="card shadow-sm border-0">
                    <div className="card-header bg-white py-3">
                        <h5 className="mb-0 card-title">Recent Login & Session Activity</h5>
                    </div>
                    <div className="card-body p-0">
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0">
                                <thead className="activity-table-header">
                                    <tr>
                                        <th scope="col" className="ps-4" style={{ width: "60px" }}>#</th>
                                        <th scope="col">Time</th>
                                        <th scope="col">Role</th>
                                        <th scope="col">Action</th>
                                        <th scope="col">Page</th>
                                        <th scope="col">Description</th>
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
                                    ) : activities.length > 0 ? (
                                        activities.map((log, index) => (
                                            <tr key={log.id}>
                                                <td className="ps-4 fw-bold text-secondary">
                                                    {index + 1}
                                                </td>
                                                <td style={{ whiteSpace: "nowrap" }}>
                                                    {new Date(log.created_at).toLocaleString()}
                                                </td>
                                                <td>
                                                    <span
                                                        className={`badge ${log.role === "admin" ? "bg-primary" : "bg-info"
                                                            }`}
                                                    >
                                                        {log.role?.toUpperCase() || "USER"}
                                                    </span>
                                                </td>
                                                <td className="fw-medium">{log.action}</td>
                                                <td className="text-muted">{log.page}</td>
                                                <td className="text-muted small" style={{ whiteSpace: "pre-wrap" }}>
                                                    {log.description || "-"}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="6" className="text-center text-muted py-5">
                                                No history found
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </AdminShell>
    );
}
