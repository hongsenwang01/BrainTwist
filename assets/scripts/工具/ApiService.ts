import { sys, warn } from "cc";

type ApiServiceConfigData = {
  baseUrl: string;
};

type ApiRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  timeoutMs?: number;
};

const STORAGE_KEY = "brain_twist_api_service_config_v1";
const DEFAULT_BASE_URL = "http://localhost:8000";

const DEFAULT_CONFIG: ApiServiceConfigData = {
  baseUrl: DEFAULT_BASE_URL,
};

export class ApiService {
  public static configure(config: { baseUrl?: string; localBaseUrl?: string }) {
    const current = this.readConfig();
    this.writeConfig({
      baseUrl: normalizeBaseUrl(
        config.baseUrl ?? config.localBaseUrl,
        current.baseUrl,
      ),
    });
  }

  public static async requestJson<T>(
    path: string,
    options: ApiRequestOptions = {},
  ): Promise<T> {
    const config = this.readConfig();
    const requestPath = createRequestPath(path, options.query);
    return fetchJson<T>(config.baseUrl, requestPath, options);
  }

  private static readConfig(): ApiServiceConfigData {
    try {
      const rawConfig = sys.localStorage.getItem(STORAGE_KEY);
      if (!rawConfig) {
        return { ...DEFAULT_CONFIG };
      }

      const config = JSON.parse(rawConfig) as Partial<
        ApiServiceConfigData & { localBaseUrl?: string }
      >;
      return {
        baseUrl: normalizeBaseUrl(
          config.baseUrl ?? config.localBaseUrl,
          DEFAULT_CONFIG.baseUrl,
        ),
      };
    } catch (error) {
      warn(`ApiService: failed to read config, ${String(error)}.`);
      return { ...DEFAULT_CONFIG };
    }
  }

  private static writeConfig(config: ApiServiceConfigData) {
    try {
      sys.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (error) {
      warn(`ApiService: failed to save config, ${String(error)}.`);
    }
  }
}

async function fetchJson<T>(
  baseUrl: string,
  path: string,
  options: ApiRequestOptions,
) {
  const response = await fetch(`${baseUrl.replace(/\/+$/, "")}${path}`, {
    method: options.method ?? "GET",
    headers: createHeaders(options.headers),
    body: createFetchBody(options.body),
  });

  const data = await parseResponseData(response.text());
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${stringifyErrorData(data)}`);
  }

  return data as T;
}

function createHeaders(headers: Record<string, string> = {}) {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...headers,
  };
}

function createFetchBody(body: unknown) {
  if (body === undefined || body === null) {
    return undefined;
  }

  return typeof body === "string" ? body : JSON.stringify(body);
}

async function parseResponseData(dataPromise: Promise<string>) {
  const text = await dataPromise;
  return parseMaybeJson(text);
}

function parseMaybeJson(data: unknown) {
  if (typeof data !== "string") {
    return data;
  }

  if (!data) {
    return null;
  }

  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

function stringifyErrorData(data: unknown) {
  return typeof data === "string" ? data : JSON.stringify(data);
}

function createRequestPath(
  path: string,
  query: ApiRequestOptions["query"],
) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const queryString = createQueryString(query);
  return queryString ? `${normalizedPath}?${queryString}` : normalizedPath;
}

function createQueryString(query: ApiRequestOptions["query"]) {
  if (!query) {
    return "";
  }

  return Object.keys(query)
    .filter((key) => query[key] !== undefined && query[key] !== null)
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String(query[key]))}`)
    .join("&");
}

function normalizeBaseUrl(value: string | undefined, fallback: string) {
  const text = String(value ?? "").trim();
  if (!text) {
    return fallback;
  }

  if (text === "http://localhost:3000" || text === "http://127.0.0.1:3000") {
    return DEFAULT_BASE_URL;
  }

  return text.replace(/\/+$/, "");
}
