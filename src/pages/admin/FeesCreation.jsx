import AdminShell from '../../components/AdminShell'
import crestPrimary from '../../assets/media/images.png'
import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../../../supabaseClient'
import { toast } from 'react-toastify'


const adminNavGroups = [
    {
        title: 'Student Portal',
        items: [
            {
                to: '/admin-portal/academic-years',
                label: 'Academic Years',
                icon: 'bi-calendar3'
            },
            {
                to: '/admin-portal/groups-courses',
                label: 'Groups & Courses',
                icon: 'bi-diagram-3'
            },
            {
                to: '/admin-portal/subjects',
                label: 'Subjects',
                icon: 'bi-journal-text'
            }
        ]
    },
    {
        title: 'Fees Creation',
        static: true,
        items: [
            {
                to: '/admin-portal/fees-creation',
                label: 'Student Fees Creation',
                icon: 'bi-currency-rupee'
            }
        ]
    },
    {
        title: 'Profile Creation',
        static: true,
        items: [
            {
                to: '/admin-portal/profile-creation',
                label: 'Staff Profile Creation',
                icon: 'bi-person-plus-fill'
            }
        ]
    },
    {
        title: 'Department',
        static: true,
        items: [
            {
                to: '/admin-portal/department',
                label: 'Department',
                icon: 'bi-diagram-3'
            }
        ]
    },
    {
        title: 'Class Time Table',
        static: true,
        items: [
            {
                to: '/admin-portal/class-time-table',
                label: 'Class Time Table',
                icon: 'bi-calendar-date'
            }
        ]
    }
]

export default function FeesCreation() {
    const [isLoading, setIsLoading] = useState(true)
    const [years, setYears] = useState([])
    const [groups, setGroups] = useState([])
    const [courses, setCourses] = useState([])

    const [selectedYear, setSelectedYear] = useState('')
    const [selectedGroup, setSelectedGroup] = useState('')
    const [selectedCourse, setSelectedCourse] = useState('')

    const [feeRows, setFeeRows] = useState([])

    // Fee Categories State
    const [feeCategories, setFeeCategories] = useState([])
    const [newFeeCategory, setNewFeeCategory] = useState('')
    const [editingCategory, setEditingCategory] = useState(null)
    const [editValue, setEditValue] = useState('')

    const handleAddCategory = async (e) => {
        e.preventDefault()
        const categoryName = newFeeCategory.trim()
        if (!categoryName) return

        try {
            const { data, error } = await supabase
                .from('academic_fee_categories')
                .insert([{ name: categoryName }])
                .select()
                .single()

            if (error) {
                if (error.code === '23505') { // Unique violation
                    toast.warning('Category already exists')
                } else {
                    throw error
                }
                return
            }

            setFeeCategories([...feeCategories, data])
            setNewFeeCategory('')
            toast.success('Category added')
        } catch (error) {
            console.error('Error adding category:', error)
            toast.error('Failed to add category')
        }
    }


    const handleRemoveCategory = async (id) => {
        if (!window.confirm('Are you sure you want to delete this category?')) return

        try {
            const { error } = await supabase
                .from('academic_fee_categories')
                .delete()
                .eq('id', id)

            if (error) throw error

            setFeeCategories(feeCategories.filter(c => c.id !== id))
            toast.success('Category removed')
        } catch (error) {
            console.error('Error removing category:', error)
            toast.error('Failed to remove category')
        }
    }

    const handleEditClick = (category) => {
        setEditingCategory(category.id)
        setEditValue(category.name)
    }

    const handleUpdateCategory = async () => {
        if (!editValue.trim()) return

        try {
            const { error } = await supabase
                .from('academic_fee_categories')
                .update({ name: editValue.trim() })
                .eq('id', editingCategory)

            if (error) throw error

            setFeeCategories(feeCategories.map(cat =>
                cat.id === editingCategory ? { ...cat, name: editValue.trim() } : cat
            ))
            setEditingCategory(null)
            setEditValue('')
            toast.success('Category updated')
        } catch (error) {
            console.error('Error updating category:', error)
            toast.error('Failed to update category')
        }
    }

    const handleCancelEdit = () => {
        setEditingCategory(null)
        setEditValue('')
    }

    useEffect(() => {
        fetchMasterData()
    }, [])

    const fetchMasterData = async () => {
        try {
            setIsLoading(true)

            // Fetch Fee Categories
            const { data: categoriesData, error: categoriesError } = await supabase
                .from('academic_fee_categories')
                .select('*')
                .eq('is_active', true)
                .order('name')
            if (categoriesError) throw categoriesError
            setFeeCategories(categoriesData || [])

            // Fetch Academic Years
            const { data: yearsData, error: yearsError } = await supabase
                .from('academic_year')
                .select('*')
                .order('academic_year', { ascending: false })
            if (yearsError) throw yearsError
            setYears(yearsData || [])

            // Fetch Groups
            const { data: groupsData, error: groupsError } = await supabase
                .from('groups')
                .select('group_id, group_name, group_code')
                .order('group_name')
            if (groupsError) throw groupsError
            setGroups(groupsData || [])

            // Fetch Courses
            const { data: coursesData, error: coursesError } = await supabase
                .from('courses')
                .select('*')
                .order('course_name')
            if (coursesError) throw coursesError
            setCourses(coursesData || [])

        } catch (error) {
            console.error('Error fetching data:', error)
            toast.error('Failed to load master data')
        } finally {
            setIsLoading(false)
        }
    }

    // Filter courses based on selected group
    const availableCourses = useMemo(() => {
        if (!selectedGroup) return []
        const groupObj = groups.find(g => g.group_id.toString() === selectedGroup)
        if (!groupObj) return []

        // Filter courses where group_name matches
        return courses.filter(c => c.group_name === groupObj.group_name)
    }, [selectedGroup, groups, courses])

    // Handle Group Change
    const handleGroupChange = (e) => {
        setSelectedGroup(e.target.value)
        setSelectedCourse('')
        setFeeRows([])
    }

    // Handle Course Change
    const handleCourseChange = (e) => {
        const courseId = e.target.value
        setSelectedCourse(courseId)
        // Reset fees when course changes
        setFeeRows([])
    }

    const handleReset = () => {
        setSelectedYear('')
        setSelectedGroup('')
        setSelectedCourse('')
        setFeeRows([])
    }

    const handleAddRow = () => {
        setFeeRows([
            ...feeRows,
            { id: crypto.randomUUID(), categoryId: '', amount: '' }
        ])
    }

    const handleRemoveRow = (rowId) => {
        setFeeRows(feeRows.filter(row => row.id !== rowId))
    }

    const handleRowChange = (rowId, field, value) => {
        setFeeRows(feeRows.map(row =>
            row.id === rowId ? { ...row, [field]: value } : row
        ))
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        // Validation
        if (!selectedYear || !selectedGroup || !selectedCourse) {
            toast.error('Please fill all required fields')
            return
        }

        // Logic to save fees structure would go here
        // Transform rows to expected backend format
        const feesBreakdown = feeRows.reduce((acc, row) => {
            if (row.categoryId && row.amount) {
                acc[row.categoryId] = row.amount
            }
            return acc
        }, {})

        if (Object.keys(feesBreakdown).length === 0) {
            toast.error('Please add at least one fee category with an amount')
            return
        }

        console.log('Submitting Fees Structure:', {
            academic_year_id: selectedYear,
            group_id: selectedGroup,
            course_id: selectedCourse,
            fees_breakdown: feesBreakdown
        })
        toast.success('Fees structure saved successfully (Console Log)')
    }

    return (
        <AdminShell
            navGroups={adminNavGroups}
            brandTitle="Admin Management Console"
            brandSubtitle="Chittoor"
            footerTitle="Admin Management Studio"
            footerSubtitle="Crafted for Vijayam College"
        >
            <div className="desktop-container" style={{ overflowX: 'hidden' }}>
                <section className="setup-hero mb-4 text-center">
                    <div className="setup-hero-copywrap mx-auto text-center" style={{ maxWidth: '640px' }}>
                        <div className="admin-applications__crest mx-auto" aria-hidden="true">
                            <img src={crestPrimary} alt="Vijayam crest" />
                        </div>
                        <h3 className="setup-hero-title mb-2">Vijayam Arts & Science College</h3>
                        <p className="setup-hero-copy mb-3">Collect, verify, and onboard applicants with confidence.</p>
                        <div className="setup-hero-chips d-flex flex-wrap gap-2 justify-content-center">
                            <span className="setup-hero-chip text-uppercase">SMART EXAMINATION PLATFORM</span>
                            <span className="setup-hero-chip text-uppercase">ADMISSIONS CONTROL</span>
                            <span className="setup-hero-chip text-uppercase">APPLICATIONS ADMIN CONSOLE</span>
                        </div>
                    </div>
                </section>

                <div className="row g-4 justify-content-center mx-0">
                    {/* Fee Categories Section */}
                    <div className="col-12">
                        <div className="card card-soft p-4">
                            <h4 className="mb-1">Fee Categories</h4>
                            <p className="text-muted mb-3">Manage the categories that can be any fee structure.</p>

                            <div className="row align-items-end g-3">
                                <div className="col-md-6">
                                    <label className="form-label">Add a fee category</label>
                                    <div className="d-flex gap-3">
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="e.g., Tuition"
                                            value={newFeeCategory}
                                            onChange={(e) => setNewFeeCategory(e.target.value)}
                                        />
                                        <button className="btn btn-primary px-4 text-nowrap" onClick={handleAddCategory}>Add Category</button>
                                    </div>
                                </div>
                                <div className="col-12">
                                    <div className="row g-3 mt-3">
                                        {feeCategories.map((cat) => (
                                            <div key={cat.id} className="col-md-6">
                                                <div className="d-flex justify-content-between align-items-center p-3 border rounded bg-white shadow-sm h-100">
                                                    {editingCategory === cat.id ? (
                                                        <div className="d-flex gap-2 w-100 align-items-center">
                                                            <input
                                                                type="text"
                                                                className="form-control"
                                                                value={editValue}
                                                                onChange={(e) => setEditValue(e.target.value)}
                                                                autoFocus
                                                            />
                                                            <button className="btn btn-sm btn-success text-nowrap" onClick={handleUpdateCategory}>Save</button>
                                                            <button className="btn btn-sm btn-secondary text-nowrap" onClick={handleCancelEdit}>Cancel</button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div className="fw-bold fs-6">{cat.name}</div>
                                                            <div className="d-flex gap-2">
                                                                <button
                                                                    className="btn btn-sm btn-light text-primary fw-bold px-3 border"
                                                                    onClick={() => handleEditClick(cat)}
                                                                    style={{ backgroundColor: '#eff6ff', borderColor: '#bfdbfe', color: '#1d4ed8' }}
                                                                >
                                                                    Edit
                                                                </button>
                                                                <button
                                                                    className="btn btn-sm btn-light text-danger fw-bold px-3 border"
                                                                    onClick={() => handleRemoveCategory(cat.id)}
                                                                    style={{ backgroundColor: '#fef2f2', borderColor: '#fecaca', color: '#dc2626' }}
                                                                >
                                                                    Delete
                                                                </button>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>


                    <div className="col-12">
                        {/* Fee Structure Creation Card */}
                        <div className="card card-soft p-4">
                            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                                <div>
                                    <h4 className="mb-1">Student Fees creation</h4>
                                    <p className="text-muted mb-0">Manage and create fee structures.</p>
                                </div>
                                <button type="button" className="btn btn-outline-secondary" onClick={handleReset}>Reset</button>
                            </div>

                            {isLoading ? (
                                <div className="text-center p-5">
                                    <div className="spinner-border text-primary" role="status">
                                        <span className="visually-hidden">Loading...</span>
                                    </div>
                                </div>
                            ) : (
                                <form className="row g-3" onSubmit={handleSubmit}>
                                    {/* Academic Year */}
                                    <div className="col-md-4">
                                        <label className="form-label">Academic Year <span className="text-danger">*</span></label>
                                        <select
                                            className="form-select"
                                            value={selectedYear}
                                            onChange={(e) => setSelectedYear(e.target.value)}
                                            required
                                        >
                                            <option value="" disabled>Select Year</option>
                                            {years.map(year => (
                                                <option key={year.id} value={year.id}>{year.academic_year}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Group */}
                                    <div className="col-md-4">
                                        <label className="form-label">Group <span className="text-secondary small">({groups.length} found)</span> <span className="text-danger">*</span></label>
                                        <select
                                            className="form-select"
                                            value={selectedGroup}
                                            onChange={handleGroupChange}
                                            required
                                        >
                                            <option value="" disabled>Select Group</option>
                                            {groups.map(group => (
                                                <option key={group.group_id} value={group.group_id}>{group.group_name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Course */}
                                    <div className="col-md-4">
                                        <label className="form-label">Course <span className="text-danger">*</span></label>
                                        <select
                                            className="form-select"
                                            value={selectedCourse}
                                            onChange={handleCourseChange}
                                            disabled={!selectedGroup}
                                            required
                                        >
                                            <option value="" disabled>Select Course</option>
                                            {availableCourses.map(course => (
                                                <option key={course.course_id} value={course.course_id}>{course.course_name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Fee Categories & Inputs */}
                                    {selectedCourse && (
                                        <div className="col-12 mt-4">
                                            <h5 className="mb-3">Start Creating Fee Structure</h5>

                                            {/* Headers */}
                                            {feeRows.length > 0 && (
                                                <div className="row g-3 mb-2 px-1">
                                                    <div className="col-md-6">
                                                        <label className="form-label text-muted small text-uppercase fw-bold">Fee Category *</label>
                                                    </div>
                                                    <div className="col-md-6">
                                                        <label className="form-label text-muted small text-uppercase fw-bold">Amount *</label>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Dynamic Rows */}
                                            <div className="d-flex flex-column gap-3">
                                                {feeRows.map((row) => (
                                                    <div key={row.id} className="row g-3 align-items-center">
                                                        <div className="col-md-6">
                                                            <select
                                                                className="form-select"
                                                                value={row.categoryId}
                                                                onChange={(e) => handleRowChange(row.id, 'categoryId', e.target.value)}
                                                                required
                                                            >
                                                                <option value="" disabled>Select category</option>
                                                                {feeCategories.map(cat => (
                                                                    <option
                                                                        key={cat.id}
                                                                        value={cat.id}
                                                                        disabled={feeRows.some(r => r.categoryId === cat.id.toString() && r.id !== row.id)}
                                                                    >
                                                                        {cat.name}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div className="col-md-6">
                                                            <div className="d-flex gap-2 align-items-center">
                                                                <div className="input-group">
                                                                    <span className="input-group-text">â‚¹</span>
                                                                    <input
                                                                        type="number"
                                                                        className="form-control"
                                                                        placeholder="Enter amount"
                                                                        value={row.amount}
                                                                        onChange={(e) => handleRowChange(row.id, 'amount', e.target.value)}
                                                                        min="0"
                                                                        required
                                                                    />
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-outline-danger btn-sm rounded-pill px-3"
                                                                    onClick={() => handleRemoveRow(row.id)}
                                                                >
                                                                    Remove
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Add Button */}
                                            <div className="mt-3">
                                                <button
                                                    type="button"
                                                    className="btn btn-outline-primary rounded-pill px-4"
                                                    onClick={handleAddRow}
                                                >
                                                    <i className="bi bi-plus-lg me-2"></i>
                                                    Add fee category
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="col-12 d-flex justify-content-end gap-2 mt-4">
                                        <button type="submit" className="btn btn-primary">Save Fee Structure</button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AdminShell>
    )
}

