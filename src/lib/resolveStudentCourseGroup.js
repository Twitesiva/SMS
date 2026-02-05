export const resolveStudentCourseGroup = async (supabase, studentRow) => {
  if (!studentRow) return studentRow

  const isNumeric = (value) => String(value ?? '').trim() !== '' && !Number.isNaN(Number(value))

  const courseId = studentRow.course_id || (isNumeric(studentRow.course_name) ? Number(studentRow.course_name) : null)
  const groupId = studentRow.group_id || (isNumeric(studentRow.group_name) ? Number(studentRow.group_name) : null)

  const resolveCourse = async () => {
    const select = 'course_name, course_code'
    if (courseId) {
      const { data } = await supabase.from('courses').select(select).eq('course_id', courseId).maybeSingle()
      if (data) return data
    }
    if (studentRow.course_name) {
      const { data: byIdString } = await supabase.from('courses').select(select).eq('course_id', String(studentRow.course_name)).maybeSingle()
      if (byIdString) return byIdString
      const { data: byCode } = await supabase.from('courses').select(select).eq('course_code', String(studentRow.course_name)).maybeSingle()
      if (byCode) return byCode
    }
    return null
  }

  const resolveGroup = async () => {
    const select = 'group_name, group_code'
    if (groupId) {
      const { data } = await supabase.from('groups').select(select).eq('group_id', groupId).maybeSingle()
      if (data) return data
    }
    if (studentRow.group_name) {
      const { data: byIdString } = await supabase.from('groups').select(select).eq('group_id', String(studentRow.group_name)).maybeSingle()
      if (byIdString) return byIdString
      const { data: byCode } = await supabase.from('groups').select(select).eq('group_code', String(studentRow.group_name)).maybeSingle()
      if (byCode) return byCode
    }
    return null
  }

  const [courseRow, groupRow] = await Promise.all([resolveCourse(), resolveGroup()])

  const course_display = courseRow?.course_name || courseRow?.course_code || studentRow.course_name
  const group_display = groupRow?.group_name || groupRow?.group_code || studentRow.group_name

  return {
    ...studentRow,
    course_display,
    group_display
  }
}
