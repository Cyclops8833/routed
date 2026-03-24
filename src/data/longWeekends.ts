export interface LongWeekend {
  id: string
  name: string
  startDate: string  // YYYY-MM-DD
  endDate: string    // YYYY-MM-DD
  publicHoliday: string
  holidayDate: string
  notes: string | null
}

export const longWeekends: LongWeekend[] = [
  // 2026
  { id: 'lw-2026-labourday', name: 'Labour Day', startDate: '2026-03-07', endDate: '2026-03-09', publicHoliday: 'Labour Day', holidayDate: '2026-03-09', notes: null },
  { id: 'lw-2026-easter', name: 'Easter', startDate: '2026-04-03', endDate: '2026-04-06', publicHoliday: 'Easter Friday–Monday', holidayDate: '2026-04-03', notes: 'Good Friday to Easter Monday' },
  { id: 'lw-2026-anzac', name: 'Anzac Day', startDate: '2026-04-24', endDate: '2026-04-26', publicHoliday: 'Anzac Day', holidayDate: '2026-04-25', notes: 'Sat–Mon — Anzac Day on Sunday, Mon in lieu' },
  { id: 'lw-2026-queensbirthday', name: "Queen's Birthday", startDate: '2026-06-06', endDate: '2026-06-08', publicHoliday: "Queen's Birthday", holidayDate: '2026-06-08', notes: null },
  { id: 'lw-2026-aflgf', name: 'AFL Grand Final', startDate: '2026-09-25', endDate: '2026-09-27', publicHoliday: 'AFL Grand Final Friday', holidayDate: '2026-09-25', notes: 'Dates approximate — confirmed closer to the time' },
  { id: 'lw-2026-christmas', name: 'Christmas / New Year', startDate: '2026-12-25', endDate: '2027-01-01', publicHoliday: 'Christmas Day', holidayDate: '2026-12-25', notes: 'Christmas through New Year' },
  // 2027
  { id: 'lw-2027-australiaday', name: 'Australia Day', startDate: '2027-01-23', endDate: '2027-01-26', publicHoliday: 'Australia Day', holidayDate: '2027-01-26', notes: 'Tue holiday — long Sat–Tue stretch' },
  { id: 'lw-2027-labourday', name: 'Labour Day', startDate: '2027-03-06', endDate: '2027-03-08', publicHoliday: 'Labour Day', holidayDate: '2027-03-08', notes: null },
  { id: 'lw-2027-easter', name: 'Easter', startDate: '2027-03-26', endDate: '2027-03-29', publicHoliday: 'Easter Friday–Monday', holidayDate: '2027-03-26', notes: 'Good Friday to Easter Monday' },
  { id: 'lw-2027-anzac', name: 'Anzac Day', startDate: '2027-04-24', endDate: '2027-04-26', publicHoliday: 'Anzac Day', holidayDate: '2027-04-25', notes: 'Weekend — Sat Anzac Day, Mon in lieu' },
  { id: 'lw-2027-queensbirthday', name: "Queen's Birthday", startDate: '2027-06-12', endDate: '2027-06-14', publicHoliday: "Queen's Birthday", holidayDate: '2027-06-14', notes: null },
  { id: 'lw-2027-aflgf', name: 'AFL Grand Final', startDate: '2027-09-24', endDate: '2027-09-26', publicHoliday: 'AFL Grand Final Friday', holidayDate: '2027-09-24', notes: 'Dates approximate' },
  { id: 'lw-2027-christmas', name: 'Christmas / New Year', startDate: '2027-12-25', endDate: '2028-01-01', publicHoliday: 'Christmas Day', holidayDate: '2027-12-25', notes: 'Christmas through New Year' },
]
