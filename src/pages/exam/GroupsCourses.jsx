import { useEffect, useMemo, useState } from "react";
import ConfirmationModal from '../../components/ConfirmationModal.jsx';

const LEVELS = ["Primary", "Middle", "Secondary"];
const SECTION_OPTIONS = ["A", "B", "C", "D", "E", "F"];

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
}) {
  const [categoryFilter, setCategoryFilter] = useState("");
  const [confirmModalState, setConfirmModalState] = useState({ isOpen: false, type: null, id: null });

  const duplicateErrors = useMemo(() => {
    const classCode = String(groupForm?.code || "").trim().toUpperCase();
    const classExists = classCode
      ? groups.some((g) => String(g.code || "").toUpperCase() === classCode && g.id !== groupForm?.id)
      : false;

    const sectionCode = String(courseForm?.courseCode || "").trim().toUpperCase();
    const selectedClass = courseForm?.groupName || "";
    const sectionExists = sectionCode && selectedClass
      ? courses.some(
          (c) =>
            String(c.courseCode || c.code || "").toUpperCase() === sectionCode &&
            String(c.groupName || c.group_name || "") === String(selectedClass) &&
            c.id !== editingCourseId
        )
      : false;

    return {
      classCode: classExists,
      sectionCode: sectionExists,
    };
  }, [groupForm?.code, groupForm?.id, courseForm?.courseCode, courseForm?.groupName, courses, editingCourseId, groups]);

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
                  setGroupForm({ id: "", category: "", code: "", name: "", years: 0, semesters: 0 });
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
                            <div className="text-uppercase text-dark fw-bold mb-1">{g.name || '-'}</div>
                            <div className="fs-6 fw-bold">Class {g.code || '-'}</div>
                          </div>
                          {g.category ? (
                            <span className="students-section-badge students-section-badge-category">{g.category}</span>
                          ) : null}
                        </div>
                        <div className="mt-auto d-flex gap-2">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary students-button students-button-sm flex-fill"
                            onClick={() => editGroup(g)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger students-button students-button-sm flex-fill"
                            onClick={() => handleDeleteGroupClick(g.id)}
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
      </section>

      <section className="setup-section mb-4">
        <div className="students-section-shell card card-soft mb-4">
          <div className="students-section-shell-header mb-3">
            <div>
              <h5 className="section-title mb-1" style={{ fontSize: '1.1rem' }}>Sections</h5>
              <p className="students-section-copy mb-0">
                Create sections A to F for each class. Maximum 6 sections per class.
              </p>
            </div>
          </div>

          <div className="students-section-form row g-3">
            <div className="col-md-2">
              <label className="form-label fw-bold mb-1">School Level</label>
              <select
                className="form-select"
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setCourseForm((prev) => ({ ...prev, groupCode: '', groupName: '' }));
                }}
              >
                <option value="">All Levels</option>
                {LEVELS.map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>

            <div className="col-md-3">
              <label className="form-label fw-bold mb-1">Class</label>
              <select
                className="form-select"
                required
                value={courseForm.groupCode}
                onChange={(e) => {
                  const value = e.target.value;
                  const selected = filteredGroups.find((g) => String(g.code || '') === String(value));
                  setCourseForm({
                    ...courseForm,
                    groupCode: value,
                    groupName: selected?.name || '',
                  });
                }}
              >
                <option value="">Select Class</option>
                {filteredGroups.map((g) => (
                  <option key={g.id} value={g.code}>{g.name || `Class ${g.code}`}</option>
                ))}
              </select>
            </div>

            <div className="col-md-3">
              <label className="form-label fw-bold mb-1">Section</label>
              <select
                className={`form-select ${duplicateErrors.sectionCode ? 'is-invalid' : ''}`}
                required
                value={courseForm.courseCode}
                onChange={(e) => setCourseForm({
                  ...courseForm,
                  courseCode: e.target.value,
                  courseName: `Section ${e.target.value}`,
                })}
              >
                <option value="">Select Section</option>
                {SECTION_OPTIONS.map((section) => (
                  <option key={section} value={section}>{section}</option>
                ))}
              </select>
              {duplicateErrors.sectionCode && <div className="text-danger small mt-1">Section already exists for this class</div>}
            </div>

            <div className="col-md-4">
              <label className="form-label fw-bold mb-1">Section Name</label>
              <input
                className="form-control"
                placeholder="Section Name"
                required
                value={courseForm.courseName}
                onChange={(e) => setCourseForm({ ...courseForm, courseName: e.target.value })}
              />
            </div>
          </div>

          <div className="students-section-actions mt-3 d-flex flex-wrap gap-2">
            <button
              className="btn btn-primary students-button"
              onClick={saveCourse}
              disabled={duplicateErrors.sectionCode}
            >
              {editingCourseId ? "Update Section" : "Add Section"}
            </button>
            {editingCourseId && (
              <button
                className="btn btn-outline-secondary students-button"
                onClick={() => {
                  setCourseForm({ id: "", groupCode: "", groupName: "", courseCode: "", courseName: "", semesters: 1 });
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
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <div>
                            <div className="text-uppercase text-dark fw-bold mb-1">{c.courseName || `Section ${c.courseCode}`}</div>
                            <div className="fs-6 fw-bold">Section {c.courseCode || '-'}</div>
                          </div>
                        </div>
                        <p className="text-muted text-uppercase small mb-1">Class</p>
                        <p className="fw-semibold text-dark mb-4">{c.groupName || c.groupCode || '-'}</p>
                        <div className="mt-auto d-flex gap-2">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary students-button students-button-sm flex-fill"
                            onClick={() => editCourse(c)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger students-button students-button-sm flex-fill"
                            onClick={() => handleDeleteCourseClick(c.id)}
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
      </section>

      <ConfirmationModal
        isOpen={confirmModalState.isOpen}
        onClose={() => setConfirmModalState({ isOpen: false, type: null, id: null })}
        onConfirm={handleConfirmDelete}
        title={`Confirm ${confirmModalState.type === 'group' ? 'Class' : 'Section'} Delete`}
        message={`Are you sure you want to delete this ${confirmModalState.type === 'group' ? 'class' : 'section'}?`}
        confirmText="Confirm Delete"
      />
    </>
  );
}
