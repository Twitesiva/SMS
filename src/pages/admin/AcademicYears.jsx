import { useEffect, useState } from 'react'
import AdminShell from '../../components/AdminShell'
import crestPrimary from '../../assets/media/images.png'
import AcademicYearsSection from '../exam/AcademicYears'
import { api } from '../../lib/mockApi'
import { showToast } from '../../store/ui'
import { validateRequiredFields } from '../../lib/validation'

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

export default function AcademicYears() {
  const [yearForm, setYearForm] = useState({ name: '', category: '', active: true })
  const [academicYears, setAcademicYears] = useState([])
  const [editingYearId, setEditingYearId] = useState('')

  useEffect(() => {
    const loadYears = async () => {
      try {
        const rows = await api.listAcademicYears?.()
        setAcademicYears(rows || [])
      } catch (error) {
        console.error('Failed to load academic years:', error)
        showToast(error?.message || 'Failed to load academic years', { type: 'danger' })
      }
    }

    loadYears()
  }, [])

  const addYear = async () => {
    if (!validateRequiredFields({ 'Academic year name': yearForm.name })) return

    try {
      if (editingYearId) {
        const updated = await api.updateAcademicYear?.(editingYearId, {
          name: yearForm.name,
          category: yearForm.category,
          active: yearForm.active
        })
        if (updated) {
          setAcademicYears((prev) =>
            prev.map((y) => (y.id === editingYearId ? updated : y))
          )
        }
        setEditingYearId('')
      } else {
        const created = await api.addAcademicYear({
          name: yearForm.name,
          category: yearForm.category,
          active: yearForm.active
        })
        if (created) {
          setAcademicYears((prev) => [...prev, created])
        }
      }
    } catch (error) {
      console.error('Failed to save academic year:', error)
      showToast(error?.message || 'Failed to save academic year', {
        type: 'danger'
      })
    }

    setYearForm({ name: '', category: '', active: true })
  }

  const editYear = (year) => {
    setYearForm({
      name: year.name || year.academic_year || '',
      category: year.category || '',
      active: year.active ?? true
    })
    setEditingYearId(year.id)
  }

  const deleteYear = async (id) => {
    setAcademicYears((prev) => prev.filter((y) => y.id !== id))
    try {
      await api.deleteAcademicYear?.(id)
    } catch (error) {
      console.error('Error deleting academic year:', error)
      showToast(error?.message || 'Error deleting academic year', { type: 'danger' })
    }
    if (editingYearId === id) {
      setYearForm({ name: '', category: '', active: true })
      setEditingYearId('')
    }
  }

  const cancelYearEdit = () => {
    setYearForm({ name: '', category: '', active: true })
    setEditingYearId('')
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
            <p className="setup-hero-copy mb-3">Define academic years to organize fee structures and batches.</p>
            <div className="setup-hero-chips d-flex flex-wrap gap-2 justify-content-center">
              <span className="setup-hero-chip text-uppercase">SMART EXAMINATION PLATFORM</span>
              <span className="setup-hero-chip text-uppercase">ADMISSIONS CONTROL</span>
              <span className="setup-hero-chip text-uppercase">APPLICATIONS ADMIN CONSOLE</span>
            </div>
          </div>
        </section>

        <div className="row g-4 justify-content-center mx-0">
          <div className="col-12">
            <AcademicYearsSection
              yearForm={yearForm}
              setYearForm={setYearForm}
              academicYears={academicYears}
              editingYearId={editingYearId}
              addYear={addYear}
              editYear={editYear}
              deleteYear={deleteYear}
              onCancelEdit={cancelYearEdit}
            />
          </div>
        </div>
      </div>
    </AdminShell>
  )
}

