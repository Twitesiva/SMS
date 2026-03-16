import AdShellAdmin from "../../components/AdShellAdmin";
import ConfirmationModal from '../../components/ConfirmationModal.jsx';
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../supabaseClient";
import { trackPromise, showToast } from "../../store/ui";
import "../admin/Setup.css";
import "./AdminContent.css";

const SUBJECT_TYPE_OPTIONS = ['core', 'activity', 'language', 'skill']

export default function Staff() {
  const [staffRows, setStaffRows] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [designationFilter, setDesignationFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [viewingStaff, setViewingStaff] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState({
    show: false,
    staffId: null,
    staffName: ''
  });

  const [editForm, setEditForm] = useState({
    staff_id: "",
    full_name: "",
    phone_number: "",
    email: "",
    designation: "",
    qualification: "",
    status: "ACTIVE",
  });

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("staff")
          .select(`
            *,
            staff_subjects (
              subject_id,
              subjects (
                subject_name,
                subject_code,
                subject_type
              )
            )
          `)
          .order("full_name");

        if (error) throw error;
        setStaffRows(data || []);
      } catch (error) {
        console.error("Error loading staff:", error);
        showToast("Error loading staff details", { type: 'danger' });
      } finally {
        setLoading(false);
      }
    };

    trackPromise(loadData());
  }, []);

  const uniqueSubjectNames = useMemo(() => {
    const names = new Set();
    staffRows.forEach((row) => {
      (row.staff_subjects || []).forEach((item) => {
        const subjectName = item.subjects?.subject_name;
        if (subjectName) names.add(subjectName);
      });
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [staffRows]);

  const normalizeDesignation = (value) => String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');

  const filteredStaff = useMemo(() => {
    const search = searchTerm.toLowerCase().trim();
    return staffRows.filter((row) => {
      const subjectNames = (row.staff_subjects || [])
        .map((entry) => entry.subjects?.subject_name)
        .filter(Boolean);

      const matchesSearch = !search || (
        (row.full_name || "").toLowerCase().includes(search) ||
        (row.staff_id || "").toLowerCase().includes(search) ||
        (row.phone_number || "").includes(search) ||
        (row.designation || "").toLowerCase().replace(/_/g, ' ').includes(search) ||
        subjectNames.some((name) => String(name).toLowerCase().includes(search))
      );

      const matchesDesignation = !designationFilter ||
        normalizeDesignation(row.designation) === designationFilter;

      const matchesSubject = !subjectFilter || subjectNames.includes(subjectFilter);
      return matchesSearch && matchesDesignation && matchesSubject;
    });
  }, [staffRows, searchTerm, designationFilter, subjectFilter]);

  const handleEdit = (staff) => {
    setEditingStaff(staff);
    setEditForm({
      staff_id: staff.staff_id || "",
      full_name: staff.full_name || "",
      phone_number: staff.phone_number || "",
      email: staff.email || "",
      designation: staff.designation || "",
      qualification: staff.qualification || "",
      status: staff.status || "ACTIVE",
    });
  };

  const closeEditModal = () => {
    setEditingStaff(null);
    setEditForm({
      staff_id: "",
      full_name: "",
      phone_number: "",
      email: "",
      designation: "",
      qualification: "",
      status: "ACTIVE",
    });
  };

  const handleUpdate = async () => {
    if (!editingStaff) return;
    if (!editForm.full_name || !editForm.staff_id || !editForm.designation) {
      showToast("Please fill in Name, Staff ID and Designation", { type: 'warning' });
      return;
    }

    try {
      const { error } = await supabase
        .from("staff")
        .update(editForm)
        .eq("id", editingStaff.id);

      if (error) throw error;

      showToast("Staff details updated successfully", { type: 'success' });
      setStaffRows((prev) => prev.map((row) => row.id === editingStaff.id ? { ...row, ...editForm } : row));
      closeEditModal();
    } catch (error) {
      console.error("Error updating staff:", error);
      showToast("Failed to update staff details", { type: 'danger' });
    }
  };

  const openDeleteModal = (staff) => {
    setDeleteConfirmation({
      show: true,
      staffId: staff.id,
      staffName: staff.full_name
    });
  };

  const closeDeleteModal = () => {
    setDeleteConfirmation({ show: false, staffId: null, staffName: '' });
  };

  const handleDelete = async () => {
    if (!deleteConfirmation.staffId) return;
    try {
      await supabase.from('staff_subjects').delete().eq('staff_id', deleteConfirmation.staffId);
      const { error } = await supabase.from("staff").delete().eq("id", deleteConfirmation.staffId);
      if (error) throw error;

      setStaffRows((prev) => prev.filter((row) => row.id !== deleteConfirmation.staffId));
      showToast("Staff member deleted successfully", { type: 'success' });
      closeDeleteModal();
    } catch (error) {
      console.error("Error deleting staff:", error);
      showToast("Failed to delete staff member", { type: 'danger' });
    }
  };

  const getInitials = (name) => {
    if (!name) return "ST";
    const parts = name.split(" ").filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const renderSubjectList = (staff) => {
    const subjectLabels = (staff.staff_subjects || [])
      .map((entry) => {
        const code = entry.subjects?.subject_code;
        const name = entry.subjects?.subject_name;
        return [code, name].filter(Boolean).join(' - ');
      })
      .filter(Boolean);

    if (subjectLabels.length === 0) return '-';
    return subjectLabels.join(', ');
  }

  return (
    <AdShellAdmin>
      <div className="container-fluid p-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h2 className="fw-bold text-dark mb-1">Staff Management</h2>
          </div>
        </div>

        <div className="card border-0 shadow-sm mb-4 staff-filters">
          <div className="card-body p-3">
            <div className="staff-filters__grid">
              <div className="staff-filters__field">
                <label className="staff-filters__label">Search</label>
                <div className="input-group staff-filters__input-group">
                  <span className="input-group-text"><i className="bi bi-search text-muted"></i></span>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search by Name, Staff ID, Phone, Designation, Subject"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="staff-filters__field">
                <label className="staff-filters__label">Designation</label>
                <input
                  className="form-control"
                  value={designationFilter}
                  onChange={(e) => setDesignationFilter(normalizeDesignation(e.target.value))}
                  placeholder="Type designation"
                />
              </div>

              <div className="staff-filters__field">
                <label className="staff-filters__label">Subject</label>
                <select className="form-select" value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
                  <option value="">All Subjects</option>
                  {uniqueSubjectNames.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="students-table-panel card card-soft p-4">
          <div className="students-table-panel-header mb-3">
            <div>
              <h5 className="students-table-panel-title mb-1" style={{ color: '#ffffff' }}>Staff Directory</h5>
            </div>
            <div className="students-table-panel-meta text-end" style={{ color: '#ffffff' }}>
              {loading ? 'Refreshing data...' : `${filteredStaff.length} staff members listed`}
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
                  <th>Subjects</th>
                  <th>Phone</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="text-center py-5">
                      <div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading...</span></div>
                    </td>
                  </tr>
                ) : filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-5 text-muted">No staff records found.</td>
                  </tr>
                ) : (
                  filteredStaff.map((staff) => (
                    <tr key={staff.id} role="button" onClick={() => setViewingStaff(staff)} style={{ cursor: "pointer" }}>
                      <td>
                        <div className="d-flex align-items-center justify-content-center rounded-circle bg-white shadow-sm border" style={{ width: "50px", height: "50px", padding: "3px", flexShrink: 0 }}>
                          <div className="w-100 h-100 rounded-circle overflow-hidden bg-light d-flex align-items-center justify-content-center">
                            {staff.image_url ? (
                              <img src={staff.image_url} alt={staff.full_name} className="w-100 h-100" style={{ objectFit: 'cover', objectPosition: 'top center' }} />
                            ) : (
                              <span className="text-secondary fw-bold" style={{ fontSize: "0.85em" }}>{getInitials(staff.full_name)}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>{staff.staff_id}</td>
                      <td>{staff.full_name}</td>
                      <td>{staff.designation?.replace(/_/g, ' ')}</td>
                      <td style={{ maxWidth: 260 }}>{renderSubjectList(staff)}</td>
                      <td>{staff.phone_number || '-'}</td>
                      <td className="text-end">
                        <div className="d-flex justify-content-end flex-wrap gap-2">
                          <button className="students-action-button students-action-button--edit" onClick={(event) => { event.stopPropagation(); handleEdit(staff); }}>
                            Edit
                          </button>
                          <button className="students-action-button students-action-button--delete" onClick={(event) => { event.stopPropagation(); openDeleteModal(staff); }}>
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

      {editingStaff && (
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

      {viewingStaff && (
        <div className="students-modal-overlay" tabIndex="-1">
          <div className="students-modal-dialog">
            <div className="students-modal-content">
              <div className="students-modal-header">
                <div>
                  <p className="students-modal-header-eyebrow text-uppercase mb-1">Staff Overview</p>
                  <h5 className="students-modal-header-title fw-semibold mb-1">{viewingStaff.full_name || "Staff Details"}</h5>
                  <div className="students-modal-header-meta text-white-50 small">
                    <span>{viewingStaff.staff_id || '-'}</span>
                    <span className="mx-2">•</span>
                    <span>{viewingStaff.designation?.replace(/_/g, ' ') || '-'}</span>
                  </div>
                </div>
                <button type="button" className="students-modal-close btn btn-sm" onClick={() => setViewingStaff(null)}>
                  Close
                </button>
              </div>
              <div className="students-modal-body">
                <div className="students-modal-summary">
                  <div className="card shadow-sm border-0 mb-4">
                    <div className="card-body p-4">
                      <div className="row g-3">
                        <div className="col-md-6"><strong>Phone:</strong> {viewingStaff.phone_number || '-'}</div>
                        <div className="col-md-6"><strong>Email:</strong> {viewingStaff.email || '-'}</div>
                        <div className="col-md-6"><strong>Qualification:</strong> {viewingStaff.qualification || '-'}</div>
                        <div className="col-md-6"><strong>Experience:</strong> {viewingStaff.experience_years || 0} Years</div>
                        <div className="col-md-6"><strong>Joining Date:</strong> {formatDate(viewingStaff.joining_date)}</div>
                        <div className="col-md-6"><strong>Status:</strong> {viewingStaff.status || '-'}</div>
                        <div className="col-12">
                          <strong>Subjects:</strong>
                          <div className="mt-2 d-flex flex-wrap gap-2">
                            {(viewingStaff.staff_subjects || []).length === 0 ? (
                              <span className="text-muted">No subjects assigned.</span>
                            ) : (
                              (viewingStaff.staff_subjects || []).map((entry, index) => (
                                <span key={`${entry.subject_id}-${index}`} className="badge bg-light text-dark border">
                                  {(entry.subjects?.subject_code ? `${entry.subjects.subject_code} - ` : '') + (entry.subjects?.subject_name || '-')}
                                </span>
                              ))
                            )}
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
        message={`Are you sure you want to delete ${deleteConfirmation.staffName}? This action cannot be undone.`}
        onConfirm={handleDelete}
        onClose={closeDeleteModal}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </AdShellAdmin>
  );
}
