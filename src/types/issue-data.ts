export interface IssueData {
  summary: string;
  subtasks: { key: string; summary: string; issueType?: string }[];
  fixVersions: string[];
  issueType: string;
  _needsFetch?: boolean;
}
