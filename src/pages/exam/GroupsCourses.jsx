import { useEffect, useMemo, useState } from "react";
import ConfirmationModal from '../../components/ConfirmationModal.jsx';

const LEVELS = ["Primary", "Middle", "Secondary"];

const getLevelForClass = (classCode) => {
  const value = Number(classCode);
  if (value >= 1 && value <= 5) return "Primary";
  if (value >= 6 && value <= 9) return "Middle";
  if (value >= 10 && value <= 12) return "Secondary";
  return "";
};

export default function GroupsCoursesSection({
  groupForm,
  setGroupForm,
  editingGroupId,
  setEditingGroupId,
  groups,
  saveGroup,
  editGroup,
  deleteGroup,
  courseForm,
  setCourseForm,
  editingCourseId,
  setEditingCourseId,
  courses,
  saveCourse,
  editCourse,
  deleteCourse,
  sections = [],
  academicYears = [],
}) {
  const [categoryFilter, setCategoryFilter] = useState("");
  const [confirmModalState, setConfirmModalState] = useState({ isOpen: false, type: null, id: null });

  const duplicateErrors = useMemo(() => {
    const classCode = String(groupForm?.code || "").trim();
    const classExists = classCode
      ? groups.some((g) => String(g.class_number || g.code || "") === classCode && g.id !== groupForm?.id)
      : false;

    const selectedClassCode = String(courseForm?.groupCode || "");
    const selectedSectionName = String(courseForm?.courseCode || "");
    const mappingExists = selectedClassCode && selectedSectionName
      ? courses.some((c) =>
          String(c.groupCode || "") === selectedClassCode &&
          String(c.courseCode || "") === selectedSectionName &&
          c.id !== editingCourseId
        )
      : false;

    return {
      classCode: classExists,
      sectionCode: mappingExists,
    };
  }, [groupForm?.code, groupForm?.id, courseForm?.groupCode, courseForm?.courseCode, courses, editingCourseId, groups]);

  const filteredGroups = useMemo(() => {
    if (!categoryFilter) return groups;
    return groups.filter((group) => String(group.category || "").toLowerCase() === categoryFilter.toLowerCase());
  }, [categoryFilter, groups]);

  useEffect(() => {
    const inferredLevel = getLevelForClass(groupForm?.code);
    if (inferredLevel && groupForm.category !== inferredLevel) {
      setGroupForm((prev) => ({ ...prev, category: inferredLevel }));
    }
  }, [groupForm?.code, groupForm?.category, setGroupForm]);

  const handleDeleteGroupClick = (id) => {
    setConfirmModalState({ isOpen: true, type: 'group', id });
  };

  const handleDeleteCourseClick = (id) => {
    setConfirmModalState({ isOpen: true, type: 'course', id });
  };

  const handleConfirmDelete = async () => {
    const { type, id } = confirmModalState;
    if (type === 'group') {
      await deleteGroup(id);
    } else if (type === 'course') {
      await deleteCourse(id);
    }
    setConfirmModalState({ isOpen: false, type: null, id: null });
  };

  return (
    <>
<section className="setup-section mb-4">
        <div className="students-section-shell card card-soft mb-4">
          <div className="students-section-shell-header mb-3">
            <div>
              <h5 className="section-title mb-1" style={{ fontSize: '1.1rem' }}>Classes</h5>
              <p className="students-section-copy mb-0">
                Create classes from 1 to 12 and map school level category.
              </p>
            </div>
          </div>

          <div className="students-section-form row g-2 align-items-end">
            <div className="col-md-3">
              <label className="form-label fw-bold mb-1">Class</label>
              <input
                className={`form-control ${duplicateErrors.classCode ? 'is-invalid' : ''}`}
                type="number"
                min="1"
                max="12"
                placeholder="1 to 12"
                required
                value={groupForm.code}
                onChange={(e) => {
                  const next = e.target.value;
                  setGroupForm((prev) => ({
                    ...prev,
                    code: next,
                    name: next ? `Class ${next}` : '',
                    category: getLevelForClass(next) || prev.category,
                  }));
                }}
              />
              {duplicateErrors.classCode && <div className="text-danger fw-bold mt-1">Class already exists</div>}
            </div>

            <div className="col-md-3">
              <label className="form-label fw-bold mb-1">School Level</label>
              <select
                className="form-select"
                value={groupForm.category}
                onChange={(e) => setGroupForm({ ...groupForm, category: e.target.value })}
                required
              >
                <option value="">Select Level</option>
                {LEVELS.map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>

            <div className="col-md-3">
              <label className="form-label fw-bold mb-1">Class Name</label>
              <input
                className="form-control"
                placeholder="Class Name"
                value={groupForm.name}
                onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                required
              />
            </div>

            <div className="col-md-3">
              <label className="form-label fw-bold mb-1">Sections</label>
              <input
                className="form-control"
                placeholder="Enter sections (A,B,C...)"
                value={groupForm.sections || ''}
                onChange={(e) => setGroupForm({ ...groupForm, sections: e.target.value })}
                required
                onInvalid={(e) => e.target.setCustomValidity("Please fill out this field.")}
                onInput={(e) => e.target.setCustomValidity("")}
              />
            </div>
          </div>

          <div className="students-section-actions mt-3 d-flex flex-wrap gap-2">
            <button
              className="btn btn-primary students-button"
              onClick={saveGroup}
              disabled={duplicateErrors.classCode}
            >
              {editingGroupId ? "Update Class" : "Add Class"}
            </button>
            {editingGroupId && (
              <button
                className="btn btn-outline-secondary students-button"
                onClick={() => {
                  setGroupForm({ id: "", category: "", categoryId: "", code: "", name: "" });
                  setEditingGroupId("");
                }}
              >
                Cancel
              </button>
            )}
          </div>

          {groups.length > 0 && (
            <div className="students-section-list mt-4">
              <div className="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-3">
                {groups.map((g) => (
                  <div className="col" key={g.id}>
                    <div className="card h-100 students-category-card">
                      <div className="card-body d-flex flex-column">
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <div>
                            <div className="text-uppercase text-dark fw-bold mb-1">{g.name || g.class_name || '-'}</div>
                            <div className="fs-6 fw-bold">Class {g.code || g.class_number || '-'}</div>
                          </div>
                          {g.category ? (
                            <span className="students-section-badge students-section-badge-category">{g.category}</span>
                          ) : null}
                        </div>
                        <div className="mt-2 mb-3 d-flex flex-wrap gap-2">
                          {courses
                            .filter(c => String(c.groupCode) === String(g.code || g.class_number))
                            .map(c => (
                              <span key={c.id} className="badge bg-light text-dark border px-2 py-1 fs-6">
                                {c.groupCode}{c.courseCode || c.courseName}
                              </span>
                            ))
                          }
                        </div>
                        <div className="mt-auto d-flex gap-2">
                          <button type="button" className="btn btn-sm btn-outline-primary students-button students-button-sm flex-fill" onClick={() => editGroup(g)}>
                            Edit
                          </button>
                          <button type="button" className="btn btn-sm btn-outline-danger students-button students-button-sm flex-fill" onClick={() => handleDeleteGroupClick(g.id)}>
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
      </section>

      <section className="setup-section mb-4">
        <div className="students-section-shell card card-soft mb-4">
          <div className="students-section-shell-header mb-3">
            <div>
              <h5 className="section-title mb-1" style={{ fontSize: '1.1rem' }}>Class-Section Mapping</h5>
              <p className="students-section-copy mb-0">
                Map class and section using class_sections table.
              </p>
            </div>
          </div>

          <div className="students-section-form row g-3">
            <div className="col-md-3">
              <label className="form-label fw-bold mb-1">School Level</label>
              <select className="form-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="">All Levels</option>
                {LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}
              </select>
            </div>

            <div className="col-md-3">
              <label className="form-label fw-bold mb-1">Class</label>
              <select
                className="form-select"
                required
                value={courseForm.groupCode}
                onChange={(e) => {
                  const selected = filteredGroups.find((g) => String(g.class_number || g.code) === String(e.target.value));
                  setCourseForm((prev) => ({
                    ...prev,
                    groupCode: e.target.value,
                    groupName: selected?.class_name || selected?.name || '',
                  }));
                }}
              >
                <option value="">Select Class</option>
                {filteredGroups.map((g) => (
                  <option key={g.id} value={g.class_number || g.code}>{g.class_name || g.name}</option>
                ))}
              </select>
            </div>

            <div className="col-md-3">
              <label className="form-label fw-bold mb-1">Section</label>
              <select
                className={`form-select ${duplicateErrors.sectionCode ? 'is-invalid' : ''}`}
                required
                value={courseForm.courseCode}
                onChange={(e) => {
                  setCourseForm((prev) => ({
                    ...prev,
                    courseCode: e.target.value,
                    courseName: e.target.value,
                  }));
                }}
              >
                <option value="">Select Section</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.section_name || section.courseCode || section.name}>
                    {section.section_name || section.courseCode || section.name}
                  </option>
                ))}
              </select>
              {duplicateErrors.sectionCode && <div className="text-danger small mt-1">Mapping already exists</div>}
            </div>

            <div className="col-md-3">
              <label className="form-label fw-bold mb-1">Academic Year</label>
              <select
                className="form-select"
                value={courseForm.academicYearId || ''}
                onChange={(e) => setCourseForm((prev) => ({ ...prev, academicYearId: e.target.value }))}
              >
                <option value="">Select Academic Year</option>
                {academicYears.map((year) => (
                  <option key={year.id} value={year.id}>{year.name || year.year_name || year.academic_year}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="students-section-actions mt-3 d-flex flex-wrap gap-2">
            <button className="btn btn-primary students-button" onClick={saveCourse} disabled={duplicateErrors.sectionCode}>
              {editingCourseId ? "Update Mapping" : "Add Mapping"}
            </button>
            {editingCourseId && (
              <button
                className="btn btn-outline-secondary students-button"
                onClick={() => {
                  setCourseForm({ id: "", groupCode: "", groupName: "", courseCode: "", courseName: "", academicYearId: "" });
                  setEditingCourseId("");
                }}
              >
                Cancel
              </button>
            )}
          </div>

          {courses.length > 0 && (
            <div className="students-section-list mt-4">
              <div className="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-3">
                {courses.map((c) => (
                  <div className="col" key={c.id}>
                    <div className="card h-100 students-category-card">
                      <div className="card-body d-flex flex-column">
                        <div className="text-uppercase text-dark fw-bold mb-1">Class {c.groupCode}</div>
                        <div className="fw-semibold text-dark mb-2">{c.groupName || '-'}</div>
                        <div className="fw-bold mb-1">Section {c.courseCode || '-'}</div>
                        <div className="text-muted mb-3">{c.courseName || c.courseCode || '-'}</div>
                        <div className="mt-auto d-flex gap-2">
                          <button type="button" className="btn btn-sm btn-outline-primary students-button students-button-sm flex-fill" onClick={() => editCourse(c)}>
                            Edit
                          </button>
                          <button type="button" className="btn btn-sm btn-outline-danger students-button students-button-sm flex-fill" onClick={() => handleDeleteCourseClick(c.id)}>
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
      </section>

      <ConfirmationModal
        isOpen={confirmModalState.isOpen}
        onClose={() => setConfirmModalState({ isOpen: false, type: null, id: null })}
        onConfirm={handleConfirmDelete}
        title={`Confirm ${confirmModalState.type === 'group' ? 'Class' : 'Mapping'} Delete`}
        message={`Are you sure you want to delete this ${confirmModalState.type === 'group' ? 'class' : 'class-section mapping'}?`}
        confirmText="Confirm Delete"
      />
    </>
  );
}
