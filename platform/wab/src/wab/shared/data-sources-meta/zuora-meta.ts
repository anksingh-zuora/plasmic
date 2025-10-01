import type { DataSource } from "@/wab/server/entities/Entities";
import {
  ArgMeta,
  DataSourceMeta,
} from "@/wab/shared/data-sources-meta/data-sources";

const COMMON_ARGS: Record<string, ArgMeta> = {
  path: {
    type: "string",
    label: "Path",
    renderProps: (dataSource) => {
      const baseUrl = dataSource.settings["baseUrl"] as string | undefined;
      return {
        prefix: baseUrl
          ? baseUrl.endsWith("/")
            ? baseUrl
            : `${baseUrl}/`
          : undefined,
        placeholder: "v1/accounts",
      };
    },
  },
  params: {
    type: "dict-string",
    label: "Params",
    description: "Query parameters to send",
  },
  headers: {
    type: "dict-string",
    label: "Headers",
    description: "Headers to send",
  },
};

export const ZUORA_META: DataSourceMeta = {
  id: "zuora",
  label: "Zuora",
  credentials: {
    clientId: {
      type: "string",
      label: "Client ID",
      required: true,
    },
    clientSecret: {
      type: "string",
      label: "Client Secret",
      required: true,
    },
  },
  settings: {
    baseUrl: {
      type: "string",
      label: "Base URL",
      required: true,
      default: "https://rest-staging2.zuora.com",
      public: true,
    },
    accessTokenUrl: {
      type: "string",
      label: "Access Token URL",
      required: true,
      default: "https://rest-staging2.zuora.com/oauth/token",
      public: true,
    },
    scope: {
      type: "string",
      label: "Scope(s)",
      description: "OAuth scopes (e.g., read, write)",
      default: "",
    },
  },
  studioOps: {},
  ops: [
    {
      name: "get",
      label: "GET",
      type: "read",
      args: {
        ...COMMON_ARGS,
      },
    },
    {
      name: "post",
      label: "POST",
      type: "write",
      args: {
        ...COMMON_ARGS,
        body: {
          type: "http-body",
          label: "Body",
        },
      },
    },
    {
      name: "put",
      label: "PUT",
      type: "write",
      args: {
        ...COMMON_ARGS,
        body: {
          type: "http-body",
          label: "Body",
        },
      },
    },
    {
      name: "delete",
      label: "DELETE",
      type: "write",
      args: {
        ...COMMON_ARGS,
      },
    },
    {
      name: "patch",
      label: "PATCH",
      type: "write",
      args: {
        ...COMMON_ARGS,
        body: {
          type: "http-body",
          label: "Body",
        },
      },
    },
  ],
};

export interface ZuoraDataSource extends DataSource {
  source: "zuora";
  credentials: {
    clientId: string;
    clientSecret: string;
  };
  settings: {
    baseUrl: string;
    accessTokenUrl: string;
    scope?: string;
  };
}
