import type { Report } from './types'

interface VitalsAPI {
  getReports(): Promise<Report[]>
  deleteReport(filename: string): Promise<boolean>
  getReportsDir(): Promise<string>
  checkSkill(): Promise<boolean>
  installSkill(): Promise<{ success: boolean; message: string }>
}

interface Window {
  vitalsAPI: VitalsAPI
}
