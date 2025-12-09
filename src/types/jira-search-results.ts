interface Fields {
  issuetype: { subtask: boolean; name: string };
  parent?: JiraIssue;
  summary: string;
  fixVersions: { name: string }[];
}
export interface JiraIssue {
  key: string;
  fields: Fields;
}

export interface JiraSearchResults {
  isLast: boolean;
  nextPageToken?: string;
  issues: JiraIssue[];
  warningMessages?: string[];
}
