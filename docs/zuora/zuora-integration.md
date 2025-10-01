# Zuora Integration

This document describes the Zuora integration for Plasmic, which allows you to connect to Zuora's REST API using OAuth 2.0 client credentials flow.

## Overview

The Zuora integration provides a way to:
- Authenticate with Zuora using OAuth 2.0 client credentials
- Make authenticated API calls to Zuora's REST API
- Use Zuora data in your Plasmic components

## Configuration

To set up the Zuora integration, you need to provide the following credentials:

### Required Fields

- **Client ID**: Your Zuora OAuth client ID
- **Client Secret**: Your Zuora OAuth client secret
- **Base URL**: The Zuora REST API base URL (e.g., `https://rest-staging2.zuora.com`)
- **Access Token URL**: The OAuth token endpoint (e.g., `https://rest-staging2.zuora.com/oauth/token`)

### Optional Fields

- **Scope(s)**: OAuth scopes for the integration (e.g., `read`, `write`)

## OAuth 2.0 Client Credentials Flow

The integration uses OAuth 2.0 client credentials flow, which is suitable for server-to-server authentication:

1. The integration sends a POST request to the token endpoint with:
   - `grant_type=client_credentials`
   - Client credentials in the Authorization header (Basic auth)
   - Optional scope parameter

2. Zuora responds with an access token

3. The access token is used for subsequent API calls with Bearer authentication

4. Tokens are automatically refreshed when they expire

## Available Operations

The Zuora integration supports standard HTTP operations:

- **GET**: Retrieve data from Zuora
- **POST**: Create new resources in Zuora
- **PUT**: Update existing resources in Zuora
- **PATCH**: Partially update resources in Zuora
- **DELETE**: Remove resources from Zuora

## Example Usage

### Getting Account Information

```javascript
// GET request to retrieve account information
const response = await zuoraDataSource.get({
  path: "v1/accounts/12345",
  headers: {
    "Content-Type": "application/json"
  }
});
```

### Creating a New Account

```javascript
// POST request to create a new account
const response = await zuoraDataSource.post({
  path: "v1/accounts",
  body: {
    name: "New Customer",
    currency: "USD",
    billToContact: {
      firstName: "John",
      lastName: "Doe",
      email: "john.doe@example.com"
    }
  }
});
```

### Updating an Account

```javascript
// PUT request to update an account
const response = await zuoraDataSource.put({
  path: "v1/accounts/12345",
  body: {
    name: "Updated Customer Name",
    currency: "EUR"
  }
});
```

## Error Handling

The integration handles common error scenarios:

- **401 Unauthorized**: Automatically refreshes the access token and retries the request
- **400 Bad Request**: Returns detailed error information from Zuora
- **Rate Limiting**: Respects Zuora's rate limits and returns appropriate error messages

## Security Considerations

- Client credentials are stored securely and encrypted
- Access tokens are cached in memory and automatically refreshed
- All API calls are made over HTTPS
- Sensitive data is not logged

## Troubleshooting

### Common Issues

1. **Invalid Client Credentials**: Verify your Client ID and Client Secret are correct
2. **Invalid Base URL**: Ensure the Base URL points to the correct Zuora environment
3. **Token Expired**: The integration automatically handles token refresh, but verify your credentials if this persists
4. **Rate Limiting**: Zuora has rate limits; consider implementing retry logic for high-volume operations

### Debug Mode

Enable debug logging to troubleshoot issues:

```javascript
// Set debug flag in your data source configuration
const zuoraDataSource = {
  // ... other config
  debug: true
};
```

## API Reference

For detailed information about Zuora's REST API, refer to the [Zuora API Documentation](https://www.zuora.com/developer/api-reference/).

## Support

For issues with the Zuora integration, please:
1. Check the troubleshooting section above
2. Verify your Zuora API credentials and configuration
3. Review Zuora's API documentation for endpoint-specific requirements
4. Contact support if the issue persists
