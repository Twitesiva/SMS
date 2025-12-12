import React, { useEffect, useState } from "react";
import AdminShell from "../components/AdminShell";
import { api } from "../lib/mockApi";
import { supabase } from "../../supabaseClient";
import { showToast } from "../store/ui";

export default function ResultPublish() {
    const [exams, setExams] = useState([]);
    const [selectedExamId, setSelectedExamId] = useState("");
    const [loading, setLoading] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);

    useEffect(() => {
        loadExams();
    }, []);

    const loadExams = async () => {
        setLoading(true);
        try {
            const data = await api.listExams();
            setExams(data || []);
        } catch (error) {
            console.error("Failed to load exams", error);
            showToast("Failed to load exams", { type: "error" });
        } finally {
            setLoading(false);
        }
    };

    const handlePublishClick = async () => {
        if (!selectedExamId) {
            showToast("Please select an exam", { type: "error" });
            return;
        }

        try {
            // Check for existing results to prevent duplicates
            const { count, error: existingError } = await supabase
                .from('results')
                .select('*', { count: 'exact', head: true })
                .eq('exam_id', selectedExamId);

            if (existingError) throw existingError;

            if (count > 0) {
                showToast("Results are already published for this exam.", { type: "warning" });
                return;
            }

            setShowConfirmModal(true);
        } catch (error) {
            console.error("Error checking exam status:", error);
            showToast("Failed to verify exam status", { type: "error" });
        }
    };

    const handlePublishConfirm = async () => {
        setShowConfirmModal(false);
        setPublishing(true);
        try {

            // 1. Fetch registrations with nested marks data
            // We fetch the core structure but remove the direct relation joins to avoid schema errors.
            const { data: registrations, error: fetchError } = await supabase
                .from('exam_registrations')
                .select(`
                    id,
                    student_id,
                    exam_id,
                    semester,
                    exam_registration_subjects (
                        id,
                        subject_id,
                        barcodes (
                            id,
                            marks (
                                marks_obtained,
                                max_marks,
                                barcode_id
                            )
                        )
                    )
                `)
                .eq('exam_id', selectedExamId);

            if (fetchError) throw fetchError;

            // 2. Extract IDs for manual fetching
            const studentIds = new Set();
            const subjectIds = new Set();

            (registrations || []).forEach(reg => {
                if (reg.student_id) studentIds.add(reg.student_id);
                if (reg.exam_registration_subjects) {
                    reg.exam_registration_subjects.forEach(sub => {
                        if (sub.subject_id) subjectIds.add(sub.subject_id);
                    });
                }
            });

            // 3. Fetch Students and Subjects in parallel
            const [studentsRes, subjectsRes] = await Promise.all([
                studentIds.size > 0
                    ? supabase.from('students').select('id, full_name, hall_ticket_no').in('id', Array.from(studentIds))
                    : { data: [] },
                subjectIds.size > 0
                    ? supabase.from('subjects').select('subject_id, subject_name, subject_code').in('subject_id', Array.from(subjectIds))
                    : { data: [] }
            ]);

            if (studentsRes.error) throw studentsRes.error;
            if (subjectsRes.error) throw subjectsRes.error;

            const studentMap = new Map((studentsRes.data || []).map(s => [s.id, s]));
            const subjectMap = new Map((subjectsRes.data || []).map(s => [s.subject_id, s]));

            // 4. Flatten and transform into results format
            const resultsPayload = [];
            const previewList = [];

            (registrations || []).forEach(reg => {
                const student = studentMap.get(reg.student_id);
                const studentName = student?.full_name || "Unknown";
                const hallTicket = student?.hall_ticket_no || "N/A";

                (reg.exam_registration_subjects || []).forEach(sub => {
                    const subject = subjectMap.get(sub.subject_id);
                    const subjectCode = subject?.subject_code || "N/A";
                    const subjectName = subject?.subject_name || "Unknown";

                    (sub.barcodes || []).forEach(barcode => {
                        (barcode.marks || []).forEach(mark => {
                            // Payload for DB
                            resultsPayload.push({
                                student_id: reg.student_id,
                                exam_id: reg.exam_id,
                                subject_id: sub.subject_id,
                                semester: reg.semester,
                                marks_obtained: mark.marks_obtained,
                                max_marks: mark.max_marks || 100,
                                barcode_id: mark.barcode_id
                            });

                            // Preview for UI
                            previewList.push({
                                hallTicket,
                                studentName,
                                subject: `${subjectCode} - ${subjectName}`,
                                marks: mark.marks_obtained
                            });
                        });
                    });
                });
            });

            if (previewList.length === 0) {
                showToast("No results found to publish for this exam.", { type: "info" });
                setPublishing(false);
                return;
            }

            // Directly publish without confirmation
            if (resultsPayload.length > 0) {
                // Upsert into results table
                const { error: insertError } = await supabase
                    .from('results')
                    .upsert(resultsPayload, { onConflict: 'student_id, exam_id, subject_id' });

                if (insertError) throw insertError;
            }

            // Update exam master status
            const { error } = await supabase
                .from("exam_master")
                .update({ results_published: true })
                .eq("id", selectedExamId);

            if (error) throw error;

            showToast("Results published successfully", { type: "success" });
            setSelectedExamId("");
            loadExams();

        } catch (error) {
            console.error("Failed to publish results", error);
            showToast("Failed to publish results: " + error.message, { type: "error" });
        } finally {
            setPublishing(false);
        }
    };

    return (
        <AdminShell>
            <div className="container-fluid py-4">
                <h2 className="fw-bold mb-4">Publish Results</h2>

                <div className="card card-soft shadow-sm" style={{ maxWidth: '600px' }}>
                    <div className="card-body">
                        <div className="d-flex align-items-end gap-3 mb-3">
                            <div className="flex-grow-1">
                                <label htmlFor="examSelect" className="form-label">
                                    Select Exam Name
                                </label>
                                <select
                                    id="examSelect"
                                    className="form-select"
                                    value={selectedExamId}
                                    onChange={(e) => setSelectedExamId(e.target.value)}
                                    disabled={loading || publishing}
                                >
                                    <option value="">-- Select Exam --</option>
                                    {exams.map((exam) => (
                                        <option key={exam.id} value={exam.id}>
                                            {exam.exam_name} {exam.results_published ? "(Published)" : ""}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <button
                                className="btn btn-primary"
                                onClick={handlePublishClick}
                                disabled={!selectedExamId || publishing}
                            >
                                {publishing ? "Processing..." : "Publish Results"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {showConfirmModal && (
                <div className="modal d-block" tabIndex="-1" role="dialog" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow-lg">
                            <div className="modal-header border-0">
                                <h5 className="modal-title fw-bold">Confirm Publish</h5>
                                <button type="button" className="btn-close" onClick={() => setShowConfirmModal(false)}></button>
                            </div>
                            <div className="modal-body">
                                <p className="text-muted mb-0">
                                    Are you sure you want to publish results for <strong>{exams.find(e => e.id === selectedExamId)?.exam_name}</strong>?
                                </p>
                                <p className="text-muted small mt-2 mb-0">
                                    This action cannot be undone easily. Students will be able to view their results immediately.
                                </p>
                            </div>
                            <div className="modal-footer border-0">
                                <button type="button" className="btn btn-light" onClick={() => setShowConfirmModal(false)}>
                                    Cancel
                                </button>
                                <button type="button" className="btn btn-primary" onClick={handlePublishConfirm}>
                                    Confirm Publish
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </AdminShell>
    );
}
