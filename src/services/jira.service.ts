import { IssueData, JiraIssue, JiraSearchResults } from '../types';
import { chunks, performRequest } from '../utils/fetch-utils';

export interface JiraServiceOptions {
  includeSubtasks: boolean;
}

export class JiraService {
  constructor(private options: JiraServiceOptions) {}

  async getTicketsFromAPI(
    ticketNumbers: string[],
    nextPageToken?: string,
    tickets: JiraIssue[] = []
  ): Promise<JiraIssue[]> {
    const jql = `key IN (${ticketNumbers.join(',')})`;
    const nextPageParam = nextPageToken
      ? `&nextPageToken=${encodeURIComponent(nextPageToken)}`
      : '';
    // Request parent.fields.fixVersions explicitly to get parent's fixVersions for subtasks
    const { body } = await performRequest<JiraSearchResults>(
      `/rest/api/3/search/jql?jql=${jql}&maxResults=100${nextPageParam}&fields=summary,fixVersions,issuetype,parent,parent.fields.summary,parent.fields.issuetype,parent.fields.fixVersions`,
      'GET'
    );

    if (body.warningMessages && body.warningMessages.length > 0) {
      console.warn(
        'JIRA response has warnings',
        JSON.stringify(body.warningMessages)
      );
    }

    Array.prototype.push.apply(tickets, body.issues);

    if (body.isLast) {
      return tickets;
    } else {
      return this.getTicketsFromAPI(ticketNumbers, body.nextPageToken, tickets);
    }
  }

  async fetchAndProcessTickets(ticketNumbers: string[]): Promise<{
    ticketsData: [string, IssueData][];
    rawTickets: JiraIssue[];
  }> {
    const jiraTicketResults: JiraIssue[] = [];

    for (const chunk of chunks(ticketNumbers, 20)) {
      const chunkResults = await this.getTicketsFromAPI(chunk);
      jiraTicketResults.push(...chunkResults);
    }

    const filteredData = this.getFilteredTicketData(jiraTicketResults.flat());

    // Find parent tickets that need to be fetched separately
    const parentsToFetch = Object.entries(filteredData)
      .filter(([, data]) => data._needsFetch)
      .map(([key]) => key);

    // Fetch parent tickets if needed
    if (parentsToFetch.length > 0) {
      const parentTickets = await this.getTicketsFromAPI(parentsToFetch);

      // Update the filtered data with proper parent information
      for (const parent of parentTickets) {
        if (filteredData[parent.key]) {
          filteredData[parent.key] = {
            ...filteredData[parent.key],
            fixVersions: parent.fields.fixVersions?.map((v) => v.name) ?? [],
            summary: parent.fields.summary,
            issueType: parent.fields.issuetype.name,
            _needsFetch: undefined,
          };
        }
      }
    }

    // Remove _needsFetch flag from final output
    Object.values(filteredData).forEach((data) => delete data._needsFetch);

    return {
      ticketsData: Object.entries(filteredData),
      rawTickets: jiraTicketResults,
    };
  }

  getFilteredTicketData(
    jiraTickets: JiraIssue[] = []
  ): Record<string, IssueData> {
    const tickets = jiraTickets.reduce<Record<string, IssueData>>(
      (acc, issue) => {
        const isSubtask = Boolean(issue.fields.issuetype.subtask);

        if (isSubtask) {
          return this.processSubtask(acc, issue);
        }

        return this.processRegularTask(acc, issue);
      },
      {}
    );

    return tickets;
  }

  private processSubtask(
    acc: Record<string, IssueData>,
    issue: JiraIssue
  ): Record<string, IssueData> {
    const parent = issue.fields.parent;

    if (!parent) {
      return acc;
    }

    const existingParent: IssueData | undefined = parent && acc[parent.key];

    if (!existingParent) {
      return this.createNewParentFromSubtask(acc, issue, parent);
    }

    if (this.options.includeSubtasks && parent) {
      return this.updateExistingParentWithSubtask(
        acc,
        issue,
        parent,
        existingParent
      );
    }

    return acc;
  }

  private createNewParentFromSubtask(
    acc: Record<string, IssueData>,
    issue: JiraIssue,
    issueParent: JiraIssue
  ): Record<string, IssueData> {
    const parentKey = issueParent.key;
    const parentFixVersions = issueParent.fields?.fixVersions;

    // If parent fixVersions are not available, mark with empty array
    // They will be fetched separately if needed
    return {
      ...acc,
      [parentKey]: {
        summary: issueParent.fields?.summary || 'Unknown',
        issueType: issueParent.fields?.issuetype?.name || 'Unknown',
        fixVersions: parentFixVersions?.map((v) => v.name) ?? [],
        subtasks: this.options.includeSubtasks
          ? [{ key: issue.key, summary: issue.fields.summary }]
          : [],
        _needsFetch: !parentFixVersions, // Mark if parent needs to be fetched
      },
    };
  }

  private updateExistingParentWithSubtask(
    acc: Record<string, IssueData>,
    issue: JiraIssue,
    issueParent: JiraIssue,
    existingParent: IssueData
  ): Record<string, IssueData> {
    const parentKey = issueParent.key;
    return {
      ...acc,
      [parentKey]: {
        summary: issueParent.fields.summary,
        issueType: issueParent.fields.issuetype.name,
        fixVersions: [
          ...new Set([
            ...existingParent.fixVersions,
            ...(issueParent.fields.fixVersions?.map((v) => v.name) ?? []),
          ]),
        ],
        subtasks: [
          ...existingParent.subtasks,
          {
            key: issue.key,
            summary: issue.fields.summary,
            issueType: issue.fields.issuetype.name,
          },
        ],
      },
    };
  }

  private processRegularTask(
    acc: Record<string, IssueData>,
    issue: JiraIssue
  ): Record<string, IssueData> {
    if (acc[issue.key]) {
      return acc;
    }

    return {
      ...acc,
      [issue.key]: {
        summary: issue.fields.summary,
        subtasks: [],
        fixVersions: issue.fields.fixVersions?.map((v) => v.name) ?? [],
        issueType: issue.fields.issuetype.name,
      },
    };
  }

  async fetchTasksByFixVersion(
    fixVersion: string,
    nextPageToken?: string,
    tickets: JiraIssue[] = []
  ): Promise<JiraIssue[]> {
    const jql = `fixVersion = "${fixVersion}" ORDER BY key ASC`;
    const nextPageParam = nextPageToken
      ? `&nextPageToken=${encodeURIComponent(nextPageToken)}`
      : '';

    const { body } = await performRequest<JiraSearchResults>(
      `/rest/api/3/search/jql?jql=${encodeURIComponent(
        jql
      )}&maxResults=100${nextPageParam}&fields=key,summary,issuetype,fixVersions,parent`,
      'GET'
    );

    if (body.warningMessages && body.warningMessages.length > 0) {
      console.warn(
        'JIRA response has warnings',
        JSON.stringify(body.warningMessages)
      );
    }

    Array.prototype.push.apply(tickets, body.issues);

    if (body.isLast) {
      return tickets;
    } else {
      return this.fetchTasksByFixVersion(
        fixVersion,
        body.nextPageToken,
        tickets
      );
    }
  }

  categorizeTasks(
    fixVersionTasks: JiraIssue[],
    ticketsInCommits: JiraIssue[]
  ): { missingTasks: JiraIssue[]; foundTasks: JiraIssue[] } {
    const ticketKeysInCommitsSet = new Set(ticketsInCommits.map((t) => t.key));
    const missingTasks: JiraIssue[] = [];
    const foundTasks: JiraIssue[] = [];

    // Build a map of parent keys from subtasks in commits
    const parentKeysWithSubtasksInCommits = new Set<string>();
    for (const ticket of ticketsInCommits) {
      // Check if it's a subtask by checking the issuetype name or subtask property
      const isSubtask =
        ticket.fields.issuetype?.subtask === true ||
        ticket.fields.issuetype?.name === 'Sub-task';
      const parentKey = ticket.fields.parent?.key;

      if (isSubtask && parentKey) {
        parentKeysWithSubtasksInCommits.add(parentKey);
      }
    }

    // Also check if any fixVersion task IS a subtask whose parent is in commits
    const taskKeysWhoseParentsAreInCommits = new Set<string>();
    for (const task of fixVersionTasks) {
      const isSubtask =
        task.fields.issuetype?.subtask === true ||
        task.fields.issuetype?.name === 'Sub-task';
      if (
        isSubtask &&
        task.fields.parent?.key &&
        ticketKeysInCommitsSet.has(task.fields.parent.key)
      ) {
        taskKeysWhoseParentsAreInCommits.add(task.key);
      }
    }

    // Categorize all fixVersion tasks
    for (const task of fixVersionTasks) {
      if (task.fields.issuetype.name === 'Epic') {
        continue;
      }

      const isDirectlyInCommits = ticketKeysInCommitsSet.has(task.key);
      const hasSubtaskInCommits = parentKeysWithSubtasksInCommits.has(task.key);
      const parentIsInCommits = taskKeysWhoseParentsAreInCommits.has(task.key);

      if (isDirectlyInCommits || hasSubtaskInCommits || parentIsInCommits) {
        foundTasks.push(task);
      } else {
        missingTasks.push(task);
      }
    }

    return { missingTasks, foundTasks };
  }

  async checkFixVersionCompliance(
    ticketsInCommits: JiraIssue[],
    fixVersion: string
  ): Promise<{ missingTasks: JiraIssue[]; foundTasks: JiraIssue[] }> {
    const allFixVersionTasks = await this.fetchTasksByFixVersion(fixVersion);
    return this.categorizeTasks(allFixVersionTasks, ticketsInCommits);
  }
}
