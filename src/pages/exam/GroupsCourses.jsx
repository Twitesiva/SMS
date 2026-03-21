import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../supabaseClient.js";
import ConfirmationModal from '../../components/ConfirmationModal.jsx';

const LEVELS = ["Primary", "Middle", "Secondary"];

const SECTION_DISPLAY_MAP = {
  "A": "A1",
  "B": "A2",
  "C": "A3",
  "D": "A4",
  "E": "A5",
  "F": "A6",
  "G": "A7"
};

const getSectionDisplay = (sectionName) => {
  return SECTION_DISPLAY_MAP[sectionName] || sectionName;
};

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
  allGroups = [],
  loadData,
  academicYears = [],
}) {
  const [categoryFilter, setCategoryFilter] = useState("");
  const [confirmModalState, setConfirmModalState] = useState({ isOpen: false, type: null, id: null });
  const [overviewData, setOverviewData] = useState([]);
  
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  useEffect(() => {
    const fetchOverview = async () => {
      // Fetch junction records with related data
      // For HS (11/12), we look for groups either in sections table or junction record
      const { data, error } = await supabase
        .from("class_sections")
        .select(`
          id,
          classes(class_name, class_number),
          sections(section_name),
          groups(group_name)
        `);
      if (error) console.error("Overview fetch error:", error);
      if (data) setOverviewData(data);
    };
    fetchOverview();
  }, [courses]);

  const groupedOverview = useMemo(() => {
    const grouped = {};
    overviewData.forEach(item => {
      const cls = item.classes;
      const sec = item.sections;
      const grp = item.groups;
      if (!cls || !sec) return;

      const isHS = cls.class_number === 11 || cls.class_number === 12;
      
      // Hierarchy: Class -> Group -> Section
      let key = cls.class_name;
      let displayName = cls.class_name;
      
      if (isHS && grp?.group_name) {
          key = `${cls.class_name}|${grp.group_name}`;
          displayName = `${cls.class_name} - ${grp.group_name}`;
      }

      if (!grouped[key]) {
          grouped[key] = {
              displayName: displayName,
              className: cls.class_name,
              groupName: isHS ? grp?.group_name : null,
              sections: []
          };
      }
      if (!grouped[key].sections.includes(sec.section_name)) {
        grouped[key].sections.push(sec.section_name);
      }
    });

    Object.keys(grouped).forEach(key => {
      grouped[key].sections.sort((a, b) => a.localeCompare(b));
    });
    return grouped;
  }, [overviewData]);

  const sortedOverviewKeys = useMemo(() => {
    return Object.keys(groupedOverview).sort((a, b) => {
      const aObj = groupedOverview[a];
      const bObj = groupedOverview[b];
      const aNum = Number(aObj.className.replace(/\D/g, '')) || 0;
      const bNum = Number(bObj.className.replace(/\D/g, '')) || 0;
      if (aNum !== bNum) return aNum - bNum;
      return aObj.displayName.localeCompare(bObj.displayName);
    });
  }, [groupedOverview]);

  const duplicateErrors = useMemo(() => {
    const classCode = String(groupForm?.code || "").trim();
    const sectionName = String(groupForm?.sections || "").trim();
    const isHS = Number(classCode) === 11 || Number(classCode) === 12;

    // For non-HS classes, check if class + section combination already exists
    // sectionName is the DB value (A, B, etc.), we need to check class with that section
    const comboExists = classCode && sectionName
      ? courses.some((c) => {
          // Match by class number and section name
          const sameClass = String(c.groupCode || "") === classCode;
          const sameSection = String(c.courseCode || "") === sectionName;
          if (!sameClass || !sameSection) return false;
          // For HS, also must match the selected group to be a true duplicate
          if (isHS) return c.groupId === selectedGroupId;
          return true;
        })
      : false;

    return {
      classCode: comboExists,
      sectionCode: false,
    };
  }, [groupForm?.code, groupForm?.sections, courses, selectedGroupId]);

  const sortedGroups = useMemo(() => {
    return [...groups].sort((a, b) => {
      const aNum = Number(a.code || a.class_number) || 0;
      const bNum = Number(b.code || b.class_number) || 0;
      return aNum - bNum;
    });
  }, [groups]);

  const displayCards = useMemo(() => {
    const cards = [];
    
    // Process Classes 1-10
    const lowerClasses = groups.filter(g => {
        const num = Number(g.code || g.class_number);
        return num >= 1 && num <= 10;
    });
    
    lowerClasses.forEach(cls => {
        const classNum = cls.code || cls.class_number;
        const clsSections = courses.filter(c => String(c.groupCode) === String(classNum));
        
        cards.push({
            type: 'class',
            id: cls.id,
            uniqueId: `class-${cls.id}`,
            name: cls.name || cls.class_name,
            code: classNum,
            category: cls.category || cls.school_level,
            data: cls,
            sections: clsSections.sort((a, b) => a.courseCode.localeCompare(b.courseCode))
        });
    });
    
    // Process Classes 11-12
    const higherClasses = groups.filter(g => {
        const num = Number(g.code || g.class_number);
        return num === 11 || num === 12;
    });
    
    higherClasses.forEach(cls => {
        const classNum = cls.code || cls.class_number;
        // Find all groups for this class
        const classGroups = allGroups.filter(ag => ag.class_id === cls.id);
        
        classGroups.forEach(grp => {
            const groupSections = courses.filter(c => 
              String(c.groupCode) === String(classNum) && 
              c.groupId === grp.id
            );

            if (groupSections.length > 0) {
              cards.push({
                  type: 'group',
                  id: grp.id,
                  uniqueId: `group-${grp.id}`,
                  name: grp.group_name,
                  className: cls.name || cls.class_name,
                  classCode: classNum,
                  category: cls.category || cls.school_level || 'Secondary',
                  data: grp,
                  sections: groupSections.sort((a, b) => a.courseCode.localeCompare(b.courseCode))
              });
            }
        });

        // Check for any legacy ungrouped sections for HS classes
        const ungroupedSections = courses.filter(c => 
          String(c.groupCode) === String(classNum) && !c.groupId
        );
        if (ungroupedSections.length > 0) {
            cards.push({
                type: 'class',
                id: cls.id,
                uniqueId: `class-HS-ungrouped-${cls.id}`,
                name: cls.name || cls.class_name,
                code: classNum,
                category: cls.category || cls.school_level,
                data: cls,
                sections: ungroupedSections.sort((a, b) => a.courseCode.localeCompare(b.courseCode))
            });
        }
    });
    
    return cards.sort((a,b) => {
        const aNum = Number(a.code || a.classCode) || 0;
        const bNum = Number(b.code || b.classCode) || 0;
        if (aNum !== bNum) return aNum - bNum;
        return a.name.localeCompare(b.name);
    });
  }, [groups, courses, allGroups]);

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

  const isHigherSecondary = useMemo(() => {
    const num = Number(groupForm.code);
    return num === 11 || num === 12;
  }, [groupForm.code]);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || !groupForm.code) {
      alert("Please provide a group name and a class number.");
      return;
    }
    try {
      let selectedClass = groups.find(g => String(g.code || g.class_number) === String(groupForm.code));
      
      // AUTO-CREATE CLASS IF MISSING
      if (!selectedClass) {
        const classPayload = {
          class_number: Number(groupForm.code),
          class_name: `Class ${groupForm.code}`,
          school_level: groupForm.category,
        };
        const { data: newCls, error: clsErr } = await supabase
          .from("classes")
          .insert([classPayload])
          .select()
          .single();
        
        if (clsErr) throw clsErr;
        selectedClass = newCls;
        if (loadData) await loadData();
      }

      const { data, error } = await supabase
        .from("groups")
        .insert([{ class_id: selectedClass.id, group_name: newGroupName.trim() }])
        .select()
        .single();
      
      if (error) throw error;
      if (data) {
        setSelectedGroupId(data.id);
        setNewGroupName("");
        setIsCreatingGroup(false);
        if (loadData) await loadData();
      }
    } catch (err) {
      console.error("Group creation failed:", err);
      alert(err.message || "Failed to create group");
    }
  };

  const handleLocalSave = async () => {
    // Group required only for HS
    if (isHigherSecondary && !selectedGroupId) {
      alert("Please select or create a group for Class 11/12.");
      return;
    }
    
    // Determine which save method to use
    if (isHigherSecondary && window.handleSaveWithGroup) {
        await window.handleSaveWithGroup(selectedGroupId);
    } else {
        // For Classes 1-10, groupId is null
        if (window.handleSaveWithGroup) {
            await window.handleSaveWithGroup(null);
        } else {
            await saveGroup();
        }
    }
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
              {duplicateErrors.classCode && <div className="text-danger fw-bold mt-1">Class-Section already exists</div>}
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

            <div className="col-md-2">
              <label className="form-label fw-bold mb-1">Section</label>
              <select
                className={`form-select ${duplicateErrors.classCode ? 'is-invalid' : ''}`}
                value={groupForm.sections || ''}
                onChange={(e) => setGroupForm({ ...groupForm, sections: e.target.value })}
                required
              >
                <option value="">Select Section</option>
                <option value="A">A1</option>
                <option value="B">A2</option>
                <option value="C">A3</option>
                <option value="D">A4</option>
                <option value="E">A5</option>
                <option value="F">A6</option>
                <option value="G">A7</option>
              </select>
            </div>

            {isHigherSecondary && (
              <div className="col-md-4">
                <label className="form-label fw-bold mb-1">Group (Class 11/12 only)</label>
                <div className="d-flex gap-2">
                   {isCreatingGroup ? (
                      <div className="input-group">
                        <input 
                          type="text" 
                          className="form-control" 
                          placeholder="New Group Name" 
                          value={newGroupName}
                          onChange={(e) => setNewGroupName(e.target.value)}
                        />
                        <button className="btn btn-success" onClick={handleCreateGroup}><i className="bi bi-check-lg" /></button>
                        <button className="btn btn-outline-danger" onClick={() => setIsCreatingGroup(false)}><i className="bi bi-x-lg" /></button>
                      </div>
                   ) : (
                      <div className="input-group">
                        <select 
                          className="form-select" 
                          value={selectedGroupId}
                          onChange={(e) => setSelectedGroupId(e.target.value)}
                        >
                          <option value="">Select Group</option>
                          {allGroups
                            .filter(g => {
                                const cls = groups.find(c => String(c.code || c.class_number) === String(groupForm.code));
                                return g.class_id === cls?.id;
                            })
                            .map(g => <option key={g.id} value={g.id}>{g.group_name}</option>)
                          }
                        </select>
                        <button className="btn btn-outline-primary" onClick={() => setIsCreatingGroup(true)} title="Create New Group"><i className="bi bi-plus-lg" /></button>
                      </div>
                   )}
                </div>
              </div>
            )}
          </div>


          <div className="students-section-actions mt-3 d-flex flex-wrap gap-2">
            <button
              className="btn btn-primary students-button"
              onClick={handleLocalSave}
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

          {displayCards.length > 0 && (
            <div className="students-section-list mt-4">
              <div className="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-3">
                {displayCards.map((card) => {
                  return (
                  <div className="col" key={card.uniqueId}>
                    <div className="card h-100 students-category-card">
                      <div className="card-body d-flex flex-column">
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <div className="text-uppercase text-dark fw-bold">
                                {card.type === 'group' ? `CLASS ${card.classCode} - ${card.name}` : `CLASS ${card.code}`}
                          </div>
                          {card.category ? (
                            <span className="students-section-badge students-section-badge-category">{card.category}</span>
                          ) : null}
                        </div>
                        <div className="mt-2 mb-3 d-flex flex-wrap gap-2">
                          {card.sections.map((c, idx) => (
                              <span key={c.id} className="badge bg-light text-dark border px-2 py-1 fs-6 d-inline-flex align-items-center gap-1">
                                {getSectionDisplay(c.courseCode)}
                                <button type="button" className="btn-close btn-close-sm" style={{ fontSize: "0.4rem", filter: "invert(0.5)" }} onClick={(e) => { e.stopPropagation(); handleDeleteCourseClick(c.id); }} aria-label="Delete mapping"></button>
                              </span>
                            ))
                          }
                        </div>
                        <div className="mt-auto d-flex gap-2">
                          {card.type === 'class' ? (
                            <button type="button" className="btn btn-sm btn-outline-primary students-button students-button-sm flex-fill" onClick={() => editGroup(card.data)}>
                              Edit
                            </button>
                          ) : (
                            <div className="flex-fill"></div>
                          )}
                          <button type="button" className="btn btn-sm btn-outline-danger students-button students-button-sm flex-fill" onClick={() => card.type === 'class' ? handleDeleteGroupClick(card.id) : alert("To delete a group, delete all its sections first or use the Groups table if available.")}>
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="setup-section mb-4">
        <div className="students-section-shell card card-soft mb-4">
          <div className="students-section-shell-header mb-3">
            <div>
              <h5 className="section-title mb-1" style={{ fontSize: '1.1rem' }}>CLASS-SECTION OVERVIEW</h5>
              <p className="students-section-copy mb-2">
                View all class-section combinations created in the system.
              </p>
              <div className="badge bg-primary text-white">Total Classes : {Object.keys(groupedOverview).length}</div>
            </div>
          </div>

          <div className="students-section-list mt-2">
            <div className="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-3">
              {sortedOverviewKeys.map((key) => {
                const entry = groupedOverview[key];
                const className = entry.className;  // Always "Class 12" etc.
                // Title shows Class + Group if HS: "CLASS 12 - MATHS BIOLOGY"
                const title = entry.displayName.toUpperCase().includes('CLASS') ? entry.displayName.toUpperCase() : `CLASS ${entry.displayName.toUpperCase()}`;
                // Prefix for section badges: just the class number, e.g. "12"
                const prefix = className.replace(/class\s*/i, '').trim();
                const sectionsList = entry.sections;
                return (
                  <div className="col" key={key}>
                    <div className="card h-100 students-category-card">
                      <div className="card-body d-flex flex-column">
                        <div className="text-uppercase text-dark fw-bold mb-1">{title}</div>
                        <div className="text-muted small mb-3 fw-semibold">Sections : {sectionsList.length}</div>
                        <div className="d-flex flex-wrap gap-2">
                          {sectionsList.map((sec, idx) => (
                            <span key={`${key}-${sec}`} className="badge bg-light text-dark border px-2 py-1 fs-6">
                              {getSectionDisplay(sec)}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
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
