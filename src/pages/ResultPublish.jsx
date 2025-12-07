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
    const [showConfirm, setShowConfirm] = useState(false);

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

    const handlePublish = async () => {
        if (!selectedExamId) {
            showToast("Please select an exam", { type: "error" });
            return;
        }

        setShowConfirm(true);
    };

    const confirmPublish = async () => {
        setShowConfirm(false);

        setPublishing(true);
        try {
            // 1. Fetch all data related to this exam to construct results
            const { data: registrations, error: fetchError } = await supabase
                .from('exam_registrations')
                .select(`
                    student_id,
                    exam_id,
                    semester,
                    exam_registration_subjects (
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

            // 2. Flatten and transform into results format
            const resultsPayload = [];
            (registrations || []).forEach(reg => {
                (reg.exam_registration_subjects || []).forEach(sub => {
                    (sub.barcodes || []).forEach(barcode => {
                        (barcode.marks || []).forEach(mark => {
                            resultsPayload.push({
                                student_id: reg.student_id,
                                exam_id: reg.exam_id,
                                subject_id: sub.subject_id,
                                semester: reg.semester,
                                marks_obtained: mark.marks_obtained,
                                max_marks: mark.max_marks || 100,
                                barcode_id: mark.barcode_id
                            });
                        });
                    });
                });
            });

            if (resultsPayload.length > 0) {
                // 3. Upsert into results table
                const { error: insertError } = await supabase
                    .from('results')
                    .upsert(resultsPayload, { onConflict: 'student_id, exam_id, subject_id' });

                if (insertError) throw insertError;
            }

            // 4. Update exam master status
            const { error } = await supabase
                .from("exam_master")
                .update({ results_published: true })
                .eq("id", selectedExamId);

            if (error) throw error;

            showToast("Results published successfully", { type: "success" });
            loadExams();
            setSelectedExamId("");
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
                                onClick={handlePublish}
                                disabled={!selectedExamId || publishing}
                            >
                                {publishing ? "Publishing..." : "Publish Results"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {showConfirm && (
                <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">Confirm Publish</h5>
                                <button type="button" className="btn-close" onClick={() => setShowConfirm(false)}></button>
                            </div>
                            <div className="modal-body">
                                <p>Are you sure you want to publish results for this exam?</p>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-secondary" onClick={() => setShowConfirm(false)}>Cancel</button>
                                <button className="btn btn-primary" onClick={confirmPublish}>Confirm Publish</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </AdminShell>
    );
}
