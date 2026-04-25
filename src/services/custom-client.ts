import Axios, {
  AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
  type RawAxiosRequestHeaders,
} from "axios";

type CancelablePromise<T> = Promise<T> & { cancel: () => void };

const isBrowser = typeof window !== "undefined";

const setHeader = (
  config: InternalAxiosRequestConfig,
  key: string,
  value: string,
) => {
  if (typeof config.headers.set === "function") {
    config.headers.set(key, value);
    return;
  }

  config.headers[key] = value;
};

export const AXIOS_INSTANCE = Axios.create({
  baseURL: "https://api-tick-x.nysm.work",
});

AXIOS_INSTANCE.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (!isBrowser) {
      return config;
    }

    const storageAddress = window.localStorage.getItem("wallet-address");
    if (storageAddress) {
      setHeader(config, "wallet-address", storageAddress);
    }

    return config;
  },
);

AXIOS_INSTANCE.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (!isBrowser) {
      return config;
    }

    const token = window.localStorage.getItem("token");
    if (token) {
      setHeader(config, "Authorization", `Bearer ${token}`);
    }

    return config;
  },
);

// Response interceptor to handle 401 unauthorized
AXIOS_INSTANCE.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    // Check if response status is 401
    if (error.response?.status === 401) {
      const requestUrl = error.config?.url ?? "";
      const isAuthRequest = requestUrl.startsWith("/api/auth/");

      if (isAuthRequest) {
        return Promise.reject(error);
      }

      // Expired sessions should only clear the access token.
      // The wallet can still be connected and should be able to re-login.
      if (isBrowser) {
        window.localStorage.removeItem("token");

        // Dispatch custom event so connected wallet sessions can re-authenticate.
        window.dispatchEvent(
          new CustomEvent("auth:logout", {
            detail: { reason: "token-expired", status: 401 },
          }),
        );
      }
    }

    return Promise.reject(error);
  },
);

export const customClient = <T>(
  url: string,
  options?: RequestInit,
): Promise<T> => {
  const source = Axios.CancelToken.source();
  const promise = AXIOS_INSTANCE<T>({
    url,
    method: options?.method,
    headers: options?.headers as RawAxiosRequestHeaders,
    data: options?.body,
    signal: options?.signal ?? undefined,
    cancelToken: source.token,
  }).then((response) => response.data) as CancelablePromise<T>;

  promise.cancel = () => {
    source.cancel("Query was cancelled");
  };

  return promise;
};

// In some case with react-query and swr you want to be able to override the return error type so you can also do it here like this
export type ErrorType<Error> = AxiosError<Error>;

export type BodyType<BodyData> = BodyData;
