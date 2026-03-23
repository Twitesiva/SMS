import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../../supabaseClient'
import { useStaffAuth } from '../../store/staffAuth'
import '../common/Auth.css'


export default function StaffLogin() {
  const nav = useNavigate()
  const { setStaff } = useStaffAuth()
  const [staffId, setStaffId] = useState('')
  const [mobile, setMobile] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onLogin = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    const cleanStaffId = staffId.trim()
    const cleanMobile = mobile.trim()

    try {
      const { data, error: fetchError } = await supabase
        .from('staff')
        .select('*')
        .eq('staff_id', cleanStaffId)
        .eq('phone', cleanMobile)

      if (fetchError) {
        setError('Unable to sign in. Please try again.')
        setLoading(false)
        return
      }

      const staffRecord = data && data.length > 0 ? data[0] : null;

      if (!staffRecord) {
        setError('Invalid Staff ID or Mobile Number')
        setLoading(false)
        return
      }

      setStaff(staffRecord)
      nav('/staff/dashboard')
    } catch (err) {
      console.error(err)
      setError('Unable to sign in. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f4f6f9', display: 'flex', flexDirection: 'column' }}>
      {/* HEADER SECTION */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/logo.png" alt="School Logo" style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover' }} />
          <div>
            <h2 style={{ margin: 0, fontWeight: '600', fontSize: '18px', color: '#1a1a1a' }}>Jazz Public School</h2>
            <p style={{ margin: 0, fontSize: '13px', color: '#666', fontWeight: '500' }}>Staff Access</p>
          </div>
        </div>
        <Link 
          to="/roles" 
          style={{
            textDecoration: 'none',
            color: '#444',
            fontSize: '14px',
            fontWeight: '500',
            border: '1px solid #ccc',
            padding: '8px 16px',
            borderRadius: '20px',
            backgroundColor: 'white'
          }}
        >
          ← Back to Roles
        </Link>
      </header>

      {/* CENTER SECTION */}
      <div style={{ textAlign: 'center', marginTop: '20px' }}>
        <h1 style={{ fontSize: '30px', fontWeight: 'bold', color: '#111', margin: '0 0 8px 0' }}>
          Staff portal login
        </h1>
        <p style={{ color: '#666', fontSize: '15px', margin: 0 }}>
          Sign in to manage users and system settings.
        </p>
      </div>

      {/* LOGIN CARD */}
      <div style={{
        width: '420px',
        margin: '40px auto',
        backgroundColor: 'white',
        borderRadius: '10px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.08)',
        overflow: 'hidden'
      }}>
        {/* Gradient Top Border */}
        <div style={{ height: '4px', background: 'linear-gradient(90deg, blue, green, yellow)', width: '100%' }}></div>
        
        <div style={{ padding: '35px 30px' }}>
          <h3 style={{ textAlign: 'center', margin: '0 0 6px 0', fontSize: '22px', fontWeight: 'bold', color: '#222' }}>
            Welcome back
          </h3>
          <p style={{ textAlign: 'center', color: '#666', marginBottom: '25px', fontSize: '14px' }}>
            Use your staff credentials to continue.
          </p>
          
          <form onSubmit={onLogin} autoComplete="off" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#333', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Staff ID
              </label>
              <input
                type="text"
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                placeholder="Enter Staff ID"
                required
                autoComplete="off"
                style={{
                  width: '100%',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  padding: '12px 14px',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#333', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Mobile Number
              </label>
              <input
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="Enter Mobile Number"
                required
                autoComplete="new-password"
                style={{
                  width: '100%',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  padding: '12px 14px',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {error && (
              <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 14px', borderRadius: '6px', fontSize: '13px' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: 'linear-gradient(90deg, #4f7cff, #5a8dee)',
                color: 'white',
                borderRadius: '6px',
                height: '45px',
                fontWeight: '600',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '15px',
                marginTop: '10px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {loading ? 'Signing in...' : 'SIGN IN'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
