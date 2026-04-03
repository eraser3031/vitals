import type { Report } from './types'

interface VitalsAPI {
  getReports(): Promise<Report[]>
  deleteReport(filename: string): Promise<boolean>
  getReportsDir(): Promise<string>
}

interface Window {
  vitalsAPI: VitalsAPI
}
