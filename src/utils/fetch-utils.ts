import fetch from 'node-fetch';
import { ConfigService } from '../services/config.service';

let configInstance: ConfigService | null = null;

const getConfig = () => {
  if (!configInstance) {
    configInstance = new ConfigService();
  }
  return configInstance;
};

export const chunks = <T extends unknown>(arr: T[], chunkSize: number) => {
  const results = [];
  for (var i = 0; i < arr.length; i += chunkSize) {
    results.push(arr.slice(i, i + chunkSize));
  }
  return results;
};

export const performRequest = async <T = void>(
  path: string,
  method: string,
  body?: any
) => {
  const { JIRA_API_DOMAIN, JIRA_API_EMAIL, JIRA_API_TOKEN } = getConfig();
  const headers = {
    Authorization: `Basic ${Buffer.from(
      `${JIRA_API_EMAIL}:${JIRA_API_TOKEN}`
    ).toString('base64')}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  const response = await fetch(
    `https://${JIRA_API_DOMAIN}.atlassian.net${path}`,
    {
      method,
      headers,
      body,
    }
  );

  if (response.status === 401) {
    throw Error('Request failed with 401 - check if credentials are valid.');
  }

  const responseBody =
    response.status === 204 ? undefined : await response.json();

  return {
    ...response,
    status: response.status,
    body: responseBody as T,
  };
};

export const performRequestWithErrorHandling = async <T = void>(
  path: string,
  method: string,
  body?: any,
  {
    throwOnError = true,
    successMessage = 'Request succeeded.',
    errorMessage = 'Request failed',
  }: {
    throwOnError?: boolean;
    successMessage?: string;
    errorMessage?: string;
  } = {}
) => {
  try {
    const response = await performRequest<T>(path, method, body);

    if (response.status >= 200 && response.status < 300) {
      console.log(successMessage, `HTTP ${response.status}`);

      return response;
    } else {
      const bodyPart = response.body
        ? `, response body: ${JSON.stringify(response.body)}`
        : '';

      throw new Error(`HTTP ${response.status}${bodyPart}`);
    }
  } catch (e) {
    console.error(errorMessage, e.mesaage);

    if (throwOnError) {
      throw e;
    }

    return undefined;
  }
};
