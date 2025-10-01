import { makeZuoraFetcher } from "@/wab/server/data-sources/zuora-fetcher";
import { ZuoraDataSource } from "@/wab/shared/data-sources-meta/zuora-meta";
import { DataSourceId } from "@/wab/shared/ApiSchema";

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("ZuoraFetcher", () => {
  const mockDataSource = {
    id: "test-zuora" as DataSourceId,
    name: "Test Zuora",
    source: "zuora" as const,
    credentials: {
      clientId: "test-client-id",
      clientSecret: "test-client-secret",
    },
    settings: {
      baseUrl: "https://rest-staging2.zuora.com",
      accessTokenUrl: "https://rest-staging2.zuora.com/oauth/token",
      scope: "read write",
    },
  } as ZuoraDataSource;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
  });

  it("should create a ZuoraFetcher instance", () => {
    const fetcher = makeZuoraFetcher(mockDataSource);
    expect(fetcher).toBeDefined();
  });

  it("should handle token refresh", async () => {
    const fetcher = makeZuoraFetcher(mockDataSource);
    
    // Mock successful token response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: "test-access-token",
        token_type: "Bearer",
        expires_in: 3600,
        scope: "read write",
      }),
    });

    // Mock successful API response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ success: true }),
      status: 200,
      headers: new Map([["content-type", "application/json"]]),
    });

    const result = await fetcher.get({
      path: "v1/accounts",
    });

    expect(result).toEqual({
      data: {
        response: { success: true },
        statusCode: 200,
        headers: { "content-type": "application/json" },
      },
    });

    // Verify token request was made
    expect(mockFetch).toHaveBeenCalledWith(
      "https://rest-staging2.zuora.com/oauth/token",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Authorization": "Basic " + Buffer.from("test-client-id:test-client-secret").toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        }),
        body: "grant_type=client_credentials&scope=read+write",
      })
    );

    // Verify API request was made with Bearer token
    expect(mockFetch).toHaveBeenCalledWith(
      "https://rest-staging2.zuora.com/v1/accounts",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          "Authorization": "Bearer test-access-token",
          "Content-Type": "application/json",
        }),
      })
    );
  });

  it("should handle POST requests", async () => {
    const fetcher = makeZuoraFetcher(mockDataSource);
    
    // Mock successful token response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: "test-access-token",
        token_type: "Bearer",
        expires_in: 3600,
      }),
    });

    // Mock successful API response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ id: "12345", name: "Test Account" }),
      status: 201,
      headers: new Map([["content-type", "application/json"]]),
    });

    const result = await fetcher.post({
      path: "v1/accounts",
      body: {
        name: "Test Account",
        currency: "USD",
      },
    });

    expect(result).toEqual({
      data: {
        response: { id: "12345", name: "Test Account" },
        statusCode: 201,
        headers: { "content-type": "application/json" },
      },
    });

    // Verify API request was made with correct body
    expect(mockFetch).toHaveBeenCalledWith(
      "https://rest-staging2.zuora.com/v1/accounts",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Authorization": "Bearer test-access-token",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          name: "Test Account",
          currency: "USD",
        }),
      })
    );
  });

  it("should handle token request errors", async () => {
    const fetcher = makeZuoraFetcher(mockDataSource);
    
    // Mock failed token response
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => "Invalid client credentials",
    });

    await expect(fetcher.get({ path: "v1/accounts" })).rejects.toThrow(
      "Failed to get access token: Invalid client credentials"
    );
  });

  it("should handle API request errors", async () => {
    const fetcher = makeZuoraFetcher(mockDataSource);
    
    // Mock successful token response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: "test-access-token",
        token_type: "Bearer",
        expires_in: 3600,
      }),
    });

    // Mock failed API response
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => JSON.stringify({ error: "Account not found" }),
    });

    await expect(fetcher.get({ path: "v1/accounts/12345" })).rejects.toThrow();
  });
});
