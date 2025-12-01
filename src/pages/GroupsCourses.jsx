import { useEffect, useState } from "react";

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

  // When category is UG/PG we auto-fill standard duration and semesters
  useEffect(() => {
    if (!groupForm) return;
    if (groupForm.category === "UG") {
      setGroupForm((prev) => ({ ...prev, years: 3, semesters: 6 }));
    } else if (groupForm.category === "PG") {
      setGroupForm((prev) => ({ ...prev, years: 2, semesters: 4 }));
    }
    // note: we intentionally do not clear years/semesters when category is empty
  }, [groupForm?.category, setGroupForm]);

  const isFixedDuration =
    groupForm && (groupForm.category === "UG" || groupForm.category === "PG");
    
  // State for category filter in courses section
  const [categoryFilter, setCategoryFilter] = useState("");
  
  // Filter groups based on selected category
  const filteredGroups = categoryFilter 
    ? groups.filter(group => group.category === categoryFilter)
    : groups;

  return (
    <>
      <section className="setup-section mb-4">
        <div className="students-section-shell card card-soft mb-4">
          <div className="students-section-shell-header mb-3">
            <div>
              <h5 className="section-title mb-1">Groups</h5>
              <p className="students-section-copy small mb-0">
                Create and manage cohorts with their academic category, duration, and semesters.
              </p>
            </div>
          </div>
          <div className="students-section-form row g-2 align-items-end">
            <div className="col-md-3">
              <label className="form-label fw-bold mb-1">Category</label>
              <select
                className="form-select"
                value={groupForm.category}
                onChange={(e) =>
                  setGroupForm({ ...groupForm, category: e.target.value })
                }
                required
              >
                <option value="">Select Category</option>
                <option value="UG">UG</option>
                <option value="PG">PG</option>
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-bold mb-1">Group Code</label>
              <input
                className="form-control"
                placeholder="Group Code"
                required
                value={groupForm.code}
                onChange={(e) =>
                  setGroupForm({
                    ...groupForm,
                    code: e.target.value.toUpperCase(),
                  })
                }
              />
            </div>
            <div className="col-md-3">
              <label className="form-label fw-bold mb-1">Group Name</label>
              <input
                className="form-control"
                placeholder="Group Name"
                required
                value={groupForm.name}
                onChange={(e) =>
                  setGroupForm({ ...groupForm, name: e.target.value })
                }
              />
            </div>
            <div className="col-md-3 col-lg-2">
              <label className="form-label fw-bold mb-1">
                Duration (years)
              </label>
              <input
                type="number"
                className="form-control no-spinner"
                placeholder="Years"
                value={groupForm.years}
                onChange={(e) => {
                  if (!isFixedDuration)
                    setGroupForm({ ...groupForm, years: e.target.value });
                }}
                disabled={isFixedDuration}
                style={{ "-moz-appearance": "textfield" }}
                onWheel={(e) => e.target.blur()}
              />
            </div>
            <div className="col-md-3 col-lg-2">
              <label className="form-label fw-bold mb-1">
                Number of semesters
              </label>
              <input
                type="number"
                className="form-control no-spinner"
                placeholder="No. of Semesters"
                value={groupForm.semesters}
                onChange={(e) => {
                  if (!isFixedDuration)
                    setGroupForm({ ...groupForm, semesters: e.target.value });
                }}
                disabled={isFixedDuration}
                style={{ "-moz-appearance": "textfield" }}
                onWheel={(e) => e.target.blur()}
              />
            </div>
          </div>
          <div className="students-section-actions mt-3 d-flex flex-wrap gap-2">
            <button
              className="btn btn-primary students-button"
              onClick={saveGroup}
            >
              {editingGroupId ? "Update Group" : "Add Group"}
            </button>
            {editingGroupId && (
              <button
                className="btn btn-outline-secondary students-button"
                onClick={() => {
                  setGroupForm({
                    id: "",
                    category: "",
                    code: "",
                    name: "",
                    years: 0,
                    semesters: 0,
                  });
                  setEditingGroupId("");
                }}
              >
                Cancel
              </button>
            )}
          </div>

          {groups.length > 0 && (
            <div className="students-section-list mt-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <span
                  className="text-muted text-uppercase fw-semibold small"
                  style={{ letterSpacing: "0.08em" }}
                >
                  Showing {groups.length} group{groups.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-3">
                {groups.map((g) => (
                  <div className="col" key={g.id}>
                    <div className="card h-100 students-category-card">
                      <div className="card-body d-flex flex-column">
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <div>
                            <div className="text-uppercase text-muted small mb-1">
                              Group Name
                            </div>
                            <div className="fs-5 fw-bold">{g.name || "-"}</div>
                            <div className="text-muted small">
                              {g.code || "-"}
                            </div>
                          </div>
                          <div className="d-flex flex-column align-items-end gap-2">
                            {g.category ? (
                              <span className="students-section-badge students-section-badge-category">
                                {g.category}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className="d-flex flex-wrap gap-4 mb-4 text-muted">
                          <div>
                            <div className="text-uppercase small">Duration</div>
                            <div className="fw-semibold text-dark">
                              {g.years || "-"} Years
                            </div>
                          </div>
                          <div>
                            <div className="text-uppercase small">Semesters</div>
                            <div className="fw-semibold text-dark">
                              {g.semesters || "-"}
                            </div>
                          </div>
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
                            onClick={() => deleteGroup(g.id)}
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
              <h5 className="section-title mb-1">Courses</h5>
              <p className="students-section-copy small mb-0">
                Assign course codes and group mappings so academic programs stay organized.
              </p>
            </div>
          </div>
          <div className="students-section-form row g-3">
            <div className="col-md-2">
              <label className="form-label fw-bold mb-1">Category</label>
              <select
                className="form-select"
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setCourseForm((prev) => ({ ...prev, groupCode: "" }));
                }}
              >
                <option value="">All Categories</option>
                <option value="UG">UG</option>
                <option value="PG">PG</option>
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-bold mb-1">Group</label>
              <select
                className="form-select"
                required
                value={courseForm.groupCode}
                onChange={(e) => {
                  const value = e.target.value;
                  const selected = filteredGroups.find(
                    (g) =>
                      (g.groupCode || g.code || g.group_code) === value ||
                      (g.group_name || g.name) === value
                  );
                  const groupNameValue =
                    selected?.group_name ||
                    selected?.name ||
                    selected?.groupName ||
                    "";
                  setCourseForm({
                    ...courseForm,
                    groupCode: value,
                    groupName: groupNameValue,
                  });
                }}
                disabled={!categoryFilter}
              >
                <option value="">Select Group</option>
                {filteredGroups.map((g) => (
                  <option key={g.id} value={g.code}>
                    {g.name || g.code}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-bold mb-1">Course Code</label>
              <input
                className="form-control"
                placeholder="Enter Course Code"
                required
                value={courseForm.courseCode}
                onChange={(e) =>
                  setCourseForm({
                    ...courseForm,
                    courseCode: e.target.value.toUpperCase(),
                  })
                }
              />
            </div>
            <div className="col-md-4">
              <label className="form-label fw-bold mb-1">Course Name</label>
              <input
                className="form-control"
                placeholder="Enter Course Name"
                required
                value={courseForm.courseName}
                onChange={(e) =>
                  setCourseForm({ ...courseForm, courseName: e.target.value })
                }
              />
            </div>
          </div>
          <div className="students-section-actions mt-3 d-flex flex-wrap gap-2">
            <button
              className="btn btn-primary students-button"
              onClick={saveCourse}
            >
              {editingCourseId ? "Update Course" : "Add Course"}
            </button>
            {editingCourseId && (
              <button
                className="btn btn-outline-secondary students-button"
                onClick={() => {
                  setCourseForm({
                    id: "",
                    groupCode: "",
                    courseCode: "",
                    courseName: "",
                    semesters: 6,
                  });
                  setEditingCourseId("");
                }}
              >
                Cancel
              </button>
            )}
          </div>

          {courses.length > 0 && (
            <div className="students-section-list mt-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <span
                  className="text-muted text-uppercase fw-semibold small"
                  style={{ letterSpacing: "0.08em" }}
                >
                  Showing {courses.length} course{courses.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-3">
                {courses.map((c) => (
                  <div className="col" key={c.id}>
                    <div className="card h-100 students-category-card">
                      <div className="card-body d-flex flex-column">
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <div>
                            <div className="text-uppercase text-muted small mb-1">
                              Course Name
                            </div>
                            <div className="fs-5 fw-bold">{c.courseName}</div>
                          </div>
                          <span className="students-section-badge students-section-badge-course">
                            {c.semesters} sems
                          </span>
                        </div>
                        <div className="mb-2">
                          <div className="text-muted text-uppercase small mb-1">
                            Course Code
                          </div>
                          <div className="fw-semibold text-dark">
                            {c.courseCode}
                          </div>
                        </div>
                        <p className="text-muted text-uppercase small mb-1">
                          Group
                        </p>
                        <p className="fw-semibold text-dark mb-4">
                          {c.groupName || c.groupCode || "-"}
                        </p>
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
                            onClick={() => deleteCourse(c.id)}
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
    </>
  );
}
