import AdminShell from '../../components/AdminShell'
import { useEffect, useState } from 'react'
import { api } from '../../lib/mockApi'

export default function Courses() {
  const [courses, setCourses] = useState([])
  const load = async () => setCourses(await api.listCourses())
  useEffect(() => { load() }, [])
  
  return (
    <AdminShell>
      <h2 className="fw-bold mb-3">Courses</h2>
      <div className="row">
        <div className="col-12">
          <div className="card card-soft p-0">
            <table className="table mb-0">
              <thead><tr><th>Course Code</th><th>Course Name</th><th>Duration</th></tr></thead>
              <tbody>
                {courses.map(c => (
                  <tr key={c.id}>
                    <td>{c.code}</td>
                    <td>{c.name}</td>
                    <td>{c.duration_years} years</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminShell>
  )
}
