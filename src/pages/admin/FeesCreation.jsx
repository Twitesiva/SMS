import AdShellAdmin from '../../components/AdShellAdmin'

import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/mockApi'
import { supabase } from '../../../supabaseClient'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import '../exam/Dashboard.css'
import './Setup.css'
import './AdminContent.css'

export default function FeesCreation() {
    const [isLoading, setIsLoading] = useState(true)
    const [years, setYears] = useState([])
    const [groups, setGroups] = useState([])
    const [courses, setCourses] = useState([])

    const [selectedCategory, setSelectedCategory] = useState('')
    const [selectedYear, setSelectedYear] = useState('')
    const [selectedGroup, setSelectedGroup] = useState('')
    const [selectedCourse, setSelectedCourse] = useState('')
    const [yearOfStudy, setYearOfStudy] = useState('')

    const [feeRows, setFeeRows] = useState([])

    // Fee Categories State
    const [feeCategories, setFeeCategories] = useState([])
    const [newFeeCategory, setNewFeeCategory] = useState('')
    const [editingCategory, setEditingCategory] = useState(null)
    const [editValue, setEditValue] = useState('')

    // Saved Fee Structures State
    const [savedFeeStructures, setSavedFeeStructures] = useState([])
    const [editingFeeId, setEditingFeeId] = useState(null)
    const [showAllFeesModal, setShowAllFeesModal] = useState(false)

    // Hostel Fees State
    const [hostelFeesList, setHostelFeesList] = useState([])
    const [hostelYear, setHostelYear] = useState('')
    const [hostelYearOfStudy, setHostelYearOfStudy] = useState('')
    const [hostelAmount, setHostelAmount] = useState('')
    const [editingHostelId, setEditingHostelId] = useState(null)
    const [showAllHostelFeesModal, setShowAllHostelFeesModal] = useState(false)

    // Duplicate Check State

    // Duplicate Check State
    const [duplicateWarning, setDuplicateWarning] = useState(null)

    useEffect(() => {
        checkDuplicate()
    }, [selectedYear, selectedCategory, selectedGroup, selectedCourse, yearOfStudy])

    const checkDuplicate = async () => {
        setDuplicateWarning(null)
        if (!selectedYear || !selectedCategory || !selectedGroup || !selectedCourse || !yearOfStudy) return

        const yearObj = years.find(y => y.id.toString() === selectedYear.toString())
        if (!yearObj) return

        try {
            let query = supabase
                .from('academic_fees')
                .select('id, total_fee')
                .eq('academic_year', yearObj.academic_year)
                .eq('category', selectedCategory)
                .eq('group_id', selectedGroup)
                .eq('course_id', selectedCourse)
                .eq('year_of_study', yearOfStudy)
                .maybeSingle()

            const { data, error } = await query

            if (data) {
                // If we are editing and the found record is the one we are editing, it's not a duplicate.
                if (editingFeeId && data.id === editingFeeId) {
                    return
                }
                setDuplicateWarning(`Fee structure already exists for this combination! (Total: ₹${data.total_fee})`)
            }
        } catch (err) {
            console.error('Error checking duplicate:', err)
        }
    }

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
        fetchSavedFeeStructures()
        fetchHostelFees()
    }, [])

    const fetchHostelFees = async () => {
        try {
            const { data, error } = await supabase
                .from('hostel_fees')
                .select('*')
                .order('created_at', { ascending: false })
            if (error) throw error
            setHostelFeesList(data || [])
        } catch (error) {
            console.error('Error fetching hostel fees:', error)
        }
    }

    const fetchSavedFeeStructures = async () => {
        try {
            const { data, error } = await supabase
                .from('academic_fees')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) throw error
            setSavedFeeStructures(data || [])
        } catch (error) {
            console.error('Error fetching saved fees:', error)
        }
    }

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
                .select('group_id, group_name, group_code, Category')
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

    // Filter groups based on selected category
    const availableGroups = useMemo(() => {
        if (!selectedCategory) return []
        return groups.filter(g => g.Category === selectedCategory)
    }, [selectedCategory, groups])

    // Filter courses based on selected group
    const availableCourses = useMemo(() => {
        if (!selectedGroup) return []
        const groupObj = groups.find(g => g.group_id.toString() === selectedGroup)
        if (!groupObj) return []

        // Filter courses where group_name matches
        return courses.filter(c => c.group_name === groupObj.group_name)
    }, [selectedGroup, groups, courses])

    const handleCategoryChange = (e) => {
        setSelectedCategory(e.target.value)
        setSelectedGroup('')
        setSelectedCourse('')
        setFeeRows([])
    }

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
        setYearOfStudy('')
    }

    const handleReset = () => {
        setSelectedCategory('')
        setSelectedYear('')
        setSelectedGroup('')
        setSelectedCourse('')
        setYearOfStudy('')
        setFeeRows([])
        setDuplicateWarning(null)
        setEditingFeeId(null)
    }

    const handleEdit = async (feeStructure) => {
        try {
            setIsLoading(true)
            setShowAllFeesModal(false) // Close modal if editing from modal
            handleReset() // clear previous state content cleanly first

            // 1. Set main fields
            const yearObj = years.find(y => y.academic_year === feeStructure.academic_year)
            if (yearObj) setSelectedYear(yearObj.id.toString())

            setSelectedCategory(feeStructure.category)
            setSelectedGroup(feeStructure.group_id.toString())
            setSelectedCourse(feeStructure.course_id.toString())
            setYearOfStudy(feeStructure.year_of_study.toString())
            setEditingFeeId(feeStructure.id)

            // 2. Fetch breakdown
            const { data: breakdownData, error } = await supabase
                .from('academic_fee_breakdown')
                .select('*')
                .eq('academic_fee_id', feeStructure.id)

            if (error) throw error

            // 3. Set rows
            const rows = breakdownData.map(item => ({
                id: crypto.randomUUID(),
                categoryId: item.academic_fee_category_id,
                amount: item.amount
            }))
            setFeeRows(rows)

            window.scrollTo({ top: 0, behavior: 'smooth' })

        } catch (error) {
            console.error("Error loading fee structure for edit:", error)
            toast.error("Failed to load fee structure")
        } finally {
            setIsLoading(false)
        }
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

    const handleSubmit = async (e) => {
        e.preventDefault()

        // Validation
        if (!selectedYear || !selectedCategory || !selectedGroup || !selectedCourse || !yearOfStudy) {
            toast.error('Please fill all required fields')
            return
        }

        if (duplicateWarning) {
            toast.error('Cannot save: Fee structure already exists.')
            return
        }

        if (feeRows.length === 0) {
            toast.error('Please add at least one fee category')
            return
        }

        // Validate amounts
        const invalidRows = feeRows.some(row => !row.amount || Number(row.amount) <= 0);
        if (invalidRows) {
            toast.error('Please enter valid amounts for all fee categories');
            return;
        }

        const totalFee = feeRows.reduce((sum, row) => sum + Number(row.amount || 0), 0)

        if (totalFee <= 0) {
            toast.error('Total fee must be greater than 0')
            return
        }

        try {
            setIsLoading(true)

            // Get current user
            const { data: { user } } = await supabase.auth.getUser()

            // Get Academic Year String
            const selectedYearObj = years.find(y => y.id.toString() === selectedYear.toString())
            if (!selectedYearObj) throw new Error('Invalid academic year selected')

            let feeId = null;

            if (editingFeeId) {
                // UPDATE
                const { error: updateError } = await supabase
                    .from('academic_fees')
                    .update({
                        category: selectedCategory,
                        academic_year: selectedYearObj.academic_year,
                        year_of_study: parseInt(yearOfStudy),
                        course_id: parseInt(selectedCourse),
                        group_id: parseInt(selectedGroup),
                        total_fee: totalFee,
                        // created_by: user?.id || null // Keep original creator? Or update? Usually keep original.
                    })
                    .eq('id', editingFeeId)

                if (updateError) throw updateError
                feeId = editingFeeId

                // Delete old breakdown
                const { error: deleteError } = await supabase
                    .from('academic_fee_breakdown')
                    .delete()
                    .eq('academic_fee_id', feeId)
                if (deleteError) throw deleteError

            } else {
                // INSERT
                const { data: feeData, error: feeError } = await supabase
                    .from('academic_fees')
                    .insert([{
                        category: selectedCategory,
                        academic_year: selectedYearObj.academic_year,
                        year_of_study: parseInt(yearOfStudy),
                        course_id: parseInt(selectedCourse),
                        group_id: parseInt(selectedGroup),
                        total_fee: totalFee,
                        created_by: user?.id || null
                    }])
                    .select()
                    .single()

                if (feeError) throw feeError
                feeId = feeData.id
            }

            // 2. Insert into academic_fee_breakdown (New or Replacement)
            const breakdownData = feeRows.map(row => {
                const categoryObj = feeCategories.find(c => c.id.toString() === row.categoryId.toString())
                return {
                    academic_fee_id: feeId,
                    academic_fee_category_id: row.categoryId,
                    fee_name: categoryObj ? categoryObj.name : 'Unknown',
                    amount: Number(row.amount)
                }
            })

            const { error: breakdownError } = await supabase
                .from('academic_fee_breakdown')
                .insert(breakdownData)

            if (breakdownError) {
                if (!editingFeeId) {
                    // Only rollback if it was a new insert. If update failed here, we might be in inconsistent state (header updated, details deleted but not inserted).
                    // In a transaction this would be safe. Here difficult.
                    await supabase.from('academic_fees').delete().eq('id', feeId)
                }
                throw breakdownError
            }

            toast.success(editingFeeId ? 'Fee structure updated successfully!' : 'Fee structure saved successfully!')
            handleReset()
            fetchSavedFeeStructures() // Refresh list

        } catch (error) {
            console.error('Error saving fee structure:', error)
            toast.error(error.message || 'Failed to save fee structure')
        } finally {
            setIsLoading(false)
        }
    }

    // Hostel Fees Handlers
    const handleSaveHostelFee = async (e) => {
        e.preventDefault()
        if (!hostelYear || !hostelAmount) {
            toast.error('Please fill all required fields for Hostel Fee')
            return
        }

        try {
            setIsLoading(true)
            const { data: { user } } = await supabase.auth.getUser()
            const yearObj = years.find(y => y.id.toString() === hostelYear.toString())
            if (!yearObj) throw new Error('Invalid academic year')

            const payload = {
                academic_year: yearObj.academic_year,
                year_of_study: 1, // Defaulting to 1 as per UI hiding request
                hostel_fee: parseFloat(hostelAmount),
                created_by: user?.id || null
            }

            if (editingHostelId) {
                const { error } = await supabase
                    .from('hostel_fees')
                    .update(payload)
                    .eq('id', editingHostelId)
                if (error) throw error
                toast.success('Hostel fee updated successfully')
            } else {
                // Check duplicate
                const { data: existing } = await supabase
                    .from('hostel_fees')
                    .select('id')
                    .eq('academic_year', yearObj.academic_year)
                    .eq('year_of_study', payload.year_of_study)
                    .maybeSingle()

                if (existing) {
                    toast.error('Hostel fee for this year already exists')
                    setIsLoading(false)
                    return
                }

                const { error } = await supabase
                    .from('hostel_fees')
                    .insert([payload])
                if (error) throw error
                toast.success('Hostel fee added successfully')
            }

            setHostelYear('')
            setHostelAmount('')
            setEditingHostelId(null)
            fetchHostelFees()

        } catch (error) {
            console.error('Error saving hostel fee:', error)
            toast.error(error.message || 'Failed to save hostel fee')
        } finally {
            setIsLoading(false)
        }
    }

    const handleDeleteHostelFee = async (id) => {
        if (!window.confirm('Are you sure you want to delete this hostel fee?')) return
        try {
            const { error } = await supabase
                .from('hostel_fees')
                .delete()
                .eq('id', id)
            if (error) throw error
            toast.success('Hostel fee deleted')
            fetchHostelFees()
        } catch (error) {
            console.error('Error deleting hostel fee:', error)
            toast.error('Failed to delete hostel fee')
        }
    }

    const handleEditHostelFee = (fee) => {
        const yearObj = years.find(y => y.academic_year === fee.academic_year)
        if (yearObj) setHostelYear(yearObj.id.toString())
        setHostelAmount(fee.hostel_fee)
        setEditingHostelId(fee.id)
    }

    const handleCancelHostelEdit = () => {
        setHostelYear('')
        setHostelAmount('')
        setEditingHostelId(null)
        setShowAllHostelFeesModal(false)
    }

    const renderHostelFeeRows = (feesToRender) => {
        return feesToRender.map((fee) => (
            <tr key={fee.id}>
                <td>{fee.academic_year}</td>
                <td className="text-end fw-bold">₹{fee.hostel_fee}</td>
                <td className="text-end">
                    <div className="d-flex justify-content-end gap-2">
                        <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => handleEditHostelFee(fee)}
                        >
                            <i className="bi bi-pencil"></i>
                        </button>
                        <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleDeleteHostelFee(fee.id)}
                        >
                            <i className="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        ))
    }

    const renderFeeRows = (feesToRender) => {
        return feesToRender.map((fee) => {
            const groupName = groups.find(g => g.group_id === fee.group_id)?.group_name || 'Unknown'
            const courseName = courses.find(c => c.course_id === fee.course_id)?.course_name || 'Unknown'

            return (
                <tr key={fee.id}>
                    <td>{fee.academic_year}</td>
                    <td><span className="badge bg-light text-dark border">{fee.category}</span></td>
                    <td>{groupName}</td>
                    <td>{courseName}</td>
                    <td>{fee.year_of_study}</td>
                    <td className="text-end fw-bold">₹{fee.total_fee}</td>
                    <td className="text-end">
                        <div className="d-flex justify-content-end gap-2">
                            <button
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => handleEdit(fee)}
                            >
                                <i className="bi bi-pencil"></i>
                            </button>
                            <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={async () => {
                                    if (!window.confirm('Delete this fee structure?')) return;
                                    try {
                                        const { error: breakdownError } = await supabase
                                            .from('academic_fee_breakdown')
                                            .delete()
                                            .eq('academic_fee_id', fee.id)

                                        if (breakdownError) throw breakdownError;

                                        const { error } = await supabase
                                            .from('academic_fees')
                                            .delete()
                                            .eq('id', fee.id)

                                        if (error) throw error
                                        toast.success('Fee structure deleted')
                                        fetchSavedFeeStructures()
                                    } catch (e) {
                                        console.error(e)
                                        toast.error('Failed to delete')
                                    }
                                }}
                            >
                                <i className="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            )
        })
    }

    return (
        <AdShellAdmin
            brandTitle="ADMIN PORTAL"
            footerTitle="Admin Management Studio"
            footerSubtitle="Crafted for Vijayam College"
        >
            <div className="desktop-container fees-creation-page" style={{ overflowX: 'hidden' }}>
                <h4 className="mb-4">Fees Creation</h4>

                <div className="row g-4 justify-content-center mx-0">
                    {/* Fee Categories Section */}
                    <div className="col-12">
                        <div className="students-section-shell card card-soft mb-4">
                            <div className="students-section-shell-header mb-3">
                                <div>
                                    <h5 className="section-title mb-1" style={{ fontSize: '1.1rem' }}>Fee Categories</h5>
                                    <p className="students-section-copy mb-0">Manage the categories that can be any fee structure.</p>
                                </div>
                            </div>

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
                        {/* Fee Structure Creation Card */}
                        <div className="students-section-shell card card-soft mb-4">
                            <div className="students-section-shell-header mb-3">
                                <div className="d-flex justify-content-between align-items-center w-100">
                                    <div>
                                        <h5 className="section-title mb-1" style={{ fontSize: '1.1rem' }}>Student Fees Creation</h5>
                                        <p className="students-section-copy mb-0">Manage and create fee structures.</p>
                                    </div>
                                    <button type="button" className="btn btn-outline-light btn-sm" onClick={handleReset}>Reset</button>
                                </div>
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
                                    <div className="col-md-2">
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
                                    {/* Category */}
                                    <div className="col-md-2">
                                        <label className="form-label">Category <span className="text-danger">*</span></label>
                                        <select
                                            className="form-select"
                                            value={selectedCategory}
                                            onChange={handleCategoryChange}
                                            required
                                        >
                                            <option value="" disabled>Select Category</option>
                                            <option value="UG">UG</option>
                                            <option value="PG">PG</option>
                                        </select>
                                    </div>

                                    {/* Group */}
                                    <div className="col-md-3">
                                        <label className="form-label">Group <span className="text-secondary small">({availableGroups.length} found)</span> <span className="text-danger">*</span></label>
                                        <select
                                            className="form-select"
                                            value={selectedGroup}
                                            onChange={handleGroupChange}
                                            disabled={!selectedCategory}
                                            required
                                        >
                                            <option value="" disabled>Select Group</option>
                                            {availableGroups.map(group => (
                                                <option key={group.group_id} value={group.group_id}>{group.group_name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Course */}
                                    <div className="col-md-3">
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

                                    {/* Year of Study */}
                                    <div className="col-md-2">
                                        <label className="form-label">Year of Study <span className="text-danger">*</span></label>
                                        <select
                                            className="form-select"
                                            value={yearOfStudy}
                                            onChange={(e) => setYearOfStudy(e.target.value)}
                                            disabled={!selectedCategory}
                                            required
                                        >
                                            <option value="" disabled>Select Year</option>
                                            {selectedCategory === 'UG' && (
                                                <>
                                                    <option value="1">1</option>
                                                    <option value="2">2</option>
                                                    <option value="3">3</option>
                                                </>
                                            )}
                                            {selectedCategory === 'PG' && (
                                                <>
                                                    <option value="1">1</option>
                                                    <option value="2">2</option>
                                                </>
                                            )}
                                        </select>
                                    </div>

                                    {/* Duplicate Warning */}
                                    {duplicateWarning && (
                                        <div className="col-12">
                                            <div className="alert alert-danger d-flex align-items-center mb-0" role="alert">
                                                <i className="bi bi-exclamation-triangle-fill me-2"></i>
                                                <div>
                                                    <strong>Warning:</strong> {duplicateWarning}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Fee Categories & Inputs */}
                                    {selectedCourse && !duplicateWarning && (
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
                                                                    <span className="input-group-text">₹</span>
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
                                        {editingFeeId && (
                                            <button type="button" className="btn btn-secondary" onClick={handleReset}>Cancel Edit</button>
                                        )}
                                        <button type="submit" className="btn btn-primary" disabled={!!duplicateWarning}>
                                            {editingFeeId ? 'Update Fee Structure' : 'Save Fee Structure'}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>

                    <div className="col-12">
                        <div className="students-section-shell card card-soft mb-4">
                            <div className="students-section-shell-header mb-3">
                                <div className="d-flex justify-content-between align-items-center w-100">
                                    <h5 className="section-title mb-1" style={{ fontSize: '1.1rem' }}>Saved Fee Structures</h5>
                                    {savedFeeStructures.length > 2 && (
                                        <button
                                            className="btn btn-sm btn-outline-light"
                                            onClick={() => setShowAllFeesModal(true)}
                                        >
                                            View All
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="table-responsive">
                                <table className="table table-hover align-middle fees-creation-table">
                                    <thead className="table-light">
                                        <tr>
                                            <th>Academic Year</th>
                                            <th>Category</th>
                                            <th>Group</th>
                                            <th>Course</th>
                                            <th>Year</th>
                                            <th className="text-end">Total Fee</th>
                                            <th className="text-end">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {savedFeeStructures.length === 0 ? (
                                            <tr>
                                                <td colSpan="7" className="text-center py-4 text-muted">Thinking... No fee structures found.</td>
                                            </tr>
                                        ) : (
                                            renderFeeRows(savedFeeStructures.slice(0, 2))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>


            {/* Hostel Fees Section */}
            <div className="row g-4 justify-content-center mx-0 mt-4">
                <div className="col-12">
                    <div className="card card-soft p-4">
                        <h4 className="mb-3">Hostel Fees Management</h4>
                        <form onSubmit={handleSaveHostelFee} className="row g-3 align-items-end mb-4">
                            <div className="col-md-4">
                                <label className="form-label">Academic Year <span className="text-danger">*</span></label>
                                <select
                                    className="form-select"
                                    value={hostelYear}
                                    onChange={(e) => setHostelYear(e.target.value)}
                                    required
                                >
                                    <option value="" disabled>Select Year</option>
                                    {years.map(year => (
                                        <option key={year.id} value={year.id}>{year.academic_year}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-md-4">
                                <label className="form-label">Amount <span className="text-danger">*</span></label>
                                <div className="input-group">
                                    <span className="input-group-text">₹</span>
                                    <input
                                        type="number"
                                        className="form-control"
                                        placeholder="Enter amount"
                                        value={hostelAmount}
                                        onChange={(e) => setHostelAmount(e.target.value)}
                                        min="0"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="col-md-4">
                                <div className="d-flex gap-2">
                                    <button type="submit" className="btn btn-primary px-4">
                                        {editingHostelId ? 'Update' : 'Save'}
                                    </button>
                                    {editingHostelId && (
                                        <button type="button" className="btn btn-secondary" onClick={handleCancelHostelEdit}>Cancel</button>
                                    )}
                                </div>
                            </div>
                        </form>

                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <h5 className="mb-0">Saved Hostel Fees</h5>
                            {hostelFeesList.length > 2 && (
                                <button
                                    className="btn btn-sm btn-outline-primary"
                                    onClick={() => setShowAllHostelFeesModal(true)}
                                >
                                    View All
                                </button>
                            )}
                        </div>
                        <div className="table-responsive">
                            <table className="table table-hover align-middle fees-creation-table">
                                <thead className="table-light">
                                    <tr>
                                        <th>Academic Year</th>
                                        <th className="text-end">Amount</th>
                                        <th className="text-end">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {hostelFeesList.length === 0 ? (
                                        <tr>
                                            <td colSpan="3" className="text-center py-4 text-muted">No hostel fees found.</td>
                                        </tr>
                                    ) : (
                                        renderHostelFeeRows(hostelFeesList.slice(0, 2))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>


            {/* View All Modal */}
            {
                showAllFeesModal && (
                    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
                        <div className="modal-dialog modal-xl modal-dialog-scrollable">
                            <div className="modal-content">
                                <div className="modal-header">
                                    <h5 className="modal-title">All Fee Structures</h5>
                                    <button type="button" className="btn-close" onClick={() => setShowAllFeesModal(false)}></button>
                                </div>
                                <div className="modal-body">
                                    <div className="table-responsive">
                                        <table className="table table-hover align-middle fees-creation-table">
                                            <thead className="table-light">
                                                <tr>
                                                    <th>Academic Year</th>
                                                    <th>Category</th>
                                                    <th>Group</th>
                                                    <th>Course</th>
                                                    <th>Year</th>
                                                    <th className="text-end">Total Fee</th>
                                                    <th className="text-end">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {renderFeeRows(savedFeeStructures)}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowAllFeesModal(false)}>Close</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            <ToastContainer position="top-right" autoClose={3000} />
        </AdShellAdmin>
    )
}



