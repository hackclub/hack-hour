export interface IAirtableThumbnail {
  url: string
  width: number
  height: number
}

export interface IAirtableAttachment {
  id: string
  url: string
  filename: string
  size: number
  type: string
  thumbnails?: {
    small: IAirtableThumbnail
    large: IAirtableThumbnail
    full: IAirtableThumbnail
  }
}

export interface Users {
  'Name'?: string
  'Internal ID'?: string
  'Slack ID'?: string
  'Email'?: string
  'Address'?: string
  'Sessions'?: Array<string>
  'Minutes (All)': number | string
  'Minutes (Approved)': number | string
  'Minutes (Banked)': number | string
  'Scrapbook'?: Array<string>
  'YSWS Verification User'?: Array<string>
  'Verification Status (from YSWS Verification User)': Array<string | boolean | number | Record<string, unknown>>
  'Orders'?: Array<string>
  'Record ID': number | string
  'Spent Incl. Pending (Minutes)': number | string
  'Initial Banked Minutes'?: number
  'Inital Order Refunded Minutes'?: number
  'Total Earned (Hours)': number | string
  'Balance (Minutes)': number | string
  'Settled Balance (Minutes)': number | string
  'Spent (Minutes)': number | string
  'Total Earned (Minutes)': number | string
  'Balance (Hours)': number | string
  'Settled Balance (Hours)': number | string
  'Order Count': number
  'Session Count': number
  'Verifications Count': number
  'Bag Onboarding Triggered'?: boolean
  '/shop'?: boolean
  'Minutes (Pending Approval)': number | string
  'Fraud': number | string
  'dmChannel'?: string
  'verificationDmSent'?: boolean
  'isFullUser'?: boolean
  'firstPurchaseSubmitted'?: boolean
  'finalDm'?: boolean
  'Flow Triggered By'?: 'Hedi' | 'Arcadius'
  'Created At': string
  'Manual Reach Out Assignee'?: 'Julian' | 'Nora' | 'Jasper' | 'River' | 'IGNORE'
  'Onboarding Stage': number | string
  'In Pending (Minutes)': number | string
  'Spent Fulfilled (Minutes)': number | string
  'API Authorization'?: boolean
  'Flagged'?: boolean
  'Notes'?: string
  'Minutes (Rejected)': number | string
  'verificationDm'?: boolean
  'Arcade Eligible': number | string
  'Projects'?: Array<string>
}

export interface Sessions {
  'Session ID'?: string
  'Message TS'?: string
  'Code URL'?: string
  'Control TS'?: string
  'Work'?: string
  'Minutes'?: number
  'Percentage Approved'?: number
  'Status'?: 'Approved' | 'Unreviewed' | 'Rejected' | 'Requested Re-review' | 'Banked' | 'Rejected Locked'
  'Approved Minutes': number | string
  'Reason'?: string
  'Created At'?: string
  'Activity'?: boolean
  'Evidenced'?: boolean
  'Remarks'?: string
  'User'?: Array<string>
  'Scrapbook'?: Array<string>
  'Record ID': number | string
  'First Time'?: boolean
  'TEMP: Git commits'?: string
  'View Session': { label: string; } & Record<string, unknown>
  'Scrapbook Approved': Array<string | boolean | number | Record<string, unknown>>
  'Fraud': Array<string | boolean | number | Record<string, unknown>>
  'Review Button TS'?: string
  'User: Name': Array<string | boolean | number | Record<string, unknown>>
  'User: Slack ID': Array<string | boolean | number | Record<string, unknown>>
  'TEMP: Git commits check': number | string
  'Scrapbook: Record ID': Array<string | boolean | number | Record<string, unknown>>
}

export interface Scrapbook {
  'Scrapbook TS'?: string
  'Scrapbook URL'?: string
  'Sessions'?: Array<string>
  'User'?: Array<string>
  'Attachments'?: Array<IAirtableAttachment>
  'Text'?: string
  'Record ID': number | string
  'Approved'?: boolean
  'Magic Happening'?: boolean
  'Reviewer'?: Array<string>
  'Open URL': { label: string; } & Record<string, unknown>
  'Review Start Time'?: string
  'Review End Time'?: string
  'Review Duration': number | string
  'Fraud'?: boolean
  'Review TS'?: string
  'Linked Sessions Count': number
  'Count Unreviewed Sessions': number
  'Count Reviewed Sessions': number
  'Created At': string
  'Review Interface': { label: string; } & Record<string, unknown>
  'Count Unevidenced sessions': number
  'Review Button TSs': Array<string | boolean | number | Record<string, unknown>>
  'Reviewed On'?: 'Hakkuun' | 'Airtable Interface' | 'Other'
  'TEMP: Sessions pending review check': number
  'Projects'?: Array<string>
  'TEMP: Commits': Array<string | boolean | number | Record<string, unknown>>
  'TEMP: Approved Minutes': Array<string | boolean | number | Record<string, unknown>>
  'OTJ: Sorted scraps'?: boolean
  'User: Slack ID': Array<string | boolean | number | Record<string, unknown>>
  'Reviewer: Slack ID': Array<string | boolean | number | Record<string, unknown>>
}
