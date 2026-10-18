const EN_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const EN_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']

export function calendarMonthTitle(year, monthIndex, language) {
  const name = language === 'ar' ? AR_MONTHS[monthIndex] : EN_LONG[monthIndex]
  return `${name} ${year}`
}

export function formatNamedDate(iso, language, { month = 'short' } = {}) {
  const [year, monthIndex, day] = iso.split('-').map(Number)
  if (language === 'ar') return `${day} ${AR_MONTHS[monthIndex - 1]} ${year}`
  const name = (month === 'long' ? EN_LONG : EN_SHORT)[monthIndex - 1]
  return `${name} ${day}, ${year}`
}
