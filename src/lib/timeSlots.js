const generateTimeSlots = () => {
  const times = []
  for (let hour = 6; hour <= 18; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      if (hour === 18 && minute > 0) continue

      const time = new Date()
      time.setHours(hour, minute, 0, 0)

      const hours = hour % 12 || 12
      const ampm = hour < 12 ? 'AM' : 'PM'
      const formattedMinute = minute.toString().padStart(2, '0')
      const displayTime = `${hours}:${formattedMinute} ${ampm}`
      const value = time.toTimeString().slice(0, 5)

      times.push({ value, displayTime })
    }
  }
  return times
}

export const TIME_SLOTS = generateTimeSlots()
