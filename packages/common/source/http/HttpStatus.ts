// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Numeric HTTP status codes, named for readability.
 */
export enum HttpStatusCode {
    // 2xx Success
    Ok = 200,
    Created = 201,
    Accepted = 202,
    NoContent = 204,

    // 3xx Redirection
    MovedPermanently = 301,
    Found = 302,
    SeeOther = 303,
    NotModified = 304,
    TemporaryRedirect = 307,
    PermanentRedirect = 308,

    // 4xx Client Errors
    BadRequest = 400,
    Unauthorized = 401,
    PaymentRequired = 402,
    Forbidden = 403,
    NotFound = 404,
    MethodNotAllowed = 405,
    NotAcceptable = 406,
    RequestTimeout = 408,
    Conflict = 409,
    Gone = 410,
    UnprocessableEntity = 422,
    UpgradeRequired = 426,
    TooManyRequests = 429,

    // 5xx Server Errors
    InternalServerError = 500,
    NotImplemented = 501,
    BadGateway = 502,
    ServiceUnavailable = 503,
    GatewayTimeout = 504,
}

export enum HttpRedirectStatusCode {
    MovedPermanently = HttpStatusCode.MovedPermanently, // 301
    SeeOther = HttpStatusCode.SeeOther, // 303
    TemporaryRedirect = HttpStatusCode.TemporaryRedirect, // 307
    PermanentRedirect = HttpStatusCode.PermanentRedirect, // 308
}

// Define the type for HTTP status information
type HttpStatusInfo = {
    message: string;
    code: HttpStatusCode;
};

// Create a map of status codes to their default messages
const HttpStatusMap: Record<HttpStatusCode, HttpStatusInfo> = {
    // 2xx Success
    [HttpStatusCode.Ok]: {
        message: 'OK',
        code: HttpStatusCode.Ok,
    },
    [HttpStatusCode.Created]: {
        message: 'Created',
        code: HttpStatusCode.Created,
    },
    [HttpStatusCode.Accepted]: {
        message: 'Accepted',
        code: HttpStatusCode.Accepted,
    },
    [HttpStatusCode.NoContent]: {
        message: 'No Content',
        code: HttpStatusCode.NoContent,
    },

    // 3xx Redirection
    [HttpStatusCode.MovedPermanently]: {
        message: 'Moved Permanently',
        code: HttpStatusCode.MovedPermanently,
    },
    [HttpStatusCode.Found]: {
        message: 'Found',
        code: HttpStatusCode.Found,
    },
    [HttpStatusCode.SeeOther]: {
        message: 'See Other',
        code: HttpStatusCode.SeeOther,
    },
    [HttpStatusCode.NotModified]: {
        message: 'Not Modified',
        code: HttpStatusCode.NotModified,
    },
    [HttpStatusCode.TemporaryRedirect]: {
        message: 'Temporary Redirect',
        code: HttpStatusCode.TemporaryRedirect,
    },
    [HttpStatusCode.PermanentRedirect]: {
        message: 'Permanent Redirect',
        code: HttpStatusCode.PermanentRedirect,
    },

    // 4xx Client Errors
    [HttpStatusCode.BadRequest]: {
        message: 'Bad Request',
        code: HttpStatusCode.BadRequest,
    },
    [HttpStatusCode.Unauthorized]: {
        message: 'Unauthorized',
        code: HttpStatusCode.Unauthorized,
    },
    [HttpStatusCode.PaymentRequired]: {
        message: 'Payment Required',
        code: HttpStatusCode.PaymentRequired,
    },
    [HttpStatusCode.Forbidden]: {
        message: 'Forbidden',
        code: HttpStatusCode.Forbidden,
    },
    [HttpStatusCode.NotFound]: {
        message: 'Not Found',
        code: HttpStatusCode.NotFound,
    },
    [HttpStatusCode.MethodNotAllowed]: {
        message: 'Method Not Allowed',
        code: HttpStatusCode.MethodNotAllowed,
    },
    [HttpStatusCode.NotAcceptable]: {
        message: 'Not Acceptable',
        code: HttpStatusCode.NotAcceptable,
    },
    [HttpStatusCode.RequestTimeout]: {
        message: 'Request Timeout',
        code: HttpStatusCode.RequestTimeout,
    },
    [HttpStatusCode.Conflict]: {
        message: 'Conflict',
        code: HttpStatusCode.Conflict,
    },
    [HttpStatusCode.Gone]: {
        message: 'Gone',
        code: HttpStatusCode.Gone,
    },
    [HttpStatusCode.UnprocessableEntity]: {
        message: 'Unprocessable Entity',
        code: HttpStatusCode.UnprocessableEntity,
    },
    [HttpStatusCode.UpgradeRequired]: {
        message: 'Upgrade Required',
        code: HttpStatusCode.UpgradeRequired,
    },
    [HttpStatusCode.TooManyRequests]: {
        message: 'Too Many Requests',
        code: HttpStatusCode.TooManyRequests,
    },

    // 5xx Server Errors
    [HttpStatusCode.InternalServerError]: {
        message: 'Internal Server Error',
        code: HttpStatusCode.InternalServerError,
    },
    [HttpStatusCode.NotImplemented]: {
        message: 'Not Implemented',
        code: HttpStatusCode.NotImplemented,
    },
    [HttpStatusCode.BadGateway]: {
        message: 'Bad Gateway',
        code: HttpStatusCode.BadGateway,
    },
    [HttpStatusCode.ServiceUnavailable]: {
        message: 'Service Unavailable',
        code: HttpStatusCode.ServiceUnavailable,
    },
    [HttpStatusCode.GatewayTimeout]: {
        message: 'Gateway Timeout',
        code: HttpStatusCode.GatewayTimeout,
    },
};

// A class to handle HTTP status information
export class HttpStatus {
    // Get status info by code
    static getStatusInfo(code: HttpStatusCode): HttpStatusInfo {
        return HttpStatusMap[code];
    }

    // Get just the message for a given status code
    static getMessage(code: HttpStatusCode): string {
        return HttpStatusMap[code].message;
    }

    static isValidHttpStatus(code: number): boolean {
        return code in HttpStatusMap;
    }
}
