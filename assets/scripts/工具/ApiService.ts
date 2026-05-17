import { sys, warn } from "cc";

export type ApiServiceMode = "local" | "cloud";

type ApiServiceConfigData = {
  mode: ApiServiceMode;
  localBaseUrl: string;
  cloudBaseUrl: string;
  cloudEnvId: string;
  cloudServiceId: string;
};

type ApiRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  timeoutMs?: number;
};

type DouyinCloudResponse = {
  statusCode?: number;
  status?: number;
  data?: unknown;
  header?: Record<string, string>;
};

const STORAGE_KEY = "brain_twist_api_service_config_v1";
const DEFAULT_LOCAL_BASE_URL = "http://localhost:8000";
const DEFAULT_CLOUD_BASE_URL = "";
const DEFAULT_CLOUD_ENV_ID = "env-5WR869esJh";
const DEFAULT_CLOUD_SERVICE_ID = "1m1m8q7pj63uu";

const DEFAULT_CONFIG: ApiServiceConfigData = {
  mode: "local",
  localBaseUrl: DEFAULT_LOCAL_BASE_URL,
  cloudBaseUrl: DEFAULT_CLOUD_BASE_URL,
  cloudEnvId: DEFAULT_CLOUD_ENV_ID,
  cloudServiceId: DEFAULT_CLOUD_SERVICE_ID,
};

export class ApiService {
  public static configure(config: Partial<Omit<ApiServiceConfigData, "mode">>) {
    const current = this.readConfig();
    this.writeConfig({
      ...current,
      localBaseUrl: normalizeBaseUrl(config.localBaseUrl, current.localBaseUrl),
      cloudBaseUrl: normalizeBaseUrl(config.cloudBaseUrl, current.cloudBaseUrl),
      cloudEnvId: normalizeText(config.cloudEnvId, current.cloudEnvId),
      cloudServiceId: normalizeText(config.cloudServiceId, current.cloudServiceId),
    });
  }

  public static getMode() {
    return this.readConfig().mode;
  }

  public static setMode(mode: ApiServiceMode) {
    const current = this.readConfig();
    if (current.mode === mode) {
      return;
    }

    this.writeConfig({
      ...current,
      mode,
    });
  }

  public static toggleMode() {
    const nextMode: ApiServiceMode = this.getMode() === "local" ? "cloud" : "local";
    this.setMode(nextMode);
    return nextMode;
  }

  public static getModeDisplayName() {
    return this.getMode() === "local" ? "本地" : "云端";
  }

  public static async requestJson<T>(
    path: string,
    options: ApiRequestOptions = {},
  ): Promise<T> {
    const config = this.readConfig();
    const requestPath = createRequestPath(path, options.query);

    if (config.mode === "cloud") {
      if (canUseDouyinCloud()) {
        return callDouyinContainer<T>(config, requestPath, options);
      }

      if (config.cloudBaseUrl) {
        return fetchJson<T>(config.cloudBaseUrl, requestPath, options);
      }

      throw new Error(
        "Douyin cloud API is unavailable. Run in Douyin or set cloudBaseUrl.",
      );
    }

    return fetchJson<T>(config.localBaseUrl, requestPath, options);
  }

  private static readConfig(): ApiServiceConfigData {
    try {
      const rawConfig = sys.localStorage.getItem(STORAGE_KEY);
      if (!rawConfig) {
        return { ...DEFAULT_CONFIG };
      }

      const config = JSON.parse(rawConfig) as Partial<ApiServiceConfigData>;
      return {
        mode: config.mode === "cloud" ? "cloud" : "local",
        localBaseUrl: normalizeBaseUrl(
          config.localBaseUrl,
          DEFAULT_CONFIG.localBaseUrl,
        ),
        cloudBaseUrl: normalizeBaseUrl(
          config.cloudBaseUrl,
          DEFAULT_CONFIG.cloudBaseUrl,
        ),
        cloudEnvId: normalizeText(config.cloudEnvId, DEFAULT_CONFIG.cloudEnvId),
        cloudServiceId: normalizeText(
          config.cloudServiceId,
          DEFAULT_CONFIG.cloudServiceId,
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

async function callDouyinContainer<T>(
  config: ApiServiceConfigData,
  path: string,
  options: ApiRequestOptions,
) {
  const tt = (globalThis as unknown as { tt?: any }).tt;
  const cloud = tt.createCloud({
    envID: config.cloudEnvId,
    serviceID: config.cloudServiceId,
  });

  const response = await new Promise<DouyinCloudResponse>((resolve, reject) => {
    cloud.callContainer({
      path,
      init: {
        method: options.method ?? "GET",
        header: createHeaders(options.headers),
        body: createFetchBody(options.body),
        timeout: options.timeoutMs ?? 30000,
      },
      success: resolve,
      fail: reject,
    });
  });

  const status = Number(response.statusCode ?? response.status ?? 200);
  const data = parseMaybeJson(response.data);
  if (status < 200 || status >= 300) {
    throw new Error(`Douyin cloud HTTP ${status}: ${stringifyErrorData(data)}`);
  }

  return data as T;
}

function canUseDouyinCloud() {
  const tt = (globalThis as unknown as { tt?: { createCloud?: unknown } }).tt;
  return typeof tt?.createCloud === "function";
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

function normalizeText(value: string | undefined, fallback: string) {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function normalizeBaseUrl(value: string | undefined, fallback: string) {
  const text = String(value ?? "").trim();
  if (!text) {
    return fallback;
  }

  if (text === "http://localhost:3000" || text === "http://127.0.0.1:3000") {
    return DEFAULT_LOCAL_BASE_URL;
  }

  return text.replace(/\/+$/, "");
}
