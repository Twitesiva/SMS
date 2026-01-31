import AdShellAdmin from "../../components/AdShellAdmin";
import ConfirmationModal from '../../components/ConfirmationModal.jsx';
import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../../supabaseClient";
import { trackPromise, showToast } from "../../store/ui";
import { toast } from "react-toastify";
import { validateRequiredFields } from "../../lib/validation";
import "../admin/Setup.css";
import "./AdminContent.css";

export default function Staff() {
    const [teachers, setTeachers] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [designationFilter, setDesignationFilter] = useState("");
    const [loading, setLoading] = useState(false);
    const [editingTeacher, setEditingTeacher] = useState(null);
    const [viewingTeacher, setViewingTeacher] = useState(null);
    const [deleteConfirmation, setDeleteConfirmation] = useState({
        show: false,
        teacherId: null,
        teacherName: ''
    });

    const [editForm, setEditForm] = useState({
        staff_id: "",
        full_name: "",
        gender: "",
        date_of_birth: "",
        aadhar_number: "",
        phone_number: "",
        email: "",
        address: "",
        designation: "",
        qualification: "",
        experience_years: 0,
        joining_date: "",
        status: "ACTIVE",
    });

    // Load initial data
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from("teachers")
                    .select("*")
                    .order("full_name");

                if (error) throw error;
                setTeachers(data || []);
            } catch (error) {
                console.error("Error loading teachers:", error);
                showToast("Error loading staff details", "error");
            } finally {
                setLoading(false);
            }
        };
        trackPromise(loadData());
    }, []);

    const normalizeDesignation = (value) => String(value || '')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '_');

    const filteredTeachers = useMemo(() => {
        const search = searchTerm.toLowerCase().trim();
        return teachers.filter((teacher) => {
            const matchesSearch = !search || (
                (teacher.full_name || "").toLowerCase().includes(search) ||
                (teacher.staff_id || "").toLowerCase().includes(search) ||
                (teacher.phone_number || "").includes(search) ||
                (teacher.designation || "").toLowerCase().replace(/_/g, ' ').includes(search)
            );
            const matchesDesignation = !designationFilter ||
                normalizeDesignation(teacher.designation) === designationFilter;
            return matchesSearch && matchesDesignation;
        });
    }, [teachers, searchTerm, designationFilter]);

    const handleEdit = (teacher) => {
        setEditingTeacher(teacher);
        setEditForm({
            staff_id: teacher.staff_id || "",
            full_name: teacher.full_name || "",
            gender: teacher.gender || "",
            date_of_birth: teacher.date_of_birth || "",
            aadhar_number: teacher.aadhar_number || "",
            phone_number: teacher.phone_number || "",
            email: teacher.email || "",
            address: teacher.address || "",
            designation: teacher.designation || "",
            qualification: teacher.qualification || "",
            experience_years: teacher.experience_years || 0,
            joining_date: teacher.joining_date || "",
            status: teacher.status || "ACTIVE",
        });
    };

    const closeEditModal = () => {
        setEditingTeacher(null);
        setEditForm({
            staff_id: "",
            full_name: "",
            gender: "",
            date_of_birth: "",
            aadhar_number: "",
            phone_number: "",
            email: "",
            address: "",
            designation: "",
            qualification: "",
            experience_years: 0,
            joining_date: "",
            status: "ACTIVE",
        });
    };

    const handleUpdate = async () => {
        if (!editingTeacher) return;

        // Basic validation
        if (!editForm.full_name || !editForm.staff_id || !editForm.designation) {
            showToast("Please fill in Name, Staff ID and Designation", "warning");
            return;
        }

        try {
            const { error } = await supabase
                .from("teachers")
                .update(editForm)
                .eq("id", editingTeacher.id);

            if (error) throw error;

            showToast("Staff details updated successfully", "success");

            // Update local state
            setTeachers(prev => prev.map(t => t.id === editingTeacher.id ? { ...t, ...editForm } : t));
            closeEditModal();
        } catch (error) {
            console.error("Error updating teacher:", error);
            showToast("Failed to update staff details", "error");
        }
    };

    const openTeacherDetails = (teacher) => {
        setViewingTeacher(teacher);
    };

    const closeTeacherDetails = () => {
        setViewingTeacher(null);
    };

    const openDeleteModal = (teacher) => {
        setDeleteConfirmation({
            show: true,
            teacherId: teacher.id,
            teacherName: teacher.full_name
        });
    };

    const closeDeleteModal = () => {
        setDeleteConfirmation({
            show: false,
            teacherId: null,
            teacherName: ''
        });
    };

    const handleDelete = async () => {
        if (!deleteConfirmation.teacherId) return;

        try {
            const { error } = await supabase
                .from("teachers")
                .delete()
                .eq("id", deleteConfirmation.teacherId);

            if (error) throw error;

            setTeachers((prev) => prev.filter((t) => t.id !== deleteConfirmation.teacherId));
            showToast("Staff member deleted successfully", "success");
            closeDeleteModal();
        } catch (error) {
            console.error("Error deleting teacher:", error);
            showToast("Failed to delete staff member", "error");
        }
    };

    // Helper to get initials
    const getInitials = (name) => {
        if (!name) return "ST";
        const parts = name.split(" ").filter(Boolean);
        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    };


    const formatDate = (dateString) => {
        if (!dateString) return "-";
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
    };


    return (
        <AdShellAdmin>
            <div className="container-fluid p-4">
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <h2 className="fw-bold text-dark mb-1">Staff Management</h2>
                    </div>
                    <div className="d-flex gap-2">
                        {/* Add button to create new teacher could go here if needed, linking to profile creation */}
                    </div>
                </div>

                {/* Search Bar */}
                <div className="card border-0 shadow-sm mb-4 staff-filters">
                    <div className="card-body p-3">
                        <div className="staff-filters__grid">
                            <div className="staff-filters__field">
                                <label className="staff-filters__label">Search</label>
                                <div className="input-group staff-filters__input-group">
                                    <span className="input-group-text">
                                        <i className="bi bi-search text-muted"></i>
                                    </span>
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="Search by Name, Staff ID, Phone or Designation..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="staff-filters__field">
                                <label className="staff-filters__label">Designation</label>
                                <select
                                    className="form-select"
                                    value={designationFilter}
                                    onChange={(e) => setDesignationFilter(e.target.value)}
                                >
                                    <option value="">All Designations</option>
                                    <option value="PROFESSOR">Professor</option>
                                    <option value="ASSISTANT_PROFESSOR">Assistant Professor</option>
                                    <option value="HOD">HOD</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Staff Table */}
                <div className="students-table-panel card card-soft p-4">
                    <div className="students-table-panel-header mb-3">
                        <div>
                            <h5 className="students-table-panel-title mb-1" style={{ color: '#ffffff' }}>
                                Staff Directory
                            </h5>
                        </div>
                        <div className="students-table-panel-meta text-end" style={{ color: '#ffffff' }}>
                            {loading ? "Refreshing data..." : `${filteredTeachers.length} staff members listed`}
                        </div>
                    </div>
                    <div className="table-responsive">
                        <table className="table table-borderless table-hover align-middle mb-0">
                            <thead className="table-light">
                                <tr>
                                    <th style={{ width: "70px" }}>Photo</th>
                                    <th>Staff ID</th>
                                    <th>Name</th>
                                    <th>Designation</th>
                                    <th>Phone</th>
                                    <th className="text-end">Actions</th>
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
                                ) : filteredTeachers.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="text-center py-5 text-muted">
                                            No staff records found.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredTeachers.map((teacher) => (
                                        <tr
                                            key={teacher.id}
                                            role="button"
                                            onClick={() => openTeacherDetails(teacher)}
                                            style={{ cursor: "pointer" }}
                                        >
                                            <td>
                                                <div
                                                    className="d-flex align-items-center justify-content-center rounded-circle bg-white shadow-sm border"
                                                    style={{
                                                        width: "50px",
                                                        height: "50px",
                                                        padding: "3px",
                                                        flexShrink: 0
                                                    }}
                                                >
                                                    <div className="w-100 h-100 rounded-circle overflow-hidden bg-light d-flex align-items-center justify-content-center">
                                                        {teacher.image_url ? (
                                                            <img
                                                                src={teacher.image_url}
                                                                alt={teacher.full_name}
                                                                className="w-100 h-100"
                                                                style={{ objectFit: 'cover', objectPosition: 'top center' }}
                                                            />
                                                        ) : (
                                                            <span
                                                                className="text-secondary fw-bold"
                                                                style={{ fontSize: "0.85em" }}
                                                            >
                                                                {getInitials(teacher.full_name)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td>{teacher.staff_id}</td>
                                            <td>{teacher.full_name}</td>
                                            <td>{teacher.designation?.replace(/_/g, ' ')}</td>
                                            <td>{teacher.phone_number || "-"}</td>
                                            <td className="text-end">
                                                <div className="d-flex justify-content-end flex-wrap gap-2">
                                                    <button
                                                        className="students-action-button students-action-button--edit"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            handleEdit(teacher);
                                                        }}
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        className="students-action-button students-action-button--delete"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            openDeleteModal(teacher);
                                                        }}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Edit Modal */}
            {editingTeacher && (
                <div className="modal d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
                    <div className="modal-dialog modal-lg modal-dialog-centered">
                        <div className="modal-content border-0 shadow-lg">
                            <div className="modal-header border-bottom-0 pb-0">
                                <h5 className="modal-title fw-bold">Edit Staff Details</h5>
                                <button type="button" className="btn-close" onClick={closeEditModal}></button>
                            </div>
                            <div className="modal-body">
                                <form className="row g-3">
                                    <div className="col-md-6">
                                        <label className="form-label small text-muted text-uppercase fw-bold">Staff ID</label>
                                        <input type="text" className="form-control" value={editForm.staff_id} onChange={(e) => setEditForm({ ...editForm, staff_id: e.target.value })} />
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label small text-muted text-uppercase fw-bold">Full Name</label>
                                        <input type="text" className="form-control" value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} />
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label small text-muted text-uppercase fw-bold">Designation</label>
                                        <input type="text" className="form-control" value={editForm.designation} onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })} />
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label small text-muted text-uppercase fw-bold">Qualification</label>
                                        <input type="text" className="form-control" value={editForm.qualification} onChange={(e) => setEditForm({ ...editForm, qualification: e.target.value })} />
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label small text-muted text-uppercase fw-bold">Phone</label>
                                        <input type="text" className="form-control" value={editForm.phone_number} onChange={(e) => setEditForm({ ...editForm, phone_number: e.target.value })} />
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label small text-muted text-uppercase fw-bold">Email</label>
                                        <input type="email" className="form-control" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label small text-muted text-uppercase fw-bold">Status</label>
                                        <select className="form-select" value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                                            <option value="ACTIVE">ACTIVE</option>
                                            <option value="INACTIVE">INACTIVE</option>
                                        </select>
                                    </div>
                                </form>
                            </div>
                            <div className="modal-footer border-0">
                                <button type="button" className="btn btn-light rounded-pill px-4" onClick={closeEditModal}>Cancel</button>
                                <button type="button" className="btn btn-primary rounded-pill px-4" onClick={handleUpdate}>Save Changes</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* View Modal */}
            {viewingTeacher && (
                <div className="students-modal-overlay" tabIndex="-1">
                    <div className="students-modal-dialog">
                        <div className="students-modal-content">
                            <div className="students-modal-header">
                                <div>
                                    <p className="students-modal-header-eyebrow text-uppercase mb-1">
                                        Staff Overview
                                    </p>
                                    <h5 className="students-modal-header-title fw-semibold mb-1">
                                        {viewingTeacher.full_name || "Staff Details"}
                                    </h5>
                                    <div className="students-modal-header-meta text-white-50 small">
                                        <span>{viewingTeacher.staff_id || "-"}</span>
                                        <span className="mx-2">•</span>
                                        <span>{viewingTeacher.designation?.replace(/_/g, ' ') || "-"}</span>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className="students-modal-close btn btn-sm"
                                    aria-label="Close"
                                    onClick={closeTeacherDetails}
                                >
                                    Close
                                </button>
                            </div>
                            <div className="students-modal-body">
                                <div className="students-modal-summary">
                                    <div className="card shadow-sm border-0 mb-4">
                                        <div className="card-body p-4">
                                            <div className="d-flex flex-column flex-md-row gap-5 align-items-start">
                                                {/* Photo Section */}
                                                <div className="flex-shrink-0 mx-auto mx-md-0" style={{ width: '200px' }}>
                                                    <div
                                                        className="rounded-circle bg-white shadow-sm border"
                                                        style={{ width: '200px', height: '200px', padding: '5px' }}
                                                    >
                                                        <div className="w-100 h-100 rounded-circle overflow-hidden bg-light position-relative d-flex align-items-center justify-content-center">
                                                            {viewingTeacher.image_url ? (
                                                                <img
                                                                    src={viewingTeacher.image_url}
                                                                    alt={viewingTeacher.full_name}
                                                                    className="w-100 h-100"
                                                                    style={{ objectFit: 'cover', objectPosition: 'top center' }}
                                                                />
                                                            ) : (
                                                                <div className="text-secondary display-4 fw-bold">
                                                                    {getInitials(viewingTeacher.full_name)}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="text-center mt-3">
                                                        <span className={`badge rounded-pill px-4 py-2 text-uppercase letter-spacing-1 ${viewingTeacher.status === 'ACTIVE'
                                                            ? 'bg-success-subtle text-success border border-success'
                                                            : 'bg-danger-subtle text-danger border border-danger'
                                                            }`}>
                                                            {viewingTeacher.status || 'Active'}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Details Section */}
                                                <div className="flex-grow-1 w-100">
                                                    <h5 className="border-bottom pb-2 mb-3 text-uppercase text-dark fs-6 fw-bold letter-spacing-1">
                                                        Professional Information
                                                    </h5>
                                                    <div className="row row-cols-1 row-cols-lg-2 g-x-5 g-y-2 mb-4">
                                                        <div className="col d-flex">
                                                            <span className="staff-detail-label text-dark fw-bold text-uppercase">Staff ID :</span>
                                                            <span className="fw-medium text-dark">{viewingTeacher.staff_id}</span>
                                                        </div>
                                                        <div className="col d-flex">
                                                            <span className="staff-detail-label text-dark fw-bold text-uppercase">Qualification :</span>
                                                            <span className="fw-medium text-dark">{viewingTeacher.qualification || "-"}</span>
                                                        </div>
                                                        <div className="col d-flex">
                                                            <span className="staff-detail-label text-dark fw-bold text-uppercase">Designation :</span>
                                                            <span className="fw-medium text-dark">{viewingTeacher.designation?.replace(/_/g, ' ') || "-"}</span>
                                                        </div>
                                                        <div className="col d-flex">
                                                            <span className="staff-detail-label text-muted small text-uppercase fw-semibold">Experience :</span>
                                                            <span className="fw-medium text-dark">{viewingTeacher.experience_years} Years</span>
                                                        </div>
                                                        <div className="col d-flex">
                                                            <span className="staff-detail-label text-muted small text-uppercase fw-semibold">Joining Date :</span>
                                                            <span className="fw-medium text-dark">{formatDate(viewingTeacher.joining_date)}</span>
                                                        </div>
                                                    </div>

                                                    <h5 className="border-bottom pb-2 mb-3 text-uppercase text-muted fs-6 fw-bold letter-spacing-1">
                                                        Personal Information
                                                    </h5>
                                                    <div className="row row-cols-1 row-cols-lg-2 g-x-5 g-y-2 mb-4">
                                                        <div className="col d-flex">
                                                            <span className="staff-detail-label text-muted small text-uppercase fw-semibold">Full Name :</span>
                                                            <span className="fw-medium text-dark">{viewingTeacher.full_name}</span>
                                                        </div>
                                                        <div className="col d-flex">
                                                            <span className="staff-detail-label text-muted small text-uppercase fw-semibold">DOB :</span>
                                                            <span className="fw-medium text-dark">{formatDate(viewingTeacher.date_of_birth)}</span>
                                                        </div>
                                                        <div className="col d-flex">
                                                            <span className="staff-detail-label text-muted small text-uppercase fw-semibold">Gender :</span>
                                                            <span className="fw-medium text-dark">{viewingTeacher.gender || "-"}</span>
                                                        </div>
                                                    </div>

                                                    <h5 className="border-bottom pb-2 mb-3 mt-4 text-uppercase text-muted fs-6 fw-bold letter-spacing-1">
                                                        Contact
                                                    </h5>
                                                    <div className="d-flex flex-column gap-2">
                                                        <div className="d-flex">
                                                            <span className="staff-detail-label text-muted small text-uppercase fw-semibold">Phone :</span>
                                                            <span className="fw-medium text-dark">{viewingTeacher.phone_number || "-"}</span>
                                                        </div>
                                                        <div className="d-flex">
                                                            <span className="staff-detail-label text-muted small text-uppercase fw-semibold">Email :</span>
                                                            <span className="fw-medium text-dark">{viewingTeacher.email || "-"}</span>
                                                        </div>
                                                        <div className="d-flex mt-1">
                                                            <span className="staff-detail-label text-muted small text-uppercase fw-semibold">Address :</span>
                                                            <span className="fw-medium text-dark">
                                                                {viewingTeacher.address}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmationModal
                isOpen={deleteConfirmation.show}
                title="Delete Staff Member"
                message={`Are you sure you want to delete ${deleteConfirmation.teacherName}? This action cannot be undone.`}
                onConfirm={handleDelete}
                onClose={closeDeleteModal}
                confirmText="Delete"
                cancelText="Cancel"
            />
        </AdShellAdmin>
    );
}
