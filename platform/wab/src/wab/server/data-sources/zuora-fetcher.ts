import { base64StringToBuffer } from "@/wab/server/data-sources/data-utils";
import { DataSourceError } from "@/wab/shared/data-sources-meta/data-sources";
import { ZuoraDataSource } from "@/wab/shared/data-sources-meta/zuora-meta";
import { isEmpty, isNil, isString } from "lodash";
import fetch, { Response } from "node-fetch";

const DEFAULT_TIMEOUT = 175000;

export function makeZuoraFetcher(source: ZuoraDataSource) {
  return new ZuoraFetcher(source);
}

interface ZuoraTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

export class ZuoraFetcher {
  private readonly baseUrl: string;
  private readonly accessTokenUrl: string;
  private accessToken: string | null = null;
  private tokenExpiry: number | null = null;

  constructor(private source: ZuoraDataSource) {
    this.baseUrl = source.settings.baseUrl.endsWith("/")
      ? source.settings.baseUrl
      : `${source.settings.baseUrl}/`;
    this.accessTokenUrl = source.settings.accessTokenUrl;
  }

  private async getAccessToken(): Promise<string> {
    // Check if we have a valid token
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    // Request new token using client credentials flow
    const credentials = Buffer.from(
      `${this.source.credentials.clientId}:${this.source.credentials.clientSecret}`
    ).toString("base64");

    const body = new URLSearchParams({
      grant_type: "client_credentials",
    });

    // Add scope if provided
    if (this.source.settings.scope) {
      body.append("scope", this.source.settings.scope);
    }

    const response = await fetch(this.accessTokenUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
      timeout: DEFAULT_TIMEOUT,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new DataSourceError(
        `Failed to get access token: ${errorText}`,
        response.status
      );
    }

    const tokenData: ZuoraTokenResponse = await response.json();
    this.accessToken = tokenData.access_token;
    
    // Set expiry time with 5 minute buffer
    this.tokenExpiry = Date.now() + (tokenData.expires_in - 300) * 1000;

    return this.accessToken;
  }

  private async makeAuthenticatedRequest(
    url: string,
    options: any
  ): Promise<Response> {
    const token = await this.getAccessToken();
    
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
      "Authorization": `Bearer ${token}`,
    };

    return fetch(url, {
      ...options,
      headers,
      timeout: DEFAULT_TIMEOUT,
    });
  }

  async get(opts: {
    path?: string;
    params?: Record<string, string>;
    headers?: Record<string, string>;
  }) {
    const res = await this.makeAuthenticatedRequest(
      this.makePath(opts.path, opts.params),
      {
        method: "GET",
        headers: this.makeHeaders(opts.headers),
      }
    );
    return processResult(res);
  }

  async post(opts: {
    path?: string;
    body?: string | object;
    params?: Record<string, string>;
    headers?: Record<string, string>;
  }) {
    const res = await this.makeAuthenticatedRequest(
      this.makePath(opts.path, opts.params),
      {
        method: "POST",
        headers: this.makeHeaders(opts.headers),
        body: bodyToFetchBody(opts.body),
      }
    );
    return processResult(res);
  }

  async put(opts: {
    path?: string;
    body?: string | object;
    params?: Record<string, string>;
    headers?: Record<string, string>;
  }) {
    const res = await this.makeAuthenticatedRequest(
      this.makePath(opts.path, opts.params),
      {
        method: "PUT",
        headers: this.makeHeaders(opts.headers),
        body: bodyToFetchBody(opts.body),
      }
    );
    return processResult(res);
  }

  async delete(opts: {
    path?: string;
    params?: Record<string, string>;
    headers?: Record<string, string>;
  }) {
    const res = await this.makeAuthenticatedRequest(
      this.makePath(opts.path, opts.params),
      {
        method: "DELETE",
        headers: this.makeHeaders(opts.headers),
      }
    );
    return processResult(res);
  }

  async patch(opts: {
    path?: string;
    body?: string | object;
    params?: Record<string, string>;
    headers?: Record<string, string>;
  }) {
    const res = await this.makeAuthenticatedRequest(
      this.makePath(opts.path, opts.params),
      {
        method: "PATCH",
        headers: this.makeHeaders(opts.headers),
        body: bodyToFetchBody(opts.body),
      }
    );
    return processResult(res);
  }

  private makePath(path?: string, params?: Record<string, string>) {
    const fixedPath = isNil(path)
      ? ""
      : path.startsWith("/")
      ? path.slice(1)
      : path;
    const url = new URL(this.baseUrl + fixedPath);
    const searchParams = new URLSearchParams(params);
    Array.from(searchParams.entries()).forEach(([k, v]) => {
      url.searchParams.append(k, v);
    });
    return url.toString();
  }

  private makeHeaders(headers?: Record<string, string>): Record<string, string> {
    return {
      "Content-Type": "application/json",
      ...headers,
    };
  }
}

async function processResult(res: Response) {
  let processedResponse: string | any = await res.text();
  const statusCode = res.status;
  try {
    processedResponse = JSON.parse(processedResponse);
  } catch {}
  if (statusCode >= 400) {
    throw new DataSourceError(
      isString(processedResponse) || !isEmpty(processedResponse)
        ? processedResponse
        : undefined,
      statusCode
    );
  }
  return {
    data: {
      response: processedResponse,
      statusCode,
      headers: Object.fromEntries(res.headers.entries()),
    },
  };
}

function bodyToFetchBody(body?: string | object) {
  if (body == null) {
    return undefined;
  } else if (typeof body === "object") {
    return JSON.stringify(body);
  } else if (body.startsWith("@binary")) {
    return base64StringToBuffer(body.slice("@binary".length));
  } else {
    return body;
  }
}
