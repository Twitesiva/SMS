import React, { useState, useEffect } from "react";
import AdminShell from "../components/AdminShell";
import { supabase } from "../../supabaseClient";
import { toast } from "react-toastify";

export default function Revaluation() {
    const [exams, setExams] = useState([]);
    const [selectedExam, setSelectedExam] = useState("");
    const [hallTicket, setHallTicket] = useState("");
    const [student, setStudent] = useState(null);
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [publishModal, setPublishModal] = useState(false);
    const [publishing, setPublishing] = useState(false);

    const [revalPublished, setRevalPublished] = useState(false);
    const [checkingPublished, setCheckingPublished] = useState(false);

    const [revalModal, setRevalModal] = useState({
        show: false,
        resultId: null,
        subjectId: null, // Keep this for reference if needed, but we use explicit IDs for the new table
        subjectName: "",
        subjectCode: "",
        currentMarks: 0,
        newRevalMarks: "",
    });

    useEffect(() => {
        fetchExams();
    }, []);

    const fetchExams = async () => {
        const { data, error } = await supabase
            .from("exam_master")
            .select("id, exam_name")
            .order("created_at", { ascending: false });
        if (error) {
            console.error("Error fetching exams:", error);
            toast.error("Failed to load exams.");
        } else {
            setExams(data || []);
        }
    };

    const checkRevalStatus = async (examId) => {
        if (!examId) {
            setRevalPublished(false);
            return;
        }
        setCheckingPublished(true);
        try {
            // Check if any revaluation result is published for this exam
            const { data, error } = await supabase
                .from("revaluation_results")
                .select("id")
                .eq("exam_id", examId)
                .eq("status", "published")
                .limit(1);

            if (error) throw error;
            setRevalPublished(data && data.length > 0);
        } catch (err) {
            console.error("Error checking reval status:", err);
        } finally {
            setCheckingPublished(false);
        }
    };

    const handleSearch = async (e) => {
        if (e) e.preventDefault();
        if (!selectedExam) {
            toast.warn("Please select the exam name.");
            return;
        }
        if (!hallTicket.trim()) {
            toast.warn("Please enter a hall ticket number.");
            return;
        }

        setLoading(true);
        setHasSearched(true);
        setStudent(null);
        setResults([]);

        try {
            // 1. Fetch Student
            const { data: studentData, error: studentError } = await supabase
                .from("students")
                .select(`
                    *,
                    group:groups!students_group_name_fkey (group_name, group_code),
                    course:courses!students_course_name_fkey (course_name, course_code)
                `)
                .eq("hall_ticket_no", hallTicket.trim())
                .single();

            if (studentError || !studentData) {
                toast.error("Student not found with this Hall Ticket Number.");
                setLoading(false);
                return;
            }

            setStudent(studentData);

            // 2. Fetch Results for this Student + Exam
            // Assuming reval Marks are stored in 'reval_marks' column for now or we just update obtained_marks?
            // User request: "add the new column for Revaluation marks"
            // Since I cannot change schema, I will assume we are updating 'marks_obtained' but the UI asks for "Revaluation Marks"
            // Wait, the user said "add the new column for Revaluation marks" which implies DB schema change OR UI column.
            // The prompt "add the new column for Revaluation marks" likely means UI column.
            // And "each subject have revaluation mark update button".
            // "once clicks thn it should be shown hall ticket and subject details and the mark input box and once user enter the marks thn the click submit thn to store"
            // I'll assume we are updating the main marks, or a specific reval column if it existed.
            // Since I don't see a 'revaluation_marks' column in the schema provided earlier (only marks_obtained),
            // I will assume for now we are updating 'marks_obtained' effectively overwriting it, OR I should add a column if I could.
            // But I cannot run SQL DDL here.
            // The user prompt "marks should be store in database" implies persistence.
            // Checking schema again... 'marks_obtained' is the main one. I'll use that for now or 'marks_obtained' as current and update it.
            // Actually, usually Revaluation implies a separate process. But without schema change power, I will just update 'marks_obtained'.
            // However, to mimic "Revaluation", maybe I should just update the same 'marks_obtained'.

            const { data: resultsData, error: resultsError } = await supabase
                .from("results")
                .select(`
            id,
            marks_obtained,
            max_marks,
            subject_id,
            subjects (
              subject_name,
              subject_code
            )
          `)
                .eq("student_id", studentData.id)
                .eq("exam_id", selectedExam)
                .order("id");

            if (resultsError) {
                console.error("Error fetching results:", resultsError);
                toast.error("Failed to fetch results.");
            } else {
                // 3. Fetch any pending revaluations for this student
                const { data: pendingRevals } = await supabase
                    .from('revaluation_results')
                    .select('subject_id, revised_marks')
                    .eq('student_id', studentData.id)
                    .eq('exam_id', selectedExam)
                    .eq('status', 'pending');

                // Merge pending marks
                const mergedResults = (resultsData || []).map(res => {
                    const pending = pendingRevals?.find(p => p.subject_id === res.subject_id);
                    return {
                        ...res,
                        display_marks: pending ? pending.revised_marks : res.marks_obtained,
                        is_pending_reval: !!pending
                    };
                });

                setResults(mergedResults);
            }
        } catch (err) {
            console.error("Unexpected error:", err);
            toast.error("An unexpected error occurred.");
        } finally {
            setLoading(false);
        }
    };

    const openRevalModal = (res) => {
        setRevalModal({
            show: true,
            resultId: res.id, // Keep this for reference if needed, but we use explicit IDs for the new table
            subjectId: res.subject_id,
            subjectName: res.subjects?.subject_name,
            subjectCode: res.subjects?.subject_code,
            currentMarks: res.marks_obtained,
            newRevalMarks: res.marks_obtained, // Default to current marks
        });
    };

    const closeRevalModal = () => {
        setRevalModal({
            show: false,
            resultId: null,
            subjectId: null,
            subjectName: "",
            subjectCode: "",
            currentMarks: 0,
            newRevalMarks: "",
        });
    };

    const submitRevaluation = async () => {
        if (!student || !selectedExam || !revalModal.subjectId) return;

        setUpdating(true);
        try {
            // Upsert into revaluation_results table
            // Based on schema: student_id, exam_id, subject_id, original_marks, revised_marks, status
            const payload = {
                student_id: student.id,
                exam_id: selectedExam,
                subject_id: revalModal.subjectId,
                original_marks: revalModal.currentMarks,
                revised_marks: revalModal.newRevalMarks,
                status: 'pending'
            };

            // Using upsert to handle if revaluation already exists for this subject
            // Note: Schema doesn't explicitly show a unique constraint on (student_id, exam_id, subject_id) 
            // but typical logic implies one active reval per subject. 
            // We'll filter by these 3 keys to find existing record if we were doing manual check, 
            // but upsert works best with unique constraints. If no unique constraint, this might insert duplicates.
            // Assuming the logic is to insert a new request or update existing pending one.
            // We'll check existence first to be safe since constraints aren't guaranteed in the provided text.

            const { data: existing } = await supabase
                .from('revaluation_results')
                .select('id')
                .eq('student_id', student.id)
                .eq('exam_id', selectedExam)
                .eq('subject_id', revalModal.subjectId)
                .maybeSingle();

            let error;
            if (existing) {
                const { error: updateError } = await supabase
                    .from('revaluation_results')
                    .update({ revised_marks: revalModal.newRevalMarks, status: 'pending' })
                    .eq('id', existing.id);
                error = updateError;
            } else {
                const { error: insertError } = await supabase
                    .from("revaluation_results")
                    .insert([payload]);
                error = insertError;
            }

            if (error) throw error;

            toast.success("Revaluation mark saved (Pending Publication).");

            // Update local state to show the new mark immediately as requested
            setResults((prev) =>
                prev.map((res) =>
                    res.subject_id === revalModal.subjectId
                        ? { ...res, display_marks: revalModal.newRevalMarks, is_pending_reval: true }
                        : res
                )
            );

            closeRevalModal();
        } catch (err) {
            console.error("Error saving revaluation marks:", err);
            toast.error("Failed to save revaluation marks.");
        } finally {
            setUpdating(false);
        }
    };

    const handlePublishResults = async () => {
        if (!selectedExam) return;
        setPublishing(true);
        try {
            // 1. Fetch all pending revaluation results for this exam
            // We iterate or batch update. Since supabase JS client does not support multi-table update joining easily,
            // we'll fetch and iterate. Ideally this should be a stored procedure or edge function for performance.
            const { data: pendingRevals, error: fetchError } = await supabase
                .from('revaluation_results')
                .select('*')
                .eq('exam_id', selectedExam)
                .eq('status', 'pending');

            if (fetchError) throw fetchError;

            if (!pendingRevals || pendingRevals.length === 0) {
                toast.info("No pending revaluation results to publish.");
                setPublishing(false);
                setPublishModal(false);
                return;
            }

            // 2. Update existing results table
            // We'll loop. For large datasets this is risky, but for typical reval counts it's likely okay.
            for (const reval of pendingRevals) {
                // Update specific result record
                await supabase
                    .from('results')
                    .update({ marks_obtained: reval.revised_marks })
                    .eq('student_id', reval.student_id)
                    .eq('exam_id', reval.exam_id)
                    .eq('subject_id', reval.subject_id);

                // 3. Mark revaluation as published
                await supabase
                    .from('revaluation_results')
                    .update({ status: 'published', published_at: new Date().toISOString() })
                    .eq('id', reval.id);
            }

            // 4. Update Exam Master
            const { error: examError } = await supabase
                .from("exam_master")
                .update({ formatted_revaluation_date: new Date().toISOString(), result_published: true })
                .eq("id", selectedExam);

            if (examError) throw examError;

            toast.success(`Published ${pendingRevals.length} revaluation result(s) successfully.`);
            setPublishModal(false);
            setRevalPublished(true); // Update local state immediately
            // Refresh results if student is currently viewed
            if (student && hallTicket) {
                handleSearch();
            }
        } catch (err) {
            console.error("Error publishing revaluation results:", err);
            toast.error("Failed to publish results.");
        } finally {
            setPublishing(false);
        }
    };

    return (
        <AdminShell>
            <div className="revaluation-container container-fluid p-4">
                <div className="card shadow-sm mb-4">
                    <div className="card-header bg-white py-3">
                        <h5 className="mb-0 fw-bold text-primary">Revaluation & Marks Update</h5>
                    </div>
                    <div className="card-body">
                        <div className="row g-3 align-items-end">
                            {/* Exam Filter */}
                            <div className="col-md-4">
                                <label className="form-label fw-semibold">Select Exam</label>
                                <select
                                    className="form-select"
                                    value={selectedExam}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setSelectedExam(val);
                                        setStudent(null);
                                        setResults([]);
                                        setHasSearched(false);
                                        checkRevalStatus(val);
                                    }}
                                >
                                    <option value="">-- Choose an Exam --</option>
                                    {exams.map((exam) => (
                                        <option key={exam.id} value={exam.id}>
                                            {exam.exam_name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Hall Ticket Input */}
                            <div className="col-md-4">
                                <label className="form-label fw-semibold">Student Hall Ticket</label>
                                <div className="input-group">
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="Enter Hall Ticket No"
                                        value={hallTicket}
                                        onChange={(e) => setHallTicket(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && handleSearch(e)}
                                        onFocus={() => {
                                            if (!selectedExam) {
                                                toast.warn("Please select the exam name.");
                                            }
                                        }}
                                    />
                                    <button
                                        className="btn btn-primary"
                                        onClick={handleSearch}
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            <span
                                                className="spinner-border spinner-border-sm"
                                                role="status"
                                                aria-hidden="true"
                                            ></span>
                                        ) : (
                                            <i className="bi bi-search me-1"></i>
                                        )}
                                        Search
                                    </button>
                                </div>
                            </div>
                            {/* Publish Button */}
                            {selectedExam && (
                                <div className="col-md-4">
                                    <label className="form-label d-none d-md-block">&nbsp;</label>
                                    <button
                                        className={`btn ${revalPublished ? "btn-secondary" : "btn-success"} w-100`}
                                        onClick={() => !revalPublished && setPublishModal(true)}
                                        disabled={revalPublished || checkingPublished}
                                    >
                                        <i className={`bi ${revalPublished ? "bi-check-circle-fill" : "bi-megaphone-fill"} me-2`}></i>
                                        {revalPublished ? "Revaluation Published" : "Publish Revaluation Results"}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Results Area */}
                {
                    student && (
                        <div className="card shadow-sm fade-in-up">
                            <div className="card-header bg-light py-3">
                                <div className="d-flex flex-column gap-2">
                                    <h6 className="mb-3 fw-bold fs-5 text-primary text-uppercase border-bottom pb-2">
                                        Student Information
                                    </h6>
                                    <div className="row g-2 mt-1">
                                        <div className="col-12">
                                            <div className="d-flex mb-2">
                                                <span className="fw-semibold text-muted" style={{ minWidth: "140px" }}>Student Name</span>
                                                <span className="fw-bold text-dark">: {student.full_name}</span>
                                            </div>
                                            <div className="d-flex mb-2">
                                                <span className="fw-semibold text-muted" style={{ minWidth: "140px" }}>Hall Ticket No</span>
                                                <span className="fw-bold text-dark">: {student.hall_ticket_no}</span>
                                            </div>
                                            <div className="d-flex mb-2">
                                                <span className="fw-semibold text-muted" style={{ minWidth: "140px" }}>Group</span>
                                                <span className="fw-bold text-dark">: {student.group?.group_name || student.group_name || "-"}</span>
                                            </div>
                                            <div className="d-flex mb-2">
                                                <span className="fw-semibold text-muted" style={{ minWidth: "140px" }}>Course</span>
                                                <span className="fw-bold text-dark">: {student.course?.course_name || student.course_name}</span>
                                            </div>
                                            <div className="d-flex mb-2">
                                                <span className="fw-semibold text-muted" style={{ minWidth: "140px" }}>Semester</span>
                                                <span className="fw-bold text-dark">: {student.current_semester || "-"}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="card-body p-0">
                                {results.length === 0 ? (
                                    <div className="text-center py-5">
                                        <i className="bi bi-journal-x text-muted fs-1"></i>
                                        <p className="mt-2 text-muted">No results found for this exam.</p>
                                    </div>
                                ) : (
                                    <div className="table-responsive">
                                        <table className="table table-hover align-middle mb-0">
                                            <thead className="table-light">
                                                <tr>
                                                    <th scope="col" className="ps-4" style={{ width: "80px" }}>S.No</th>
                                                    <th scope="col">Subject</th>
                                                    <th scope="col" style={{ width: "150px" }}>Obtained Marks</th>
                                                    <th scope="col" style={{ width: "150px" }}>Revaluation Marks</th>
                                                    <th scope="col" style={{ width: "150px" }}>Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {results.map((res, index) => (
                                                    <tr key={res.id}>
                                                        <td className="ps-4 text-muted">{index + 1}</td>
                                                        <td className="fw-bold text-secondary">
                                                            {res.subjects?.subject_code || "-"} - {res.subjects?.subject_name || "-"}
                                                        </td>
                                                        <td>
                                                            <span className="badge bg-light text-dark border px-3 py-2 fs-6">
                                                                {res.marks_obtained}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            {res.is_pending_reval ? (
                                                                <span className="badge bg-warning text-dark border px-3 py-2 fs-6">
                                                                    {res.display_marks}
                                                                </span>
                                                            ) : (
                                                                <span className="text-muted">-</span>
                                                            )}
                                                        </td>
                                                        <td>
                                                            <button
                                                                className="btn btn-sm btn-outline-primary"
                                                                onClick={() => openRevalModal(res)}
                                                                disabled={revalPublished}
                                                            >
                                                                <i className="bi bi-pencil-square me-1"></i> Update
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                }
            </div >

            {/* Revaluation Modal */}
            {
                revalModal.show && (
                    <div className="modal-backdrop fade show"></div>
                )
            }
            <div
                className={`modal fade ${revalModal.show ? "show d-block" : ""}`}
                tabIndex="-1"
                role="dialog"
                style={{ backgroundColor: revalModal.show ? "rgba(0,0,0,0.5)" : "transparent" }}
            >
                <div className="modal-dialog modal-dialog-centered" role="document">
                    <div className="modal-content shadow-lg border-0">
                        <div className="modal-header bg-primary text-white">
                            <h5 className="modal-title fw-bold">Update Revaluation Marks</h5>
                            <button
                                type="button"
                                className="btn-close btn-close-white"
                                onClick={closeRevalModal}
                            ></button>
                        </div>
                        <div className="modal-body p-4">
                            <div className="mb-3 p-3 bg-light rounded border">
                                <div className="d-flex justify-content-between mb-2">
                                    <small className="text-muted">Student Hall Ticket</small>
                                    <span className="fw-bold">{student?.hall_ticket_no}</span>
                                </div>
                                <div className="d-flex justify-content-between mb-2">
                                    <small className="text-muted">Subject Code</small>
                                    <span className="fw-bold">{revalModal.subjectCode}</span>
                                </div>
                                <div className="d-flex justify-content-between">
                                    <small className="text-muted">Subject Name</small>
                                    <span className="fw-bold text-end">{revalModal.subjectName}</span>
                                </div>
                            </div>

                            <div className="mb-4">
                                <label className="form-label fw-semibold">New Marks</label>
                                <input
                                    type="number"
                                    className="form-control form-control-lg"
                                    value={revalModal.newRevalMarks}
                                    onChange={(e) =>
                                        setRevalModal({ ...revalModal, newRevalMarks: e.target.value })
                                    }
                                    autoFocus
                                />
                                <div className="form-text">
                                    Current Marks: <span className="fw-bold">{revalModal.currentMarks}</span>
                                </div>
                            </div>

                            <div className="d-flex justify-content-end gap-2">
                                <button
                                    type="button"
                                    className="btn btn-light"
                                    onClick={closeRevalModal}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={submitRevaluation}
                                    disabled={updating}
                                >
                                    {updating ? "Saving..." : "Submit Update"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Publish Confirmation Modal */}
            {
                publishModal && (
                    <>
                        <div className="modal-backdrop fade show"></div>
                        <div
                            className="modal fade show d-block"
                            tabIndex="-1"
                            role="dialog"
                            style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
                        >
                            <div className="modal-dialog modal-dialog-centered" role="document">
                                <div className="modal-content shadow-lg border-0">
                                    <div className="modal-header bg-success text-white">
                                        <h5 className="modal-title fw-bold">Confirm Publication</h5>
                                        <button
                                            type="button"
                                            className="btn-close btn-close-white"
                                            onClick={() => setPublishModal(false)}
                                        ></button>
                                    </div>
                                    <div className="modal-body p-4 text-center">
                                        <div className="mb-3">
                                            <i className="bi bi-check-circle-fill text-success" style={{ fontSize: "3rem" }}></i>
                                        </div>
                                        <h5 className="mb-3">Publish Revaluation Results?</h5>
                                        <p className="text-muted">
                                            Are you sure you want to publish the revaluation results for this exam?
                                            This action will make the updated marks visible to students.
                                        </p>
                                        <div className="d-flex justify-content-center gap-2 mt-4">
                                            <button
                                                type="button"
                                                className="btn btn-light px-4"
                                                onClick={() => setPublishModal(false)}
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-success px-4"
                                                onClick={handlePublishResults}
                                                disabled={publishing}
                                            >
                                                {publishing ? "Publishing..." : "Confirm Publish"}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )
            }
        </AdminShell >
    );
}
