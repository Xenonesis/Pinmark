export interface NetworkRequestData {
  url: string;
  method: string;
  status?: number;
  requestBody?: any;
  responseBody?: any;
  timestamp: number;
  duration?: number;
  isError?: boolean;
}

export class NetworkInterceptor {
  private requests: NetworkRequestData[] = [];
  private originalFetch: typeof window.fetch;
  private originalXHR: typeof window.XMLHttpRequest;

  constructor() {
    this.originalFetch = window.fetch;
    this.originalXHR = window.XMLHttpRequest;
  }

  enable() {
    this.patchFetch();
    this.patchXHR();
  }

  disable() {
    window.fetch = this.originalFetch;
    window.XMLHttpRequest = this.originalXHR;
  }

  private addRequest(req: NetworkRequestData) {
    this.requests.push(req);
    const cutoff = Date.now() - 15000;
    this.requests = this.requests.filter(r => r.timestamp >= cutoff);
  }

  getRequests() {
    return [...this.requests];
  }

  clear() {
    this.requests = [];
  }

  private patchFetch() {
    const original = this.originalFetch;
    window.fetch = async (...args) => {
      const startTime = Date.now();
      const reqData: NetworkRequestData = {
        url: typeof args[0] === 'string' ? args[0] : (args[0] as Request).url,
        method: args[1]?.method || 'GET',
        timestamp: startTime,
      };

      try {
        if (args[1]?.body && typeof args[1].body === 'string') {
          reqData.requestBody = args[1].body.slice(0, 5000);
        }
      } catch (e) {}

      try {
        const response = await original.apply(window, args);
        reqData.duration = Date.now() - startTime;
        reqData.status = response.status;
        reqData.isError = response.status >= 400;

        if (response.headers.get('content-type')?.includes('application/json')) {
          try {
            const clone = response.clone();
            const text = await clone.text();
            reqData.responseBody = text.slice(0, 5000);
          } catch(e) {}
        }
        
        this.addRequest(reqData);
        return response;
      } catch (error) {
        reqData.duration = Date.now() - startTime;
        reqData.isError = true;
        reqData.responseBody = String(error);
        this.addRequest(reqData);
        throw error;
      }
    };
  }

  private patchXHR() {
    const original = this.originalXHR;
    const self = this;
    window.XMLHttpRequest = function() {
      const xhr = new original();
      let reqData: NetworkRequestData;
      let startTime: number;

      const originalOpen = xhr.open;
      xhr.open = function(method: string, url: string | URL, ...args: any[]) {
        reqData = {
          url: String(url),
          method: method,
          timestamp: Date.now()
        };
        return originalOpen.apply(xhr, [method, url, ...args] as any);
      };

      const originalSend = xhr.send;
      xhr.send = function(body?: Document | XMLHttpRequestBodyInit | null) {
        startTime = Date.now();
        if (body && typeof body === 'string') {
          reqData.requestBody = body.slice(0, 5000);
        }
        return originalSend.apply(xhr, [body] as any);
      };

      xhr.addEventListener('loadend', () => {
        reqData.duration = Date.now() - startTime;
        reqData.status = xhr.status;
        reqData.isError = xhr.status >= 400;
        
        const contentType = xhr.getResponseHeader('content-type');
        if (contentType && contentType.includes('application/json')) {
          if (xhr.responseText) {
            reqData.responseBody = xhr.responseText.slice(0, 5000);
          }
        }
        self.addRequest(reqData);
      });

      xhr.addEventListener('error', () => {
        reqData.duration = Date.now() - startTime;
        reqData.isError = true;
        reqData.responseBody = 'XHR Network Error';
        self.addRequest(reqData);
      });

      return xhr;
    } as any;
  }
}
