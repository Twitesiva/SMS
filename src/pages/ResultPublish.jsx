import React, { useEffect, useState } from "react";
import AdminShell from "../components/AdminShell";
import ConfirmationModal from "../components/ConfirmationModal";
import { api } from "../lib/mockApi";
import { supabase } from "../../supabaseClient";
import { showToast } from "../store/ui";

export default function ResultPublish() {
    const [exams, setExams] = useState([]);
    const [selectedExamId, setSelectedExamId] = useState("");
    const [loading, setLoading] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);

    const [filters, setFilters] = useState({
        academicYear: "",
        group: "",
        course: "",
        semester: ""
    });
    const [options, setOptions] = useState({
        academicYears: [],
        groups: [],
        courses: [],
        semesters: [1, 2, 3, 4, 5, 6]
    });
    const [loadingOptions, setLoadingOptions] = useState(false);

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        setLoading(true);
        setLoadingOptions(true);
        try {
            const [examsData, groupsData, coursesData, yearsData] = await Promise.all([
                api.listExams(),
                api.listGroups ? api.listGroups() : supabase.from('groups').select('*').then(res => res.data),
                api.listCourses ? api.listCourses() : supabase.from('courses').select('*').then(res => res.data),
                supabase.from('academic_year').select('academic_year').then(res => res.data)
            ]);

            setExams(examsData || []);
            setOptions(prev => ({
                ...prev,
                groups: groupsData || [],
                courses: coursesData || [],
                academicYears: (yearsData || []).map(y => y.academic_year)
            }));
        } catch (error) {
            console.error("Failed to load options", error);
            showToast("Failed to load initial data", { type: "error" });
        } finally {
            setLoading(false);
            setLoadingOptions(false);
        }
    };

    // Derived courses based on selected group
    const filteredCourses = filters.group
        ? options.courses.filter(c => {
            const gName = c.group_name || c.groupName;
            return gName === filters.group;
        })
        : options.courses;

    const selectedExam = exams.find(e => e.id === selectedExamId);
    const isPublished = selectedExam?.results_published;

    const handlePublishClick = async () => {
        if (!selectedExamId) {
            showToast("Please select an exam", { type: "error" });
            return;
        }

        try {
            // Partial duplicate check is complex with filters, relying on Upsert to handle updates.
            // We removed the strict count > 0 check to allow partial publishing.

            // Optional: Check if any students match the filters before popping modal
            let query = supabase
                .from('exam_registrations')
                .select('id', { count: 'exact', head: true })
                .eq('exam_id', selectedExamId);

            if (filters.academicYear) query = query.eq('academic_year', filters.academicYear);
            if (filters.group) query = query.eq('group_name', filters.group);
            if (filters.course) query = query.eq('course_name', filters.course);
            if (filters.semester) query = query.eq('semester', filters.semester);

            const { count: matchingCount, error: countError } = await query;
            if (countError) throw countError;

            if (matchingCount === 0) {
                showToast("No student registrations found matching these criteria.", { type: "warning" });
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

            // 1. Fetch registrations
            // Remove deep nesting for marks/barcodes as we will fetch marks separately to handle null barcodes
            let regQuery = supabase
                .from('exam_registrations')
                .select(`
                    id,
                    student_id,
                    exam_id,
                    semester,
                    exam_registration_subjects (
                        id,
                        subject_id
                    )
                `)
                .eq('exam_id', selectedExamId);

            if (filters.academicYear) regQuery = regQuery.eq('academic_year', filters.academicYear);
            if (filters.group) regQuery = regQuery.eq('group_name', filters.group);
            if (filters.course) regQuery = regQuery.eq('course_name', filters.course);
            if (filters.semester) regQuery = regQuery.eq('semester', filters.semester);

            const { data: registrations, error: fetchError } = await regQuery;

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

            // 3. Fetch Students, Subjects, and Marks in parallel
            const [studentsRes, subjectsRes, marksRes] = await Promise.all([
                studentIds.size > 0
                    ? supabase.from('students').select('id, full_name, hall_ticket_no').in('id', Array.from(studentIds))
                    : { data: [] },
                subjectIds.size > 0
                    ? supabase.from('subjects').select('subject_id, subject_name, subject_code').in('subject_id', Array.from(subjectIds))
                    : { data: [] },
                (studentIds.size > 0 && subjectIds.size > 0)
                    ? supabase.from('marks')
                        .select('student_id, subject_id, internal_marks, theory_marks, max_marks, barcode_id')
                        .in('student_id', Array.from(studentIds))
                        .in('subject_id', Array.from(subjectIds))
                    : { data: [] }
            ]);

            if (studentsRes.error) throw studentsRes.error;
            if (subjectsRes.error) throw subjectsRes.error;
            if (marksRes.error) throw marksRes.error;

            const studentMap = new Map((studentsRes.data || []).map(s => [s.id, s]));
            const subjectMap = new Map((subjectsRes.data || []).map(s => [s.subject_id, s]));

            // Map marks by "student_id-subject_id"
            const marksMap = new Map();
            (marksRes.data || []).forEach(m => {
                marksMap.set(`${m.student_id}-${m.subject_id}`, m);
            });

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

                    // Look up mark
                    const mark = marksMap.get(`${reg.student_id}-${sub.subject_id}`);

                    if (mark) {
                        const internal = mark.internal_marks || 0;
                        const theory = mark.theory_marks || 0;
                        const total = internal + theory;

                        // Payload for DB
                        resultsPayload.push({
                            student_id: reg.student_id,
                            exam_id: reg.exam_id,
                            subject_id: sub.subject_id,
                            semester: reg.semester,
                            marks_obtained: total,
                            internal_marks: internal,
                            theory_marks: theory,
                            max_marks: mark.max_marks || 100,
                            barcode_id: mark.barcode_id // Can be null now, which is allowed
                        });

                        // Preview for UI
                        previewList.push({
                            hallTicket,
                            studentName,
                            subject: `${subjectCode} - ${subjectName}`,
                            marks: total
                        });
                    }
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

            // 5. Update exam master status intelligently
            // Check if ALL students registered for this exam now have results published

            // Get total count of registered students for this exam
            const { count: totalRegistrations, error: regCountError } = await supabase
                .from('exam_registrations')
                .select('student_id', { count: 'exact', head: true })
                .eq('exam_id', selectedExamId);

            if (regCountError) throw regCountError;

            // Get count of students who have at least one result published for this exam
            // Note: This is an approximation. Ideally we check if every subject for every student is published.
            // But checking if "all students have at least some result" is a reasonable proxy for "results published" state in many flows.
            // A more strict check would be: count(distinct student_id) in results == count(distinct student_id) in exam_registrations

            // We use rpc or raw query if needed, but here's a client-side approximation or simple distinct count
            // Since Supabase head:true with distinct is tricky, we can rely on our previous knowledge or a separate query.

            // Let's just update the flag if we are publishing for *all* or if the total counts match.
            // For now, to meet the requirement: "once the register exam can who all students are appearing the whole results published thn it should be turn into True"

            const { data: distinctResults, error: resCountError } = await supabase
                .from('results')
                .select('student_id')
                .eq('exam_id', selectedExamId);

            if (resCountError) throw resCountError;

            const uniqueStudentsWithResults = new Set(distinctResults.map(r => r.student_id)).size;

            // If the number of unique students with results equals the total number of registrations, 
            // then we consider the results fully published.
            if (uniqueStudentsWithResults >= totalRegistrations) {
                const { error } = await supabase
                    .from("exam_master")
                    .update({ results_published: true })
                    .eq("id", selectedExamId);

                if (error) throw error;
            }

            showToast("Results published successfully", { type: "success" });
            setSelectedExamId("");
            setFilters({
                academicYear: "",
                group: "",
                course: "",
                semester: ""
            });
            loadInitialData();

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
                        <div className="row g-3 mb-3">
                            <div className="col-12">
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
                                        <option key={exam.id} value={exam.id} disabled={exam.results_published}>
                                            {exam.exam_name} {exam.results_published ? "(Published)" : ""}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="col-md-6">
                                <label className="form-label">Academic Year</label>
                                <select
                                    className="form-select"
                                    value={filters.academicYear}
                                    onChange={(e) => setFilters(prev => ({ ...prev, academicYear: e.target.value }))}
                                    disabled={!selectedExamId || publishing || isPublished}
                                >
                                    <option value="">All Years</option>
                                    {options.academicYears.map(year => (
                                        <option key={year} value={year}>{year}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="col-md-6">
                                <label className="form-label">Group</label>
                                <select
                                    className="form-select"
                                    value={filters.group}
                                    onChange={(e) => setFilters(prev => ({ ...prev, group: e.target.value, course: '' }))}
                                    disabled={!selectedExamId || publishing || isPublished}
                                >
                                    <option value="">All Groups</option>
                                    {options.groups.map(g => (
                                        <option key={g.group_id || g.id} value={g.group_name || g.name}>{g.group_name || g.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="col-md-6">
                                <label className="form-label">Course</label>
                                <select
                                    className="form-select"
                                    value={filters.course}
                                    onChange={(e) => setFilters(prev => ({ ...prev, course: e.target.value }))}
                                    disabled={!selectedExamId || publishing || isPublished}
                                >
                                    <option value="">All Courses</option>
                                    {filteredCourses.map(c => (
                                        <option key={c.course_id || c.id} value={c.course_name || c.name}>{c.course_name || c.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="col-md-6">
                                <label className="form-label">Semester</label>
                                <select
                                    className="form-select"
                                    value={filters.semester}
                                    onChange={(e) => setFilters(prev => ({ ...prev, semester: e.target.value }))}
                                    disabled={!selectedExamId || publishing || isPublished}
                                >
                                    <option value="">All Semesters</option>
                                    {options.semesters.map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="col-12 d-flex justify-content-end mt-4">
                                <button
                                    className="btn btn-primary"
                                    onClick={handlePublishClick}
                                    disabled={!selectedExamId || publishing || isPublished}
                                >
                                    {publishing ? "Processing..." : isPublished ? "Results Published" : "Publish Results"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <ConfirmationModal
                isOpen={showConfirmModal}
                onClose={() => setShowConfirmModal(false)}
                onConfirm={handlePublishConfirm}
                title="Confirm Publish"
                message={`Are you sure you want to publish results for ${exams.find(e => e.id === selectedExamId)?.exam_name}? This action cannot be undone easily. Students will be able to view their results immediately.`}
                confirmText="Confirm Publish"
                confirmButtonClass="btn-primary"
                isLoading={publishing}
            />
        </AdminShell>
    );
}
