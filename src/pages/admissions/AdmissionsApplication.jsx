import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { api } from '../../lib/mockApi'
import { supabase } from '../../../supabaseClient'
import AdmissionShell from '../../components/AdmissionShell'
import ConfirmationModal from '../../components/ConfirmationModal'
import crestPrimary from '../../assets/media/images.png'
import { validateRequiredFields } from '../../lib/validation'
import { showToast } from '../../store/ui'
import './Admissions.css'

const navGroups = [
    {
        title: 'Admissions Overview',
        static: true,
        items: [
            { to: '/admissions/overview', label: 'Admissions Overview', icon: 'bi-speedometer2' }
        ]
    },
    {
        title: 'Application Review',
        static: true,
        items: [
            { to: '/admissions/review', label: 'Application Review', icon: 'bi-file-earmark-check' }
        ]
    },
    {
        title: 'Student Application',
        static: true,
        items: [
            { to: '/admissions/application', label: 'Student Application', icon: 'bi-window-plus' }
        ]
    },
    {
        title: 'Admissions Enrolled',
        static: true,
        items: [
            { to: '/admissions/confirmed', label: 'Admissions Enrolled', icon: 'bi-person-check' }
        ]
    }
]

export default function AdmissionsApplication() {
    const GENDERS = ['Male', 'Female', 'Other']
    const CASTES = ['General', 'OBC', 'SC', 'ST', 'Others']
    const RELIGIONS = ['Hindu', 'Muslim', 'Christian', 'Sikh', 'Buddhist', 'Jain', 'Others']
    const STATES = ['Tamil Nadu', 'Andhra Pradesh', 'Karnataka', 'Kerala', 'Telangana', 'Maharashtra', 'Other']

    const initialForm = {
        student_id: '',
        ht_no: '',
        academic_year: '',
        admission_year: '',
        group: '',
        group_code: '',
        course_id: '',
        full_name: '',
        gender: '',
        dob: '',
        father_name: '',
        mother_name: '',
        nationality: '',
        state: '',
        aadhar_no: '',
        postal_code: '',
        address: '',
        mobile: '',
        Parent_no: '',
        religion: '',
        caste: '',
        current_semester: '',
        is_hostel: '',
        is_transport: ''
    }

    const [form, setForm] = useState({
        ...initialForm,
        course_name: ''
    })
    const [photo, setPhoto] = useState(null)
    const [cert, setCert] = useState(null)
    const [loading, setLoading] = useState(false)
    const [msg, setMsg] = useState('')
    const [courses, setCourses] = useState([])
    const [groups, setGroups] = useState([])
    const [years, setYears] = useState([])
    const [category, setCategory] = useState('')
    const [filteredYears, setFilteredYears] = useState([])
    const [filteredGroups, setFilteredGroups] = useState([])
    const [filteredCourses, setFilteredCourses] = useState([])
    const [duplicateErrors, setDuplicateErrors] = useState({ student_id: false, ht_no: false })
    const [showConfirmModal, setShowConfirmModal] = useState(false)

    const currentYear = new Date().getFullYear()
    const admissionYearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 3 + i)

    const handle = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

    useEffect(() => {
        const bootstrap = async () => {
            try {
                const [cs, gs, ys] = await Promise.all([
                    api.listCourses(),
                    api.listGroups?.() || [],
                    api.listAcademicYears?.() || []
                ])
                setCourses(cs || [])
                setFilteredCourses(cs || [])
                setGroups(gs || [])
                setFilteredGroups(gs || [])
                const activeYears = (ys || []).filter(year => year?.active !== false)
                setYears(activeYears)
                setFilteredYears(activeYears)
            } catch (error) {
                console.error('Failed to load masters', error)
                setCourses([])
                setGroups([])
                setYears([])
                setFilteredYears([])
            }
        }
        bootstrap()
    }, [])

    useEffect(() => {
        if (category) {
            const filteredYrs = years.filter(year => {
                return (category === 'UG' && year.category === 'UG') ||
                    (category === 'PG' && year.category === 'PG')
            })

            const filteredGrps = groups.filter(group => {
                return (category === 'UG' && (group.category === 'UG' || group.Category === 'UG')) ||
                    (category === 'PG' && (group.category === 'PG' || group.Category === 'PG'))
            })

            const selectedGroup = filteredGrps.find(g => g.code === form.group_code || g.group_code === form.group_code)

            const filteredCrs = courses.filter(course => {
                if (!selectedGroup) return true

                const groupCode = selectedGroup.code || selectedGroup.group_code

                return (
                    course.group_code === groupCode ||
                    course.groupCode === groupCode ||
                    (course.group_name && (course.group_name === selectedGroup.name || course.group_name === selectedGroup.group_name)) ||
                    (course.groupName && (course.groupName === selectedGroup.name || course.groupName === selectedGroup.group_name))
                )
            })

            setFilteredYears(filteredYrs)
            setFilteredGroups(filteredGrps)
            setFilteredCourses(filteredCrs)

            if (form.academic_year && !filteredYrs.some(y => y.academic_year === form.academic_year || y.name === form.academic_year)) {
                handle('academic_year', '')
            }
            if (form.group_code && !filteredGrps.some(g => g.code === form.group_code || g.group_code === form.group_code)) {
                handle('group_code', '')
                handle('group', '')
                handle('course_id', '')
                handle('course_name', '')
            }
            if (form.course_id && !filteredCrs.some(c => String(c.id || c.course_id) === String(form.course_id))) {
                handle('course_id', '')
                handle('course_name', '')
            }
        } else {
            setFilteredYears(years)
            setFilteredGroups(groups)
            setFilteredCourses(courses)
        }
    }, [category, years, groups, courses, form.academic_year, form.group_code, form.course_id])

    useEffect(() => {
        const checkStudentId = async () => {
            if (!form.student_id) {
                setDuplicateErrors(prev => ({ ...prev, student_id: false }))
                return
            }
            try {
                const { data, error } = await supabase
                    .from('students')
                    .select('id')
                    .eq('student_id', form.student_id)

                if (error) throw error
                setDuplicateErrors(prev => ({ ...prev, student_id: data && data.length > 0 }))
            } catch (err) {
                console.error('Error checking student ID:', err)
            }
        }

        const timer = setTimeout(checkStudentId, 500)
        return () => clearTimeout(timer)
    }, [form.student_id])

    useEffect(() => {
        const checkHtNo = async () => {
            if (!form.ht_no) {
                setDuplicateErrors(prev => ({ ...prev, ht_no: false }))
                return
            }
            try {
                const { data, error } = await supabase
                    .from('students')
                    .select('id')
                    .eq('hall_ticket_no', form.ht_no)

                if (error) throw error
                setDuplicateErrors(prev => ({ ...prev, ht_no: data && data.length > 0 }))
            } catch (err) {
                console.error('Error checking Hall Ticket No:', err)
            }
        }

        const timer = setTimeout(checkHtNo, 500)
        return () => clearTimeout(timer)
    }, [form.ht_no])

    const resetAll = () => {
        setForm(initialForm)
        setCategory('')
        setFilteredGroups(groups)
        setFilteredCourses(courses)
        setFilteredYears(years)
        setPhoto(null)
        setCert(null)
        setMsg('')
    }

    const onNumericChange = (key, max) => (event) => {
        const sanitized = (event.target.value || '').replace(/\D/g, '').slice(0, max)
        handle(key, sanitized)
    }

    const isDigits = (value, len) => new RegExp(`^\\d{${len}}$`).test(value)
    const location = useLocation()

    // Pre-fill form if redirected from Application Review
    useEffect(() => {
        const autoFill = async () => {
            if (!location.state?.applicationData || groups.length === 0) return

            const app = location.state.applicationData

            // Auto-set Category based on available groups/years if possible, or default
            // For now, let's assume UG as default or derived from group
            // Ideally we should find the group in 'groups' to know its category
            const foundGroup = groups.find(g => String(g.id || g.group_id) === String(app.group_id))
            if (foundGroup) {
                setCategory(foundGroup.category || foundGroup.Category || 'UG') // Trigger category filter
            }

            const admYear = app.admission_year || app.academic_year?.split('-')[0] || new Date().getFullYear();

            const foundCourse = courses.find(c => String(c.id || c.course_id) === String(app.course_id));
            // Helper to ensure we get an alphabetic code (e.g. 'CS') instead of numeric ('01')
            const getAlphabeticCode = (code, name) => {
                if (code && isNaN(Number(code))) return code.toUpperCase(); // Already alphabetic like 'CS'

                // If code is numeric (e.g. '01'), try to derive from Name (e.g. 'Computer Science' -> 'CS')
                if (name) {
                    const nameParts = name.split(' ').filter(p => p.length > 0);
                    if (nameParts.length > 1) {
                        // e.g. "Computer Science" -> "CS"
                        return nameParts.map(p => p[0]).join('').toUpperCase().substring(0, 3);
                    } else if (nameParts.length === 1) {
                        // e.g. "Commerce" -> "COM"
                        return nameParts[0].substring(0, 3).toUpperCase();
                    }
                }
                return code; // Fallback to whatever we have
            };

            const rawGrpCode = foundGroup ? (foundGroup.code || foundGroup.group_code) : '';
            const rawCourseCode = foundCourse ? (foundCourse.courseCode || foundCourse.course_code || foundCourse.code) : '';

            // Determine the best prefix
            // 1. Try explicit alphanumeric group code from course (rare but possible mapping)
            // 2. Try group code/name logic (CS from Computer Science)
            // 3. Fallback to course code

            let idCode = foundCourse?.group_code || foundCourse?.groupCode;

            if (!idCode || !isNaN(Number(idCode))) {
                // If we don't have a specific text code yet, try deriving from Group
                idCode = getAlphabeticCode(rawGrpCode, foundGroup?.name || foundGroup?.group_name);
            }

            // If still nothing or numeric, try course
            if (!idCode || !isNaN(Number(idCode))) {
                idCode = getAlphabeticCode(rawCourseCode, foundCourse?.name || foundCourse?.course_name);
            }

            console.log('DEBUG ID GEN:', { foundCourse, rawGrpCode, rawCourseCode, idCode });

            let nextStudentId = '';
            let nextHtNo = '';

            // Auto-generate IDs if we have necessary info
            if (admYear && idCode) {
                try {
                    const yearShort = String(admYear).substring(2, 4);
                    const prefix = `${yearShort}${idCode}`;

                    // Fetch last Student ID for this series
                    const { data: lastStu } = await supabase
                        .from('students')
                        .select('student_id')
                        .ilike('student_id', `${prefix}%`)
                        .order('student_id', { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    if (lastStu && lastStu.student_id) {
                        const suffix = lastStu.student_id.replace(prefix, '');
                        const num = parseInt(suffix, 10);
                        if (!isNaN(num)) {
                            nextStudentId = `${prefix}${String(num + 1).padStart(3, '0')}`;
                        } else {
                            nextStudentId = `${prefix}001`; // Fallback
                        }
                    } else {
                        nextStudentId = `${prefix}001`; // Start of series
                    }

                    // Fetch last Hall Ticket No (Global Running Number)
                    // We order by id desc to get the most recently inserted one
                    const { data: lastHt } = await supabase
                        .from('students')
                        .select('hall_ticket_no')
                        .not('hall_ticket_no', 'is', null)
                        .order('id', { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    if (lastHt && lastHt.hall_ticket_no) {
                        // Handle potential non-numeric chars if any, though user implies numeric
                        const htStr = String(lastHt.hall_ticket_no).replace(/\D/g, '');
                        if (htStr) {
                            const htNum = BigInt(htStr);
                            nextHtNo = String(htNum + 1n);
                        }
                    }

                } catch (err) {
                    console.error("Error auto-generating IDs", err);
                }
            }

            setForm(prev => ({
                ...prev,
                academic_year: String(app.admission_year || app.academic_year || ''),
                admission_year: app.admission_year,
                group: foundGroup ? (foundGroup.name || foundGroup.group_name) : '',
                group_code: rawGrpCode,
                course_id: app.course_id,
                // We will need to set course_name in the effect that watches course_id changes
                full_name: app.full_name,
                gender: app.gender,
                dob: app.date_of_birth,
                father_name: app.father_name,
                mother_name: app.mother_name,
                nationality: app.nationality,
                state: app.state,
                aadhar_no: app.aadhar_number,
                postal_code: app.pincode,
                address: app.address,
                mobile: app.phone_number,
                Parent_no: app.parent_no,
                religion: app.religion,
                caste: app.caste,
                // Default placeholders if missing
                current_semester: 1,
                // Accommodation Details from Application
                is_hostel: app.is_hostel === true || app.is_hostel === 'true',
                is_transport: (app.is_hostel === true || app.is_hostel === 'true') ? false : (app.is_transport === true || app.is_transport === 'true'),
                // Set Generated IDs
                student_id: nextStudentId,
                ht_no: nextHtNo
            }))

            // If photo exists, we can't easily set the File object, but we can perhaps set a preview url or handle it separately.
            // For now, simpler to leave photo manual or handle URL in payload if supported. 
            // AdminApplications expects File object in 'photo' state for upload. 
            // If we want to use existing URL, we might need to adjust payload construction.
        }

        autoFill()
    }, [location.state, groups, courses]) // Depend on groups to ensure they are loaded

    const submit = async (event) => {
        event.preventDefault()
        setMsg('')
        const requiredFields = {
            Category: category,
            'Academic Year': form.academic_year,
            'Group': form.group,
            'Course': form.course_id,
            'Full Name': form.full_name,
            'Gender': form.gender,
            'Date of Birth': form.dob,
            'Mobile Number': form.mobile,
            'Parent Mobile': form.Parent_no,
            'Postal Code': form.postal_code,
            'Address': form.address,
            'Semester': form.current_semester
        }

        if (form.is_hostel === '') {
            showToast('Please select Student Type (Hostel/Dayscholar).', { type: 'warning' })
            return
        }
        if (form.is_hostel === false && form.is_transport === '') {
            showToast('Please select College Transport option.', { type: 'warning' })
            return
        }

        if (!validateRequiredFields(requiredFields, { title: 'Incomplete application' })) return
        if (!isDigits(form.mobile, 10)) {
            showToast('Enter a valid 10-digit mobile number.', { type: 'warning', title: 'Invalid mobile' })
            return
        }
        if (!isDigits(form.postal_code, 6)) {
            showToast('Postal code must be 6 digits.', { type: 'warning', title: 'Invalid postal code' })
            return
        }
        if (form.aadhar_no && !isDigits(form.aadhar_no, 12)) {
            showToast('Aadhar number must contain 12 digits.', { type: 'warning', title: 'Invalid Aadhar' })
            return
        }

        if (form.aadhar_no && !isDigits(form.aadhar_no, 12)) {
            showToast('Aadhar number must contain 12 digits.', { type: 'warning', title: 'Invalid Aadhar' })
            return
        }

        setShowConfirmModal(true)
    }

    const confirmSubmit = async () => {
        setShowConfirmModal(false)
        setLoading(true)
        try {
            const selectedCourse = courses.find((course) => String(course.id || course.course_id) === String(form.course_id))
            if (!selectedCourse) throw new Error('Select a valid course')

            const courseCode = selectedCourse.courseCode || selectedCourse.code
            if (!courseCode) throw new Error('Selected course is missing a course code reference')
            const courseLabel = form.course_name || selectedCourse.courseName || selectedCourse.course_name || ''

            // Use existing photo URL if no new photo file is selected
            const existingPhotoUrl = location.state?.applicationData?.photo_url
            const finalPhotoUrl = photo ? URL.createObjectURL(photo) : existingPhotoUrl

            const payload = {
                student_id: form.student_id || `STU${Date.now().toString().slice(-6)}`,
                hall_ticket_no: form.ht_no || null,
                academic_year: form.academic_year,
                admission_year: form.admission_year || null,
                group_name: form.group_code || form.group,
                course_name: courseCode,
                current_semester: form.current_semester,
                Category: category || null,
                full_name: form.full_name,
                gender: form.gender,
                date_of_birth: form.dob,
                father_name: form.father_name || null,
                mother_name: form.mother_name || null,
                nationality: form.nationality || null,
                state: form.state || null,
                aadhar_number: form.aadhar_no || null,
                pincode: form.postal_code,
                address: form.address,
                phone_number: form.mobile,
                Parent_no: form.Parent_no,
                religion: form.religion || null,
                caste: form.caste || null,
                photo_url: finalPhotoUrl || null,
                cert_url: cert ? URL.createObjectURL(cert) : null,
                status: 'ACTIVE',
                is_hostel: form.is_hostel,
                is_transport: form.is_hostel ? false : form.is_transport,
                created_at: new Date().toISOString()
            }

            const { data: newStudent, error } = await supabase.from('students').insert([payload]).select().single()
            if (error) throw error

            // If we came from Application Review, link the admission and approve it
            if (location.state?.applicationData?.id) {
                const { data: { user } } = await supabase.auth.getUser()

                // 1. Link Student and Approve Admission
                const { error: linkError } = await supabase
                    .from('admissions')
                    .update({
                        student_id: newStudent.id,
                        admission_status: 'APPROVED',
                        confirmed_at: new Date().toISOString(),
                        confirmed_by: user?.id
                    })
                    .eq('application_id', location.state.applicationData.id)

                if (linkError) {
                    console.error('Failed to link/approve admission', linkError)
                    showToast('Student created, but failed to approve admission.', { type: 'warning' })
                } else {
                    // 2. Mark Application as Confirmed
                    const { error: appError } = await supabase
                        .from('applications')
                        .update({ status: 'CONFIRMED', application_status: 'CONFIRMED' })
                        .eq('id', location.state.applicationData.id)

                    if (appError) {
                        console.error('Failed to confirm application status', appError)
                    }
                }
            }

            showToast('Application submitted successfully!', { type: 'success', title: 'Success' })
            setMsg('Application saved successfully.')
            resetAll()
            // Use history replace to clear state so refresh doesn't re-fill
            window.history.replaceState({}, document.title)

        } catch (error) {
            console.error('Unable to submit application', error)
            setMsg(error.message || 'Unable to submit application right now.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <AdmissionShell navGroups={navGroups} brandTitle="Admissions Portal" brandSubtitle="" className="admin-shell--admissions">
            <div className="admissions-page">
                <div className="desktop-container" style={{ overflowX: 'hidden' }}>
                    <section className="setup-hero mb-4">
                        <div className="setup-hero__inner">
                            <div className="setup-hero__content">
                                <div className="setup-hero__crest" aria-hidden="true">
                                    <img src={crestPrimary} alt="Vijayam crest" />
                                </div>
                                <div>
                                    <div className="setup-hero__eyebrow">Admissions 2026</div>
                                    <h1 className="setup-hero__title mb-1">Vijayam College of Arts & Science</h1>
                                    <p className="setup-hero__subtitle mb-0">
                                        Collect, verify, and onboard applicants with confidence.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <div className="row g-4 justify-content-center mx-0">
                        <div className="col-12 col-lg-11 col-xl-10">
                            <div className="card card-soft p-4 mb-4">
                                <div className="d-flex justify-content-between align-items-center mb-3">
                                    <div>
                                        <h4 className="mb-1">Student Application</h4>
                                        <p className="text-muted mb-0">Programme selection, personal profile, and uploads.</p>
                                    </div>
                                    <button type="button" className="btn btn-outline-secondary" onClick={resetAll}>Reset Form</button>
                                </div>

                                <form onSubmit={submit}>
                                    <div className="application-section mb-4">
                                        <h6 className="text-uppercase text-muted fw-bold small">Programme Selection</h6>
                                        <div className="row g-3 mt-1">
                                            <div className="col-md-2">
                                                <label className="form-label">Category</label>
                                                <select
                                                    className="form-select"
                                                    value={category}
                                                    onChange={(e) => setCategory(e.target.value)}
                                                    required
                                                >
                                                    <option value="">Select</option>
                                                    <option value="UG">UG</option>
                                                    <option value="PG">PG</option>
                                                </select>
                                            </div>
                                            <div className="col-md-2">
                                                <label className="form-label">Academic Year</label>
                                                <select
                                                    className="form-select"
                                                    value={form.academic_year}
                                                    onChange={(e) => handle('academic_year', e.target.value)}
                                                    required
                                                    disabled={!category}
                                                >
                                                    <option value="">Select Year</option>
                                                    {filteredYears.map((year) => (
                                                        <option key={year.id} value={year.academic_year || year.name}>
                                                            {year.academic_year || year.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="col-md-2">
                                                <label className="form-label">Admission Year</label>
                                                <select
                                                    className="form-select"
                                                    value={form.admission_year}
                                                    onChange={(e) => handle('admission_year', e.target.value)}
                                                    required
                                                >
                                                    <option value="">Select Year</option>
                                                    {admissionYearOptions.map((year) => (
                                                        <option key={year} value={year}>
                                                            {year}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="col-md-2">
                                                <label className="form-label">Group</label>
                                                <select
                                                    className="form-select"
                                                    value={form.group_code || form.group}
                                                    onChange={(e) => {
                                                        const value = e.target.value
                                                        const selected = filteredGroups.find(group => group.code === value || group.group_code === value)
                                                        handle('group', selected?.name || selected?.group_name || selected?.code || value)
                                                        setForm(prev => ({ ...prev, group_code: value }))
                                                    }}
                                                    required
                                                    disabled={!category}
                                                >
                                                    <option value="">Select</option>
                                                    {filteredGroups.map((group) => (
                                                        <option key={group.id || group.group_id} value={group.code || group.group_code}>
                                                            {group.name || group.group_name || 'Group'}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="col-md-2">
                                                <label className="form-label">Course</label>
                                                <select
                                                    className="form-select"
                                                    value={form.course_id}
                                                    onChange={(e) => {
                                                        const selected = filteredCourses.find(course => String(course.id || course.course_id) === String(e.target.value))
                                                        setForm(prev => ({
                                                            ...prev,
                                                            course_id: e.target.value,
                                                            course_name: selected?.courseName || selected?.course_name || selected?.name || ''
                                                        }))
                                                    }}
                                                    required
                                                    disabled={!form.group_code}
                                                >
                                                    <option value="">Select</option>
                                                    {filteredCourses.map((course) => (
                                                        <option key={course.id || course.course_id} value={course.id || course.course_id}>
                                                            {course.name || course.courseName || course.course_name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="col-md-2">
                                                <label className="form-label">Semester</label>
                                                <input
                                                    type="number"
                                                    className="form-control"
                                                    value={form.current_semester}
                                                    onChange={(e) => handle('current_semester', e.target.value)}
                                                    placeholder="Sem No"
                                                    min="1"
                                                    max="8"
                                                    required
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="application-section mb-4">
                                        <h6 className="text-uppercase text-muted fw-bold small">Identity & Guardians</h6>
                                        <div className="row g-3 mt-1">
                                            <div className="col-md-6">
                                                <label className="form-label">Student ID</label>
                                                <input
                                                    className={`form-control ${duplicateErrors.student_id ? 'is-invalid' : ''}`}
                                                    value={form.student_id}
                                                    onChange={(e) => handle('student_id', e.target.value)}
                                                    placeholder="Enter Student ID"
                                                />
                                                {duplicateErrors.student_id && <div className="invalid-feedback">Already Exists</div>}
                                            </div>
                                            <div className="col-md-6">
                                                <label className="form-label">Hall Ticket No</label>
                                                <input
                                                    className={`form-control ${duplicateErrors.ht_no ? 'is-invalid' : ''}`}
                                                    value={form.ht_no}
                                                    onChange={(e) => handle('ht_no', e.target.value)}
                                                    placeholder="Enter Hall Ticket No"
                                                />
                                                {duplicateErrors.ht_no && <div className="invalid-feedback">Already Exists</div>}
                                            </div>
                                            <div className="col-md-8">
                                                <label className="form-label">Student Full Name</label>
                                                <input className="form-control" value={form.full_name} onChange={(e) => handle('full_name', e.target.value)} required />
                                            </div>
                                            <div className="col-md-2">
                                                <label className="form-label">Gender</label>
                                                <select className="form-select" value={form.gender} onChange={(e) => handle('gender', e.target.value)} required>
                                                    <option value="">Select</option>
                                                    {GENDERS.map((gender) => (
                                                        <option key={gender} value={gender}>{gender}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="col-md-2">
                                                <label className="form-label">DOB</label>
                                                <input type="date" className="form-control" value={form.dob} onChange={(e) => handle('dob', e.target.value)} required />
                                            </div>
                                            <div className="col-md-6">
                                                <label className="form-label">Father's Name</label>
                                                <input className="form-control" value={form.father_name} onChange={(e) => handle('father_name', e.target.value)} />
                                            </div>
                                            <div className="col-md-6">
                                                <label className="form-label">Mother's Name</label>
                                                <input className="form-control" value={form.mother_name} onChange={(e) => handle('mother_name', e.target.value)} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="application-section mb-4">
                                        <h6 className="text-uppercase text-muted fw-bold small">Contact & Address</h6>
                                        <div className="row g-3 mt-1">
                                            <div className="col-md-4">
                                                <label className="form-label">Mobile Number</label>
                                                <input type="tel" className="form-control" value={form.mobile} onChange={onNumericChange('mobile', 10)} required maxLength={10} placeholder="10-digit mobile number" />
                                            </div>
                                            <div className="col-md-4">
                                                <label className="form-label">Parent Mobile</label>
                                                <input type="tel" className="form-control" value={form.Parent_no} onChange={onNumericChange('Parent_no', 10)} required maxLength={10} placeholder="Parent's 10-digit mobile" />
                                            </div>

                                            <div className="col-md-4">
                                                <label className="form-label">Nationality</label>
                                                <input className="form-control" value={form.nationality} onChange={(e) => handle('nationality', e.target.value)} placeholder="Indian" />
                                            </div>
                                            <div className="col-md-4">
                                                <label className="form-label">State</label>
                                                <select className="form-select" value={form.state} onChange={(e) => handle('state', e.target.value)}>
                                                    <option value="">Select</option>
                                                    {STATES.map((st) => (
                                                        <option key={st} value={st}>{st}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="col-md-4">
                                                <label className="form-label">Postal Code</label>
                                                <input type="text" className="form-control" value={form.postal_code} onChange={onNumericChange('postal_code', 6)} required maxLength={6} placeholder="6-digit pin" />
                                            </div>
                                            <div className="col-md-4">
                                                <label className="form-label">Aadhaar</label>
                                                <input type="text" className="form-control" value={form.aadhar_no} onChange={onNumericChange('aadhar_no', 12)} maxLength={12} placeholder="12-digit number" />
                                            </div>
                                            <div className="col-12">
                                                <label className="form-label">Address</label>
                                                <textarea className="form-control" rows="2" value={form.address} onChange={(e) => handle('address', e.target.value)} required></textarea>
                                            </div>

                                            <div className="col-md-4">
                                                <label className="form-label">Religion</label>
                                                <select className="form-select" value={form.religion} onChange={(e) => handle('religion', e.target.value)}>
                                                    <option value="">Select</option>
                                                    {RELIGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                                                </select>
                                            </div>
                                            <div className="col-md-4">
                                                <label className="form-label">Caste</label>
                                                <select className="form-select" value={form.caste} onChange={(e) => handle('caste', e.target.value)}>
                                                    <option value="">Select</option>
                                                    {CASTES.map((c) => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="application-section mb-4">
                                        <h6 className="text-uppercase text-muted fw-bold small">Accomodation</h6>
                                        <div className="row g-3 mt-1">
                                            <div className="col-md-3">
                                                <label className="form-label d-block">Student Type *</label>
                                                <div className="form-check form-check-inline">
                                                    <input className="form-check-input" type="radio" name="is_hostel" id="hostelYes"
                                                        checked={form.is_hostel === true}
                                                        onChange={() => handle('is_hostel', true)}
                                                    />
                                                    <label className="form-check-label" htmlFor="hostelYes">Hostel</label>
                                                </div>
                                                <div className="form-check form-check-inline">
                                                    <input className="form-check-input" type="radio" name="is_hostel" id="hostelNo"
                                                        checked={form.is_hostel === false}
                                                        onChange={() => handle('is_hostel', false)}
                                                    />
                                                    <label className="form-check-label" htmlFor="hostelNo">Day Scholar</label>
                                                </div>
                                            </div>
                                            <div className="col-md-4">
                                                <label className="form-label d-block text-muted">College Transport (if Day Scholar)</label>
                                                <div className="form-check form-check-inline">
                                                    <input className="form-check-input" type="radio" name="is_transport" id="transportYes"
                                                        checked={form.is_transport === true}
                                                        onChange={() => handle('is_transport', true)}
                                                        disabled={form.is_hostel === true}
                                                    />
                                                    <label className="form-check-label" htmlFor="transportYes">Yes</label>
                                                </div>
                                                <div className="form-check form-check-inline">
                                                    <input className="form-check-input" type="radio" name="is_transport" id="transportNo"
                                                        checked={form.is_transport === false}
                                                        onChange={() => handle('is_transport', false)}
                                                        disabled={form.is_hostel === true}
                                                    />
                                                    <label className="form-check-label" htmlFor="transportNo">No</label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="d-flex justify-content-end gap-2">
                                        <button type="button" className="btn btn-light" onClick={resetAll}>Cancel</button>
                                        <button type="submit" className="btn btn-primary" disabled={loading}>
                                            {loading ? 'Submitting...' : 'Submit Application'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
                <ConfirmationModal
                    isOpen={showConfirmModal}
                    onClose={() => setShowConfirmModal(false)}
                    onConfirm={confirmSubmit}
                    title="Confirm Application"
                    message={`Are you sure you want to submit the application for ${form.full_name}?`}
                    confirmText="Submit Application"
                    confirmButtonClass="btn-primary"
                    isLoading={loading}
                />
            </div>
        </AdmissionShell>
    )
}
