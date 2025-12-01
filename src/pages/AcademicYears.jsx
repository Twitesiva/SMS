import { useState } from 'react';
 
const inferCategoryFromYearName = (yearName = '') => {
  if (!yearName) return 'UG';
  const sanitized = yearName.trim().replace(/[^0-9-]/g, '');
  const match = sanitized.match(/^(\d{4})-(\d{4})$/);
  if (!match) return 'UG';
  const start = Number(match[1]);
  const end = Number(match[2]);
  return end - start === 2 ? 'PG' : 'UG';
};
 
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
 
  const validateYearFormat = (yearStr, category) => {
    if (!yearStr) return false;
   
    // Check if the format is YYYY-YYYY
    const yearRegex = /^(\d{4})-(\d{4})$/;
    if (!yearRegex.test(yearStr)) return false;
   
    const [startYear, endYear] = yearStr.split('-').map(Number);
    const expectedDuration = category === 'UG' ? 3 : 2;
   
    return (endYear - startYear) === expectedDuration;
  };
 
  const handleYearChange = (e) => {
    const value = e.target.value;
    const prevValue = yearForm.name || '';
    if (yearForm.category && /^\d{4}$/.test(value)) {
      if (value.length <= prevValue.length) {
        setYearForm(prev => ({ ...prev, name: value }));
        setError('');
        return;
      }
      const duration = yearForm.category === 'UG' ? 3 : 2;
      const startYear = Number(value);
      const autofilled = `${value}-${startYear + duration}`;
      setYearForm(prev => ({ ...prev, name: autofilled }));
      if (!validateYearFormat(autofilled, yearForm.category)) {
        const expectedYears = yearForm.category === 'UG' ? '3 years' : '2 years';
        setError(`Please enter a valid ${yearForm.category} duration (${expectedYears})`);
      } else {
        setError('');
      }
      return;
    }
    setYearForm(prev => ({ ...prev, name: value }));
   
    if (!value) {
      setError('');
      return;
    }
   
    if (!yearForm.category) {
      setError('Please select a category first');
      return;
    }
   
    if (!validateYearFormat(value, yearForm.category)) {
      const expectedYears = yearForm.category === 'UG' ? '3 years' : '2 years';
      setError(`Please enter a valid ${yearForm.category} duration (${expectedYears})`);
    } else {
      setError('');
    }
  };
 
  const getCategory = (year) => {
    const rawCategory =
      (year.category && String(year.category)) ||
      (year.year_category && String(year.year_category)) ||
      "";
    const normalized = rawCategory.trim();
    if (normalized) return normalized.toUpperCase();
    return inferCategoryFromYearName(year.name || year.academic_year);
  };
 
  // Group academic years by category (normalize to uppercase)
  const groupedYears = academicYears.reduce(
    (acc, year) => {
      const category = getCategory(year);
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(year);
      return acc;
    },
    { UG: [], PG: [] } // Ensure both buckets exist
  );
  const ugYears = groupedYears.UG || [];
  const pgYears = groupedYears.PG || [];
 
  const handleAddYear = async () => {
    if (!yearForm.category) {
      setError('Please select a category first');
      return;
    }
   
    if (!validateYearFormat(yearForm.name, yearForm.category)) {
      const expectedYears = yearForm.category === 'UG' ? '3 years' : '2 years';
      setError(`Please enter a valid ${yearForm.category} duration (${expectedYears})`);
      return;
    }
   
    setError('');
    await addYear();
  };
 
  const handleEditYear = (year) => {
    const category = getCategory(year);
    editYear(year);
    setYearForm({
      name: year.name || year.academic_year,
      category,
      active: year.active,
    });
    setError('');
  };
 
  const handleDeleteYear = async (id) => {
    if (window.confirm('Are you sure you want to delete this academic year?')) {
      await deleteYear(id);
    }
  };
  return (
    <section className="setup-section mb-4">
      <div className="students-section-shell card card-soft mb-4">
        <div className="students-section-shell-header mb-3">
          <div>
            <h5 className="section-title mb-1">Academic Years</h5>
            <p className="students-section-copy small mb-0">
              Define and organize academic spans by category so groups and fees stay aligned.
            </p>
          </div>
        </div>

        <div className="students-section-form row g-2 align-items-end">
          <div className="col-md-2">
            <label className="form-label fw-bold mb-1">Category</label>
            <select
              className="form-select"
              value={yearForm.category || ''}
              onChange={(e) => {
                setYearForm({ ...yearForm, category: e.target.value, name: '' });
                setError('');
              }}
              required
            >
              <option value="">Select Category</option>
              <option value="UG">UG</option>
              <option value="PG">PG</option>
            </select>
          </div>
          <div className="col-md-5">
            <label className="form-label fw-bold mb-1">Academic Year</label>
            {yearForm.category ? (
              <select
                className={`form-select ${error && 'is-invalid'}`}
                value={yearForm.name}
                onChange={(e) => {
                  setYearForm(prev => ({ ...prev, name: e.target.value }));
                  setError('');
                }}
                required
              >
                <option value="">Select Academic Year</option>
                {Array.from({ length: 11 }, (_, i) => {
                  const startYear = 2020 + i;
                  const endYear = yearForm.category === 'UG' ? startYear + 3 : startYear + 2;
                  const yearRange = `${startYear}-${endYear}`;
                  return (
                    <option key={yearRange} value={yearRange}>
                      {yearRange}
                    </option>
                  );
                })}
              </select>
            ) : (
              <input
                className="form-control"
                placeholder="Select category first"
                disabled
              />
            )}
            {error && <div className="invalid-feedback d-block">{error}</div>}
          </div>
          <div className="col-md-5 d-flex flex-wrap gap-2 justify-content-end">
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

        {(ugYears.length > 0 || pgYears.length > 0) && (
          <div className="students-section-list mt-4">
            <div className="row g-4">
              {ugYears.length > 0 && (
                <div className="col-12">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h6 className="fw-bold mb-0">UG Years</h6>
                  </div>
                  <div className="row g-3">
                    {ugYears.map((y) => (
                      <div className="col-md-4" key={y.id || y.academic_year || y.name}>
                        <div className="card h-100 students-category-card">
                          <div className="card-body d-flex flex-column gap-3">
                            <div>
                              <p className="fw-bold mb-1">{y.name || y.academic_year}</p>
                              <p className="text-muted mb-2 text-uppercase small">
                                {getCategory(y)} Academic Year
                              </p>
                              <span className="students-section-badge students-section-badge-category">
                                {getCategory(y)}
                              </span>
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
                                onClick={() => handleDeleteYear(y.id)}
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

              {pgYears.length > 0 && (
                <div className="col-12">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h6 className="fw-bold mb-0">PG Years</h6>
                  </div>
                  <div className="row g-3">
                    {pgYears.map((y) => (
                      <div className="col-md-4" key={y.id || y.academic_year || y.name}>
                        <div className="card h-100 students-category-card">
                          <div className="card-body d-flex flex-column gap-3">
                            <div>
                              <p className="fw-bold mb-1">{y.name || y.academic_year}</p>
                              <p className="text-muted mb-2 text-uppercase small">
                                {getCategory(y)} Academic Year
                              </p>
                              <span className="students-section-badge students-section-badge-course">
                                {getCategory(y)}
                              </span>
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
                                onClick={() => handleDeleteYear(y.id)}
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
          </div>
        )}
      </div>
    </section>
  );
}
