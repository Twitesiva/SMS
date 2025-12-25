import { useState } from 'react';
import { showToast } from '../../store/ui.js';
import ConfirmationModal from '../../components/ConfirmationModal.jsx';

export default function AcademicYearsSection({
  yearForm,
  setYearForm,
  academicYears = [],
  editingYearId,
  addYear,
  editYear,
  deleteYear,
  onCancelEdit,
}) {
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  const validateYearFormat = (yearStr) => {
    if (!yearStr) return false;
    // Check if the format is YYYY-YYYY
    const yearRegex = /^(\d{4})-(\d{4})$/;
    const match = yearStr.match(yearRegex);
    if (!match) return false;

    const startYear = parseInt(match[1], 10);
    const endYear = parseInt(match[2], 10);

    // Enforce 1 year gap (e.g. 2025-2026)
    return (endYear - startYear) === 1;
  };

  const handleYearChange = (e) => {
    const value = e.target.value;
    setYearForm(prev => ({ ...prev, name: value }));
    // Clear error on change
    if (value) setError('');
  };

  const handleAddYear = async () => {
    // Validate format before submitting
    if (!validateYearFormat(yearForm.name)) {
      setError('Please select a valid academic year (e.g. 2025-2026)');
      return;
    }

    setError('');
    try {
      await addYear();
      showToast(editingYearId ? "Academic year updated successfully" : "Academic year added successfully", { type: 'success' });
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditYear = (year) => {
    editYear(year);
    // When editing, we populate the name. 
    // We update yearForm which is in parent.
    // Ensure we don't carry over category if it exists in year object but not in form requirements.
    setYearForm({
      name: year.name || year.academic_year,
      active: year.active,
    });
    setError('');
  };

  const handleDeleteClick = (id) => {
    setDeleteTargetId(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (deleteTargetId) {
      try {
        await deleteYear(deleteTargetId);
        showToast("Academic year deleted successfully", { type: 'success' });
        setShowDeleteConfirm(false);
        setDeleteTargetId(null);
      } catch (err) {
        console.error(err);
        showToast("Failed to delete academic year", { type: 'error' });
      }
    }
  };

  // Create a Set of existing year names for efficient lookup
  const existingYears = new Set(academicYears.map(y => y.name || y.academic_year));

  // Generate options starting from 2025 to 2030 (6 years)
  const startBaseYear = 2025;
  const yearOptions = Array.from({ length: 6 }, (_, i) => {
    const start = startBaseYear + i;
    return `${start}-${start + 1}`;
  });

  return (
    <section className="setup-section mb-4">
      <div className="students-section-shell card card-soft mb-4">
        <div className="students-section-shell-header mb-3">
          <div>
            <h5 className="section-title mb-1">Academic Years</h5>
            <p className="students-section-copy small mb-0">
              Define academic years to organize batches and curriculum.
            </p>
          </div>
        </div>

        <div className="students-section-form row g-2 align-items-end">
          <div className="col-md-5">
            <label className="form-label fw-bold mb-1">Academic Year</label>
            <select
              className={`form-select ${error && 'is-invalid'}`}
              value={yearForm.name || ''}
              onChange={handleYearChange}
              required
            >
              <option value="">Select Academic Year</option>
              {yearOptions.map((opt) => {
                // Check if this option is already in the list
                const isDisabled = existingYears.has(opt);
                return (
                  <option key={opt} value={opt} disabled={isDisabled}>
                    {opt} {isDisabled ? '(Created)' : ''}
                  </option>
                );
              })}
            </select>
            {error && <div className="invalid-feedback d-block">{error}</div>}
          </div>
          <div className="col-md-5 d-flex flex-wrap gap-2 justify-content-start">
            <button
              className="btn btn-primary students-button"
              onClick={handleAddYear}
            >
              {editingYearId ? "Update Year" : "Add Year"}
            </button>
            {editingYearId && (
              <button
                className="btn btn-outline-secondary students-button"
                onClick={onCancelEdit}
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {academicYears.length > 0 && (
          <div className="students-section-list mt-4">
            <div className="row g-3">
              {academicYears.map((y) => (
                <div className="col-md-4" key={y.id || y.academic_year || y.name}>
                  <div className="card h-100 students-category-card">
                    <div className="card-body d-flex flex-column gap-3">
                      <div>
                        <p className="fw-bold mb-1">{y.name || y.academic_year}</p>
                        <p className="text-muted mb-2 text-uppercase small">
                          Academic Year
                        </p>
                      </div>
                      <div className="mt-auto d-flex gap-2">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary students-button students-button-sm flex-fill"
                          onClick={() => handleEditYear(y)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger students-button students-button-sm flex-fill"
                          onClick={() => handleDeleteClick(y.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title="Confirm Delete"
        message="Are you sure you want to delete this academic year?"
        confirmText="Confirm Delete"
      />
    </section>
  );
}
